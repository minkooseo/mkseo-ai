# Architecture

The shared Python library owns validated configuration and PydanticAI model
selection for Love and Stride. It has no FastAPI dependency and does not own
chat prompts, conversation state, HTTP routes, or application startup.

```text
Bundled preset -> configuration -> PydanticAI model
Provider environment + caller-owned HTTP client --^
Caller-owned agent consumes the configured model
```

## Package boundaries

`src/mkseo_ai/config.py` defines immutable configuration models and loads a
selected `LlmPreset` into one `ServerConfig` with provider-specific
`ModelConfig` settings. `load_config()` defaults to `LlmPreset.OMLX`; callers
cannot supply arbitrary file paths. Configuration contains model selection,
application mode, and listen port; it does not load credentials. Every model
requires a base URL and exposes its compatible API as a read-only string:
`google` for Gemini, `openai` for the other providers.

`src/mkseo_ai/presets/` bundles the YAML resources selected through `LlmPreset`:
`server-dev-omlx.yaml`, `server-dev-lmstudio.yaml`, `server-dev-gemini.yaml`.
All bundled presets use development mode. Package resource loading makes preset
selection independent of the caller's working directory.

`src/mkseo_ai/model.py` constructs the configured PydanticAI adapter without
sending a model request. It selects `GoogleModel` or `OpenAIChatModel` from the
compatible API and passes the configured base URL directly to the provider.
Provider SDKs resolve credentials. Callers explicitly supply an HTTP client or
absence of one. A supplied client is used for local and hosted providers; its
lifecycle belongs to the caller.

`src/mkseo_ai/py.typed` exposes package typing to consumers. Provider rules and
configuration constraints belong in [Providers](providers.md).

## Consumers and development

Love and Stride consume this package through editable uv dependencies from their
server projects. Application code owns agent instructions, message history,
request deadlines, and client lifecycle. Both applications select a bundled
preset through their CLI and default to OMLX.

The package targets Python 3.14 and uses the uv build backend. Tests mirror the
package beneath `tests/mkseo_ai/`. The `pnpm check` gate covers dependency lock
consistency, Prettier and Ruff formatting, Ruff lint, strict Pyright checks,
pytest, and `uv build --no-sources`. Husky runs the gate before commits.
