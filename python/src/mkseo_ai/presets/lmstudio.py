"""LM Studio development configuration."""

from mkseo_ai.config import ServerConfig
from mkseo_ai.presets.local import load_local


def load() -> ServerConfig:
    """Select the local LM Studio server and its model."""
    return load_local("lmstudio")
