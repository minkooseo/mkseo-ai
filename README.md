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

The package bundles shared, non-secret Python presets. Applications can present
the provider and model choices, then load the selected preset:

```python
from pydantic_ai import Agent

from mkseo_ai.config import list_provider_models, load_config
from mkseo_ai.model import load_model

providers = list_provider_models()
choice = providers[0].models[0]  # The user selects a provider and model.
config = load_config(choice.preset)
model = load_model(config.model, http_client=None)
agent = Agent(model, instructions="Answer clearly and concisely.")
```

| Provider  | Displayed model | Preset CLI value |
| --------- | --------------- | ---------------- |
| oMLX      | Gemma 4         | `omlx`           |
| LM Studio | Gemma 4         | `lmstudio`       |
| Gemini    | Flash Lite      | `gemini_lite`    |
| Gemini    | Flash 3.8       | `gemini_flash`   |

All presets select development mode and server port 8787. oMLX uses
`http://127.0.0.1:8000/v1`; LM Studio uses `http://127.0.0.1:1234/v1`. Their
configured model IDs are sent through the OpenAI-compatible API. The Python
presets ship in the wheel and source archive. `load_config()` defaults to oMLX
when called without a choice.

Love and Stride commands accept `--config=lmstudio` (or another enum value),
with oMLX selected when the option is omitted. Applications can use
`list_provider_models()` to present the same choices without asking users to
type model IDs or enum names. Edit the Python presets to change model settings.
The model loader also supports explicit OpenAI configuration; no OpenAI preset
is bundled.

Run the agent inside its async context manager so provider-owned HTTP clients
close on exit. Callers with their own `httpx.AsyncClient` pass it explicitly as
`http_client` and own its cleanup; this supports request/response hooks. Loading
configuration or a model does not send a model request.

Python config types expose a read-only `compatible_api`: `google` for Gemini and
`openai` for OpenAI, LM Studio, and oMLX. The loader selects the adapter by
protocol and endpoint instead of concrete config types.

Each model needs `provider`, `name`, and a nonempty `base_url`. Unknown fields,
credential fields, and mismatched provider settings fail validation without
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
