# Developer UX

## Integration flow

A consuming application selects a shared preset and receives validated settings.
OMLX is the default when no preset is selected. It selects a PydanticAI model
adapter from those settings and uses that adapter in its own agent. Model
selection does not send a model request.

Applications can display grouped providers and readable model choices at
startup. The library owns the bundled Python settings; consumers select a choice
rather than supplying a configuration file path or model ID. See
[Providers](providers.md) for the available choices.

Settings contain no API keys. Provider SDKs obtain credentials from the process
environment, including for local endpoints when configured. Each model has an
API address, and its provider determines which compatible API is used.
[Providers](providers.md) owns the preset contents and configuration rules.

The application explicitly supplies either its own asynchronous HTTP client or
no client. A supplied client remains the application's responsibility to manage
and close.

Invalid settings and provider setup failures surface as errors to the caller.
The library does not choose a fallback provider or turn failures into chat
replies.

## Development workflow

Local consumers use editable dependencies so library changes are available
without publishing a release. Python dependency management uses uv; pnpm
provides convenient commands for formatting, linting, type checks, tests,
dependency checks, and package builds. The same quality gate runs before a
commit. [Architecture](architecture.md) owns the command and package map.

## Interface design

The product interface is a typed Python API and validated configuration. There
are no visual screens, navigation flows, dialogs, or design tokens. Applications
define their own user-facing chat experience and error messages.
