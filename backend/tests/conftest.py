import os

import httpx
import pytest
from httpx import ASGITransport

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "mysql+asyncmy://app:app@127.0.0.1:3306/personal_stack_test")

from app.main import app  # noqa: E402


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
