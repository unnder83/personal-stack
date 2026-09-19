from datetime import datetime

from sqlalchemy import text

from app.modules.blog.models import Post, Tag


async def test_blog_tables_exist_after_migration(db_session):
    result = await db_session.execute(
        text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = DATABASE() AND table_name IN ('posts', 'tags', 'post_tags')"
        )
    )

    assert sorted(row[0] for row in result) == ["post_tags", "posts", "tags"]


async def test_post_with_tags_roundtrip(db_session):
    post = Post(
        title="Hello",
        slug="hello",
        summary="摘要",
        content_md="# 标题\n\n正文",
        status="published",
        published_at=datetime(2026, 9, 19, 12, 0, 0),
        tags=[Tag(name="Python", slug="python")],
    )
    db_session.add(post)
    await db_session.flush()

    loaded = await db_session.get(Post, post.id)

    assert loaded is not None
    assert loaded.tags[0].name == "Python"
    assert loaded.status == "published"
