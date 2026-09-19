from app.core.security import create_access_token, hash_password
from app.modules.auth.models import User


async def create_admin(db_session, *, is_active: bool = True) -> User:
    user = User(
        username="admin",
        password_hash=hash_password("secret123"),
        is_active=is_active,
    )
    db_session.add(user)
    await db_session.flush()
    return user


async def test_login_success_returns_user(client, db_session):
    admin = await create_admin(db_session)

    response = await client.post(
        "/api/auth/login", json={"username": "admin", "password": "secret123"}
    )

    assert response.status_code == 200
    assert response.json() == {"id": admin.id, "username": "admin"}
    assert "access_token" in response.cookies


async def test_login_sets_secure_cookie_attributes(client, db_session):
    await create_admin(db_session)

    response = await client.post(
        "/api/auth/login", json={"username": "admin", "password": "secret123"}
    )

    set_cookie = response.headers["set-cookie"]
    assert "HttpOnly" in set_cookie
    assert "SameSite=lax" in set_cookie
    assert "Path=/" in set_cookie
    assert "Max-Age=604800" in set_cookie
    # 测试环境 COOKIE_SECURE=false，不应带 Secure；生产默认开启
    assert "Secure" not in set_cookie


async def test_login_wrong_password_returns_401(client, db_session):
    await create_admin(db_session)

    response = await client.post(
        "/api/auth/login", json={"username": "admin", "password": "wrong"}
    )

    assert response.status_code == 401
    assert response.json()["code"] == "invalid_credentials"


async def test_login_unknown_user_returns_401(client):
    response = await client.post(
        "/api/auth/login", json={"username": "nobody", "password": "whatever"}
    )

    assert response.status_code == 401
    assert response.json()["code"] == "invalid_credentials"


async def test_login_validation_error_shape(client):
    response = await client.post("/api/auth/login", json={"username": "", "password": ""})

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"


async def test_me_without_cookie_returns_401(client):
    response = await client.get("/api/auth/me")

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"


async def test_me_with_tampered_cookie_returns_401(client):
    client.cookies.set("access_token", "not-a-real-token")

    response = await client.get("/api/auth/me")

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"


async def test_me_with_token_of_missing_user_returns_401(client):
    client.cookies.set("access_token", create_access_token(999))

    response = await client.get("/api/auth/me")

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"


async def test_me_rejects_inactive_user(client, db_session):
    user = await create_admin(db_session, is_active=False)
    client.cookies.set("access_token", create_access_token(user.id))

    response = await client.get("/api/auth/me")

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"


async def test_login_then_me_returns_user(client, db_session):
    admin = await create_admin(db_session)

    login = await client.post(
        "/api/auth/login", json={"username": "admin", "password": "secret123"}
    )
    assert login.status_code == 200

    response = await client.get("/api/auth/me")

    assert response.status_code == 200
    assert response.json() == {"id": admin.id, "username": "admin"}


async def test_logout_clears_cookie(client, db_session):
    await create_admin(db_session)
    await client.post(
        "/api/auth/login", json={"username": "admin", "password": "secret123"}
    )

    response = await client.post("/api/auth/logout")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert 'access_token=""' in response.headers["set-cookie"]

    me = await client.get("/api/auth/me")
    assert me.status_code == 401


async def test_login_rate_limited_after_failures(client, db_session):
    await create_admin(db_session)

    for _ in range(5):
        response = await client.post(
            "/api/auth/login", json={"username": "admin", "password": "wrong"}
        )
        assert response.status_code == 401

    sixth = await client.post(
        "/api/auth/login", json={"username": "admin", "password": "wrong"}
    )
    assert sixth.status_code == 429
    assert sixth.json()["code"] == "rate_limited"

    # 即使密码正确也被拦截（防爆破）
    correct = await client.post(
        "/api/auth/login", json={"username": "admin", "password": "secret123"}
    )
    assert correct.status_code == 429


async def test_successful_login_resets_rate_limit(client, db_session):
    await create_admin(db_session)

    for _ in range(4):
        await client.post(
            "/api/auth/login", json={"username": "admin", "password": "wrong"}
        )

    success = await client.post(
        "/api/auth/login", json={"username": "admin", "password": "secret123"}
    )
    assert success.status_code == 200

    for _ in range(4):
        response = await client.post(
            "/api/auth/login", json={"username": "admin", "password": "wrong"}
        )
        assert response.status_code == 401
