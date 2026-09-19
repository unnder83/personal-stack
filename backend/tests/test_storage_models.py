from sqlalchemy import text

from app.modules.storage.models import Folder, StoredFile


async def test_storage_tables_exist_after_migration(db_session):
    result = await db_session.execute(
        text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = DATABASE() AND table_name IN ('folders', 'files')"
        )
    )

    assert sorted(row[0] for row in result) == ["files", "folders"]


async def test_folder_tree_and_file_roundtrip(db_session, owner_id):
    parent = Folder(owner_id=owner_id, name="文档")
    db_session.add(parent)
    await db_session.flush()
    child = Folder(owner_id=owner_id, name="子目录", parent_id=parent.id)
    db_session.add(child)
    stored = StoredFile(
        owner_id=owner_id,
        folder_id=parent.id,
        name="报告.pdf",
        storage_path="1/ab/abcdef.bin",
        size=123,
        mime_type="application/pdf",
        sha256="a" * 64,
    )
    db_session.add(stored)
    await db_session.flush()

    loaded = await db_session.get(Folder, parent.id)
    assert loaded is not None
    await db_session.refresh(loaded, attribute_names=["children"])
    file_row = await db_session.get(StoredFile, stored.id)

    assert loaded is not None
    assert [item.name for item in loaded.children] == ["子目录"]
    assert file_row is not None
    assert file_row.size == 123
