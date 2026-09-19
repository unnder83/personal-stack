from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.modules.blog.models import Post, Tag
from app.modules.blog.schemas import PostInput
from app.modules.blog.slugs import make_slug, normalize_tag


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


async def _slug_taken(session: AsyncSession, slug: str, exclude_id: int | None = None) -> bool:
    stmt = select(Post.id).where(Post.slug == slug)
    if exclude_id is not None:
        stmt = stmt.where(Post.id != exclude_id)
    return (await session.execute(stmt.limit(1))).scalar_one_or_none() is not None


def _apply_pagination(stmt, page: int, page_size: int):
    return stmt.limit(page_size).offset((page - 1) * page_size)


async def _count(session: AsyncSession, stmt) -> int:
    return (await session.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()


async def _get_or_create_tags(session: AsyncSession, names: list[str]) -> list[Tag]:
    normalized: dict[str, tuple[str, str]] = {}
    for raw in names:
        try:
            display, slug = normalize_tag(raw)
        except ValueError:
            continue
        if slug not in normalized:
            normalized[slug] = (display, slug)
    if not normalized:
        return []
    slugs = list(normalized)
    existing = (
        (await session.execute(select(Tag).where(Tag.slug.in_(slugs)))).scalars().all()
    )
    by_slug = {tag.slug: tag for tag in existing}
    tags: list[Tag] = []
    for slug, (display, _) in normalized.items():
        tag = by_slug.get(slug)
        if tag is None:
            tag = Tag(name=display, slug=slug)
            session.add(tag)
            by_slug[slug] = tag
        tags.append(tag)
    return tags


async def list_published(
    session: AsyncSession, *, tag_slug: str | None, page: int, page_size: int
) -> tuple[list[Post], int]:
    stmt = select(Post).where(Post.status == "published")
    if tag_slug:
        stmt = stmt.join(Post.tags).where(Tag.slug == tag_slug)
    total = await _count(session, stmt)
    items = (
        await session.execute(
            _apply_pagination(
                stmt.order_by(Post.published_at.desc(), Post.id.desc()), page, page_size
            ).options(selectinload(Post.tags))
        )
    ).scalars().all()
    return list(items), total


async def get_published_by_slug(session: AsyncSession, slug: str) -> Post:
    post = (
        await session.execute(
            select(Post).where(Post.slug == slug, Post.status == "published")
        )
    ).scalar_one_or_none()
    if post is None:
        raise AppError("not_found", "文章不存在", 404)
    return post


async def list_admin_posts(
    session: AsyncSession, *, status: str | None, page: int, page_size: int
) -> tuple[list[Post], int]:
    stmt = select(Post)
    if status:
        stmt = stmt.where(Post.status == status)
    total = await _count(session, stmt)
    items = (
        await session.execute(
            _apply_pagination(
                stmt.order_by(Post.updated_at.desc(), Post.id.desc()), page, page_size
            )
        )
    ).scalars().all()
    return list(items), total


async def get_post(session: AsyncSession, post_id: int) -> Post:
    post = await session.get(Post, post_id)
    if post is None:
        raise AppError("not_found", "文章不存在", 404)
    return post


async def create_post(session: AsyncSession, data: PostInput) -> Post:
    slug = data.slug or make_slug(data.title)
    if await _slug_taken(session, slug):
        raise AppError("slug_conflict", "该链接地址已被使用", 409)
    post = Post(
        title=data.title,
        slug=slug,
        summary=data.summary,
        content_md=data.content_md,
        status=data.status,
        published_at=_now() if data.status == "published" else None,
    )
    post.tags = await _get_or_create_tags(session, data.tags)
    session.add(post)
    await session.commit()
    return post


async def update_post(session: AsyncSession, post: Post, data: PostInput) -> Post:
    slug = data.slug or post.slug
    if await _slug_taken(session, slug, exclude_id=post.id):
        raise AppError("slug_conflict", "该链接地址已被使用", 409)
    post.title = data.title
    post.slug = slug
    post.summary = data.summary
    post.content_md = data.content_md
    if data.status == "published" and post.published_at is None:
        post.published_at = _now()
    post.status = data.status
    post.tags = await _get_or_create_tags(session, data.tags)
    await session.commit()
    return post


async def delete_post(session: AsyncSession, post: Post) -> None:
    await session.delete(post)
    await session.commit()


async def list_published_tags(session: AsyncSession) -> list[Tag]:
    stmt = (
        select(Tag)
        .join(Tag.posts)
        .where(Post.status == "published")
        .distinct()
        .order_by(Tag.name)
    )
    return list((await session.execute(stmt)).scalars().all())
