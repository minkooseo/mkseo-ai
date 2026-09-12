import json
import os
from unittest import IsolatedAsyncioTestCase
from unittest.mock import patch

from httpx import AsyncClient, MockTransport, Request, Response
from pydantic_ai import Agent
from pydantic_ai.models.google import GoogleModel
from pydantic_ai.models.openai import OpenAIChatModel

from mkseo_ai.config import (
    ExternalServiceModelConfig,
    LmStudioModelConfig,
    OmlxModelConfig,
)
from mkseo_ai.model import load_model


class ModelTestCase(IsolatedAsyncioTestCase):
    @patch.dict(
        os.environ,
        {
            "MODEL_API_KEY": "lmstudio-test-key",
            "OMLX_API_KEY": "omlx-test-key",
        },
        clear=True,
    )
    async def test_load_model__local_provider_uses_configured_transport(self):
        requests: list[Request] = []
        for config in [
            OmlxModelConfig(
                provider="omlx",
                name="omlx-test-model",
                base_url="http://omlx.test/v1",
            ),
            LmStudioModelConfig(
                provider="lmstudio",
                name="lmstudio-test-model",
                base_url="http://lmstudio.test/v1",
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
                    "Bearer api-key-not-set",
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
                    ExternalServiceModelConfig(
                        provider="gemini",
                        name="gemini-test",
                        base_url="https://generativelanguage.googleapis.com",
                    ),
                    GoogleModel,
                ),
                (
                    ExternalServiceModelConfig(
                        provider="openai",
                        name="gpt-test",
                        base_url="https://api.openai.com/v1",
                    ),
                    OpenAIChatModel,
                ),
            ]:
                with self.subTest(provider=config.provider):
                    model = load_model(config, http_client=None)
                    self.assertIsInstance(model, model_type)
                    async with model:
                        pass

    async def test_load_model__gemini_uses_configured_endpoint_and_client(self):
        requests: list[Request] = []

        def respond(request: Request) -> Response:
            requests.append(request)
            return Response(
                200,
                json={
                    "candidates": [
                        {
                            "content": {
                                "role": "model",
                                "parts": [{"text": "Google answer"}],
                            },
                            "finishReason": "STOP",
                        }
                    ]
                },
            )

        with patch.dict(
            os.environ, {"GOOGLE_API_KEY": "google-test-key"}, clear=True
        ):
            async with AsyncClient(transport=MockTransport(respond)) as client:
                model = load_model(
                    ExternalServiceModelConfig(
                        provider="gemini",
                        name="gemini-test",
                        base_url="https://google.test",
                    ),
                    http_client=client,
                )
                self.assertEqual([], requests)
                async with Agent(model) as agent:
                    result = await agent.run("Hello")
                self.assertEqual("Google answer", result.output)
                self.assertFalse(client.is_closed)
        self.assertEqual(1, len(requests))
        self.assertEqual(
            "https://google.test/v1beta/models/gemini-test:generateContent",
            str(requests[0].url),
        )
        self.assertEqual(
            "google-test-key", requests[0].headers["x-goog-api-key"]
        )
