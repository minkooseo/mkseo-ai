# Generation

The TypeScript package turns caller-owned instructions and a nonblank prompt
into plain text or a validated object using the configured local model.
[Providers](providers.md) owns model setup. Applications retain agents,
conversation history, concurrency policy, persistence, and user-requested
retries.

## Results and output modes

Plain-text generation returns a string without an object schema or JSON parsing.
Object generation requests a JSON object, requires an explicit mode, and uses
one runtime schema for the output contract and final validation:

- Structured output sends JSON Schema without requesting strict enforcement.
- Strict structured output additionally requests server-side enforcement.
- Prompted output appends JSON Schema and its descriptions to the original
  prompt and relies on local validation, without requesting server-side
  enforcement.

Modes never switch automatically. Backend/model support determines whether a
structured request succeeds. An explicit strict-enforcement downgrade fails even
when the returned object passes local validation. Valid JSON alone does not
prove that a server enforced the schema.

Results must contain completed assistant text. Truncation, missing content, or a
malformed completion response fail without salvaging partial output. Object
output permits surrounding whitespace and one complete outer JSON Markdown
fence; embedded fragments or additional commentary are not recovered. Separate
reasoning content is not substituted for the answer.

## Schema requirements

The generated JSON has an object root. The runtime schema's native JSON Schema
conversion describes the values the model must produce before local parsing.
Recursive schemas and inputs that cannot be converted fail before network
access. Each backend determines which generated JSON Schema features it
supports, including the constraints required for strict enforcement.

Titles and descriptions explain the requested result. Metadata follows native
conversion semantics, including JSON Schema keyword overrides. Prompted
instructions include formatted JSON Schema so its represented rules reach the
model without a separate translation.

Local synchronous validation is authoritative. Callers receive its parsed
result, including local transformations and defaults. Refinements that have no
JSON Schema representation remain local checks; descriptions can communicate
those expectations to the model. Server-side enforcement cannot prove that these
local checks passed.

## Attempts and retries

Each call requires a positive safe-integer output-token limit. Its retry limit
is a non-negative safe integer. Omitting that limit allows three extra retries,
for at most four network attempts; zero allows only the initial attempt.

Transport failures, HTTP 408/429/500/502/503/504, and generated objects that
fail JSON parsing or schema validation share one retry budget. Invalid
input/schema, unsupported capabilities, other HTTP failures, malformed protocol
responses, truncation, and unexpected internal failures stop immediately.

Retries preserve the model, prompt, schema, mode, and token limit. Delays use
jitter with exponential ceilings beginning at 250 ms and capped at 2 seconds. A
valid server-requested delay is honored as a minimum. Retry exhaustion retains
the final failure category, cause, HTTP status when available, and attempt
count.

Applications own runtime lifecycle and decide whether a completed result still
belongs to their current work. Each generation call owns its retry budget;
independent calls do not share attempt counts.

## Concurrency

Applications can use an optional work gate to bound concurrent activity. They
choose a positive safe-integer limit and which requests share that gate. At most
that many tasks run at once, and waiting tasks start in queue order. Text and
object generation have no implicit or global concurrency limit; gated generation
calls retain their independent retry budgets.

Canceling work before it starts rejects the request with the cancellation reason
without executing it. Once work starts, that work owns cancellation, and its
slot remains occupied until it settles. Success and failure both release the
slot for the next waiting task.

## Failures

Callers receive a result or a classified failure, not a provider response object
or a fabricated reply. Failure categories distinguish configuration, schema,
transport, HTTP, unsupported capability, protocol, output, truncation, and
internal errors. Failures retain their cause, network attempt count, and HTTP
status when one exists. Preflight failures report zero network attempts.

Applications decide how to present failures to users.
