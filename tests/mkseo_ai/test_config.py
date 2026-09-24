from typing import cast
from unittest import TestCase

from mkseo_ai.config import (
    LlmPreset,
    list_provider_models,
    load_config,
)


class ConfigTestCase(TestCase):
    def test_load_config__defaults_to_omlx(self):
        config = load_config()
        self.assertEqual(
            {
                "mode": "dev",
                "port": 8787,
                "model": {
                    "provider": "omlx",
                    "name": "Jundot--gemma-4-E4B-it-oQ4e-mtp",
                    "base_url": "http://127.0.0.1:8000/v1",
                },
            },
            config.model_dump(),
        )

    def test_load_config__selects_bundled_presets(self):
        self.assertEqual(
            {
                "mode": "dev",
                "port": 8787,
                "model": {
                    "provider": "lmstudio",
                    "name": "google/gemma-4-e4b",
                    "base_url": "http://127.0.0.1:1234/v1",
                },
            },
            load_config(LlmPreset.LMSTUDIO).model_dump(),
        )
        self.assertEqual(
            {
                "mode": "dev",
                "port": 8787,
                "model": {
                    "provider": "gemini",
                    "name": "gemini-3.5-flash-lite",
                    "base_url": "https://generativelanguage.googleapis.com",
                },
            },
            load_config(LlmPreset.GEMINI).model_dump(),
        )
        self.assertEqual(
            {
                "mode": "dev",
                "port": 8787,
                "model": {
                    "provider": "gemini",
                    "name": "gemini-3.8-flash",
                    "base_url": "https://generativelanguage.googleapis.com",
                },
            },
            load_config(LlmPreset.GEMINI_FLASH_3_8).model_dump(),
        )

    def test_list_provider_models__contains_only_supported_choices(self):
        self.assertEqual(
            [
                {
                    "id": "omlx",
                    "label": "oMLX",
                    "models": [
                        {
                            "id": "gemma-4",
                            "label": "Gemma 4",
                            "preset": "omlx",
                        }
                    ],
                },
                {
                    "id": "lmstudio",
                    "label": "LM Studio",
                    "models": [
                        {
                            "id": "gemma-4",
                            "label": "Gemma 4",
                            "preset": "lmstudio",
                        }
                    ],
                },
                {
                    "id": "gemini",
                    "label": "Gemini",
                    "models": [
                        {
                            "id": "flash-lite",
                            "label": "Flash Lite",
                            "preset": "gemini",
                        },
                        {
                            "id": "flash-3.8",
                            "label": "Flash 3.8",
                            "preset": "gemini_flash_3_8",
                        },
                    ],
                },
            ],
            [
                choice.model_dump(mode="json")
                for choice in list_provider_models()
            ],
        )

    def test_load_config__rejects_untyped_preset(self):
        for value in ["omlx", "unknown", "server-dev.yaml", None]:
            with (
                self.subTest(value=value),
                self.assertRaisesRegex(TypeError, "must be a LlmPreset"),
            ):
                load_config(cast(LlmPreset, value))
