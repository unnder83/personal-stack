import hashlib
import os
import tempfile
from pathlib import Path
from typing import BinaryIO

from fastapi import UploadFile

from app.core.errors import AppError

CHUNK_SIZE = 1024 * 1024


class LocalBlobStore:
    def __init__(self, root: str) -> None:
        self.root = Path(root)

    def absolute_path(self, storage_path: str) -> Path:
        root = self.root.resolve()
        target = (root / storage_path).resolve()
        if target != root and root not in target.parents:
            raise AppError("invalid_path", "非法的存储路径", 400)
        return target

    def save_upload(
        self, owner_id: int, upload: UploadFile, max_bytes: int
    ) -> tuple[str, int, str]:
        self.root.mkdir(parents=True, exist_ok=True)
        tmp_dir = self.root / "tmp"
        tmp_dir.mkdir(parents=True, exist_ok=True)
        hasher = hashlib.sha256()
        size = 0
        fd, tmp_name = tempfile.mkstemp(dir=tmp_dir)
        try:
            with os.fdopen(fd, "wb") as out:
                while True:
                    chunk = upload.file.read(CHUNK_SIZE)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > max_bytes:
                        raise AppError("file_too_large", "文件超过大小上限", 413)
                    hasher.update(chunk)
                    out.write(chunk)
            digest = hasher.hexdigest()
            storage_path = f"{owner_id}/{digest[:2]}/{digest}.bin"
            target = self.absolute_path(storage_path)
            target.parent.mkdir(parents=True, exist_ok=True)
            if target.exists():
                os.unlink(tmp_name)
            else:
                os.replace(tmp_name, target)
            return storage_path, size, digest
        except BaseException:
            if os.path.exists(tmp_name):
                os.unlink(tmp_name)
            raise

    def open(self, storage_path: str) -> BinaryIO:
        path = self.absolute_path(storage_path)
        if not path.is_file():
            raise AppError("not_found", "文件不存在", 404)
        return path.open("rb")

    def delete(self, storage_path: str) -> None:
        path = self.absolute_path(storage_path)
        if path.is_file():
            path.unlink()
