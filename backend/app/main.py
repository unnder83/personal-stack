from fastapi import FastAPI

from app.core.config import settings
from app.core.errors import register_error_handlers

app = FastAPI(title=settings.app_name)
register_error_handlers(app)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
