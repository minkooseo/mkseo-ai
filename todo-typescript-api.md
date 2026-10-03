# TypeScript local model API and CLI

## Purpose and boundaries

Add `@mkseo/ai` as an independent TypeScript package in this repository. The
existing Python package configures PydanticAI providers for its consumers; it
keeps its own runtime and distribution. TypeScript does not call Python.

Stride's imported core is the first TypeScript consumer. It owns persona agents,
prompts, generation workflows, persistence, and retries. This library supplies
reusable text/object generation over one OpenAI-compatible protocol, with oMLX
and LM Studio backend configurations. It contains no Stride types, social state,
React, application scheduler, or database.

```text
Stride core / library test CLI
               |
      typed text/object API
               |
     mode + schema compilation
               |
       compatible fetch client
               |
       oMLX or LM Studio
               |
       validation -> typed result
```

LocalML is reference-only: inspect its compatible client and boundary tests for
useful patterns, but do not edit LocalML, change its dependencies, migrate its
consumers, or require it at runtime. Keep its orchestration, locale state,
native adapters, model-specific defaults, and extra retry loops out of this API.

## Public generation contract

A factory constructs the client from validated backend, endpoint, and model
configuration. Applications own that client's lifetime and resolve addresses
appropriate to their platform; a phone must reach the model host directly.
Non-secret local presets can be shared with Python where their meaning matches.
Neither schema metadata nor generation calls implicitly choose another backend.
The factory accepts a transport observer for request-method/HTTP-status
diagnostics; core wires it privately to CLI stderr for `--debug`.

```ts
import type { z } from "zod";

export interface GenerateInput {
  /** Caller-owned instructions; e.g. 'Summarize the supplied note.'. */
  readonly instructions: string;
  /** Task input; e.g. 'The train leaves at 09:30.'. */
  readonly prompt: string;
  /** Caller-owned cancellation/deadline signal; e.g. controller.signal. */
  readonly signal: AbortSignal;
  /** Output limit; e.g. 256 tokens. */
  readonly maxOutputTokens: number;
}

export type ObjectMode = "structured" | "structured-strict" | "prompted";

export interface Generation {
  text(input: GenerateInput): Promise<string>;
  object<S extends z.ZodType>(
    input: GenerateInput & {
      /** Runtime output contract with descriptions; e.g. answerSchema. */
      readonly schema: S;
      /** Explicit output mechanism; e.g. 'prompted'. */
      readonly mode: ObjectMode;
    },
  ): Promise<z.output<S>>;
}
```

Each call makes one request and returns a validated value or a classified
failure, never a provider response object. Callers own retry/deadline budgets.
Cancellation, HTTP failure, unsupported capability, invalid schema/output, and
truncation are distinguishable failures. Cleanup, parsing, and validation share
one attempt boundary; a cleanup error must not escape classification. Check
completion status before cleanup. Allow only defined outer formatting cleanup;
never salvage an inner object from malformed or truncated content.

## Three object-output modes

| Mode              | Backend request                          |
| ----------------- | ---------------------------------------- |
| structured        | JSON Schema response format              |
| structured-strict | JSON Schema plus strict enforcement      |
| prompted          | Ordinary text with appended instructions |

Every object mode parses and validates the result with the same Zod schema.

Structured mode sends the schema in `response_format.json_schema` without
requesting strict enforcement. Strict mode requests `json_schema.strict: true`
and checks the supported schema subset. Neither mode promises capabilities
merely because a server accepts a compatible endpoint. Verify the installed
backend/model; unsupported modes fail explicitly, with no silent downgrade. [LM
Studio structured output][lmstudio], [oMLX server][omlx-server].

Prompted mode requests ordinary text, parses the final JSON value, and validates
it locally. It offers no server-side schema enforcement. All modes preserve the
same output type and reject invalid or truncated results. Ordinary `text()`
remains available when no object contract is needed.

## Prompted output: explain the schema

Use runtime Zod `.meta({ title, description })` metadata for type and field
explanations. Source comments alone are unavailable at runtime. Put field
metadata on the final field schema. [Zod metadata][zod-metadata].

For example, a schema module can export:

```ts
import { z } from "zod";

export const schema = z
  .strictObject({
    summary: z.string().min(1).meta({
      description: "A concise summary of the supplied note.",
    }),
  })
  .meta({
    title: "NoteSummary",
    description: "The main point of one note.",
  });
```

The library deterministically appends a readable block to the caller's prompt,
rather than dumping raw schema:

```text
## Output contract: NoteSummary
The main point of one note.
Return one JSON object, without Markdown or extra commentary.
Fields:
- summary: string, required, at least 1 character.
  A concise summary of the supplied note.
No additional fields.
```

Preserve the original prompt and append the block with a clear separator.
Describe nested fields/types, array elements, required versus optional fields,
nulls, enums, and supported constraints. Names and descriptions explain intent;
constraints still govern validation. Reject unsupported schema constructs rather
than silently erasing them.

Zod's JSON Schema conversion can supply the structural information, while a
library formatter produces the human-readable contract. Keep one schema as the
source for prompt compilation and final validation. Test exact generated prompt
text, including nested and optional fields. [Zod conversion][zod-schema].

## CLI to exercise the same API

Add a root `pnpm cli` entry for this library's Node test harness. It calls the
public TypeScript API directly. It has no second transport, hidden retry loop,
or app-specific agent behavior. These are proposed commands, not existing tools:

```sh
pnpm cli text --preset omlx --prompt "Say hello." \
  --instructions "Be concise." --max-output-tokens 128 --timeout-ms 30000

pnpm cli object --preset lmstudio --mode structured \
  --schema examples/note-schema.ts --prompt "The train leaves at 09:30." \
  --instructions "Summarize accurately." \
  --max-output-tokens 256 --timeout-ms 30000

pnpm cli object --preset omlx --mode prompted --show-prompt \
  --schema examples/note-schema.ts --prompt "The train leaves at 09:30." \
  --instructions "Summarize accurately." \
  --max-output-tokens 256 --timeout-ms 30000
```

Repeat the object command with `--mode structured-strict`, and exercise all
three modes against each preset. A caller-selected schema module exports
`schema` with runtime metadata, so CLI testing covers the real typed API. Keep
module loading in the Node-only CLI; native imports never load it.

`--preset` resolves non-secret endpoint/model settings; explicit `--base-url`
and `--model` overrides let developers test their running local servers.
`--timeout-ms` and Ctrl-C propagate cancellation through the same API signal.
The CLI requires an explicit object mode and schema.

Write successful text or validated JSON to stdout. Diagnostics and errors go to
stderr; failures exit nonzero and never masquerade as successful output.
`--show-prompt` prints the effective prompted-output instructions to stderr, so
developers can inspect the generated contract without contaminating JSON. It
observes the actual request compiler's output, not a second formatter.

This CLI verifies request/response behavior in Node. Expo/Hermes compatibility
still needs its own integration check; CLI success cannot prove mobile support.

Run the CLI directly from TypeScript with `tsx`, with no prior compile/build.
Provide `pnpm cli --watch` to restart the selected command after source or
schema changes, aborting the previous request. Include dynamically loaded schema
files and linked source paths in the watcher. [tsx watch][tsx].

## Packaging and delivery

```text
mkseo-ai/
  pyproject.toml + src/mkseo_ai/   existing Python distribution
  typescript/
    package.json                 @mkseo/ai
    src/                         API, transport, schema/prompt compiler
    src/cli.ts                   isolated Node CLI entry
  examples/note-schema.ts        CLI schema with field metadata
  shared/                        portable presets and contract fixtures
```

Keep language distributions, dependencies, and tests independent. Ship shared
assets in the installed packages; Python's existing cloud support does not
expand this local-only TypeScript scope. During development, package exports
resolve to TypeScript source, never stale compiled output. Node and Metro
transform it automatically, with no compile/build, copy, or publish step.
Changes must refresh Stride's Metro-connected development client and restart CLI
watch mode. Initial native setup is separate from source-only JS/TS editing.
Metro must see the linked source and dependencies. [Metro watching][metro].
Stride's `src/shared` owns its domain contracts; this library imports none of
them. Stride exposes no model API to its app.

1. Define the typed API, failure categories, and verified backend capabilities.
2. Implement text and the three object modes, including metadata compilation.
3. Add CLI commands using that same API and a reusable schema example.
4. Verify Node and Expo/Hermes behavior before Stride switches consumers.

Acceptance covers valid output in every supported mode, explicit unsupported
mode errors, malformed/truncated output, request failure, cancellation, exact
prompt formatting, and CLI stdout/stderr/exit behavior. Test installed-package
assets and platform import isolation. Verify app refresh and CLI watch from a
checkout without compiled output. Update PRDs and quality gates when the
implementation exists; this document is the proposal.

[Stride's integration plan][stride-plan] owns graph, workflow, and app concerns.

[stride-plan]: ../stride/todo-server-migration.md
[lmstudio]: https://lmstudio.ai/docs/developer/openai-compat/structured-output
[omlx-server]: https://github.com/jundot/omlx/blob/main/omlx/server.py
[zod-metadata]: https://zod.dev/metadata
[zod-schema]: https://zod.dev/json-schema
[tsx]: https://tsx.is/watch-mode
[metro]: https://metrobundler.dev/docs/configuration/#watchfolders
