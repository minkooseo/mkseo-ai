# Human evaluation

The TypeScript package helps a person tune what a program sends to a model, such
as a prompt or persona settings, by blind A/B comparisons. Every decision is a
person's, made on a grading page; the library never scores an output or picks a
side. It runs in Node only and is kept apart from the generation entry that Expo
apps load. The commands a person or agent runs are in [Developer UX](ux.md).

## Projects

A project gives the library its cases, speakers, model call, and the question
for each kind of round, plus optional speaker descriptions. One short file is
enough for a single prompt.

- A **case** is one fixed input with a unique id, free-text context, and labels.
  The context is what the person reads to understand the case, so it can be one
  message or a whole conversation.
- A **speaker** is who writes an output for a case, such as one persona, with a
  unique name per case and labels. For each case a project names the addressed
  speakers, who always respond, such as the persona the user answered, and the
  others, who may; a single-prompt project names its one speaker as addressed.
- The **model call** is a plain function that returns the output text for one
  case and speaker. It may carry the project's own case fields.
- The **questions** say what the grader answers on a pair round and on a lineup
  round, such as "Which reply is kinder?". A round saves its question when it
  starts, and the page shows it above every item.
- A **speaker description** says what a speaker is meant to sound like for one
  case. It is saved with each output, so it always matches the files that made
  the output.

A project may have one speaker or many. With a single speaker there is nothing
to compare between speakers, so only pair rounds apply.

## Output sets

An **output** is the model's text for one case and one speaker. Generating gives
each case a chosen number of responses (one unless set): its addressed speakers,
then others drawn at random to fill the rest, no speaker twice. The draw is the
same in every run, so two output sets made with the same number hold the same
speakers. The outputs are saved as one output set. Output labels combine case
and speaker labels; a label that the two set to different values is an error.
Each output also keeps its speaker description, or none. A few model calls run
at once.

The first failed model call stops the run with an error that names the case and
speaker. Nothing is written, so the same command can simply run again. Every
command that creates files takes a new or empty folder, so nothing is ever
overwritten or mixed.

Before the first model call, the project is checked: case ids and speaker names
must be nonblank and unique, a case and speaker must not set one label to
different values, and every case must be able to get exactly the chosen number
of responses.

## Rounds

A **round** is a fixed set of items, drawn at random once and saved. Two output
sets compared in one round must hold the same cases, speakers, case text, and
labels; their speaker descriptions may differ. A round is a random draw of at
most a chosen number of items (5 unless set).

- **Pair**: the same case and speaker from set A and set B, on random sides.
  When there is a speaker description, the item shows the one saved with set B's
  output, since B is the newer set being proposed; it is the same whichever side
  B is on. The person picks the better side or a tie.
- **Lineup**: for one case, every speaker from set A against the same speakers
  from set B, on random sides. The person picks the side that sounds more like
  different people, or a tie. A case with one speaker is left out.

A round with no items is refused with a one-line reason. The round stores the
folders of the compared output sets relative to its own folder, so a saved round
reads the same from any checkout. The round remembers which set is on which
side, but the page never shows it.

## Choices

Starting a round opens a grading page served from this machine only. It shows
one item at a time: the case above, then Left and Right side by side, and on a
pair item with a description, the description beside them. The person picks a
side or a tie and writes a reason; a pick without a reason is refused, and
nothing is recorded. Each choice is saved in the round folder as it arrives, so
the page can be closed and reopened, and an unfinished round can be opened again
later. The command ends when every item has a choice.

Only one process serves a round at a time. While one does, opening the same
round again is refused with the address of the page already open. A mark left by
a process that has ended does not block the round.

## Results

When every item has a choice, the result is counted before anything is saved,
then saved and printed. Showing a finished round says where its result is, and
writes the result first if it is missing.

A finished round also saves its decisions: for each item, the case, the speakers
shown, the item's labels, the winning set (A, B, or a tie), and the reason as
written. Reasons are read there, since a choice alone names only a page side.

A result gives wins for A, wins for B, ties, the exact two-sided sign test
p-value with ties left out, and the same counts per label value.

The package ships an agent guide, organized as produce and compare. It suggests
a default limit: the new side wins with more wins than losses and a p-value of
at most 0.05. Projects may choose other limits.
