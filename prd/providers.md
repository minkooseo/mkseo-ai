# Providers

Applications select LM Studio, OMLX, Gemini, or OpenAI through one validated
configuration. Selecting a provider constructs its PydanticAI model adapter
without sending a model request. Prompts and conversation behavior belong to the
consuming application.

## Configuration

Configuration requires a development or production mode, a listen port from 1
through 65,535, and a provider-specific model selection. Unknown fields and
unsupported providers are rejected. Model names and local API roots must be
nonempty after trimming surrounding whitespace.

LM Studio and OMLX require a model name and an OpenAI-compatible API root.
Gemini and OpenAI require a model name and use their hosted provider connection.
Missing files, malformed YAML, and invalid settings fail with an error instead
of silently choosing replacement settings.

## Credentials and transport

Credentials come from the environment rather than YAML. LM Studio accepts an
optional bearer token from `MODEL_API_KEY`; OMLX accepts one from
`OMLX_API_KEY`. Gemini uses `GOOGLE_API_KEY`, with `GEMINI_API_KEY` as a
fallback when the preferred key is absent or empty. OpenAI uses
`OPENAI_API_KEY`. An explicitly supplied local token must be nonempty after
trimming whitespace.

Consumers may supply an HTTP client to control transport for any provider. They
retain responsibility for its lifetime. Credential selection is the same whether
the consumer supplies a client or allows the provider to manage its own
transport.

See [Architecture](architecture.md) for package and application boundaries.
