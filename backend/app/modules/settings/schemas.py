import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Accent = Literal["violet", "blue", "emerald", "rose", "amber", "slate"]
ThemeMode = Literal["light", "dark", "system"]
BackgroundType = Literal["solid", "gradient", "mesh"]

_GRADIENT_PRESETS = {"aurora", "daylight", "dusk"}
_MESH_PRESETS = {"mesh-violet", "mesh-emerald"}
_HEX_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")


class BackgroundConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: BackgroundType
    value: str

    @model_validator(mode="after")
    def validate_value(self) -> "BackgroundConfig":
        if self.type == "solid":
            if not _HEX_RE.fullmatch(self.value):
                raise ValueError("solid 背景必须是十六进制色值")
        elif self.type == "gradient":
            if self.value not in _GRADIENT_PRESETS:
                raise ValueError("未知的渐变预设")
        elif self.value not in _MESH_PRESETS:
            raise ValueError("未知的 mesh 预设")
        return self


class ThemeConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: ThemeMode = "system"
    accent: Accent = "violet"
    radius: int = Field(default=16, ge=0, le=28)
    blur: int = Field(default=12, ge=0, le=24)
    background: BackgroundConfig = BackgroundConfig(type="gradient", value="aurora")


class ThemePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: ThemeMode | None = None
    accent: Accent | None = None
    radius: int | None = Field(default=None, ge=0, le=28)
    blur: int | None = Field(default=None, ge=0, le=24)
    background: BackgroundConfig | None = None


class ThemeOut(BaseModel):
    theme: ThemeConfig
