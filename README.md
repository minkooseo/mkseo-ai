# Pydantic LLM Adapter

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

Keep non-secret YAML settings in each application:

```yaml
mode: dev
port: 8787
model:
  provider: omlx
  name: Jundot--gemma-4-E4B-it-oQ4e-mtp
  base_url: http://127.0.0.1:8000/v1
```

```python
from pathlib import Path

from pydantic_ai import Agent

from pydantic_llm_adapter.config import load_config
from pydantic_llm_adapter.model import load_model

config = load_config(Path("server-dev.yaml"))
model = load_model(config.model, http_client=None)
agent = Agent(model, instructions="Answer clearly and concisely.")
```

Run the agent inside its async context manager so provider-owned HTTP clients
close on exit. Callers with their own `httpx.AsyncClient` pass it explicitly as
`http_client` and own its cleanup; this supports request/response hooks. Loading
configuration or a model does not send a model request.

Each model needs `provider` and `name`. Only local providers accept the required
`base_url`. Unknown fields, credentials in YAML, and mismatched provider
settings fail validation without provider fallback.

Credentials come from the environment:

- OMLX: optional `OMLX_API_KEY`.
- LM Studio: optional `MODEL_API_KEY`.
- Gemini: `GOOGLE_API_KEY` (the Google SDK also accepts `GEMINI_API_KEY`).
- OpenAI: `OPENAI_API_KEY`.

## Editable consumers

Clone this repository beside `love` and `stride`. Each application's
`server/pyproject.toml` declares:

```toml
[tool.uv.sources]
pydantic-llm-adapter = { path = "../../pydantic-llm-adapter", editable = true }
```

The package is also listed in each server's project dependencies. Run
`uv sync --project server --locked` from each application root. Both virtual
environments import this checkout directly, so Python source edits are shared
immediately without copying or reinstalling files. Restart running servers after
editing the shared package. Dependency changes require syncing and updating all
affected lockfiles.

See [the product overview](prd/overview.md) for the responsibility map.
