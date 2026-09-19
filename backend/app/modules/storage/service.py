from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.modules.storage import schemas
from app.modules.storage.blobstore import LocalBlobStore
from app.modules.storage.models import Folder, StoredFile

_FORBIDDEN = ("/", "\\", "\0")


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def validate_name(name: str) -> str:
    cleaned = name.strip()
    if not cleaned or len(cleaned) > 255:
        raise AppError("invalid_name", "名称长度需在 1-255 个字符之间", 422)
    if any(char in cleaned for char in _FORBIDDEN):
        raise AppError("invalid_name", "名称不能包含 / \\ 或空字符", 422)
    return cleaned


async def get_folder(session: AsyncSession, owner_id: int, folder_id: int) -> Folder:
    folder = (
        await session.execute(
            select(Folder).where(Folder.id == folder_id, Folder.owner_id == owner_id)
        )
    ).scalar_one_or_none()
    if folder is None:
        raise AppError("not_found", "文件夹不存在", 404)
    return folder


async def _ensure_parent(session: AsyncSession, owner_id: int, parent_id: int | None) -> None:
    if parent_id is None:
        return
    await get_folder(session, owner_id, parent_id)


async def _name_taken(
    session: AsyncSession,
    owner_id: int,
    parent_id: int | None,
    name: str,
    exclude_folder_id: int | None = None,
) -> bool:
    stmt = select(Folder.id).where(
        Folder.owner_id == owner_id, Folder.parent_id == parent_id, Folder.name == name
    )
    if exclude_folder_id is not None:
        stmt = stmt.where(Folder.id != exclude_folder_id)
    return (await session.execute(stmt.limit(1))).scalar_one_or_none() is not None


async def list_contents(
    session: AsyncSession, owner_id: int, parent_id: int | None
) -> tuple[list[Folder], list[StoredFile]]:
    await _ensure_parent(session, owner_id, parent_id)
    folders = (
        await session.execute(
            select(Folder)
            .where(Folder.owner_id == owner_id, Folder.parent_id == parent_id)
            .order_by(Folder.name)
        )
    ).scalars().all()
    files = (
        await session.execute(
            select(StoredFile)
            .where(StoredFile.owner_id == owner_id, StoredFile.folder_id == parent_id)
            .order_by(StoredFile.name)
        )
    ).scalars().all()
    return list(folders), list(files)


async def create_folder(
    session: AsyncSession, owner_id: int, name: str, parent_id: int | None
) -> Folder:
    cleaned = validate_name(name)
    await _ensure_parent(session, owner_id, parent_id)
    if await _name_taken(session, owner_id, parent_id, cleaned):
        raise AppError("name_conflict", "同名文件夹已存在", 409)
    folder = Folder(owner_id=owner_id, parent_id=parent_id, name=cleaned)
    session.add(folder)
    await session.commit()
    return folder


async def _ancestor_ids(session: AsyncSession, owner_id: int, folder_id: int) -> set[int]:
    ancestors: set[int] = set()
    current: int | None = folder_id
    while current is not None:
        ancestors.add(current)
        parent_id = (
            await session.execute(select(Folder.parent_id).where(Folder.id == current))
        ).scalar_one_or_none()
        current = parent_id
    return ancestors


async def update_folder(
    session: AsyncSession, owner_id: int, folder: Folder, payload: schemas.FolderUpdate
) -> Folder:
    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes and changes["name"] is not None:
        folder.name = validate_name(changes["name"])
    if "parent_id" in changes:
        new_parent = changes["parent_id"]
        if new_parent is not None:
            await get_folder(session, owner_id, new_parent)
            if folder.id in await _ancestor_ids(session, owner_id, new_parent):
                raise AppError("invalid_move", "不能移动到自身或其子目录", 409)
        folder.parent_id = new_parent
    if await _name_taken(
        session, owner_id, folder.parent_id, folder.name, exclude_folder_id=folder.id
    ):
        raise AppError("name_conflict", "同名文件夹已存在", 409)
    await session.commit()
    return folder


async def _descendant_ids(session: AsyncSession, owner_id: int, folder_id: int) -> list[int]:
    collected: list[int] = []
    frontier = [folder_id]
    while frontier:
        current = frontier.pop()
        children = (
            await session.execute(
                select(Folder.id).where(Folder.owner_id == owner_id, Folder.parent_id == current)
            )
        ).scalars().all()
        collected.extend(children)
        frontier.extend(children)
    return collected


async def delete_folder(
    session: AsyncSession,
    owner_id: int,
    folder: Folder,
    *,
    recursive: bool,
    blob_store: LocalBlobStore,
) -> None:
    child_ids = await _descendant_ids(session, owner_id, folder.id)
    folder_ids = [folder.id, *child_ids]
    files = (
        await session.execute(
            select(StoredFile).where(
                StoredFile.owner_id == owner_id, StoredFile.folder_id.in_(folder_ids)
            )
        )
    ).scalars().all()
    direct_children = (
        await session.execute(
            select(Folder.id).where(Folder.owner_id == owner_id, Folder.parent_id == folder.id)
        )
    ).scalars().all()
    if not recursive and (direct_children or files):
        raise AppError("folder_not_empty", "文件夹非空，需递归删除", 409)
    for file_row in files:
        await _delete_file_row(session, file_row, blob_store)
    await session.execute(Folder.__table__.delete().where(Folder.id.in_(child_ids)))
    await session.delete(folder)
    await session.commit()


async def folder_chain(session: AsyncSession, owner_id: int, folder_id: int) -> list[Folder]:
    chain: list[Folder] = []
    current: int | None = folder_id
    while current is not None:
        parent_id = (
            await session.execute(select(Folder.parent_id).where(Folder.id == current))
        ).scalar_one_or_none()
        folder = await get_folder(session, owner_id, current)
        chain.append(folder)
        current = parent_id
    chain.reverse()
    return chain


async def folder_tree(session: AsyncSession, owner_id: int) -> list[schemas.FolderTreeNode]:
    folders = (
        await session.execute(select(Folder).where(Folder.owner_id == owner_id))
    ).scalars().all()
    by_id = {folder.id: folder for folder in folders}
    nodes: list[schemas.FolderTreeNode] = []
    for folder in folders:
        parts: list[str] = [folder.name]
        parent_id = folder.parent_id
        seen: set[int] = {folder.id}
        while parent_id is not None and parent_id in by_id and parent_id not in seen:
            seen.add(parent_id)
            parts.append(by_id[parent_id].name)
            parent_id = by_id[parent_id].parent_id
        path = "/".join(reversed(parts))
        nodes.append(
            schemas.FolderTreeNode(
                id=folder.id, name=folder.name, parent_id=folder.parent_id, path=path
            )
        )
    nodes.sort(key=lambda node: node.path)
    return nodes


async def _delete_file_row(
    session: AsyncSession, file_row: StoredFile, blob_store: LocalBlobStore
) -> None:
    shared = (
        await session.execute(
            select(func.count())
            .select_from(StoredFile)
            .where(StoredFile.storage_path == file_row.storage_path, StoredFile.id != file_row.id)
        )
    ).scalar_one()
    await session.delete(file_row)
    if shared == 0:
        blob_store.delete(file_row.storage_path)
