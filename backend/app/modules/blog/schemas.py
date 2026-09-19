import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str


class PostSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    slug: str
    summary: str | None
    published_at: datetime | None
    tags: list[TagOut]


class PostDetail(PostSummary):
    content_md: str
    status: str
    created_at: datetime
    updated_at: datetime


class PostAdminSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    slug: str
    status: str
    published_at: datetime | None
    updated_at: datetime


class PostInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    slug: str | None = Field(default=None, max_length=200)
    summary: str | None = Field(default=None, max_length=500)
    content_md: str = Field(min_length=1, max_length=200000)
    status: Literal["draft", "published"] = "draft"
    tags: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if value == "":
            return None
        if not re.fullmatch(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", value):
            raise ValueError("slug 只能包含小写字母、数字和连字符")
        return value


class PostListResponse(BaseModel):
    items: list[PostSummary]
    total: int
    page: int
    page_size: int


class PostAdminListResponse(BaseModel):
    items: list[PostAdminSummary]
    total: int
    page: int
    page_size: int
