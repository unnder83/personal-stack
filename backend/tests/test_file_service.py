import io

import pytest
from fastapi import UploadFile

from app.core.config import settings
from app.core.errors import AppError
from app.modules.storage import service
from app.modules.storage.blobstore import LocalBlobStore
from app.modules.storage.schemas import FileUpdate


@pytest.fixture
def store(tmp_path) -> LocalBlobStore:
    return LocalBlobStore(str(tmp_path / "files"))


def make_upload(
    content: bytes, filename: str = "报告.pdf", content_type: str = "application/pdf"
) -> UploadFile:
    return UploadFile(
        file=io.BytesIO(content), filename=filename, headers={"content-type": content_type}
    )


async def test_upload_creates_file_with_metadata(db_session, owner_id, store):
    file_row = await service.upload_file(
        db_session, owner_id, make_upload(b"hello"), folder_id=None, blob_store=store
    )

    assert file_row.name == "报告.pdf"
    assert file_row.size == 5
    assert file_row.mime_type == "application/pdf"
    assert len(file_row.sha256) == 64


async def test_upload_duplicate_name_conflicts(db_session, owner_id, store):
    await service.upload_file(
        db_session, owner_id, make_upload(b"a"), folder_id=None, blob_store=store
    )

    with pytest.raises(AppError) as exc_info:
        await service.upload_file(
            db_session, owner_id, make_upload(b"b"), folder_id=None, blob_store=store
        )

    assert exc_info.value.code == "name_conflict"


async def test_upload_missing_folder_returns_404(db_session, owner_id, store):
    with pytest.raises(AppError) as exc_info:
        await service.upload_file(
            db_session, owner_id, make_upload(b"a"), folder_id=999, blob_store=store
        )

    assert exc_info.value.status_code == 404


async def test_upload_oversize_returns_413(db_session, owner_id, store, monkeypatch):
    monkeypatch.setattr(settings, "max_upload_size_mb", 0)

    with pytest.raises(AppError) as exc_info:
        await service.upload_file(
            db_session, owner_id, make_upload(b"x" * 10), folder_id=None, blob_store=store
        )

    assert exc_info.value.status_code == 413


async def test_duplicate_content_shares_blob(db_session, owner_id, store):
    first = await service.upload_file(
        db_session, owner_id, make_upload(b"same", filename="a.bin"), folder_id=None, blob_store=store
    )
    second = await service.upload_file(
        db_session, owner_id, make_upload(b"same", filename="b.bin"), folder_id=None, blob_store=store
    )

    assert first.storage_path == second.storage_path


async def test_delete_keeps_blob_while_referenced(db_session, owner_id, store):
    first = await service.upload_file(
        db_session, owner_id, make_upload(b"same", filename="a.bin"), folder_id=None, blob_store=store
    )
    second = await service.upload_file(
        db_session, owner_id, make_upload(b"same", filename="b.bin"), folder_id=None, blob_store=store
    )

    await service.delete_file(db_session, owner_id, first, blob_store=store)

    with store.open(second.storage_path) as handle:
        assert handle.read() == b"same"


async def test_delete_removes_blob_when_last_reference(db_session, owner_id, store):
    file_row = await service.upload_file(
        db_session, owner_id, make_upload(b"only"), folder_id=None, blob_store=store
    )

    await service.delete_file(db_session, owner_id, file_row, blob_store=store)

    with pytest.raises(AppError):
        store.open(file_row.storage_path)


async def test_rename_and_move_file(db_session, owner_id, store):
    folder = await service.create_folder(db_session, owner_id, "归档", None)
    file_row = await service.upload_file(
        db_session, owner_id, make_upload(b"data"), folder_id=None, blob_store=store
    )

    updated = await service.update_file(
        db_session, owner_id, file_row, FileUpdate(name="新名字.bin", folder_id=folder.id)
    )

    assert updated.name == "新名字.bin"
    assert updated.folder_id == folder.id


async def test_usage_sums_size_and_count(db_session, owner_id, store):
    await service.upload_file(
        db_session, owner_id, make_upload(b"12345", filename="a.bin"), folder_id=None, blob_store=store
    )
    await service.upload_file(
        db_session, owner_id, make_upload(b"123", filename="b.bin"), folder_id=None, blob_store=store
    )

    usage = await service.usage(db_session, owner_id)

    assert usage.file_count == 2
    assert usage.used_bytes == 8
