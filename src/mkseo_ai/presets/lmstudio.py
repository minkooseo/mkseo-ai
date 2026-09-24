"""LM Studio development configuration."""

from mkseo_ai.config import LmStudioModelConfig, ServerConfig


def load() -> ServerConfig:
    """Select the local LM Studio server and its model."""
    return ServerConfig(
        mode="dev",
        port=8787,
        model=LmStudioModelConfig(
            provider="lmstudio",
            name="google/gemma-4-e4b",
            base_url="http://127.0.0.1:1234/v1",
        ),
    )
