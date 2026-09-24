# Providers

Applications select LM Studio, OMLX, Gemini, or OpenAI through one validated
configuration. Selecting a provider constructs its PydanticAI model adapter
without sending a model request. Prompts and conversation behavior belong to the
consuming application.

## Configuration

The library owns development choices for oMLX, LM Studio, and Gemini. oMLX and
LM Studio each offer only Gemma 4. Gemini offers only Flash Lite and Flash 3.8.
Each choice has a readable label and resolves to one configured model name, so
applications can present provider and model lists without making users enter
model IDs or enum values. oMLX is the default. Invalid selections are rejected.
OpenAI remains supported by the model adapter but has no bundled choice.
Explicit configuration supports development or production mode; there is no
bundled production preset.

Configuration requires a development or production mode, a listen port from 1
through 65,535, and a provider-specific model selection. Unknown fields and
unsupported providers are rejected. Model names and all API roots must be
nonempty after trimming surrounding whitespace.

Every provider requires a model name and an explicit API root. Gemini uses the
Google API; LM Studio, OMLX, and OpenAI use the OpenAI-compatible API. The
configured API root is used directly for the selected provider connection.
Invalid settings fail with an error instead of silently choosing replacement
settings. Presets are available from the installed package regardless of the
application working directory.

## Credentials and transport

Configuration has no API key fields. Provider SDKs resolve credentials from the
environment. Gemini uses `GOOGLE_API_KEY`, with `GEMINI_API_KEY` as a fallback
when the preferred key is absent or empty. OpenAI-compatible connections,
including LM Studio and OMLX, use `OPENAI_API_KEY` when set. With that key
absent, the OpenAI-compatible provider supplies a placeholder token.

Consumers may supply an HTTP client to control transport for any provider. They
retain responsibility for its lifetime. Credential selection is the same whether
the consumer supplies a client or allows the provider to manage its own
transport.

See [Architecture](architecture.md) for package and application boundaries.
