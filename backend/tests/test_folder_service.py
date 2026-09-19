import io

import pytest
from fastapi import UploadFile

from app.core.errors import AppError
from app.modules.storage import service
from app.modules.storage.blobstore import LocalBlobStore
from app.modules.storage.models import StoredFile
from app.modules.storage.schemas import FolderUpdate


@pytest.fixture
def store(tmp_path) -> LocalBlobStore:
    return LocalBlobStore(str(tmp_path / "files"))


def make_upload(content: bytes) -> UploadFile:
    return UploadFile(file=io.BytesIO(content), filename="x.bin")


async def test_create_and_list_root(db_session, owner_id):
    folder = await service.create_folder(db_session, owner_id, "文档", None)

    folders, files = await service.list_contents(db_session, owner_id, None)

    assert folder.name == "文档"
    assert [item.name for item in folders] == ["文档"]
    assert files == []


async def test_duplicate_name_returns_conflict(db_session, owner_id):
    await service.create_folder(db_session, owner_id, "文档", None)

    with pytest.raises(AppError) as exc_info:
        await service.create_folder(db_session, owner_id, "文档", None)

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "name_conflict"


async def test_invalid_name_rejected(db_session, owner_id):
    with pytest.raises(AppError) as exc_info:
        await service.create_folder(db_session, owner_id, "a/b", None)

    assert exc_info.value.status_code == 422
    assert exc_info.value.code == "invalid_name"


async def test_list_missing_parent_returns_404(db_session, owner_id):
    with pytest.raises(AppError) as exc_info:
        await service.list_contents(db_session, owner_id, 999)

    assert exc_info.value.status_code == 404


async def test_move_into_self_rejected(db_session, owner_id):
    folder = await service.create_folder(db_session, owner_id, "目录", None)

    with pytest.raises(AppError) as exc_info:
        await service.update_folder(db_session, owner_id, folder, FolderUpdate(parent_id=folder.id))

    assert exc_info.value.code == "invalid_move"


async def test_move_into_descendant_rejected(db_session, owner_id):
    parent = await service.create_folder(db_session, owner_id, "父目录", None)
    child = await service.create_folder(db_session, owner_id, "子目录", parent.id)

    with pytest.raises(AppError) as exc_info:
        await service.update_folder(
            db_session, owner_id, parent, FolderUpdate(parent_id=child.id)
        )

    assert exc_info.value.code == "invalid_move"


async def test_rename_and_move_folder(db_session, owner_id):
    first = await service.create_folder(db_session, owner_id, "目录", None)
    target = await service.create_folder(db_session, owner_id, "目标", None)

    renamed = await service.update_folder(
        db_session, owner_id, first, FolderUpdate(name="新名字", parent_id=target.id)
    )

    assert renamed.name == "新名字"
    assert renamed.parent_id == target.id


async def test_delete_non_empty_folder_conflicts(db_session, owner_id, store):
    parent = await service.create_folder(db_session, owner_id, "父目录", None)
    await service.create_folder(db_session, owner_id, "子目录", parent.id)

    with pytest.raises(AppError) as exc_info:
        await service.delete_folder(
            db_session, owner_id, parent, recursive=False, blob_store=store
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "folder_not_empty"


async def test_recursive_delete_removes_subtree(db_session, owner_id, store):
    parent = await service.create_folder(db_session, owner_id, "父目录", None)
    child = await service.create_folder(db_session, owner_id, "子目录", parent.id)
    path, size, digest = store.save_upload(owner_id, make_upload(b"file-bytes"), max_bytes=1000)
    db_session.add(
        StoredFile(
            owner_id=owner_id,
            folder_id=child.id,
            name="a.bin",
            storage_path=path,
            size=size,
            mime_type="application/octet-stream",
            sha256=digest,
        )
    )
    await db_session.flush()

    await service.delete_folder(db_session, owner_id, parent, recursive=True, blob_store=store)

    folders, _ = await service.list_contents(db_session, owner_id, None)
    assert folders == []
    with pytest.raises(AppError):
        store.open(path)


async def test_folder_tree_returns_paths(db_session, owner_id):
    parent = await service.create_folder(db_session, owner_id, "父目录", None)
    await service.create_folder(db_session, owner_id, "子目录", parent.id)

    tree = await service.folder_tree(db_session, owner_id)

    assert [node.path for node in tree] == ["父目录", "父目录/子目录"]


async def test_folder_chain_returns_ancestors(db_session, owner_id):
    parent = await service.create_folder(db_session, owner_id, "父目录", None)
    child = await service.create_folder(db_session, owner_id, "子目录", parent.id)

    chain = await service.folder_chain(db_session, owner_id, child.id)

    assert [folder.name for folder in chain] == ["父目录", "子目录"]
