from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.modules.auth.deps import get_current_user
from app.modules.blog import service
from app.modules.blog.schemas import (
    PostAdminListResponse,
    PostAdminSummary,
    PostDetail,
    PostInput,
    PostListResponse,
    PostSummary,
    TagOut,
)

public_router = APIRouter(prefix="/api", tags=["blog"])
admin_router = APIRouter(
    prefix="/api/admin/posts", tags=["blog-admin"], dependencies=[Depends(get_current_user)]
)


@public_router.get("/posts", response_model=PostListResponse)
async def list_posts(
    tag: str | None = None,
    page: int = Query(default=1, ge=1, le=100000),
    page_size: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_db),
) -> PostListResponse:
    items, total = await service.list_published(
        session, tag_slug=tag, page=page, page_size=page_size
    )
    return PostListResponse(
        items=[PostSummary.model_validate(post) for post in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@public_router.get("/posts/{slug}", response_model=PostDetail)
async def get_post_detail(slug: str, session: AsyncSession = Depends(get_db)) -> PostDetail:
    post = await service.get_published_by_slug(session, slug)
    return PostDetail.model_validate(post)


@public_router.get("/tags", response_model=list[TagOut])
async def list_tags(session: AsyncSession = Depends(get_db)) -> list[TagOut]:
    tags = await service.list_published_tags(session)
    return [TagOut.model_validate(tag) for tag in tags]


@admin_router.get("", response_model=PostAdminListResponse)
async def list_admin_posts(
    status: str | None = None,
    page: int = Query(default=1, ge=1, le=100000),
    page_size: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_db),
) -> PostAdminListResponse:
    items, total = await service.list_admin_posts(
        session, status=status, page=page, page_size=page_size
    )
    return PostAdminListResponse(
        items=[PostAdminSummary.model_validate(post) for post in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@admin_router.get("/{post_id}", response_model=PostDetail)
async def get_admin_post(post_id: int, session: AsyncSession = Depends(get_db)) -> PostDetail:
    post = await service.get_post(session, post_id)
    return PostDetail.model_validate(post)


@admin_router.post("", response_model=PostDetail)
async def create_post(payload: PostInput, session: AsyncSession = Depends(get_db)) -> PostDetail:
    post = await service.create_post(session, payload)
    return PostDetail.model_validate(post)


@admin_router.put("/{post_id}", response_model=PostDetail)
async def update_post(
    post_id: int, payload: PostInput, session: AsyncSession = Depends(get_db)
) -> PostDetail:
    post = await service.get_post(session, post_id)
    post = await service.update_post(session, post, payload)
    return PostDetail.model_validate(post)


@admin_router.delete("/{post_id}")
async def delete_post(post_id: int, session: AsyncSession = Depends(get_db)) -> dict[str, str]:
    post = await service.get_post(session, post_id)
    await service.delete_post(session, post)
    return {"status": "ok"}
