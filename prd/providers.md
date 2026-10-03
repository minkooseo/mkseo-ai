# Providers

Both language packages configure oMLX and LM Studio. Python also configures
Gemini and OpenAI through PydanticAI. Provider setup does not send a model
request. Applications own prompts, agents, and conversation behavior;
[Generation](generation.md) defines the TypeScript generation contract.

## Presets and model selection

Bundled non-secret presets supply the provider, model identifier, and API root.
Applications can select a preset without repeating model names or endpoints.
Local preset values agree across languages, and each installed package supplies
its presets independently of the working directory or the other language.

The local choices are Gemma 4 through oMLX and Gemma 4 through LM Studio. Python
also offers Gemini 3.5 Flash-Lite and Gemini 3.8 Flash. Its catalog groups
readable model choices by provider. OpenAI accepts explicit Python configuration
but has no bundled preset.

Python selects oMLX when no preset is supplied and rejects untyped preset
selections or configuration-file paths. TypeScript requires an explicit local
provider. Both reject unsupported providers rather than choosing a fallback.

Every configured model requires its provider's model identifier and an API root.
TypeScript permits model and endpoint overrides during client setup; generation
calls reuse that fixed selection. No model discovery, loading, or
first-available selection is implicit. The resolved model identifier is sent
with requests.

Local presets point to the model host's loopback address, using port 8000 for
oMLX and 1234 for LM Studio. A physical phone requires an address that reaches
the host; its own loopback address does not identify the host.

## Configuration constraints

Python configuration is immutable and requires development or production mode, a
listen port from 1 through 65,535, and provider-specific model settings. Every
bundled preset selects development mode and port 8787. Unknown fields and
unsupported providers fail validation. Model names and API roots must be
nonempty after trimming surrounding whitespace.

TypeScript configuration contains only the local provider, model, and endpoint.
The client validates and snapshots these settings so later caller mutations do
not change active requests. Model names must be nonblank. API roots must use
HTTP or HTTPS and contain no embedded credentials, query, or fragment. Changing
the selection requires a new client.

Gemini uses the Google API. Python's other providers and both TypeScript
providers use the OpenAI-compatible API.

## Credentials and transport

Presets contain no credentials. Python delegates credential resolution to its
provider SDKs. Gemini prefers `GOOGLE_API_KEY` and falls back to
`GEMINI_API_KEY` when the preferred key is absent or empty. OpenAI-compatible
providers use `OPENAI_API_KEY` when present and otherwise supply a placeholder
token for the configured endpoint.

Python callers explicitly supply an asynchronous HTTP client or choose
provider-managed transport. A supplied client's lifecycle remains with its
caller. Credential selection is the same with either transport choice.

TypeScript requires a caller-supplied runtime transport and reads no environment
variables. Applications provide authentication through that transport when
needed. The library imports neither Node nor Expo into its generation runtime.

[Architecture](architecture.md) describes the independent package boundaries.
