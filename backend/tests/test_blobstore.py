import io

import pytest
from fastapi import UploadFile

from app.core.errors import AppError
from app.modules.storage.blobstore import LocalBlobStore


def make_upload(content: bytes, filename: str = "测试 文件.bin") -> UploadFile:
    return UploadFile(file=io.BytesIO(content), filename=filename)


def test_save_upload_uses_hash_path_not_filename(tmp_path):
    store = LocalBlobStore(str(tmp_path / "files"))
    content = b"hello world" * 100

    storage_path, size, digest = store.save_upload(7, make_upload(content), max_bytes=10_000_000)

    assert size == len(content)
    assert storage_path == f"7/{digest[:2]}/{digest}.bin"
    assert "测试" not in storage_path
    saved = (tmp_path / "files" / storage_path).read_bytes()
    assert saved == content


def test_save_upload_dedupes_same_content(tmp_path):
    store = LocalBlobStore(str(tmp_path / "files"))
    content = b"same-content"

    first_path, _, _ = store.save_upload(1, make_upload(content), max_bytes=1000)
    second_path, _, _ = store.save_upload(1, make_upload(content, "other.bin"), max_bytes=1000)

    assert first_path == second_path
    blob = tmp_path / "files" / first_path
    assert blob.read_bytes() == content


def test_save_upload_rejects_oversize_and_cleans_tmp(tmp_path):
    store = LocalBlobStore(str(tmp_path / "files"))

    with pytest.raises(AppError) as exc_info:
        store.save_upload(1, make_upload(b"x" * 2000), max_bytes=1000)

    assert exc_info.value.status_code == 413
    assert exc_info.value.code == "file_too_large"
    tmp_dir = tmp_path / "files" / "tmp"
    assert not tmp_dir.exists() or list(tmp_dir.iterdir()) == []


def test_absolute_rejects_traversal(tmp_path):
    store = LocalBlobStore(str(tmp_path / "files"))

    with pytest.raises(AppError) as exc_info:
        store.absolute_path("../escape.txt")

    assert exc_info.value.code == "invalid_path"


def test_open_and_delete_roundtrip(tmp_path):
    store = LocalBlobStore(str(tmp_path / "files"))
    storage_path, _, _ = store.save_upload(1, make_upload(b"data"), max_bytes=1000)

    with store.open(storage_path) as handle:
        assert handle.read() == b"data"

    store.delete(storage_path)

    with pytest.raises(AppError):
        store.open(storage_path)


def test_open_missing_raises_not_found(tmp_path):
    store = LocalBlobStore(str(tmp_path / "files"))

    with pytest.raises(AppError) as exc_info:
        store.open("1/ab/missing.bin")

    assert exc_info.value.status_code == 404
