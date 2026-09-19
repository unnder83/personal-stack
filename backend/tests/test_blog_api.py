from app.core.security import create_access_token, hash_password
from app.modules.auth.models import User


async def login_as_admin(client, db_session) -> None:
    user = User(username="admin", password_hash=hash_password("secret123"))
    db_session.add(user)
    await db_session.flush()
    client.cookies.set("access_token", create_access_token(user.id))


def post_payload(**overrides) -> dict:
    payload = {
        "title": "Hello World",
        "slug": None,
        "summary": "摘要",
        "content_md": "# 标题\n\n正文",
        "status": "published",
        "tags": ["Python"],
    }
    payload.update(overrides)
    return payload


async def test_public_list_and_detail(client, db_session):
    await login_as_admin(client, db_session)
    created = await client.post("/api/admin/posts", json=post_payload())
    assert created.status_code == 200
    slug = created.json()["slug"]

    listed = await client.get("/api/posts")

    assert listed.status_code == 200
    body = listed.json()
    assert body["total"] == 1
    assert body["items"][0]["slug"] == slug

    detail = await client.get(f"/api/posts/{slug}")

    assert detail.status_code == 200
    assert detail.json()["content_md"] == "# 标题\n\n正文"
    assert detail.json()["tags"][0]["name"] == "Python"


async def test_admin_endpoints_require_auth(client):
    for method, path in [
        ("get", "/api/admin/posts"),
        ("post", "/api/admin/posts"),
        ("get", "/api/admin/posts/1"),
        ("put", "/api/admin/posts/1"),
        ("delete", "/api/admin/posts/1"),
    ]:
        response = await getattr(client, method)(path)

        assert response.status_code == 401, path
        assert response.json()["code"] == "unauthorized"


async def test_public_detail_of_draft_returns_404(client, db_session):
    await login_as_admin(client, db_session)
    created = await client.post("/api/admin/posts", json=post_payload(status="draft"))
    slug = created.json()["slug"]

    response = await client.get(f"/api/posts/{slug}")

    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


async def test_tags_only_include_published(client, db_session):
    await login_as_admin(client, db_session)
    await client.post("/api/admin/posts", json=post_payload(tags=["Public"], status="published"))
    await client.post("/api/admin/posts", json=post_payload(tags=["Secret"], status="draft"))

    response = await client.get("/api/tags")

    assert response.status_code == 200
    assert [tag["name"] for tag in response.json()] == ["Public"]


async def test_create_update_delete_flow(client, db_session):
    await login_as_admin(client, db_session)
    created = await client.post("/api/admin/posts", json=post_payload(status="draft"))
    post_id = created.json()["id"]

    fetched = await client.get(f"/api/admin/posts/{post_id}")
    assert fetched.json()["status"] == "draft"

    updated = await client.put(
        f"/api/admin/posts/{post_id}",
        json=post_payload(title="改名了", status="published", tags=["FastAPI"]),
    )

    assert updated.status_code == 200
    assert updated.json()["title"] == "改名了"
    assert updated.json()["published_at"] is not None

    deleted = await client.delete(f"/api/admin/posts/{post_id}")
    assert deleted.status_code == 200

    missing = await client.get(f"/api/admin/posts/{post_id}")
    assert missing.status_code == 404


async def test_slug_conflict_returns_409(client, db_session):
    await login_as_admin(client, db_session)
    await client.post("/api/admin/posts", json=post_payload(slug="taken"))
    response = await client.post("/api/admin/posts", json=post_payload(slug="taken", title="Other"))

    assert response.status_code == 409
    assert response.json()["code"] == "slug_conflict"


async def test_page_size_over_limit_rejected(client):
    response = await client.get("/api/posts", params={"page_size": 101})

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"


async def test_admin_list_filters_by_status(client, db_session):
    await login_as_admin(client, db_session)
    await client.post("/api/admin/posts", json=post_payload(status="draft", slug="d1"))
    await client.post("/api/admin/posts", json=post_payload(status="published", slug="p1"))

    drafts = await client.get("/api/admin/posts", params={"status": "draft"})

    assert drafts.status_code == 200
    assert drafts.json()["total"] == 1
    assert drafts.json()["items"][0]["slug"] == "d1"
