from app.core.security import create_access_token, hash_password
from app.modules.auth.models import User


async def login_as_admin(client, db_session) -> None:
    user = User(username="admin", password_hash=hash_password("secret123"))
    db_session.add(user)
    await db_session.flush()
    client.cookies.set("access_token", create_access_token(user.id))


async def test_storage_endpoints_require_auth(client):
    for method, path in [
        ("get", "/api/folders"),
        ("get", "/api/folders/tree"),
        ("post", "/api/folders"),
        ("patch", "/api/folders/1"),
        ("delete", "/api/folders/1"),
        ("post", "/api/files/upload"),
        ("get", "/api/files/1/download"),
        ("patch", "/api/files/1"),
        ("delete", "/api/files/1"),
        ("get", "/api/storage/usage"),
    ]:
        response = await getattr(client, method)(path)

        assert response.status_code == 401, path
        assert response.json()["code"] == "unauthorized"


async def test_folder_crud_flow(client, db_session):
    await login_as_admin(client, db_session)

    created = await client.post("/api/folders", json={"name": "文档", "parent_id": None})
    assert created.status_code == 200
    folder_id = created.json()["id"]

    listed = await client.get("/api/folders")
    assert [item["name"] for item in listed.json()["folders"]] == ["文档"]
    assert listed.json()["breadcrumb"] == []

    tree = await client.get("/api/folders/tree")
    assert tree.json()[0]["path"] == "文档"

    renamed = await client.patch(f"/api/folders/{folder_id}", json={"name": "资料"})
    assert renamed.json()["name"] == "资料"

    deleted = await client.delete(f"/api/folders/{folder_id}")
    assert deleted.status_code == 200
    assert (await client.get("/api/folders")).json()["folders"] == []


async def test_breadcrumb_for_nested_folder(client, db_session):
    await login_as_admin(client, db_session)
    parent = await client.post("/api/folders", json={"name": "父目录", "parent_id": None})
    child = await client.post(
        "/api/folders", json={"name": "子目录", "parent_id": parent.json()["id"]}
    )

    contents = await client.get("/api/folders", params={"parent_id": child.json()["id"]})

    assert [item["name"] for item in contents.json()["breadcrumb"]] == ["父目录", "子目录"]


async def test_upload_download_and_usage(client, db_session):
    await login_as_admin(client, db_session)

    upload = await client.post(
        "/api/files/upload",
        files={"file": ("报告 2026.txt", b"hello world", "text/plain")},
    )

    assert upload.status_code == 200
    file_id = upload.json()["id"]
    assert upload.json()["size"] == 11

    download = await client.get(f"/api/files/{file_id}/download")

    assert download.status_code == 200
    assert download.content == b"hello world"

    usage = await client.get("/api/storage/usage")
    assert usage.json() == {"used_bytes": 11, "file_count": 1}


async def test_download_content_disposition_encodes_unicode(client, db_session):
    await login_as_admin(client, db_session)
    upload = await client.post(
        "/api/files/upload", files={"file": ("报告 2026.txt", b"x", "text/plain")}
    )

    download = await client.get(f"/api/files/{upload.json()['id']}/download")

    header = download.headers["content-disposition"]
    assert "attachment" in header
    assert "filename*=UTF-8''" in header
    assert "%E6%8A%A5%E5%91%8A" in header


async def test_download_content_disposition_strips_unsafe_chars(client, db_session):
    await login_as_admin(client, db_session)
    upload = await client.post(
        "/api/files/upload", files={"file": ('bad"name.txt', b"x", "text/plain")}
    )

    download = await client.get(f"/api/files/{upload.json()['id']}/download")

    header = download.headers["content-disposition"]
    assert "\n" not in header and "\r" not in header
    assert "attachment" in header
    assert "filename*=UTF-8''" in header


def test_content_disposition_strips_quotes_and_newlines():
    from app.modules.storage.router import _content_disposition

    header = _content_disposition('bad"name\n.txt')

    assert "\n" not in header and "\r" not in header
    assert 'filename="badname.txt"' in header
    assert header.endswith("filename*=UTF-8''bad%22name%0A.txt")


async def test_upload_oversize_returns_413(client, db_session, monkeypatch):
    from app.core.config import settings

    await login_as_admin(client, db_session)
    monkeypatch.setattr(settings, "max_upload_size_mb", 0)

    response = await client.post("/api/files/upload", files={"file": ("big.bin", b"x" * 10)})

    assert response.status_code == 413
    assert response.json()["code"] == "file_too_large"


async def test_non_empty_folder_and_recursive_delete(client, db_session):
    await login_as_admin(client, db_session)
    folder = await client.post("/api/folders", json={"name": "目录", "parent_id": None})
    folder_id = folder.json()["id"]
    await client.post(
        "/api/files/upload",
        files={"file": ("a.txt", b"x", "text/plain")},
        data={"folder_id": str(folder_id)},
    )

    conflict = await client.delete(f"/api/folders/{folder_id}")
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "folder_not_empty"

    recursive = await client.delete(f"/api/folders/{folder_id}", params={"recursive": "true"})
    assert recursive.status_code == 200
    assert (await client.get("/api/storage/usage")).json()["file_count"] == 0
