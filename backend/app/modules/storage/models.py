from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Folder(Base):
    __tablename__ = "folders"
    __table_args__ = (
        Index("uq_folders_owner_parent_name", "owner_id", "parent_id", "name", unique=True),
        {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    owner_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"))
    parent_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("folders.id", ondelete="CASCADE"), default=None
    )
    name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    children: Mapped[list["Folder"]] = relationship(
        back_populates="parent", lazy="selectin", order_by="Folder.name"
    )
    parent: Mapped["Folder | None"] = relationship(
        back_populates="children", remote_side="Folder.id"
    )


class StoredFile(Base):
    __tablename__ = "files"
    __table_args__ = (
        Index("uq_files_owner_folder_name", "owner_id", "folder_id", "name", unique=True),
        Index("ix_files_storage_path", "storage_path"),
        {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    owner_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"))
    folder_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("folders.id", ondelete="CASCADE"), default=None
    )
    name: Mapped[str] = mapped_column(String(255))
    storage_path: Mapped[str] = mapped_column(String(500))
    size: Mapped[int] = mapped_column(BigInteger)
    mime_type: Mapped[str] = mapped_column(String(100), default="application/octet-stream")
    sha256: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
