from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_dummy_password, verify_password
from app.modules.auth.models import User


async def get_user_by_username(session: AsyncSession, username: str) -> User | None:
    result = await session.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def authenticate(session: AsyncSession, username: str, password: str) -> User | None:
    user = await get_user_by_username(session, username)
    if user is None:
        verify_dummy_password(password)
        return None
    if not verify_password(password, user.password_hash):
        return None
    if not user.is_active:
        return None
    return user


async def ensure_admin(session: AsyncSession, username: str, password: str) -> User:
    user = await get_user_by_username(session, username)
    if user is not None:
        return user
    user = User(username=username, password_hash=hash_password(password))
    session.add(user)
    await session.commit()
    return user
