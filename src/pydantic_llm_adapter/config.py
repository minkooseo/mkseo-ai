"""Server and language model configuration."""

from __future__ import annotations

import os
from pathlib import Path
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


class HostedModelConfig(BaseModel):
    """Gemini or OpenAI model selection."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    provider: Literal["gemini", "openai"]
    """Hosted model provider, for example `gemini`."""

    name: NonBlankString
    """Provider model name, for example `gemini-2.5-flash`."""


class OpenAICompatibleFileModelConfig(BaseModel):
    """Shared non-secret settings for local OpenAI-compatible servers."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    name: NonBlankString
    """Loaded model identifier, for example `google/gemma-4-e2b`."""

    base_url: NonBlankString
    """OpenAI-compatible API root, for example `http://localhost:1234/v1`."""


class LmStudioFileModelConfig(OpenAICompatibleFileModelConfig):
    """Non-secret LM Studio settings loaded from YAML."""

    provider: Literal["lmstudio"]
    """Local model provider, always `lmstudio`."""


class LmStudioModelConfig(LmStudioFileModelConfig):
    """Resolved LM Studio settings with its environment-only credential."""

    api_key: NonBlankString | None
    """Optional bearer token supplied through `MODEL_API_KEY`."""


class OmlxFileModelConfig(OpenAICompatibleFileModelConfig):
    """Non-secret OMLX settings loaded from YAML."""

    provider: Literal["omlx"]
    """Local model provider, always `omlx`."""


class OmlxModelConfig(OmlxFileModelConfig):
    """Resolved OMLX settings with its environment-only credential."""

    api_key: NonBlankString | None
    """Optional bearer token supplied through `OMLX_API_KEY`."""


type FileModelConfig = Annotated[
    LmStudioFileModelConfig | OmlxFileModelConfig | HostedModelConfig,
    Field(discriminator="provider"),
]
type ModelConfig = Annotated[
    LmStudioModelConfig | OmlxModelConfig | HostedModelConfig,
    Field(discriminator="provider"),
]


class ServerFileConfig(BaseModel):
    """Non-secret server settings read from one YAML file."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    mode: Mode
    """Runtime mode, for example `dev`."""

    port: ServerPort
    """HTTP listen port, for example `8787`."""

    model: FileModelConfig
    """Provider-specific model settings without credentials."""


class ServerConfig(BaseModel):
    """Resolved HTTP and language model configuration."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    mode: Mode
    """Runtime mode, for example `dev`."""

    port: ServerPort
    """HTTP listen port, for example `8787`."""

    model: ModelConfig
    """Provider-specific model settings with environment credentials."""


def load_config(path: Path) -> ServerConfig:
    """Load YAML settings and environment credentials."""
    try:
        raw_config = yaml.safe_load(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise ValueError(f"could not read server config {path}: {exc}") from exc
    except yaml.YAMLError as exc:
        raise ValueError(
            f"invalid YAML in server config {path}: {exc}"
        ) from exc

    file_config = ServerFileConfig.model_validate(raw_config)
    if isinstance(file_config.model, LmStudioFileModelConfig):
        model: ModelConfig = LmStudioModelConfig(
            provider=file_config.model.provider,
            name=file_config.model.name,
            base_url=file_config.model.base_url,
            api_key=os.environ.get("MODEL_API_KEY"),
        )
    elif isinstance(file_config.model, OmlxFileModelConfig):
        model = OmlxModelConfig(
            provider=file_config.model.provider,
            name=file_config.model.name,
            base_url=file_config.model.base_url,
            api_key=os.environ.get("OMLX_API_KEY"),
        )
    else:
        model = file_config.model

    return ServerConfig(
        mode=file_config.mode,
        port=file_config.port,
        model=model,
    )
