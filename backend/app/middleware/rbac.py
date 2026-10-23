from uuid import UUID
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from jose import JWTError
from ..database import get_db
from ..models import User
from ..models.entities import UserRole
from ..utils.security import decode_token, verify_password

bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Validates JWT token and returns the current authenticated user.
    
    Used by: ALL protected endpoints
    Raises: 401 if token is missing, invalid, or user is inactive
    """
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = payload.get("sub")
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc
    user = await db.get(User, UUID(user_id))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Inactive or missing user")
    return user


async def require_super_admin(user: User = Depends(get_current_user)) -> User:
    """
    Ensures the current user has super_admin role.
    
    Used by: SuperAdmin-only endpoints (user management, system settings, city-wide features)
    Raises: 403 if user is not a super_admin
    
    Example:
        @router.post("/api/users")
        async def create_user(user: User = Depends(require_super_admin)):
            # Only superadmins can create users
            pass
    """
    if user.role != UserRole.super_admin:
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user


async def verify_superadmin_password(
    password: str | None,
    user: User,
) -> None:
    """
    Step-up re-authentication for destructive superadmin actions.

    The caller must already be a super_admin (use with require_super_admin);
    this additionally proves the operator still knows the account password,
    so a stolen/leaked JWT alone cannot reset, lock or delete user accounts.

    Raises: 403 with detail "INVALID_PASSWORD" if the password is wrong.

    NOTE: intentionally returns 403, never 401. The frontend axios
    interceptor (lib/api.ts) treats any 401 as an expired session and
    silently retries after a token refresh, which would mask this error.
    """
    if not password or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=403, detail="INVALID_PASSWORD")


async def require_admin(user: User = Depends(get_current_user)) -> User:
    """
    Ensures the current user has admin role (NOT super_admin).
    
    Used by: Admin-specific endpoints (rarely needed, most endpoints use get_current_user)
    Raises: 403 if user is not an admin
    """
    if user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def assert_barangay_scope(user: User, barangay_id: UUID | None) -> None:
    """
    Ensures admin users can only access resources from their assigned barangay.
    SuperAdmins can access any barangay.
    
    Used by: Endpoints that access specific barangay resources (children, measurements, etc.)
    Raises: 403 if admin tries to access resource outside their barangay
    
    Example:
        @router.get("/api/children/{child_id}")
        async def get_child(child_id: UUID, user: User = Depends(get_current_user)):
            child = await db.get(Child, child_id)
            assert_barangay_scope(user, child.barangay_id)  # ← Check scope
            return child
    """
    if user.role == UserRole.admin and barangay_id and user.barangay_id != barangay_id:
        raise HTTPException(status_code=403, detail="Outside barangay scope")


def scoped_barangay_filter(stmt, model, user: User):
    """
    Automatically filters query to only include resources from admin's barangay.
    SuperAdmins see all barangays.
    
    Used by: List/query endpoints that return multiple records
    Returns: Modified SQL statement with barangay filter applied (if admin)
    
    Example:
        @router.get("/api/children")
        async def list_children(user: User = Depends(get_current_user)):
            stmt = select(Child)
            stmt = scoped_barangay_filter(stmt, Child, user)  # ← Auto-filter
            return await db.execute(stmt)
    """
    if user.role == UserRole.admin:
        return stmt.where(model.barangay_id == user.barangay_id)
    return stmt


def is_super_admin(user: User) -> bool:
    """
    Helper function to check if user is super_admin.
    
    Returns: True if user is super_admin, False otherwise
    
    Example:
        if is_super_admin(user):
            # Show city-wide data
        else:
            # Show barangay data only
    """
    return user.role == UserRole.super_admin


def is_admin(user: User) -> bool:
    """
    Helper function to check if user is admin.
    
    Returns: True if user is admin, False otherwise
    """
    return user.role == UserRole.admin


def get_accessible_barangay_ids(user: User) -> list[UUID] | None:
    """
    Returns list of barangay IDs the user can access.
    
    Returns: 
        - None for super_admin (can access all)
        - [barangay_id] for admin (can access only their barangay)
    
    Example:
        barangay_ids = get_accessible_barangay_ids(user)
        if barangay_ids:
            stmt = stmt.where(Child.barangay_id.in_(barangay_ids))
    """
    if user.role == UserRole.super_admin:
        return None  # Can access all
    elif user.role == UserRole.admin and user.barangay_id:
        return [user.barangay_id]
    return []

