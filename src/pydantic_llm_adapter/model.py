"""Load a PydanticAI adapter using the configuration's compatible API."""

from httpx import AsyncClient
from pydantic_ai.models import Model
from pydantic_ai.models.google import GoogleModel
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.google import GoogleProvider
from pydantic_ai.providers.openai import OpenAIProvider

from pydantic_llm_adapter.config import ModelConfig


def load_model(
    config: ModelConfig, *, http_client: AsyncClient | None
) -> Model:
    """Build the compatible API adapter without making a model request."""
    if config.compatible_api == "google":
        return GoogleModel(
            config.name,
            provider=GoogleProvider(
                base_url=config.base_url,
                http_client=http_client,
            ),
        )

    return OpenAIChatModel(
        config.name,
        provider=OpenAIProvider(
            base_url=config.base_url,
            http_client=http_client,
        ),
    )
