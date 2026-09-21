from app.core.security import create_access_token, hash_password
from app.modules.auth.models import User
from app.modules.settings.schemas import ThemeConfig


async def test_public_theme_requires_no_auth(client):
    response = await client.get("/api/settings/theme")

    assert response.status_code == 200
    body = response.json()["theme"]
    assert body["mode"] == "system"
    assert body["accent"] == "violet"
    assert body["radius"] == 16
    assert body["blur"] == 12
    assert body["background"] == {"type": "gradient", "value": "aurora"}


async def test_admin_theme_requires_auth(client):
    response = await client.put("/api/admin/settings/theme", json={"accent": "rose"})

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"


async def test_partial_update_merges_and_persists(client, db_session):
    user = User(username="admin", password_hash=hash_password("secret123"))
    db_session.add(user)
    await db_session.flush()
    client.cookies.set("access_token", create_access_token(user.id))

    updated = await client.put(
        "/api/admin/settings/theme",
        json={"accent": "emerald", "radius": 6, "background": {"type": "mesh", "value": "mesh-emerald"}},
    )

    assert updated.status_code == 200
    body = updated.json()["theme"]
    assert body["accent"] == "emerald"
    assert body["radius"] == 6
    assert body["blur"] == 12
    assert body["background"] == {"type": "mesh", "value": "mesh-emerald"}

    fetched = await client.get("/api/settings/theme")
    assert fetched.json()["theme"]["accent"] == "emerald"


async def test_invalid_values_rejected(client, db_session):
    user = User(username="admin", password_hash=hash_password("secret123"))
    db_session.add(user)
    await db_session.flush()
    client.cookies.set("access_token", create_access_token(user.id))

    bad_accent = await client.put("/api/admin/settings/theme", json={"accent": "neon"})
    assert bad_accent.status_code == 422
    assert bad_accent.json()["code"] == "validation_error"

    bad_radius = await client.put("/api/admin/settings/theme", json={"radius": 99})
    assert bad_radius.status_code == 422

    bad_solid = await client.put(
        "/api/admin/settings/theme",
        json={"background": {"type": "solid", "value": "red"}},
    )
    assert bad_solid.status_code == 422

    unknown_field = await client.put("/api/admin/settings/theme", json={"foo": "bar"})
    assert unknown_field.status_code == 422


def test_default_theme_matches_frontend_schema():
    theme = ThemeConfig()

    assert theme.model_dump() == {
        "mode": "system",
        "accent": "violet",
        "radius": 16,
        "blur": 12,
        "background": {"type": "gradient", "value": "aurora"},
    }
