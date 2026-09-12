"""Load the configured PydanticAI model adapter."""

from __future__ import annotations

from httpx import AsyncClient
from pydantic_ai.models import Model, infer_model
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.google import GoogleProvider
from pydantic_ai.providers.openai import OpenAIProvider

from pydantic_llm_adapter.config import (
    LmStudioModelConfig,
    ModelConfig,
    OmlxModelConfig,
)


def load_model(
    config: ModelConfig, *, http_client: AsyncClient | None
) -> Model:
    """Load the selected provider adapter without making a model request."""
    if isinstance(config, (LmStudioModelConfig, OmlxModelConfig)):
        provider = OpenAIProvider(
            base_url=config.base_url,
            api_key=config.api_key,
            http_client=http_client,
        )
        return OpenAIChatModel(config.name, provider=provider)

    provider = "google" if config.provider == "gemini" else "openai"
    if http_client is None:
        return infer_model(f"{provider}:{config.name}")
    return infer_model(
        f"{provider}:{config.name}",
        provider_factory=lambda name: (
            GoogleProvider(
                http_client=http_client,
            )
            if name == "google"
            else OpenAIProvider(http_client=http_client)
        ),
    )
