from app.core.security import hash_password
from app.modules.auth.models import User
from app.modules.auth.service import authenticate, ensure_admin, get_user_by_username


async def test_get_user_by_username(db_session):
    db_session.add(User(username="alice", password_hash=hash_password("secret123")))
    await db_session.flush()

    found = await get_user_by_username(db_session, "alice")
    missing = await get_user_by_username(db_session, "nobody")

    assert found is not None
    assert found.username == "alice"
    assert missing is None


async def test_authenticate_success(db_session):
    db_session.add(User(username="alice", password_hash=hash_password("secret123")))
    await db_session.flush()

    user = await authenticate(db_session, "alice", "secret123")

    assert user is not None
    assert user.username == "alice"


async def test_authenticate_wrong_password(db_session):
    db_session.add(User(username="alice", password_hash=hash_password("secret123")))
    await db_session.flush()

    assert await authenticate(db_session, "alice", "wrong") is None


async def test_authenticate_unknown_user(db_session):
    assert await authenticate(db_session, "nobody", "whatever") is None


async def test_authenticate_rejects_inactive_user(db_session):
    db_session.add(
        User(username="alice", password_hash=hash_password("secret123"), is_active=False)
    )
    await db_session.flush()

    assert await authenticate(db_session, "alice", "secret123") is None


async def test_ensure_admin_creates_user(db_session):
    user = await ensure_admin(db_session, "admin", "secret123")

    assert user.id is not None
    assert user.username == "admin"
    assert user.is_active is True


async def test_ensure_admin_is_idempotent(db_session):
    first = await ensure_admin(db_session, "admin", "secret123")
    original_hash = first.password_hash

    second = await ensure_admin(db_session, "admin", "another-password")

    assert second.id == first.id
    assert second.password_hash == original_hash
