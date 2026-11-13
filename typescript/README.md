# @mkseo/ai

A source-distributed TypeScript library for text and validated object generation
through oMLX or LM Studio. The caller supplies Node or Expo fetch and its
prompt. The main entry has no Python, React, filesystem, or environment variable
dependency. The Node-only [human evaluation](#human-evaluation) entry helps a
person tune a prompt by blind comparisons.

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

## Human evaluation

`@mkseo/ai/human-eval` helps a person tune a prompt by blind A/B comparisons. A
person picks between the model's outputs; no model ever judges. It runs in Node
only, so the main `@mkseo/ai` entry does not load it.

A project describes its cases, voices, model call, and checks, and passes them
to `runHumanEvalCli`. That gives it the commands `generate`, `judge`, `guess`,
`show`, and `choose`. Each runs once and exits; none waits for key presses, so
an agent can run them and relay pages and replies in a chat.
[AGENT-GUIDE.md](src/human-eval/AGENT-GUIDE.md) explains a whole evaluation for
the agent that runs it. Each field is described in
[project.ts](src/human-eval/project.ts).

### Tune your own prompt

One prompt, one voice, three cases, and one check
([note-summary-project.ts](examples/note-summary-project.ts)):

```ts
import { createModelClient, loadPreset } from "@mkseo/ai";
import type { HumanEvalProject } from "@mkseo/ai/human-eval";

const client = createModelClient({
  model: loadPreset("omlx"),
  fetch: globalThis.fetch,
});

// The prompt being tuned. Edit it, run generate again, then compare.
const instructions = "Summarize the note in one short sentence.";

/** One prompt, one voice: the smallest human evaluation project. */
export const project: HumanEvalProject = {
  cases: [
    { id: "train", split: "tuning", labels: {}, context: "Train at 9:30." },
    { id: "rent", split: "tuning", labels: {}, context: "Rent up 5% in May." },
    { id: "party", split: "heldout", labels: {}, context: "Party Sat 7pm." },
  ],
  voices: () => [{ name: "summary", labels: {} }],
  generate: ({ case: note }) =>
    client.text({ instructions, prompt: note.context, maxOutputTokens: 128 }),
  checks: [
    {
      id: "one-sentence",
      description: "More than one sentence.",
      violates: (output) => /[.!?]\s+\S/.test(output.text),
    },
  ],
  groupLabel: null,
};
```

The entry ([tune-note-summary.ts](examples/tune-note-summary.ts)) passes the
command line through:

```ts
import { runHumanEvalCli } from "@mkseo/ai/human-eval";
import { project } from "./note-summary-project.ts";

await runHumanEvalCli(project, process.argv.slice(2));
```

```sh
pnpm tune-example generate --out /tmp/notes/before
# edit the instructions
pnpm tune-example generate --out /tmp/notes/after
pnpm tune-example judge --kind pair --a /tmp/notes/before --b /tmp/notes/after --out /tmp/notes/round-1
pnpm tune-example choose --out /tmp/notes/round-1 --reply="1 r, 2 r long"
```

Every `--out` must be a new or empty folder. Tags are single words. Pass a reply
joined to the flag with `=`, as above, so a reply that starts with `-` is not
read as an option; the [agent guide](src/human-eval/AGENT-GUIDE.md) shows how to
pass any reply safely.

With one voice, `guess` and `judge --kind lineup` refuse with a one-line
message, and overlap has nothing to compare.

### Several voices

Only the voices change when one prompt responds in several tones. Each case gets
every voice; with `groupLabel: null`, lineup, guess, and overlap compare all
voices that responded to a case:

```ts
const tones = ["formal", "casual", "playful"];

export const project: HumanEvalProject = {
  // cases and checks as above
  voices: () => tones.map((tone) => ({ name: tone, labels: {} })),
  generate: ({ case: note, voice }) =>
    client.text({
      instructions: `${instructions} Use a ${voice.name} tone.`,
      prompt: note.context,
      maxOutputTokens: 128,
    }),
  groupLabel: null,
};
```

With many voices, give each a label such as `{ group: "calm" }` and set
`groupLabel: "group"`, so lineup, guess, and overlap stay within a group. A
project with its own case fields writes `HumanEvalProject<MyCase>`, and
`generate` receives those fields back.

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
