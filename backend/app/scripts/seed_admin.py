import asyncio
import sys

from app.core.config import settings
from app.db.session import SessionLocal
from app.modules.auth.service import ensure_admin


async def run() -> int:
    if not settings.admin_username or not settings.admin_password:
        print(
            "缺少 ADMIN_USERNAME 或 ADMIN_PASSWORD 环境变量，拒绝创建管理员账号。",
            file=sys.stderr,
        )
        return 1
    async with SessionLocal() as session:
        user = await ensure_admin(session, settings.admin_username, settings.admin_password)
        print(f"管理员账号已就绪：{user.username}（id={user.id}）")
    return 0


def main() -> None:
    raise SystemExit(asyncio.run(run()))


if __name__ == "__main__":
    main()
