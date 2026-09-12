import os
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

from pydantic_llm_adapter.config import (
    LmStudioModelConfig,
    OmlxModelConfig,
    load_config,
)


class ConfigTestCase(TestCase):
    def test_load_config__resolves_local_environment_credentials(self):
        for provider, key in [
            ("omlx", "OMLX_API_KEY"),
            ("lmstudio", "MODEL_API_KEY"),
        ]:
            with self.subTest(provider=provider):
                with TemporaryDirectory() as directory:
                    path = Path(directory) / "server.yaml"
                    path.write_text(
                        "mode: dev\nport: 8787\nmodel:\n"
                        f"  provider: {provider}\n  name: local-model\n"
                        "  base_url: http://localhost:8000/v1\n"
                    )
                    with patch.dict(os.environ, {key: "test-key"}, clear=True):
                        config = load_config(path)
                assert isinstance(
                    config.model, (OmlxModelConfig, LmStudioModelConfig)
                )
                self.assertEqual("test-key", config.model.api_key)

    def test_load_config__local_credentials_are_optional(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "server.yaml"
            path.write_text(
                "mode: dev\nport: 8787\nmodel:\n  provider: omlx\n"
                "  name: local-model\n  base_url: http://localhost:8000/v1\n"
            )
            with patch.dict(os.environ, {}, clear=True):
                config = load_config(path)
        assert isinstance(config.model, OmlxModelConfig)
        self.assertIsNone(config.model.api_key)

    def test_load_config__rejects_invalid_provider_settings(self):
        for model, error in [
            (
                "  provider: gemini\n  name: hosted\n"
                "  base_url: http://localhost\n",
                "base_url",
            ),
            ("  provider: omlx\n  name: local\n", "base_url"),
            ("  provider: unknown\n  name: local\n", "union_tag_invalid"),
            (
                "  provider: openai\n  name: hosted\n  api_key: forbidden\n",
                "api_key",
            ),
        ]:
            with self.subTest(model=model), TemporaryDirectory() as directory:
                path = Path(directory) / "server.yaml"
                path.write_text("mode: dev\nport: 8787\nmodel:\n" + model)
                with self.assertRaisesRegex(ValueError, error):
                    load_config(path)

    def test_load_config__reports_missing_file(self):
        with (
            TemporaryDirectory() as directory,
            self.assertRaisesRegex(ValueError, "could not read"),
        ):
            load_config(Path(directory) / "absent.yaml")

    def test_load_config__reports_invalid_yaml(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "server.yaml"
            path.write_text("model: [")
            with self.assertRaisesRegex(ValueError, "invalid YAML"):
                load_config(path)
