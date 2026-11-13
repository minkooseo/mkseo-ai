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

## Human evaluation commands

A project runs its human evaluation command line with one of these commands.
Each runs once, prints plain text, and exits, so an agent can relay pages and
replies through a chat; nothing waits for key presses.

- `generate --out <dir> [--split tuning|heldout] [--samples <n>]` makes an
  output set and prints how many outputs it wrote, each check's rate, and the
  most alike voices.
- `judge --kind pair|lineup --a <dir> --b <dir> --out <dir> [--items <n>]` and
  `guess --outputs <dir> --out <dir> [--items <n>]` start a blind round and
  print its first page.
- `show --out <dir>` prints the current page again, or, for a finished round,
  where its result is.
- `choose --out <dir> --reply="<words>"` records the person's reply and prints
  the next page, or the result when the round is done.

A page is Markdown meant to be pasted unchanged: numbered items with the case
context, then the outputs under Left and Right, or numbered voices to pick from,
and one closing line on how to reply, for example `3 l stiff`. Problems the
person can fix, such as a folder that is not empty, a bad reply, or a round with
nothing to compare, print one plain line and end with a failing exit code; bugs
keep their stack trace. A failed model call stops `generate` with an error that
names the case and voice, and nothing is written, so the same command can run
again. [Human evaluation](human-eval.md) owns the rules.

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

The product surfaces are typed developer APIs, configuration choices, the
terminal demo, and the human evaluation command line. It supplies no application
screens, navigation, dialogs, toasts, visual components, or design tokens.
Consuming applications own those surfaces and their user-facing error language.
