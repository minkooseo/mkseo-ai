# Developer UX

## Integration flow

Developers select a preset and receive validated model settings. Python callers
construct a provider adapter for their own agents. TypeScript callers construct
a reusable client with their runtime transport, then request plain strings or
validated objects. Setup does not send a model request. Provider choices,
defaults, overrides, and credential ownership belong in
[Providers](providers.md).

TypeScript calls make output expectations explicit: plain text needs no schema;
object output includes a schema and selected mode. Each call specifies an output
limit. Callers receive the result or a classified error and decide how to
present it in their application. [Generation](generation.md) owns mode, retry,
and failure semantics.

## Demo experience

The editable Node demo is a self-contained starting point. Developers choose a
preset and edit the prompts, schema, and call options directly. Four examples
show one plain string result and each of the three object-output modes. Each
section starts with an asterisk-prefixed title and shows only its input and
output. Examples use the generation API's default retry behavior.

Successful values appear on standard output. Unexpected failures appear on
standard error and make the process exit unsuccessfully. A failed example does
not hide later examples, allowing developers to inspect mode-specific support.
Direct and watch modes run source without a compile step; watch mode must
restart for library source and preset edits.

## Editable development

Each language package is independently installable and operable. Local consumers
link directly to the corresponding package checkout. Python consumers restart
after source changes. Node runs TypeScript source through its configured loader;
Expo consumes the same source through Metro.

Connected Expo applications must automatically refresh or reload after linked
TypeScript source or preset edits. A developer must not build, copy, reinstall,
or publish the library to see an ordinary edit. Refresh recreates configured
clients so changed presets take effect and obsolete work cannot publish results.
Initial native setup and dependency additions remain separate setup work.

A source link and visible Metro dependency roots are prerequisites. A packed
release is usable for distribution but is not an editable development link.
[Architecture](architecture.md) owns package boundaries and runtime setup;
[verification notes](../verification-typescript.md) record available evidence
and remaining runtime limitations.

## Interface and design system

The product surfaces are typed developer APIs, configuration choices, and the
terminal demo. It supplies no application screens, navigation, dialogs, toasts,
visual components, or design tokens. Consuming applications own those surfaces
and their user-facing error language.
