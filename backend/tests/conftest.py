import os
import subprocess
import sys

import httpx
import pytest
from httpx import ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault(
    "DATABASE_URL", "mysql+asyncmy://app:dev-app-password@127.0.0.1:3306/personal_stack_test"
)
os.environ.setdefault("COOKIE_SECURE", "false")

from app.core.config import settings  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _run_alembic(*args: str, check: bool = True) -> None:
    env = os.environ.copy()
    env["DATABASE_URL"] = settings.database_url
    subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND_DIR,
        env=env,
        check=check,
        capture_output=True,
    )


def _assert_test_database(url: str) -> None:
    database_name = url.rsplit("/", 1)[-1].split("?", 1)[0]
    if not database_name.endswith("_test"):
        raise RuntimeError(
            f"拒绝在非测试库上执行迁移：{database_name}（库名必须以 _test 结尾）"
        )


@pytest.fixture(scope="session", autouse=True)
def migrated_database():
    _assert_test_database(settings.database_url)
    # 先回退再升级：同时验证 downgrade 与 upgrade 都可用。
    # 空库（无 alembic_version 表）时 downgrade 可能报错，忽略即可。
    _run_alembic("downgrade", "base", check=False)
    _run_alembic("upgrade", "head")
    yield


@pytest.fixture
async def db_engine():
    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    yield engine
    await engine.dispose()


@pytest.fixture
async def db_session(db_engine):
    async with db_engine.connect() as connection:
        transaction = await connection.begin()
        session = AsyncSession(
            bind=connection,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )
        try:
            yield session
        finally:
            await session.close()
            await transaction.rollback()


@pytest.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def reset_login_limiter():
    from app.modules.auth.rate_limit import login_limiter

    login_limiter.reset_all()
    yield
    login_limiter.reset_all()


@pytest.fixture(autouse=True)
def temp_storage_root(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "storage_root", str(tmp_path / "files"))
    yield


@pytest.fixture
async def owner_id(db_session):
    from app.core.security import hash_password
    from app.modules.auth.models import User

    user = User(username="owner", password_hash=hash_password("secret123"))
    db_session.add(user)
    await db_session.flush()
    return user.id
