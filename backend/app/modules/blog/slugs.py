import re
from datetime import UTC, datetime

SLUG_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"

_NON_SLUG = re.compile(r"[^a-z0-9]+")


def make_slug(title: str) -> str:
    candidate = _NON_SLUG.sub("-", title.lower()).strip("-")
    if candidate:
        return candidate
    return f"post-{datetime.now(UTC):%Y%m%d-%H%M%S}"


def normalize_tag(name: str) -> tuple[str, str]:
    display = name.strip()
    if not display:
        raise ValueError("标签名不能为空")
    slug = re.sub(r"\s+", "-", display.lower())
    return display, slug
