# Architecture

The repository contains independently operated Python and TypeScript packages.
Neither runtime calls the other or reads its package files. Applications own
agents, prompts, conversation state, routes, scheduling, persistence, and
runtime lifecycle. The library has no application server, React, or database
dependency.

```text
Python caller -> configuration + presets -> PydanticAI adapter
Python caller -> evaluation coverage + attempt records

TypeScript caller -> client factory -> generation -> compatible transport
                                           |                 |
                                 schema contract + retry  oMLX / LM Studio
```

## Python package

`python/pyproject.toml` and `python/uv.lock` define the `mkseo-ai` distribution
and its uv dependencies. Source lives under `python/src/mkseo_ai/`; mirrored
tests live under `python/tests/`. The package supports Python 3.13 through 3.14,
with 3.14 as the development target, and builds wheels/source archives with uv.

- `config.py` owns immutable model/server configuration, the preset selection
  boundary, and the grouped provider/model catalog.
- `presets/local.py` loads the package's local JSON settings. The oMLX and LM
  Studio preset modules retain their public loading boundaries; `gemini.py`
  supplies the two Python-only Gemini presets.
- `model.py` constructs the configured PydanticAI Google or OpenAI-compatible
  adapter without sending a model request. Provider SDKs resolve credentials;
  caller-supplied HTTP clients remain caller-owned.
- `evaluation/types.py` owns immutable coverage and attempt records, exported
  through `evaluation/__init__.py`. It contains no evaluation runner.
- `py.typed` exposes typing to consumers.

[Providers](providers.md) owns configuration behavior;
[Evaluation records](evaluation.md) owns evaluation invariants.

## TypeScript package

`typescript/package.json` defines `@mkseo/ai`, its dependencies, source exports,
and commands. `typescript/tsconfig.json` configures the package's type checking.
The runtime is split into client and generation responsibilities:

- `typescript/src/client/model-client.ts` is the public export entry. It exposes
  `createModelClient`, `loadPreset`, `ConcurrencyGate`, `GenerationMode`,
  generation inputs, and classified errors. The factory snapshots the model and
  supplied fetch, then delegates text and object calls to generation.
- `typescript/src/client/model-config.ts` owns preset loading and explicit
  configuration validation. Its adjacent `local-models.json` supplies presets.
- `typescript/src/client/model-client-error.ts` defines caller-visible failure
  categories and context through `ModelClientError`.
- `typescript/src/client/transport.ts` owns compatible HTTP requests, complete
  response consumption, protocol validation, response cleanup, and
  server-provided retry-delay metadata. `requestCompletion` handles one request
  and response.
- `typescript/src/generation/generation.ts` owns generation input contracts,
  request preparation, and object-output parsing and validation. It connects
  each generation request to the retry lifecycle.
- `typescript/src/generation/retry.ts` owns `AttemptContext`, the retry loop,
  retry eligibility, budgets, and backoff scheduling for text and objects.
- `typescript/src/generation/concurrency-gate.ts` provides optional,
  platform-neutral concurrency control. Its positive safe integer limit bounds
  active work, and waiting work starts in FIFO order. Queued work can cancel
  through `AbortSignal`; active work keeps its slot until it settles. Callers
  choose the limit and which requests share a gate. `createModelClient` does not
  install a global limiter.
- `typescript/src/generation/schema-contract.ts` owns `SchemaContract` and
  `GenerationMode`. `compileJsonSchema` uses native Zod input conversion for
  every object-output mode; `schemaToPrompt` separately formats JSON Schema into
  prompt instructions. Generation selects the contract variant required for its
  request.

The client's `text` and `object` methods accept a separate retry argument that
defaults to three extra attempts. `GenerateInput` contains common task data
accepted by `text`. The factory adds the unstructured mode to its internal
`UnstructuredInput`. `ObjectInput` adds its schema and an explicit object-output
mode for `object`.

`SchemaContract` is a discriminated union: unstructured carries only its mode,
prompted adds `schemaPrompt`, and structured or structured-strict adds
`jsonSchema`. Request preparation consumes that contract, keeping the selected
mode and its required data together.

[Generation](generation.md) defines their externally observable behavior. The
runtime imports neither Node nor Expo and receives fetch from its caller. The
Node-only `typescript/demo.ts` composes the public API and demonstrates its
plain string output and the three object-output modes.

Each package ships its own local preset JSON. The root
`scripts/check-presets.js` checks that the catalogs agree; installed packages
remain self-contained. TypeScript tarballs include source and their preset;
Python wheels and source archives include Python resources.

## Editable consumers

Love and Stride's Python server projects use editable uv links to `python/`.
Their processes import checkout source and restart after edits. The TypeScript
package exports its source directly; a sibling application can link to
`../../mkseo-ai/typescript` from its `app/` package, while a shared pnpm
workspace can use `workspace:*`.

Node consumers use `tsx`; bare Node does not strip TypeScript dependencies under
`node_modules`. Expo consumers use Metro and their own Expo fetch. The linked
source, preset JSON, and installed dependencies must be visible to Metro. Its
`watchFolders` must include external roots not detected by the consumer's Expo
workspace, while preserving existing application configuration.

Ordinary source and preset edits require no library build, copy, reinstall, or
publish. A connected Metro consumer must refresh/reload and recreate its runtime
client so preset snapshots change. The application owns the validity of results
during runtime replacement. Packed releases are distribution artifacts, not
editable development links. [Developer UX](ux.md) owns the development flow;
[verification notes](../verification-typescript.md) separate available
integration evidence from remaining backend, watcher, and device verification.

## Repository tooling

The root `package.json` is private and owns Prettier, Husky, and workspace
command delegation. `pnpm-workspace.yaml` includes the TypeScript package. The
root has no library runtime exports or Python package metadata.

`python/check.py` runs Python dependency, formatting, lint, typing, test, and
build checks using uv. `pnpm -C typescript check` runs TypeScript typing, tests,
and source packing. `pnpm demo-typescript` runs the editable Node example from
either the root or TypeScript package; the root delegates to the package. The
package's `demo:watch` command runs it in watch mode. Root `pnpm check`
coordinates workspace formatting, lockfile validation, preset parity, and
package checks; Husky invokes that gate.
