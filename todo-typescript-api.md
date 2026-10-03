# TypeScript local model API and demo

## Purpose and boundaries

Add `@mkseo/ai` as an independent TypeScript package in this repository. The
existing Python package configures PydanticAI providers for its consumers; it
keeps its own runtime and distribution. TypeScript does not call Python.

Stride's imported core is the first TypeScript consumer. It owns persona agents,
prompts, generation workflows, persistence, and user-requested retries. This
library supplies reusable text/object generation with bounded automatic retries
over one OpenAI-compatible protocol, with oMLX and LM Studio configurations. It
contains no Stride types, social state, React, application scheduler, or
database.

```text
     Stride core / demo.ts
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

## Design basis from consumers

- [Love's bootstrap][love-bootstrap] selects one bundled configuration and
  injects the model into chat, safety, and follow-up agents. Its [evaluation
  runner][love-evaluation] records provider and model identity. Model choice
  belongs to setup, not individual agent calls.
- [Stride's CLI][stride-cli] selects a preset with `--llm`; its response and
  post agents receive the configured model. Its migration needs independent
  reply attempts and incremental persistence.
- LocalML's [Node configuration][localml-node] and [mobile
  configuration][localml-mobile] select an endpoint and model alias, commonly
  `localml-chat`, and inject Node or Expo fetch. Its [compatible
  client][localml-client] sends that exact model identifier and validates
  structured output with Zod. Reuse those boundaries, not its embedded retry
  loop, model-specific tuning, or JSON-fragment extraction.

The common requirement is configured generation with validated results. Love's
conversation history and critic loops, and LocalML's streaming, multimodal,
embedding, and on-device paths remain outside this initial text/object API.
Neither application is being migrated. Python parity here means local model
configuration, not a TypeScript replacement for PydanticAI agents.

## Provider and model selection

Keep provider, model name, and endpoint in the client configuration.
`loadPreset(provider)` supplies all three from a bundled preset; callers can
override the model name or endpoint before constructing the client. One local
preset per provider makes a second preset enum and a grouped model-picker API
unnecessary. Applications choose oMLX when they need a default; the library
requires an explicit provider.

The HTTP request still needs a model identifier. OpenAI Chat Completions and
oMLX require `model` in their request contracts; LM Studio's compatible API also
documents model selection through that field. The transport always sends the
resolved name, including aliases such as LocalML's `localml-chat`. [OpenAI
request contract][openai-chat], [LM Studio API][lmstudio-chat], [oMLX request
contract][omlx-request].

Application calls reuse the client's model selection. No server model discovery,
first-available-model selection, or model loading is implicit.

The bundled settings match Python's two local presets:

- Provider `omlx`, labeled `oMLX`: model name `Jundot--gemma-4-E4B-it-oQ4e-mtp`;
  API root `http://127.0.0.1:8000/v1`.
- Provider `lmstudio`, labeled `LM Studio`: model name `google/gemma-4-e4b`; API
  root `http://127.0.0.1:1234/v1`.

```ts
export type ModelProvider = "omlx" | "lmstudio";

export interface ModelConfig {
  /** Local model host; e.g. 'lmstudio'. */
  readonly provider: ModelProvider;
  /** Provider model identifier; e.g. 'google/gemma-4-e4b'. */
  readonly name: string;
  /** API root; e.g. 'http://127.0.0.1:1234/v1'. */
  readonly baseUrl: string;
}

export function loadPreset(provider: ModelProvider): ModelConfig;
```

Each package owns its bundled, non-secret preset JSON. A dependency-free
repository check enforces equality between their local model catalogs. This
small duplication keeps installation, publishing, and editable development
independent: neither package reads the other's source tree or needs asset
copying. Preserve Python's public API and choice catalog. Server mode and listen
port remain Python configuration. Preset loading must not depend on the working
directory or Python execution.

Reject unknown providers, blank model names, and invalid HTTP(S) API roots.
Validate explicit configuration as well as loaded presets. A phone needs the
model host's reachable address; its own loopback address does not reach that
host. Python's Gemini and OpenAI adapters remain outside this TypeScript scope.

## Public generation contract

`createModelClient({ model, fetch })` returns a reusable `ModelClient` with
`text()` and `object()` generation methods. It validates and snapshots its
configuration without network I/O. Applications own the client and supply their
runtime's fetch: Node's global fetch or Expo fetch. The library imports neither
runtime and reads no environment variables; runtime composition also owns any
authenticated fetch wrapper. Model selection stays fixed for that client.
Changing configuration requires constructing another client.

```ts
export interface GenerateInput {
  /** Caller-owned instructions; e.g. 'Summarize the supplied note.'. */
  readonly instructions: string;
  /** Task input; e.g. 'The train leaves at 09:30.'. */
  readonly prompt: string;
  /** Output limit; e.g. 256 tokens. */
  readonly maxOutputTokens: number;
}

export type GenerationMode =
  "unstructured" | "structured" | "structured-strict" | "prompted";
```

The methods accept a retry parameter with a default of three:
`text(input, maxRetries = 3)` returns a string;
`object({ ...input, schema, mode }, maxRetries = 3)` returns an object inferred
from the supplied schema. The retry count is a required number inside
generation.

The text method constructs an internal `UnstructuredInput` with
`mode: "unstructured"` before invoking generation. That type parallels
`ObjectInput`; callers of `text()` do not repeat the mode.

Each call returns a validated value or a classified failure, never a provider
response object. Configuration and schema errors fail before network I/O. The
library owns automatic request retries; callers own concurrency, persistence,
and later user-requested retries. Do not wrap it in another automatic retry loop
in Stride core.

Export `ModelClientError` with a `code`, network `attempts` count, HTTP `status`
or `null`, and original `cause`. Codes distinguish configuration, schema,
transport, HTTP, unsupported capability, protocol, output, truncation, and
internal failures. Preflight failures have zero attempts. Require positive
safe-integer output limits.

Cleanup, parsing, and validation share one attempt boundary. Missing/malformed
response fields, absent text content, and unknown completion reasons are
permanent protocol failures. A `length` completion is truncation; accept only
completed `stop` content before cleanup. JSON parsing or schema validation of
that content is an output failure. Object cleanup permits surrounding whitespace
and one complete outer JSON Markdown fence. Never salvage an inner object from
malformed or truncated content. Read assistant content, not separately returned
reasoning.

### Automatic retries

`maxRetries` is the second parameter of `text()` and `object()`. Omitting it
permits three retries after the initial request: at most four network attempts.
Passing `0` makes one attempt; passing `1` permits two. Require a non-negative
safe integer before network I/O. The same budget covers all retryable failures,
not a separate budget per kind.

Retry transport failures, HTTP 408/429/500/502/503/504, and generated JSON that
cannot be parsed or fails the supplied output schema. Configuration/input
errors, unsupported schemas or modes, other HTTP statuses, truncation, and
unclassified internal errors fail immediately.

Keep the provider, model, prompt, schema, mode, and output limit fixed across
attempts; retrying does not alter instructions or switch modes. Release the
failed response body before retrying. Use exponential backoff with jitter (250
ms initial ceiling, 2 s cap), honoring a valid `Retry-After` delay as a minimum.
The generation directory's retry module owns retry-count validation, attempt
context, the retry loop, retry policy, and backoff. Request preparation and
output parsing stay in generation; transport handles one HTTP attempt and
response metadata. On exhaustion, preserve the final failure category/cause and
report the attempt count.

For Stride, these attempts belong to one pending reply slot. Only exhaustion or
a non-retryable failure makes that slot fail; siblings keep running. A later
user retry starts a new call and budget at the same slot ID. Retrying a failed
save uses retained generated content and makes no model request.

## Three object-output modes

| Mode              | Backend request                          |
| ----------------- | ---------------------------------------- |
| structured        | JSON Schema response format              |
| structured-strict | JSON Schema plus strict enforcement      |
| prompted          | Ordinary text with appended instructions |

Every object mode parses and validates the result with the same Zod schema.
Object calls exclude the unstructured mode; text calls select it internally.

The schema contract owns the mode as a discriminated union. Unstructured
contracts carry no schema data, prompted contracts require only a schema prompt,
and structured contracts require only JSON Schema. Request preparation consumes
that contract directly; it cannot accept an independent, conflicting mode or
silently omit a required payload.

Keep JSON Schema compilation and schema-to-prompt conversion separate. Each
produces its own payload on demand. Do not compile both into a shared object
with nullable or optional fields.

Structured mode sends the schema in `response_format.json_schema` without
requesting strict enforcement. Strict mode requests `json_schema.strict: true`
and requires all object properties to be required, with additional properties
forbidden recursively. Never rewrite an optional field into a nullable one.
Neither mode promises capabilities merely because a server accepts a compatible
endpoint. Verify the installed backend/model; unsupported modes fail explicitly,
with no silent downgrade. Treat a provider's explicit enforcement-downgrade
response as an unsupported capability for strict mode, even when its content
passes local validation. oMLX can expose this through a response `Warning`
header. Record tested server, model, and schema combinations; a successful JSON
parse does not prove strict server enforcement. [LM Studio structured
output][lmstudio], [oMLX server][omlx-server].

Prompted mode requests ordinary text, parses the final JSON value, and validates
it locally. It offers no server-side schema enforcement. All modes preserve the
same output type and reject invalid or truncated results. Ordinary `text()`
remains available when no object contract is needed.

## Prompted output: explain the schema

Use runtime Zod `.meta({ title, description })` metadata for type and field
explanations. Source comments alone are unavailable at runtime. Put field
metadata on the final field schema. Only descriptive title/description metadata
contributes to conversion; metadata must not override types or constraints. [Zod
metadata][zod-metadata].

For example, a schema can describe its output contract directly:

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

Prompted output preserves the original prompt and appends an instruction to
return one JSON object, followed by the indented schema and its descriptions.
There is no separate schema language or handwritten constraint formatter.

Use Zod's native `z.toJSONSchema()` with `io: "input"`: generated JSON must
satisfy the input of the caller's schema before local parsing produces its
output. Require an object root and reject recursive or unrepresentable schemas
before network I/O. Supported constructs follow native Zod conversion rather
than a second library-owned whitelist. [Zod conversion][zod-schema].

Local Zod parsing remains the validation authority. Input-representable
transforms and defaults may be used; refinements still run locally even when
JSON Schema cannot express them. Describe such requirements for the model.
Strict mode additionally requires closed objects and all properties required
throughout the generated schema. Never change optional fields into nullable
fields. Test exact prompted instructions and mode-specific wire requests.

## Calling the API

Each Node example includes its own imports, client setup, and inputs. They
assume the selected local server is running and its preset model is available.
Presets supply model names and endpoints.

### Unstructured output: a plain string

`text()` returns `Promise<string>`. The awaited value is the generated text;
there is no schema, output mode, or JSON parsing in this call.

```ts
import { createModelClient, loadPreset } from "@mkseo/ai";

const client = createModelClient({
  model: loadPreset("omlx"),
  fetch: globalThis.fetch,
});

const text: string = await client.text({
  instructions: "Summarize the note in one short sentence.",
  prompt: "The train leaves at 09:30. Meet at the station at 09:15.",
  maxOutputTokens: 128,
});

console.log(text);
```

This call uses the default three retries. A final generation error propagates to
the caller.

### Text and all object modes: `demo.ts`

The self-contained [demo](typescript/demo.ts) focuses on unstructured string
output and all three object modes. Change only the preset to select the other
local server.

```ts
import { createModelClient, loadPreset } from "@mkseo/ai";
import { z } from "zod";

const noteSchema = z
  .strictObject({
    summary: z.string().min(1).meta({
      description: "A concise summary of the supplied note.",
    }),
  })
  .meta({
    title: "NoteSummary",
    description: "The main point of one note.",
  });

// Change only the preset to "lmstudio" to use the other local server.
const client = createModelClient({
  model: loadPreset("omlx"),
  fetch: globalThis.fetch,
});

const input = {
  instructions: "Summarize accurately.",
  prompt: "The train leaves at 09:30. Meet at the station at 09:15.",
  maxOutputTokens: 256,
};

async function show(title: string, run: () => Promise<unknown>): Promise<void> {
  console.log(`\n* ${title}`);
  console.log("Input:");
  console.log(JSON.stringify(input, null, 2));
  try {
    const output = await run();
    console.log("Output:");
    console.log(
      typeof output === "string" ? output : JSON.stringify(output, null, 2),
    );
  } catch (error) {
    console.error(`${title} error:`, error);
    process.exitCode = 1;
  }
}

await show("Unstructured: plain string", async () => {
  const text: string = await client.text(input);
  return text;
});

await show("Structured", () =>
  client.object({
    ...input,
    schema: noteSchema,
    mode: "structured",
  }),
);

await show("Structured strict", () =>
  client.object({
    ...input,
    schema: noteSchema,
    mode: "structured-strict",
  }),
);

await show("Prompted", () =>
  client.object({
    ...input,
    schema: noteSchema,
    mode: "prompted",
  }),
);
```

Unstructured output is a plain string. Object results are inferred as
`{ summary: string }` and validated before return. Each example reports its own
result; an unsupported mode does not hide subsequent examples. Unexpected
failures produce a nonzero exit status after the examples finish.

### Expo setup using a preset

The preset supplies the provider, model name, and base URL. The application
supplies only its runtime transport and does not repeat preset values:

```ts
import { fetch as expoFetch } from "expo/fetch";
import { createModelClient, loadPreset } from "@mkseo/ai";

const remoteLmstudio = createModelClient({
  model: loadPreset("lmstudio"),
  fetch: expoFetch,
});
```

## Running the demo

Use `typescript/demo.ts` as the complete example above. Keep provider,
endpoint/model overrides, prompts, schema, mode, and retry limit in ordinary
TypeScript that developers can edit. The demo calls the public client directly
and uses the library's retry policy. It has no argument parser or dynamic
schema-module loading and stays outside the package's runtime exports.

Provide `pnpm demo-typescript` at the root and inside `typescript/`; the root
delegates to the package, which runs the file with `tsx`. Provide
`pnpm demo:watch` inside `typescript/`, without a compile/build step. Watch mode
includes linked library/shared sources and restarts after edits. The demo exits
nonzero after any unexpected failure. Print successful results to stdout and
errors to stderr. [tsx watch][tsx].

Exercise text and every supported object mode against both presets. Node demo
success does not prove Expo/Hermes compatibility; verify that runtime
separately.

## Packaging and delivery

```text
mkseo-ai/
  package.json                   private formatting, hooks, combined checks
  pnpm-workspace.yaml             TypeScript workspace
  scripts/                       dependency-free preset parity check
  python/
    pyproject.toml, uv.lock       independent uv package and dependencies
    src/mkseo_ai/                 Python configuration and adapters
      presets/local-models.json  Python-owned local presets
    tests/                       Python tests
  typescript/
    package.json, tsconfig.json   independent @mkseo/ai package
    src/
      client/                    API, configuration, errors, transport
        local-models.json        TypeScript-owned local presets
      generation/                request preparation and schema contracts
        retry.ts                 retry policy, attempts, and backoff
    demo.ts                      Node example, inline schema and API calls
```

The repository root owns only shared development tooling and orchestration.
TypeScript owns its runtime dependencies, tests, demo, source exports, and
package build. Python owns its uv manifest, lockfile, environment, tests, and
wheel/source builds. Either package must operate without the other language
toolchain. Each artifact includes its own presets; verify imports outside the
checkout. Python's existing cloud support does not expand this local-only
TypeScript scope.

Package exports resolve to TypeScript source. Node consumers run through `tsx`
and Expo consumers through Metro; bare Node's type stripping does not support
TypeScript dependencies in `node_modules`. No compile/build, copy, or publish
step is needed after source edits. [Node TypeScript support][node-typescript].

Editable consumption is a release requirement. A sibling application declares a
direct source link, such as `link:../../mkseo-ai/typescript` from Stride's
`app/` directory. Applications in a shared pnpm workspace can use `workspace:*`.
A tarball, copied installation, or compiled output is not an editable
development link. Install library dependencies in this checkout. Python
consumers use an editable uv source at `../../mkseo-ai/python` from their
`server/` directories.

Metro must include the real linked repository and its dependencies in its
visible roots. Preserve the consumer's Expo/NativeWind configuration; add the
external checkout root to `watchFolders` when it lies outside Expo's detected
workspace. Include the checkout's dependency store, since pnpm links may resolve
outside the TypeScript package directory. Watch TypeScript and preset JSON
changes. Verify dependency resolution without introducing duplicate runtime
copies. [Metro watching][metro].

With the app connected to Metro, ordinary source edits must invalidate the
bundle and refresh/reload the consuming app automatically. The refreshed app
must use changed prompts, parsing, retry behavior, and preset values. Client
configuration is a snapshot, so reload/recreate the runtime client after preset
changes; fence old work so it cannot publish stale results. No manual library
build, copy, reinstall, or publish is allowed between an edit and its appearance
in the app. Initial native setup is separate from source edits.

Verify this in a consuming Expo development setup, including an edit in a linked
source dependency and a preset edit, and verify demo watch restart. Record
separately any device/Hermes or visible Fast Refresh behavior that cannot be
exercised; Node success alone cannot satisfy the Expo requirement. Stride's
`src/shared` owns its domain contracts; this library imports none of them.
Stride exposes no model API to its app.

1. Define provider presets, runtime transport, failures, and typed contracts.
2. Implement text/object modes, schema compilation, and bounded retries.
3. Add `demo.ts` and direct/watch scripts using the public API.
4. Verify Node and Expo/Hermes behavior before Stride switches consumers.

Acceptance covers valid output in every supported mode, explicit unsupported
mode errors, malformed/truncated output, request failure, exact prompt
formatting, and demo stdout/stderr/exit behavior. Verify local preset parity
with Python, explicit endpoint/model overrides, invalid selection rejection, and
client construction without network I/O. Mock fetch, time, and randomness to
verify exact requests, output-mode differences, strict downgrade errors,
default/zero/custom retry limits, retryable versus permanent failures and
invalid retry parameters. Use distinct model IDs to prove overrides reach the
wire. Verify the same transport contract on Node and Expo. Test
installed-package assets and platform import isolation. Turn the calling
examples into type-checked examples when the package exists. Verify app refresh
and demo watch from a checkout without compiled output. Keep PRDs and gates
aligned with the implementation.
[Verification notes](verification-typescript.md) distinguish completed checks
from runtime evidence still needed.

[Stride's integration plan][stride-plan] owns graph, workflow, and app concerns.

[stride-plan]: ../stride/todo-server-migration.md
[lmstudio]: https://lmstudio.ai/docs/developer/openai-compat/structured-output
[omlx-server]: https://github.com/jundot/omlx/blob/main/omlx/server.py
[zod-metadata]: https://zod.dev/metadata
[zod-schema]: https://zod.dev/json-schema
[tsx]: https://tsx.is/watch-mode
[metro]: https://metrobundler.dev/docs/configuration/#watchfolders
[lmstudio-chat]:
  https://lmstudio.ai/docs/developer/openai-compat/chat-completions
[omlx-request]:
  https://github.com/jundot/omlx/blob/main/omlx/api/openai_models.py
[love-bootstrap]: ../love/server/chat/cli/cli.py
[love-evaluation]: ../love/server/taro/evals/evaluation/evaluate.py
[stride-cli]: ../stride/server/cli/__main__.py
[localml-node]: ../localml/adapters/src/node/lmstudio-config.ts
[localml-mobile]: ../localml/adapters/src/mobile/model-config.ts
[localml-client]: ../localml/adapters/src/llm/lmstudio/llm-client.ts
[openai-chat]: https://platform.openai.com/docs/api-reference/chat/create
[node-typescript]: https://nodejs.org/api/typescript.html
