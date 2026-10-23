from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..middleware.rbac import require_super_admin, get_current_user, verify_superadmin_password
from ..models import User, Barangay
from ..models.entities import UserRole, AccountStatus
from ..schemas.common import UserCreate, UserRead
from ..utils.security import hash_password
from ..services.websocket import manager

router = APIRouter(prefix="/api/users", tags=["users"])


async def assert_barangay_slot_free(
    db: AsyncSession,
    barangay_id: UUID | None,
    exclude_user_id: UUID | None = None,
) -> None:
    """One active admin per barangay.

    Raises 409 BARANGAY_HAS_ADMIN if another active admin is already
    assigned to this barangay. Deactivated admins free the slot.

    Checks by barangay_id only, so barangays excluded from the public
    list (e.g. Concepcion) are still enforced.
    """
    if not barangay_id:
        return
    stmt = select(User).where(
        User.role == UserRole.admin,
        User.barangay_id == barangay_id,
        User.is_active.is_(True),
    )
    if exclude_user_id:
        stmt = stmt.where(User.id != exclude_user_id)
    if await db.scalar(stmt):
        raise HTTPException(status_code=409, detail="BARANGAY_HAS_ADMIN")


async def assert_super_admin_slot_free(
    db: AsyncSession,
    exclude_user_id: UUID | None = None,
) -> None:
    """Only one active super_admin may exist.

    Raises 409 SUPER_ADMIN_EXISTS when another active super_admin is
    already registered. Deactivating that account frees the slot.
    """
    stmt = select(User).where(
        User.role == UserRole.super_admin,
        User.is_active.is_(True),
    )
    if exclude_user_id:
        stmt = stmt.where(User.id != exclude_user_id)
    if await db.scalar(stmt):
        raise HTTPException(status_code=409, detail="SUPER_ADMIN_EXISTS")


@router.get("")
async def list_users(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role.value == "super_admin":
        users = list((await db.scalars(select(User).order_by(User.username))).all())
    elif user.role.value == "admin":
        users = list((await db.scalars(select(User).where(User.barangay_id == user.barangay_id).order_by(User.username))).all())
    else:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Enrich with barangay names
    result = []
    for u in users:
        # Get barangay name
        barangay_name = None
        if u.barangay_id:
            brgy = await db.get(Barangay, u.barangay_id)
            barangay_name = brgy.name if brgy else None
        
        result.append({
            "id": str(u.id),
            "username": u.username,
            "email": u.email,
            "role": u.role.value,
            "barangay_id": str(u.barangay_id) if u.barangay_id else None,
            "barangay_name": barangay_name,
            "is_active": u.is_active,
            "account_status": u.account_status.value if hasattr(u.account_status, 'value') else str(u.account_status),
            "last_login": u.last_login.isoformat() if u.last_login else None,
        })
    
    return result


@router.post("", response_model=UserRead)
async def create_user(body: UserCreate, db: AsyncSession = Depends(get_db), actor: User = Depends(require_super_admin)):
    await verify_superadmin_password(body.current_password, actor)
    if body.role == UserRole.admin.value:
        await assert_barangay_slot_free(db, body.barangay_id)
    elif body.role == UserRole.super_admin.value:
        await assert_super_admin_slot_free(db)
    user = User(username=body.username, email=body.email, password_hash=hash_password(body.password), role=UserRole(body.role), barangay_id=body.barangay_id)
    db.add(user)
    await db.commit()
    await manager.broadcast("refetch_data")
    await db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserRead)
async def get_user(user_id: UUID, db: AsyncSession = Depends(get_db), _=Depends(require_super_admin)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return user


@router.put("/{user_id}", response_model=UserRead)
async def update_user(user_id: UUID, body: UserCreate, db: AsyncSession = Depends(get_db), actor: User = Depends(require_super_admin)):
    await verify_superadmin_password(body.current_password, actor)
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if body.role == UserRole.admin.value:
        await assert_barangay_slot_free(db, body.barangay_id, exclude_user_id=user_id)
    elif body.role == UserRole.super_admin.value:
        await assert_super_admin_slot_free(db, exclude_user_id=user_id)
    user.username, user.email, user.role, user.barangay_id = body.username, body.email, UserRole(body.role), body.barangay_id
    if body.password:
        user.password_hash = hash_password(body.password)
    await db.commit()
    await manager.broadcast("refetch_data")
    await db.refresh(user)
    return user


class DeleteUserIn(BaseModel):
    current_password: str


@router.delete("/{user_id}")
async def delete_user(user_id: UUID, body: DeleteUserIn, db: AsyncSession = Depends(get_db), actor: User = Depends(require_super_admin)):
    await verify_superadmin_password(body.current_password, actor)
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    user.is_active = False
    await db.commit()
    await manager.broadcast("refetch_data")
    return {"ok": True}


class ResetPasswordIn(BaseModel):
    current_password: str
    new_password: str | None = None


@router.post("/{user_id}/reset-password")
async def reset_password(user_id: UUID, body: ResetPasswordIn, db: AsyncSession = Depends(get_db), actor: User = Depends(require_super_admin)):
    await verify_superadmin_password(body.current_password, actor)
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    password = body.new_password or "Admin@123"
    user.password_hash = hash_password(password)
    await db.commit()
    await manager.broadcast("refetch_data")
    return {"temporary_password": password}


class AccountStatusIn(BaseModel):
    account_status: str
    current_password: str


@router.patch("/{user_id}/account-status", response_model=UserRead)
async def update_account_status(user_id: UUID, body: AccountStatusIn, db: AsyncSession = Depends(get_db), actor: User = Depends(require_super_admin)):
    await verify_superadmin_password(body.current_password, actor)
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    try:
        user.account_status = AccountStatus(body.account_status)
    except ValueError:
        raise HTTPException(400, f"Invalid account_status. Must be one of: {[s.value for s in AccountStatus]}")
    await db.commit()
    await db.refresh(user)
    return user
