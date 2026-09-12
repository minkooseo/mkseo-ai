"""Server and language model configuration."""

from __future__ import annotations

from enum import StrEnum, auto
from importlib.resources import files
from typing import Annotated, Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Mode = Literal["dev", "prod"]
ModelProvider = Literal["lmstudio", "omlx", "gemini", "openai"]
NonBlankString = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1),
]
ServerPort = Annotated[int, Field(ge=1, le=65535)]


class LlmPreset(StrEnum):
    """Bundled server and model configuration choices."""

    OMLX = auto()
    """Development OMLX preset, selected by default."""

    LMSTUDIO = auto()
    """Development LM Studio preset."""

    GEMINI = auto()
    """Development Gemini preset."""


class ExternalServiceModelConfig(BaseModel):
    """Model selection for an external service such as Gemini or OpenAI."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    provider: Literal["gemini", "openai"]
    """Hosted model provider, for example `gemini`."""

    name: NonBlankString
    """Provider model name, for example `gemini-2.5-flash`."""

    base_url: NonBlankString
    """Service API root, for example `https://api.openai.com/v1`."""

    @property
    def compatible_api(self) -> Literal["google", "openai"]:
        """Underlying API: Google for Gemini, OpenAI for OpenAI."""
        if self.provider == "gemini":
            return "google"
        return "openai"


class OpenAICompatibleModelConfig(BaseModel):
    """Shared non-secret settings for local OpenAI-compatible servers."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    name: NonBlankString
    """Loaded model identifier, for example `google/gemma-4-e2b`."""

    base_url: NonBlankString
    """OpenAI-compatible API root, for example `http://localhost:1234/v1`."""

    @property
    def compatible_api(self) -> Literal["openai"]:
        """Local servers use the OpenAI-compatible API."""
        return "openai"


class LmStudioModelConfig(OpenAICompatibleModelConfig):
    """Model selection for a local LM Studio server."""

    provider: Literal["lmstudio"]
    """Local model provider, always `lmstudio`."""


class OmlxModelConfig(OpenAICompatibleModelConfig):
    """Model selection for a local OMLX server."""

    provider: Literal["omlx"]
    """Local model provider, always `omlx`."""


type ModelConfig = Annotated[
    LmStudioModelConfig | OmlxModelConfig | ExternalServiceModelConfig,
    Field(discriminator="provider"),
]


class ServerConfig(BaseModel):
    """HTTP and language model settings from a bundled preset."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    mode: Mode
    """Runtime mode, for example `dev`."""

    port: ServerPort
    """HTTP listen port, for example `8787`."""

    model: ModelConfig
    """Model selection, for example the local OMLX development model."""


def load_config(preset: LlmPreset = LlmPreset.OMLX) -> ServerConfig:
    """Load a bundled configuration preset; default to OMLX."""
    if type(preset) is not LlmPreset:
        raise TypeError("preset must be a LlmPreset")
    resource = files("mkseo_ai").joinpath("presets", _PRESET_FILES[preset])
    try:
        raw_config = yaml.safe_load(resource.read_text(encoding="utf-8"))
    except OSError as exc:
        raise ValueError(
            f"could not read config preset {preset}: {exc}"
        ) from exc
    except yaml.YAMLError as exc:
        raise ValueError(
            f"invalid YAML in config preset {preset}: {exc}"
        ) from exc

    return ServerConfig.model_validate(raw_config)


_PRESET_FILES = {
    LlmPreset.OMLX: "server-dev-omlx.yaml",
    LlmPreset.LMSTUDIO: "server-dev-lmstudio.yaml",
    LlmPreset.GEMINI: "server-dev-gemini.yaml",
}
