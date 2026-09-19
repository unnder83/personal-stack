from collections.abc import Iterator
from urllib.parse import quote

from fastapi import APIRouter, Depends, Form, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.modules.auth.deps import get_current_user
from app.modules.auth.models import User
from app.modules.storage import service
from app.modules.storage.blobstore import LocalBlobStore
from app.modules.storage.schemas import (
    FileOut,
    FileUpdate,
    FolderContents,
    FolderCreate,
    FolderOut,
    FolderTreeNode,
    FolderUpdate,
    StorageUsage,
)

router = APIRouter(prefix="/api", tags=["storage"])


def get_blob_store() -> LocalBlobStore:
    return LocalBlobStore(settings.storage_root)


def _content_disposition(filename: str) -> str:
    safe_ascii = "".join(
        char for char in filename if 32 <= ord(char) < 127 and char not in '"\\'
    )
    fallback = safe_ascii or "download"
    return f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{quote(filename)}"


def _stream(handle) -> Iterator[bytes]:
    try:
        while chunk := handle.read(1024 * 1024):
            yield chunk
    finally:
        handle.close()


@router.get("/folders", response_model=FolderContents)
async def list_folder(
    parent_id: int | None = None,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FolderContents:
    folders, files = await service.list_contents(session, current_user.id, parent_id)
    breadcrumb = (
        await service.folder_chain(session, current_user.id, parent_id)
        if parent_id is not None
        else []
    )
    folder = breadcrumb[-1] if breadcrumb else None
    return FolderContents(
        folder=FolderOut.model_validate(folder) if folder else None,
        breadcrumb=[FolderOut.model_validate(item) for item in breadcrumb],
        folders=[FolderOut.model_validate(item) for item in folders],
        files=[FileOut.model_validate(item) for item in files],
    )


@router.get("/folders/tree", response_model=list[FolderTreeNode])
async def get_folder_tree(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[FolderTreeNode]:
    return await service.folder_tree(session, current_user.id)


@router.post("/folders", response_model=FolderOut)
async def create_folder(
    payload: FolderCreate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FolderOut:
    folder = await service.create_folder(session, current_user.id, payload.name, payload.parent_id)
    return FolderOut.model_validate(folder)


@router.patch("/folders/{folder_id}", response_model=FolderOut)
async def update_folder(
    folder_id: int,
    payload: FolderUpdate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FolderOut:
    folder = await service.get_folder(session, current_user.id, folder_id)
    folder = await service.update_folder(session, current_user.id, folder, payload)
    return FolderOut.model_validate(folder)


@router.delete("/folders/{folder_id}")
async def delete_folder(
    folder_id: int,
    recursive: bool = False,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    blob_store: LocalBlobStore = Depends(get_blob_store),
) -> dict[str, str]:
    folder = await service.get_folder(session, current_user.id, folder_id)
    await service.delete_folder(
        session, current_user.id, folder, recursive=recursive, blob_store=blob_store
    )
    return {"status": "ok"}


@router.post("/files/upload", response_model=FileOut)
async def upload_file(
    file: UploadFile,
    folder_id: int | None = Form(default=None),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    blob_store: LocalBlobStore = Depends(get_blob_store),
) -> FileOut:
    file_row = await service.upload_file(session, current_user.id, file, folder_id, blob_store)
    return FileOut.model_validate(file_row)


@router.get("/files/{file_id}/download")
async def download_file(
    file_id: int,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    blob_store: LocalBlobStore = Depends(get_blob_store),
) -> StreamingResponse:
    file_row = await service.get_file(session, current_user.id, file_id)
    handle = blob_store.open(file_row.storage_path)
    return StreamingResponse(
        _stream(handle),
        media_type=file_row.mime_type,
        headers={
            "Content-Disposition": _content_disposition(file_row.name),
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.patch("/files/{file_id}", response_model=FileOut)
async def update_file(
    file_id: int,
    payload: FileUpdate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileOut:
    file_row = await service.get_file(session, current_user.id, file_id)
    file_row = await service.update_file(session, current_user.id, file_row, payload)
    return FileOut.model_validate(file_row)


@router.delete("/files/{file_id}")
async def delete_file(
    file_id: int,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    blob_store: LocalBlobStore = Depends(get_blob_store),
) -> dict[str, str]:
    file_row = await service.get_file(session, current_user.id, file_id)
    await service.delete_file(session, current_user.id, file_row, blob_store)
    return {"status": "ok"}


@router.get("/storage/usage", response_model=StorageUsage)
async def get_usage(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StorageUsage:
    return await service.usage(session, current_user.id)
