from fastapi import FastAPI

from app.core.config import settings
from app.core.errors import register_error_handlers
from app.modules.auth.router import router as auth_router
from app.modules.blog.router import admin_router as blog_admin_router
from app.modules.blog.router import public_router as blog_public_router
from app.modules.storage.router import router as storage_router

app = FastAPI(title=settings.app_name)
register_error_handlers(app)
app.include_router(auth_router)
app.include_router(blog_public_router)
app.include_router(blog_admin_router)
app.include_router(storage_router)


@app.get("/api/health")
async def health() -> dict[str, str]:
    raise RuntimeError("drill: forced unhealthy")
