# Human evaluation agent guide

This guide is for an agent that runs a human evaluation for a person. The person
decides; no model ever judges. The project's own docs say how to start its
command line. Below, `<cli>` stands for that command.

An evaluation has three steps: **Produce** an output set, **Compare** it with
the current best in blind rounds, and **Confirm** a win on held-out cases.

## Terms

- **Case**: one fixed input the program responds to, such as one user message or
  a whole conversation. `tuning` cases are for trying changes; `heldout` cases
  are kept apart and only used to confirm a win.
- **Voice**: a configured speaker that responds to cases, such as one tone
  setting. A project may have one voice or many, and may put voices in groups.
- **Sample**: one try for a case and voice; `--samples 2` makes two outputs for
  each.
- **Output**: the model's text for one case, one voice, and one sample.
- **Output set**: every output from one `generate` run, saved in one folder.
- **Round**: the items shown in one comparison. Items never say which output set
  an output came from.
- **Item**: one thing to decide in a round, numbered from 1.
- **Page**: the few items printed at once.
- **Choice**: what the person picked for one item: left, right, tie, or a voice.
- **Tag**: one free word the person adds to a choice, such as `stiff`.

## Produce

```sh
<cli> generate --out <dir> [--split tuning|heldout] [--samples <n>]
```

It runs every case of the split (default `tuning`) with every voice and writes
the outputs to `outputs.jsonl` in `<dir>`.

`--out` must be a new or empty folder. If a model call fails, the command stops
with an error naming the case and voice and writes nothing; fix the cause and
run the same command again.

## Compare

Compare the new output set (B) with the current best (A) in blind rounds that
the person decides.

When voices should sound distinct, first measure each side with a **guess
round**: A if it has no guess result yet, then B. It is a measurement of one
output set that the person makes, not a comparison of two. Run it at most once
per output set you care about:

```sh
<cli> guess --outputs <dir> --out <round-dir> [--items <n>]
```

Its result gives accuracy and which voice was taken for which. By default, when
B's guess accuracy falls by 10 points or more from A's, call B **clearly worse**
and do not run its pair round (a project may set its own limit).

Then start a blind round between A and B:

```sh
<cli> judge --kind pair --a <dirA> --b <dirB> --out <round-dir> [--items <n>]
```

- **pair**: one output from each set for the same case and voice. The person
  says which is better. Always run this round unless the guess round found B
  clearly worse.
- **lineup** (`--kind lineup`): all voices of one group for one case, set A
  against set B. The person says which side sounds more like different people.
  When a change should make voices more distinct, run a lineup round in addition
  to the pair round, never instead of it.

Lineup and guess need two or more voices on a case; with one voice they refuse.
`--items` defaults to 40. `--out` must be a new or empty folder. Each command
prints the first page. Then loop:

1. Paste the printed page into the chat unchanged.
2. Pass the person's reply word for word. A reply may hold quotes, `$`,
   backticks, or backslashes, or start with `-`, so always pass it through a
   quoted heredoc and join it to the flag with `=`:

   ```sh
   <cli> choose --out <round-dir> --reply="$(cat <<'REPLY'
   3 l stiff, 4 t
   REPLY
   )"
   ```

3. `choose` prints the next page. When every item has a choice, it prints the
   result instead.

Reply format, one choice per line or after a comma: the item number, the pick,
then optional one-word tags. Pair and lineup picks are `l`, `r`, or `t` (tie);
guess picks are the voice number. For example, `3 l stiff, 4 t`. A bad reply
records nothing and prints a one-line reason; show it to the person and ask
again. A reply may skip items; they come back on the next page.

When the last item gets a choice, `choose` prints the result and saves it as
`result.json` in `<round-dir>`.

- Pair and lineup: wins for A, wins for B, ties, a sign test p-value (ties left
  out), and wins per tag and per label.
- **B wins** when it has more wins than A and the p-value is at most 0.05 (a
  default a project may change). Otherwise there is no winner.

## Confirm

Before calling a win final, check it on cases that played no part in finding it:

1. Generate both sides on held-out cases with
   `<cli> generate --split heldout --out <dir>`: once with the current best
   setup and once with the new one.
2. Run a pair round on those two output sets, as in Compare.

The win is confirmed when the new side wins this round too.

## Resume

A round keeps its choices in `<round-dir>` (`round.json`, `choices.json`). To
continue later, run `<cli> show --out <round-dir>` and carry on with `choose`.
On a finished round, `show` says where the result is.

## Keep results sound

- Do not rerun a round, or start a new one on the same output sets, to chase a
  win. Report the first finished result.
- Use `heldout` cases only to confirm a win found on `tuning` cases. Do not read
  held-out outputs to form ideas for changes.
