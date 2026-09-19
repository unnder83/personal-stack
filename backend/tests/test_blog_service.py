from datetime import datetime

import pytest

from app.core.errors import AppError
from app.modules.blog import service
from app.modules.blog.models import Post, Tag
from app.modules.blog.schemas import PostInput


def make_input(**overrides) -> PostInput:
    data = {
        "title": "Hello World",
        "slug": None,
        "summary": "摘要",
        "content_md": "# 标题\n\n正文",
        "status": "draft",
        "tags": ["Python"],
    }
    data.update(overrides)
    return PostInput(**data)


async def create_published(db_session, slug: str, when: datetime, title: str = "标题") -> Post:
    post = Post(
        title=title,
        slug=slug,
        content_md="正文",
        status="published",
        published_at=when,
    )
    db_session.add(post)
    await db_session.flush()
    return post


async def test_create_post_generates_slug_and_tags(db_session):
    post = await service.create_post(db_session, make_input())

    assert post.slug == "hello-world"
    assert [tag.name for tag in post.tags] == ["Python"]


async def test_create_post_reuses_existing_tag(db_session):
    await service.create_post(db_session, make_input(tags=["Python"]))

    second = await service.create_post(db_session, make_input(title="Another", tags=["Python"]))

    assert second.tags[0].id is not None
    result = await db_session.execute(Tag.__table__.select())
    assert len(result.all()) == 1


async def test_create_post_slug_conflict(db_session):
    await service.create_post(db_session, make_input())

    with pytest.raises(AppError) as exc_info:
        await service.create_post(db_session, make_input(title="Other", slug="hello-world"))

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "slug_conflict"


async def test_update_post_keeps_own_slug(db_session):
    post = await service.create_post(db_session, make_input())

    updated = await service.update_post(
        db_session, post, make_input(title="Hello World", status="published")
    )

    assert updated.slug == "hello-world"
    assert updated.published_at is not None


async def test_update_post_replaces_tags(db_session):
    post = await service.create_post(db_session, make_input(tags=["Python"]))

    updated = await service.update_post(db_session, post, make_input(tags=["FastAPI"]))

    assert [tag.name for tag in updated.tags] == ["FastAPI"]


async def test_tag_names_are_normalized(db_session):
    post = await service.create_post(db_session, make_input(tags=["  Python  ", "python"]))

    assert [tag.name for tag in post.tags] == ["Python"]


async def test_public_list_excludes_drafts(db_session):
    await create_published(db_session, "published-one", datetime(2026, 9, 1, 8, 0, 0))
    draft = Post(title="草稿", slug="draft-one", content_md="x", status="draft")
    db_session.add(draft)
    await db_session.flush()

    items, total = await service.list_published(
        db_session, tag_slug=None, page=1, page_size=20
    )

    assert total == 1
    assert [post.slug for post in items] == ["published-one"]


async def test_published_order_is_newest_first(db_session):
    await create_published(db_session, "older", datetime(2026, 9, 1, 8, 0, 0))
    await create_published(db_session, "newer", datetime(2026, 9, 10, 8, 0, 0))

    items, _ = await service.list_published(db_session, tag_slug=None, page=1, page_size=20)

    assert [post.slug for post in items] == ["newer", "older"]


async def test_page_beyond_range_returns_empty(db_session):
    await create_published(db_session, "only", datetime(2026, 9, 1, 8, 0, 0))

    items, total = await service.list_published(db_session, tag_slug=None, page=5, page_size=20)

    assert items == []
    assert total == 1


async def test_filter_by_tag_slug(db_session):
    tagged = Post(
        title="标题",
        slug="tagged",
        content_md="正文",
        status="published",
        published_at=datetime(2026, 9, 1, 8, 0, 0),
        tags=[Tag(name="Python", slug="python")],
    )
    db_session.add(tagged)
    await db_session.flush()
    await create_published(db_session, "untagged", datetime(2026, 9, 2, 8, 0, 0))
    await db_session.flush()

    items, total = await service.list_published(
        db_session, tag_slug="python", page=1, page_size=20
    )

    assert total == 1
    assert items[0].slug == "tagged"


async def test_public_detail_of_draft_returns_404(db_session):
    db_session.add(Post(title="草稿", slug="draft-one", content_md="x", status="draft"))
    await db_session.flush()

    with pytest.raises(AppError) as exc_info:
        await service.get_published_by_slug(db_session, "draft-one")

    assert exc_info.value.status_code == 404
    assert exc_info.value.code == "not_found"


async def test_delete_post_removes_row_and_tag_links(db_session):
    post = await service.create_post(db_session, make_input())

    await service.delete_post(db_session, post)

    result = await db_session.execute(Post.__table__.select())
    assert result.all() == []


async def test_tags_only_include_published(db_session):
    published = Post(
        title="标题",
        slug="published-one",
        content_md="正文",
        status="published",
        published_at=datetime(2026, 9, 1, 8, 0, 0),
        tags=[Tag(name="Python", slug="python")],
    )
    draft = Post(
        title="草稿",
        slug="draft-one",
        content_md="x",
        status="draft",
        tags=[Tag(name="DraftTag", slug="drafttag")],
    )
    db_session.add_all([published, draft])
    await db_session.flush()

    tags = await service.list_published_tags(db_session)

    assert [tag.name for tag in tags] == ["Python"]
