# mkseo-ai

mkseo-ai provides independent Python and TypeScript packages for reusable model
access. Applications share validated provider setup and generation contracts
while retaining their own prompts, agents, conversation state, and workflows.

Python supplies PydanticAI adapters for local and hosted providers, a readable
preset catalog, and immutable evaluation coverage/attempt records. Love and
Stride consume the Python package through editable dependencies.

TypeScript supplies plain-string and validated-object generation for oMLX and LM
Studio. It supports explicit structured or prompted output, bounded retries, and
classified failures through an injected Node or Expo transport. Model presets
avoid repeated endpoint and model configuration.

Each package owns its dependencies and distribution. Editable TypeScript
consumption must expose source and preset changes without a library build, copy,
reinstall, or publish. Applications own concurrency, persistence, runtime
lifecycle, and user-facing behavior.

## Product map

- [Architecture](architecture.md): package/module boundaries, runtimes, and
  editable integration.
- [Developer UX](ux.md): setup, generation use, the demo, and development flow.
- [Providers](providers.md): model choices, configuration, and credential
  ownership for each language.
- [Generation](generation.md): TypeScript results, schemas, retries, and
  failures.
- [Evaluation records](evaluation.md): Python coverage, attempt ownership,
  evidence, and outcome invariants.
