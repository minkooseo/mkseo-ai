# Architecture

The shared Python library owns validated configuration and PydanticAI model
selection for Love and Stride. It has no FastAPI dependency and does not own
chat prompts, conversation state, HTTP routes, or application startup.

```text
YAML + environment -> configuration -> PydanticAI model -> caller's agent
Caller-owned HTTP client -------------------^
```

## Package boundaries

`src/pydantic_llm_adapter/config.py` defines immutable configuration models and
loads YAML settings with environment credentials. It includes application mode
and listen port so consumers share one configuration contract.

`src/pydantic_llm_adapter/model.py` constructs the configured PydanticAI adapter
without sending a model request. Callers explicitly supply an HTTP client or
absence of one. A supplied client is used for local and hosted providers; its
lifecycle belongs to the caller.

`src/pydantic_llm_adapter/py.typed` exposes package typing to consumers.
Provider rules and configuration constraints belong in
[Providers](providers.md).

## Consumers and development

Love and Stride consume this package through editable uv dependencies from their
server projects. Application code owns agent instructions, message history,
request deadlines, and client lifecycle.

The package targets Python 3.14 and uses the uv build backend. Tests mirror the
package beneath `tests/pydantic_llm_adapter/`. The `pnpm check` gate covers
dependency lock consistency, Prettier and Ruff formatting, Ruff lint, strict
Pyright checks, pytest, and `uv build --no-sources`. Husky runs the gate before
commits.
