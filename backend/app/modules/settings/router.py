from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.modules.auth.deps import get_current_user
from app.modules.settings import service
from app.modules.settings.schemas import ThemeOut, ThemePatch

public_router = APIRouter(prefix="/api/settings", tags=["settings"])
admin_router = APIRouter(
    prefix="/api/admin/settings", tags=["settings-admin"], dependencies=[Depends(get_current_user)]
)


@public_router.get("/theme", response_model=ThemeOut)
async def get_theme(session: AsyncSession = Depends(get_db)) -> ThemeOut:
    return ThemeOut(theme=await service.get_theme(session))


@admin_router.put("/theme", response_model=ThemeOut)
async def update_theme(
    payload: ThemePatch, session: AsyncSession = Depends(get_db)
) -> ThemeOut:
    return ThemeOut(theme=await service.update_theme(session, payload))
