import json
import os
from unittest import IsolatedAsyncioTestCase
from unittest.mock import patch

from httpx import AsyncClient, MockTransport, Request, Response
from pydantic_ai import Agent
from pydantic_ai.models.google import GoogleModel
from pydantic_ai.models.openai import OpenAIResponsesModel

from pydantic_llm_adapter.config import (
    HostedModelConfig,
    LmStudioModelConfig,
    OmlxModelConfig,
)
from pydantic_llm_adapter.model import load_model


class ModelTestCase(IsolatedAsyncioTestCase):
    async def test_load_model__local_provider_uses_configured_transport(self):
        requests: list[Request] = []
        for config in [
            OmlxModelConfig(
                provider="omlx",
                name="omlx-test-model",
                base_url="http://omlx.test/v1",
                api_key="omlx-test-key",
            ),
            LmStudioModelConfig(
                provider="lmstudio",
                name="lmstudio-test-model",
                base_url="http://lmstudio.test/v1",
                api_key="lmstudio-test-key",
            ),
        ]:
            with self.subTest(provider=config.provider):
                requests.clear()

                def respond(request: Request) -> Response:
                    requests.append(request)
                    return Response(
                        200,
                        json={
                            "id": "chat-test",
                            "object": "chat.completion",
                            "created": 1,
                            "model": "local-test",
                            "choices": [
                                {
                                    "index": 0,
                                    "message": {
                                        "role": "assistant",
                                        "content": "Local answer",
                                    },
                                    "finish_reason": "stop",
                                }
                            ],
                        },
                    )

                async with AsyncClient(
                    transport=MockTransport(respond)
                ) as client:
                    model = load_model(config, http_client=client)
                    self.assertEqual([], requests)
                    async with Agent(model) as agent:
                        result = await agent.run("Hello")
                    self.assertEqual("Local answer", result.output)
                    self.assertFalse(client.is_closed)
                self.assertEqual(1, len(requests))
                self.assertEqual(
                    config.base_url + "/chat/completions",
                    str(requests[0].url),
                )
                self.assertEqual(
                    "Bearer " + str(config.api_key),
                    requests[0].headers["authorization"],
                )
                self.assertEqual(
                    config.name, json.loads(requests[0].content)["model"]
                )

    async def test_load_model__hosted_provider_selection_with_owned_client(
        self,
    ):
        with patch.dict(
            os.environ,
            {"GOOGLE_API_KEY": "google-test-key", "OPENAI_API_KEY": "test-key"},
            clear=True,
        ):
            for config, model_type in [
                (
                    HostedModelConfig(provider="gemini", name="gemini-test"),
                    GoogleModel,
                ),
                (
                    HostedModelConfig(provider="openai", name="gpt-test"),
                    OpenAIResponsesModel,
                ),
            ]:
                with self.subTest(provider=config.provider):
                    model = load_model(config, http_client=None)
                    self.assertIsInstance(model, model_type)
                    async with model:
                        pass

    async def test_load_model__gemini_custom_client_uses_standard_key(self):
        def unexpected_request(request: Request) -> Response:
            self.fail("Loading a model must not send a request")

        with patch.dict(
            os.environ, {"GOOGLE_API_KEY": "google-test-key"}, clear=True
        ):
            async with AsyncClient(
                transport=MockTransport(unexpected_request)
            ) as client:
                model = load_model(
                    HostedModelConfig(provider="gemini", name="gemini-test"),
                    http_client=client,
                )
                self.assertIsInstance(model, GoogleModel)
                async with model:
                    pass
                self.assertFalse(client.is_closed)
