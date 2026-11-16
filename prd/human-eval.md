# Human evaluation

The TypeScript package helps a person tune what a program sends to a model, such
as a prompt or speaker settings, by blind A/B comparisons. Every decision is a
person's, or an agent's standing in for the person; the library never scores an
output or picks a side. It runs in Node only and is kept apart from the
generation entry that Expo apps load. The commands a person or agent runs are in
[Developer UX](ux.md).

## Projects

A project gives the library its cases, voices, model call, and an optional
grouping label. One short file is enough for a single prompt.

- A **case** is one fixed input with a unique id, a split, free-text context,
  and labels. The context is what the person reads to understand the case, so it
  can be one message or a whole conversation. `tuning` cases are for trying
  changes; `heldout` cases only confirm a win.
- A **voice** is one configured speaker with a unique name per case and labels.
  A project returns the voices that respond to each case; a single-prompt
  project returns one.
- The **model call** is a plain function that returns the output text for one
  case and voice. It may carry the project's own case fields.
- The **group label** names the label that puts voices into groups. When it is
  absent, all voices that responded to a case form one group.

Three shapes are supported: grouped voices, ungrouped voices, and a single
voice. With a single voice there is nothing to compare between voices.

## Output sets

An **output** is the model's text for one case, one voice, and one sample
number. Generating runs every case of one split with every voice, once per
sample number, and saves the outputs as one output set. Output labels combine
case and voice labels; a label that the two set to different values is an error.
A few model calls run at once.

The first failed model call stops the run with an error that names the case and
voice. Nothing is written, so the same command can simply run again. Every
command that creates files takes a new or empty folder, so nothing is ever
overwritten or mixed.

Before the first model call, the project is checked: case ids and voice names
must be nonblank and unique, and every voice must have the group label when
there is one.

## Rounds

A **round** is a fixed list of items, drawn at random once and saved. Two output
sets compared in one round must hold the same cases, voices, samples, case text,
and labels. At most a chosen number of items is drawn (40 unless set), spread
evenly across voices or groups.

- **Pair**: the same case, voice, and sample from set A and set B, on random
  sides. The person picks the better side or a tie, and may add free words
  (tags).
- **Lineup**: for one case and sample, every voice of one group from set A
  against the same voices from set B, on random sides. The person picks the side
  that sounds more like different people, or a tie. Groups with one voice are
  left out. It is run in addition to a pair round, never instead of it.

A round with no items is refused with a one-line reason. The round stores the
folders of the compared output sets relative to its own folder, so a saved round
reads the same from any checkout. The round remembers which set is on which
side, but pages never show it.

## Choices

Everything is non-interactive: each step runs once, prints text, and exits, so
an agent can relay pages and replies through a chat. Pages show the first items
without a choice (five pair items or one lineup item), numbered across the whole
round, as Markdown with the case context and the outputs. Each page ends with
how to reply.

A reply lists one **choice** per line or after a comma: item number, the pick
(left, right, or tie), and any one-word tags. A tag that is a number or a pick
letter means two choices were run together, and the reply is refused. Letters
may be any case. A reply that names an item not on the page, repeats an item, or
has an unknown pick records nothing and gives a one-line reason. A reply may
skip items, which come back on the next page. Choices are saved as they arrive,
so a round can be left and resumed.

## Results

When every item has a choice, the result is counted before anything is saved,
then saved and shown. Showing a finished round says where its result is, and
writes the result first if it is missing.

A result gives wins for A, wins for B, ties, the exact two-sided sign test
p-value with ties left out, and the same counts per tag and per label value.

The package ships an agent guide, organized as produce, compare, and confirm. It
suggests default limits: the new side wins with more wins than losses and a
p-value of at most 0.05, and a win is confirmed by a pair round on held-out
cases. Projects may choose other limits.
