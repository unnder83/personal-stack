import httpx
import pytest
from fastapi import FastAPI
from httpx import ASGITransport

from app.core.errors import AppError, register_error_handlers


def build_app() -> FastAPI:
    test_app = FastAPI()
    register_error_handlers(test_app)

    @test_app.get("/boom")
    async def boom():
        raise AppError("boom", "出错了", 418)

    @test_app.get("/items/{item_id}")
    async def item(item_id: int):
        return {"item_id": item_id}

    return test_app


@pytest.fixture
async def error_client():
    transport = ASGITransport(app=build_app())
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def test_app_error_uses_code_and_message(error_client):
    response = await error_client.get("/boom")

    assert response.status_code == 418
    assert response.json() == {"code": "boom", "message": "出错了"}


async def test_not_found_uses_code_and_message(error_client):
    response = await error_client.get("/missing")

    assert response.status_code == 404
    body = response.json()
    assert body["code"] == "http_404"
    assert "message" in body


async def test_validation_error_uses_code_and_message(error_client):
    response = await error_client.get("/items/abc")

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "validation_error"
    assert "message" in body
