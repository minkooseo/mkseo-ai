# mkseo-ai

mkseo-ai is a shared Python library for configuring and selecting PydanticAI
model providers. It gives applications one validated configuration boundary for
local and hosted models, so each application can focus on its own conversation
behavior.

Love and Stride consume the library through editable local dependencies.
Supported providers are OMLX, LM Studio, Gemini, and OpenAI. Shared bundled
presets supply non-secret settings, with OMLX selected by default. Provider SDKs
obtain credentials from the environment when needed.

The library supplies model adapters. Applications own agents, instructions,
conversation history, network endpoints, and any HTTP client they provide.

## Product map

- [Architecture](architecture.md): package boundaries and development runtime.
- [Developer UX](ux.md): configuration, integration, and development workflow.
- [Providers](providers.md): provider selection and configuration requirements.
