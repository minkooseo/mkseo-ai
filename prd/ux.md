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

- `generate --out <dir> [--num-samples <n>]` makes an output set with that many
  responses per case and prints how many outputs it wrote.
- `judge --kind pair|lineup --a <dir> --b <dir> --out <dir> [--num-questions <n>]`
  starts a blind round of at most that many items, opens its grading page, and
  prints the page's address. It ends when every item has a choice and prints the
  result.
- `show --out <dir>` opens the grading page again for an unfinished round, or,
  for a finished round, prints where its result is. While another `judge` or
  `show` serves the round, it refuses and prints that page's address instead.

The grading page runs on this machine only and opens on macOS. It shows one item
at a time. The question and progress stay at the top, and the case follows in
full. A pair item with a description has three columns, Left | Right |
description, with the description twice as wide; Left and Right are only as tall
as their text and stay in view while the page scrolls through the description. A
lineup has two columns, Left and Right, each listing every speaker in full. On a
narrow window everything stacks in one column. The page itself scrolls, never
sideways.

The controls are one bar at the bottom of the window: Left, Tie, Right, a reason
box that starts one line tall and grows with its text, and Submit; the bar wraps
on a narrow window. The left and right arrow keys pick a side, the T key picks a
tie (by its position, so it works with a Korean input source), and Enter
submits; the mouse does the same through the sides and buttons. The arrows still
pick while the reason box is empty, and Esc leaves the box. A missing pick or
reason shows one line under the bar and records nothing. When every item has a
choice, the page says the result is in the terminal. If the command has stopped,
the page says to run `show`.

Problems the person can fix, such as a folder that is not empty or a round with
nothing to compare, print one plain line and end with a failing exit code; bugs
keep their stack trace. A failed model call stops `generate` with an error that
names the case and speaker, and nothing is written, so the same command can run
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
terminal demo, and the human evaluation command line with its grading page. It
supplies no application screens, navigation, dialogs, toasts, or design tokens;
the grading page uses the system font and follows the system's light or dark
mode. Consuming applications own those surfaces and their user-facing error
language.
