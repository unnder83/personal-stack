from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.modules.settings.models import SiteSetting
from app.modules.settings.schemas import ThemeConfig, ThemePatch

THEME_KEY = "theme"


async def _get_row(session: AsyncSession, key: str) -> SiteSetting | None:
    return (
        await session.execute(select(SiteSetting).where(SiteSetting.key == key))
    ).scalar_one_or_none()


async def get_theme(session: AsyncSession) -> ThemeConfig:
    row = await _get_row(session, THEME_KEY)
    if row is None:
        raise AppError("not_found", "主题配置不存在", 404)
    return ThemeConfig.model_validate(row.value)


async def update_theme(session: AsyncSession, patch: ThemePatch) -> ThemeConfig:
    row = await _get_row(session, THEME_KEY)
    current = ThemeConfig.model_validate(row.value) if row else ThemeConfig()
    merged = current.model_dump()
    merged.update(patch.model_dump(exclude_unset=True, exclude_none=True))
    theme = ThemeConfig.model_validate(merged)
    if row is None:
        session.add(SiteSetting(key=THEME_KEY, value=theme.model_dump()))
    else:
        row.value = theme.model_dump()
    await session.commit()
    return theme
