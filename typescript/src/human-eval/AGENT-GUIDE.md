# Human evaluation agent guide

This guide is for an agent that runs a human evaluation for a person. Every
decision is the person's, made on a grading page; the tools never score an
output or pick a side, they only count the choices made. The project's own docs
say how to start its command line. Below, `<cli>` stands for that command.

An evaluation has two steps: **Produce** an output set, then **Compare** it with
the current best in blind rounds.

## Terms

- **Case**: one fixed input the program responds to, such as one user message or
  a whole conversation.
- **Speaker**: who writes an output for a case, such as one persona or one tone
  setting. A project may have one speaker or many. For each case it names the
  addressed speakers, who always respond, and the others, who may.
- **Sample**: one response to a case; `--num-samples 3` makes three outputs per
  case, each from a different speaker.
- **Output**: the model's text for one case and one speaker.
- **Output set**: every output from one `generate` run, saved in one folder.
- **Round**: the items shown in one comparison, a random draw of the outputs.
  Items never say which output set an output came from.
- **Item**: one thing to decide in a round, numbered from 1.
- **Choice**: what the person picked for one item (left, right, or tie) and
  their reason.

## Case text and speaker descriptions

The page reads a case's context line by line: `### ` starts a heading, `- ` a
list item, `> ` a highlighted quote; lines in a row of one kind join one list or
quote. Any other line is a paragraph, and blank lines are skipped. There is no
inline markup such as `**bold**`.

A speaker description is structured: a title, then titled sections of named
fields. A field's value is one text or a list of texts. A section marked
`collapsed` starts closed on the page; the grader can open it.

## Produce

```sh
<cli> generate --out <dir> [--num-samples <n>]
```

For each case it takes the addressed speakers, then draws others at random until
the case has `--num-samples` responses (default 1); no speaker responds twice.
The draw is the same every run, so two output sets made with the same
`--num-samples` hold the same speakers and can be compared. It writes the
outputs to `outputs.jsonl` in `<dir>`, and refuses a case that cannot get
exactly that many responses.

`--out` must be a new or empty folder. If a model call fails, the command stops
with an error naming the case and speaker and writes nothing; fix the cause and
run the same command again.

## Compare

Compare the new output set (B) with the current best (A) in a blind round that
the person decides:

```sh
<cli> judge --kind pair --a <dirA> --b <dirB> --out <round-dir> \
  [--num-questions <n>]
```

- **pair**: one output from each set for the same case and speaker. If the
  project describes its speakers, the page shows the description saved with set
  B's output beside both. `generate` saves a description with every output, and
  B is the newer set being proposed, so its description is the one the change
  under test meant.
- **lineup** (`--kind lineup`): all speakers on one case, set A against set B.

The page asks the project's question for the kind of round, such as "Which reply
is kinder?" for pair or "Which side sounds more like different people?" for
lineup.

Items are drawn at random, at most `--num-questions` (default 5). Lineup needs
two or more speakers on a case, so generate both sets with `--num-samples 2` or
more; with one it refuses. `--out` must be a new or empty folder.

`judge` opens the grading page in the browser and prints its address. Run it in
the background: it ends only when every item has a choice. Tell the person the
address and wait. On the page, one item fills the screen with Left and Right;
the person picks with the arrow keys or T for a tie, or with the mouse, writes a
reason, and presses Enter. Left and Right need a reason; a tie may have none.
Each choice is saved in `<round-dir>` as it arrives, so the page can be closed
and opened again at the same address while `judge` runs.

When the last item gets a choice, `judge` prints the result and saves it as
`result.json` in `<round-dir>`, next to `decisions.json`:

- Wins for A, wins for B, ties, and wins per label.
- The winner by majority: **B wins** when it has more wins than A, **A wins**
  when it has more than B, and otherwise there is no winner. Ties do not count.

Read the reasons in `<round-dir>/decisions.json`. Each item has its case id and
context, each speaker's text from set A and from set B, its labels, the winning
set (`a`, `b`, or `tie`), and the reason as written (null for a tie left without
one). On each item, compare A's text with B's and read the reason to see what
the person preferred and why; there is no need to open the output sets.
(`choices.json` only names the page side picked.)

## Resume

A round keeps its choices in `<round-dir>` (`round.json`, `choices.json`). If
`judge` stopped before the round was done, run `<cli> show --out <round-dir>`:
it opens the page again on the items left and prints the result when they are
done. On a finished round, `show` says where the result is. While another
`judge` or `show` still serves the round, `show` refuses and prints that page's
address: open that address instead.

## Keep results sound

- Do not rerun a round, or start a new one on the same output sets, to chase a
  win. Report the first finished result.
