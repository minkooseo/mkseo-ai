"""Gemini development configurations."""

from typing import Literal

from mkseo_ai.config import ExternalServiceModelConfig, ServerConfig


def flash_lite() -> ServerConfig:
    """Select Gemini 3.5 Flash-Lite."""
    return _config("gemini-3.5-flash-lite")


def flash_3_8() -> ServerConfig:
    """Select Gemini 3.8 Flash."""
    return _config("gemini-3.8-flash")


def _config(
    name: Literal["gemini-3.5-flash-lite", "gemini-3.8-flash"],
) -> ServerConfig:
    return ServerConfig(
        mode="dev",
        port=8787,
        model=ExternalServiceModelConfig(
            provider="gemini",
            name=name,
            base_url="https://generativelanguage.googleapis.com",
        ),
    )
