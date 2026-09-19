from sqlalchemy import text

from app.modules.auth.models import User


async def test_users_table_exists_after_migration(db_session):
    result = await db_session.execute(
        text(
            "SELECT COUNT(*) FROM information_schema.tables "
            "WHERE table_schema = DATABASE() AND table_name = 'users'"
        )
    )

    assert result.scalar_one() == 1


async def test_user_roundtrip(db_session):
    user = User(username="alice", password_hash="hash-value")
    db_session.add(user)
    await db_session.flush()

    loaded = await db_session.get(User, user.id)

    assert loaded is not None
    assert loaded.username == "alice"
    assert loaded.is_active is True
    assert loaded.created_at is not None
