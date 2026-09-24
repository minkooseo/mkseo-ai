"""Server and language model configuration."""

from __future__ import annotations

from enum import StrEnum, auto
from typing import Annotated, Literal

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

    GEMINI_LITE = auto()
    """Development Gemini 3.5 Flash-Lite preset."""

    GEMINI_FLASH = auto()
    """Development Gemini 3.8 Flash preset."""


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


class ModelChoice(BaseModel):
    """A displayable model choice backed by a bundled preset."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    id: str
    """Short choice ID, for example `flash-lite`."""

    label: str
    """Display name, for example `Gemini 3.5 Flash-Lite`."""

    preset: LlmPreset
    """Configuration choice, for example `LlmPreset.GEMINI_LITE`."""


class ProviderChoice(BaseModel):
    """A provider and the bundled models available to select."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    id: Literal["omlx", "lmstudio", "gemini"]
    """Short provider ID, for example `lmstudio`."""

    label: str
    """Display name, for example `LM Studio`."""

    models: tuple[ModelChoice, ...]
    """Available model choices, for example the two Gemini models."""


def list_provider_models() -> tuple[ProviderChoice, ...]:
    """List bundled provider and model choices for a selection interface."""
    return _PROVIDER_CHOICES


def load_config(preset: LlmPreset = LlmPreset.OMLX) -> ServerConfig:
    """Load a bundled configuration preset; default to OMLX."""
    if type(preset) is not LlmPreset:
        raise TypeError("preset must be a LlmPreset")
    from mkseo_ai.presets.gemini import flash_3_8, flash_lite
    from mkseo_ai.presets.lmstudio import load as load_lmstudio
    from mkseo_ai.presets.omlx import load as load_omlx

    return {
        LlmPreset.OMLX: load_omlx,
        LlmPreset.LMSTUDIO: load_lmstudio,
        LlmPreset.GEMINI_LITE: flash_lite,
        LlmPreset.GEMINI_FLASH: flash_3_8,
    }[preset]()


_PROVIDER_CHOICES = (
    ProviderChoice(
        id="omlx",
        label="oMLX",
        models=(
            ModelChoice(id="gemma-4", label="Gemma 4", preset=LlmPreset.OMLX),
        ),
    ),
    ProviderChoice(
        id="lmstudio",
        label="LM Studio",
        models=(
            ModelChoice(
                id="gemma-4", label="Gemma 4", preset=LlmPreset.LMSTUDIO
            ),
        ),
    ),
    ProviderChoice(
        id="gemini",
        label="Gemini",
        models=(
            ModelChoice(
                id="flash-lite",
                label="Flash Lite",
                preset=LlmPreset.GEMINI_LITE,
            ),
            ModelChoice(
                id="flash-3.8",
                label="Flash 3.8",
                preset=LlmPreset.GEMINI_FLASH,
            ),
        ),
    ),
)
