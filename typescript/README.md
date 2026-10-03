# @mkseo/ai

A source-distributed TypeScript library for text and validated object generation
through oMLX or LM Studio. The caller supplies Node or Expo fetch and its
prompt. The package has no Python, React, filesystem, or environment variable
dependency.

## Unstructured output: a plain string

Install this package and Zod in the consumer. Use `tsx` for Node execution.

```ts
import { createModelClient, loadPreset } from "@mkseo/ai";

const client = createModelClient({
  model: loadPreset("omlx"),
  fetch: globalThis.fetch,
});
const result: string = await client.text({
  instructions: "Summarize the note in one short sentence.",
  prompt: "The train leaves at 09:30. Meet at the station at 09:15.",
  maxOutputTokens: 128,
});
console.log(result);
```

`loadPreset("lmstudio")` selects the other provider without requiring a model
name or base URL. Presets include both values and every HTTP request sends the
resolved model name. Custom configurations can spread a preset and override its
`name` or `baseUrl` before creating the client. Configuration is validated and
snapshotted at creation without making a request.

Presets point to loopback. On a physical phone, update the library's local
preset to the host's reachable address or use an explicit deployment override.
The phone's loopback address refers to the phone. Credentials, if needed, belong
in an application-owned fetch wrapper.

## Get a validated object

This complete example demonstrates all three modes. Structured modes require
backend support; a failure propagates without switching modes.

```ts
import { createModelClient, loadPreset } from "@mkseo/ai";
import { z } from "zod";

const schema = z
  .strictObject({
    summary: z.string().min(1).meta({
      description: "A concise summary of the supplied note.",
    }),
  })
  .meta({ title: "NoteSummary", description: "The main point of one note." });
const client = createModelClient({
  model: loadPreset("lmstudio"),
  fetch: globalThis.fetch,
});
const input = {
  instructions: "Summarize accurately.",
  prompt: "The train leaves at 09:30.",
  maxOutputTokens: 256,
  schema,
};

const structured = await client.object({ ...input, mode: "structured" });
const strict = await client.object({ ...input, mode: "structured-strict" });
const prompted = await client.object({ ...input, mode: "prompted" });
console.log({ structured, strict, prompted });
```

| Mode                | Request behavior                                |
| ------------------- | ----------------------------------------------- |
| `structured`        | Sends JSON Schema, without strict enforcement.  |
| `structured-strict` | Sends JSON Schema and `strict: true`.           |
| `prompted`          | Appends JSON Schema and descriptions to prompt. |

Every object result is parsed and validated with the supplied Zod schema. Only
complete JSON, optionally in one outer Markdown JSON fence, is accepted.
Truncated or malformed protocol responses fail immediately. Generated JSON that
fails parsing or schema validation can retry. Explicit strict downgrade warnings
fail even when the generated object passes local validation. Successful local
validation alone does not prove server-side strict enforcement.

Zod converts the schema's input contract to JSON Schema and parses the result
locally. Use an object root. Supported schema features follow Zod's native
conversion; unrepresentable types and recursive schemas fail before network I/O.
Refinements and transformations run during local parsing, and the returned type
is the schema's output type. Describe refinements that a model should follow;
JSON Schema cannot express every local validation rule.

The backend determines which JSON Schema features it supports, including its
strict-mode requirements. Use `z.strictObject()` when extra properties should be
rejected. Conversion preserves Zod's native metadata behavior; prompted mode
appends the formatted JSON Schema, including descriptions, with an instruction
to return one JSON object.

## Retries and diagnostics

Both methods take a second parameter, `maxRetries = 3`. Each call defaults to
**three extra retries**, for at most four network attempts. Pass `0` to disable
retries, or use a non-negative safe integer. Transport failures, HTTP
408/429/500/502/503/504, and invalid generated objects share one budget. Retries
keep the same model, prompt, schema, mode, and token limit. Backoff uses jitter,
a 250 ms initial ceiling, a 2 second cap, and honors `Retry-After` as a minimum.

Concurrent calls are independent. Applications own runtime lifecycle, stale
result fencing, concurrency limits, persistence, and later user-requested
retries.

`ModelClientError` exposes `code`, `attempts`, `status`, and `cause`. Codes are
`configuration`, `schema`, `transport`, `http`, `unsupported-capability`,
`protocol`, `output`, `truncation`, and `internal`. Preflight failures have zero
network attempts; an absent HTTP status is `null`. Applications can wrap their
injected fetch to record transport diagnostics.

## Bound concurrent work

Import `ConcurrencyGate` from `@mkseo/ai` and construct it with a positive
safe-integer limit. Share that instance across the work that should use the same
limit. `gate.run(signal, work)` returns the asynchronous work's result and
queues excess calls in arrival order. Success and failure both release a slot.

Aborting a queued call rejects it without starting its work. Once work starts,
it owns cancellation of its underlying operation; the slot stays occupied until
that work settles. The gate does not install a global limit or change
model-client retries.

## Expo and editable consumption

Initial application setup uses a direct checkout link. For a sibling app rooted
at `stride/app`, declare:

```json
{
  "dependencies": {
    "@mkseo/ai": "link:../../mkseo-ai/typescript"
  }
}
```

Install dependencies in this checkout and the application once. Shared-workspace
consumers can use `workspace:*`. Exports point directly to TypeScript source;
there is no library compilation step. Node consumers use `tsx`; bare Node does
not strip TypeScript dependencies inside `node_modules`.

Use the same preset-based API with Expo's transport:

```ts
import { createModelClient, loadPreset } from "@mkseo/ai";
import { fetch as expoFetch } from "expo/fetch";

export const client = createModelClient({
  model: loadPreset("lmstudio"),
  fetch: expoFetch,
});
```

Metro must watch the real linked package and resolve its installed dependencies.
Preserve existing Expo/NativeWind configuration. Add the repository root to
`watchFolders` if it lies outside Expo's detected workspace. For example, in the
consumer's existing Metro configuration:

```js
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const libraryRoot = path.resolve(__dirname, "../../mkseo-ai");
config.watchFolders = [...config.watchFolders, libraryRoot];
module.exports = config;
```

Watching the repository includes pnpm's dependency store as well as library
source. With a working Metro watcher, library TypeScript and preset JSON edits
must refresh/reload the connected application without a library build, copy,
reinstall, or publish. Recreate the runtime client during refresh to pick up
changed preset snapshots and fence obsolete work. Dependency additions still
require installation. A packed release contains the source and preset too, but
an installed tarball is not an editable checkout link.

## Demo and checks

From this directory:

```sh
pnpm install
pnpm demo-typescript
pnpm demo:watch
pnpm check
```

[demo.ts](demo.ts) is the editable example with one selected preset. It shows
four separate cases: a plain string, JSON Schema output, strict schema output,
and prompted JSON output. Each `* <title>` section shows its input and output.
The input includes instructions, prompt, and token limit. Objects are indented
JSON; strings remain ordinary text. The source contains each explicit API call.
Errors are labeled on stderr without hiding later cases and make the process
exit nonzero. Watch mode restarts for source and preset JSON edits.

The package check runs TypeScript, business/transport tests, and a source
tarball build. Workspace formatting and Python checks are independent. Actual
model availability and enforcement depend on the installed server and model; see
[verification notes](../verification-typescript.md) for tested runtime
combinations and limits.
