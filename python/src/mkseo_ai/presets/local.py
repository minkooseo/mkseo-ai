"""Local provider settings bundled with the Python distribution."""

from importlib.resources import files
from typing import Literal

from pydantic import TypeAdapter

from mkseo_ai.config import ModelConfig, ServerConfig


def load_local(provider: Literal["omlx", "lmstudio"]) -> ServerConfig:
    """Load a local provider's model and development server settings."""
    resource = files("mkseo_ai.presets").joinpath("local-models.json")
    presets = _PRESETS_ADAPTER.validate_json(resource.read_text())
    settings = presets[provider]
    if settings["provider"] != provider:
        raise ValueError("preset provider must match its selection")
    return ServerConfig(
        mode="dev",
        port=8787,
        model=_MODEL_ADAPTER.validate_python(
            {
                "provider": settings["provider"],
                "name": settings["name"],
                "base_url": settings["baseUrl"],
            }
        ),
    )


_PRESETS_ADAPTER = TypeAdapter(
    dict[
        Literal["omlx", "lmstudio"],
        dict[Literal["provider", "name", "baseUrl"], str],
    ]
)
_MODEL_ADAPTER: TypeAdapter[ModelConfig] = TypeAdapter(ModelConfig)
