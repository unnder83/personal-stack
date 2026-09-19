from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.security import decode_access_token
from app.db.session import get_db
from app.modules.auth.models import User

ACCESS_TOKEN_COOKIE = "access_token"


async def get_current_user(
    request: Request, session: AsyncSession = Depends(get_db)
) -> User:
    token = request.cookies.get(ACCESS_TOKEN_COOKIE)
    if not token:
        raise AppError("unauthorized", "未登录", 401)
    payload = decode_access_token(token)
    if payload is None or "sub" not in payload:
        raise AppError("unauthorized", "登录状态无效，请重新登录", 401)
    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        raise AppError("unauthorized", "登录状态无效，请重新登录", 401) from None
    user = await session.get(User, user_id)
    if user is None or not user.is_active:
        raise AppError("unauthorized", "账号不可用", 401)
    return user
