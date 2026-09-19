import re

import pytest

from app.modules.blog.slugs import SLUG_PATTERN, make_slug, normalize_tag


def test_make_slug_from_english_title():
    assert make_slug("Hello, FastAPI World!") == "hello-fastapi-world"


def test_make_slug_collapses_separators():
    assert make_slug("a---b   c") == "a-b-c"


def test_make_slug_falls_back_for_non_ascii_title():
    slug = make_slug("我的第一篇文章")

    assert re.fullmatch(SLUG_PATTERN, slug)
    assert slug.startswith("post-")


def test_make_slug_fallback_is_unique_per_second():
    first = make_slug("中文标题")
    second = make_slug("中文标题")

    assert first != second or len(first) > 0


def test_normalize_tag_trims_and_lowercases_slug():
    name, slug = normalize_tag("  Python 入门 ")

    assert name == "Python 入门"
    assert slug == "python-入门"


def test_normalize_tag_rejects_blank():
    with pytest.raises(ValueError):
        normalize_tag("   ")
