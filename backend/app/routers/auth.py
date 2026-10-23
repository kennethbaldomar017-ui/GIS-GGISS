from datetime import datetime, timedelta, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials
from jose import JWTError
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ..config import get_settings
from ..database import get_db
from ..middleware.rbac import bearer, get_current_user, verify_superadmin_password
from ..models import Barangay, User, ActivityLog
from ..models.entities import ActivityLogType
from ..schemas.common import LoginRequest, TokenResponse, UserRead
from ..utils.security import create_access_token, create_refresh_token, decode_token, verify_password
from ..services.security_service import (
    record_failed_login,
    check_account_locked,
    reset_failed_login_attempts,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def user_payload(user: User, barangay_name: str | None = None) -> dict:
    return {"id": str(user.id), "username": user.username, "email": user.email, "role": user.role.value, "barangay_id": str(user.barangay_id) if user.barangay_id else None, "barangay_name": barangay_name}


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    ip_address = request.client.host if request.client else "unknown"
    
    # Find user
    user = await db.scalar(select(User).where(User.username == body.username))
    
    # Check if account is locked
    if user:
        is_locked, lock_message = await check_account_locked(db, user)
        if is_locked:
            raise HTTPException(status_code=429, detail=lock_message)
    
    # Verify password and user active status
    if not user or not verify_password(body.password, user.password_hash) or not user.is_active:
        # Record failed login
        _, message = await record_failed_login(
            db=db,
            username=body.username,
            ip_address=ip_address,
            user_id=user.id if user else None,
        )
        raise HTTPException(status_code=401, detail=message)
    
    # Reset failed login attempts on successful login
    await reset_failed_login_attempts(db, user)
    
    # Update last login and create activity log
    user.last_login = datetime.now(timezone.utc)
    log = ActivityLog(
        user_id=user.id,
        barangay_id=user.barangay_id,
        action_type=ActivityLogType.auth,
        action="login",
        details={"ip_address": ip_address, "username": user.username},
        ip_address=ip_address
    )
    db.add(user)
    db.add(log)
    await db.commit()
    
    # Build response
    extra = {"role": user.role.value, "barangay_id": str(user.barangay_id) if user.barangay_id else None}
    brgy = await db.get(Barangay, user.barangay_id) if user.barangay_id else None
    
    return TokenResponse(
        access_token=create_access_token(str(user.id), extra),
        refresh_token=create_refresh_token(str(user.id), extra),
        user=user_payload(user, brgy.name if brgy else None)
    )


@router.post("/refresh")
async def refresh(credentials: HTTPAuthorizationCredentials = Depends(bearer), db: AsyncSession = Depends(get_db)):
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.get(User, UUID(payload["sub"]))
    except (JWTError, KeyError, TypeError) as exc:
        raise HTTPException(status_code=401, detail="Invalid refresh token") from exc
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Inactive user")
    return {"access_token": create_access_token(str(user.id), {"role": user.role.value}), "token_type": "bearer"}


@router.post("/logout")
async def logout(request: Request, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    log = ActivityLog(user_id=user.id, barangay_id=user.barangay_id, action_type=ActivityLogType.auth, action="logout", details={"ip_address": ip, "username": user.username}, ip_address=ip)
    db.add(log)
    await db.commit()
    return {"ok": True}


class VerifyPasswordIn(BaseModel):
    password: str


@router.post("/verify-password")
async def verify_password_endpoint(
    body: VerifyPasswordIn,
    user: User = Depends(get_current_user),
):
    """Step-up re-auth check used by the frontend password-gate modal.

    Only reports on the caller's own password, so it leaks nothing.
    Returns 403 INVALID_PASSWORD on mismatch (never 401 — see
    middleware.rbac.verify_superadmin_password for why)."""
    await verify_superadmin_password(body.password, user)
    return {"ok": True, "username": user.username}


@router.get("/me")
async def me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    brgy = await db.get(Barangay, user.barangay_id) if user.barangay_id else None
    return {
        "id": str(user.id),
        "username": user.username,
        "email": user.email,
        "role": user.role.value,
        "barangay_id": str(user.barangay_id) if user.barangay_id else None,
        "barangay_name": brgy.name if brgy else None,
        "is_active": user.is_active,
    }
