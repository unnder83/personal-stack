from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AppError
from app.core.security import create_access_token
from app.db.session import get_db
from app.modules.auth import service
from app.modules.auth.deps import ACCESS_TOKEN_COOKIE, get_current_user
from app.modules.auth.models import User
from app.modules.auth.rate_limit import login_limiter
from app.modules.auth.schemas import LoginRequest, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=UserOut)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_db),
) -> User:
    client_ip = request.client.host if request.client else "unknown"
    if login_limiter.is_blocked(client_ip):
        raise AppError("rate_limited", "登录尝试过于频繁，请稍后再试", 429)
    user = await service.authenticate(session, payload.username, payload.password)
    if user is None:
        login_limiter.record_failure(client_ip)
        raise AppError("invalid_credentials", "用户名或密码错误", 401)
    login_limiter.reset(client_ip)
    token = create_access_token(user.id)
    response.set_cookie(
        ACCESS_TOKEN_COOKIE,
        token,
        max_age=settings.access_token_expire_days * 24 * 3600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )
    return user


@router.post("/logout")
async def logout(response: Response) -> dict[str, str]:
    response.delete_cookie(ACCESS_TOKEN_COOKIE, path="/")
    return {"status": "ok"}


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
