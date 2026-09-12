# mkseo-ai

Shared, typed Python configuration and PydanticAI provider loading for Love and
Stride. Supports OMLX, LM Studio, Gemini, and OpenAI. Applications own prompts,
agents, chat history, routes, and model lifetimes.

## Development

Install Python 3.14, uv, Node 22.18+, and pnpm. Node is used only to run
repository tooling; the distributable and runtime are pure Python.

```sh
pnpm install
uv sync --locked
pnpm check
```

`pnpm check` validates both lockfiles, formatting, Ruff lint, strict Pyright,
tests, and package builds. `pnpm format` applies Prettier to repository
metadata/docs and Ruff to Python. Individual `lint`, `typecheck`, `test`, and
`build` commands are also available. Husky runs the full gate before commits.

## Configuration and use

The package bundles the shared, non-secret YAML presets. Applications select one
through the enum instead of supplying a file path:

```python
from pydantic_ai import Agent

from mkseo_ai.config import LlmPreset, load_config
from mkseo_ai.model import load_model

config = load_config()  # Defaults to LlmPreset.OMLX.
model = load_model(config.model, http_client=None)
agent = Agent(model, instructions="Answer clearly and concisely.")

lmstudio_config = load_config(LlmPreset.LMSTUDIO)
```

| Enum member          | CLI value  | Mode | Model                             |
| -------------------- | ---------- | ---- | --------------------------------- |
| `LlmPreset.OMLX`     | `omlx`     | dev  | `Jundot--gemma-4-E4B-it-oQ4e-mtp` |
| `LlmPreset.LMSTUDIO` | `lmstudio` | dev  | `google/gemma-4-e4b`              |
| `LlmPreset.GEMINI`   | `gemini`   | dev  | `gemini-3.5-flash-lite`           |

All presets select server port 8787. OMLX uses `http://127.0.0.1:8000/v1`; LM
Studio uses `http://127.0.0.1:1234/v1`. YAML resources live under
`src/mkseo_ai/presets/` and ship in the wheel and source archive. There is no
default symlink. Preset loading works from any working directory.

Love and Stride commands accept `--config=lmstudio` (or another enum value),
with OMLX selected when the option is omitted. All bundled presets use
development mode. Edit the bundled presets to change model settings. The model
loader also supports explicit OpenAI configuration; no OpenAI preset is bundled.

Run the agent inside its async context manager so provider-owned HTTP clients
close on exit. Callers with their own `httpx.AsyncClient` pass it explicitly as
`http_client` and own its cleanup; this supports request/response hooks. Loading
configuration or a model does not send a model request.

Python config types expose a read-only `compatible_api`: `google` for Gemini and
`openai` for OpenAI, LM Studio, and OMLX. This protocol choice is fixed in
Python and is not a YAML setting. The loader selects the adapter by protocol and
endpoint instead of concrete config types.

Each model needs `provider`, `name`, and a nonempty `base_url`. Unknown fields,
credentials in YAML, and mismatched provider settings fail validation without
provider fallback.

Local OMLX and LM Studio servers run without API-key authentication. Their
configs contain no credentials. The provider SDKs handle credentials; the
OpenAI-compatible client uses `OPENAI_API_KEY` when present and a dummy key
otherwise.

External-service credentials come from the environment:

- Gemini: `GOOGLE_API_KEY` (the Google SDK also accepts `GEMINI_API_KEY`).
- OpenAI: `OPENAI_API_KEY`.

## Editable consumers

Clone this repository beside `love` and `stride`. Each application's
`server/pyproject.toml` declares:

```toml
[tool.uv.sources]
mkseo-ai = { path = "../../mkseo-ai", editable = true }
```

The package is also listed in each server's project dependencies. Run
`uv sync --project server --locked` from each application root. Both virtual
environments import this checkout directly, so Python source edits are shared
immediately without copying or reinstalling files. Restart running servers after
editing the shared package. Dependency changes require syncing and updating all
affected lockfiles.

See [the product overview](prd/overview.md) for the responsibility map.
