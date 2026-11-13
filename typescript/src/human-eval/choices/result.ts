// The result of a finished round: wins and the sign test for pair and
// lineup, accuracy and mix-ups for guess.
import type { GuessItem, Round, SideItem } from "../round/round.ts";
import type { Choice } from "./choices.ts";
import { signTest } from "./sign-test.ts";

/** How often the person picked output set A, set B, or a tie. */
export interface WinCounts {
  /** Items where set A's side was picked; e.g. 12. */
  readonly aWins: number;
  /** Items where set B's side was picked; e.g. 7. */
  readonly bWins: number;
  /** Items picked as a tie; e.g. 3. */
  readonly ties: number;
}

/** The result of a finished pair or lineup round. */
export interface SideResult extends WinCounts {
  readonly kind: "pair" | "lineup";
  /** Folder of output set A, relative to the round; e.g. '../run-1'. */
  readonly a: string;
  /** Folder of output set B, relative to the round; e.g. '../run-2'. */
  readonly b: string;
  /** Number of choices; e.g. 40. */
  readonly choices: number;
  /** Two-sided sign test p-value with ties left out; e.g. 0.03. */
  readonly pValue: number;
  /** Wins among the items that carry each tag; e.g. { stiff: ... }. */
  readonly byTag: Readonly<Record<string, WinCounts>>;
  /** Wins per label name, then per value; e.g. { group: { calm: ... } }. */
  readonly byLabel: Readonly<
    Record<string, Readonly<Record<string, WinCounts>>>
  >;
}

/** The result of a finished guess round. */
export interface GuessResult {
  readonly kind: "guess";
  /** Folder of the output set, relative to the round; e.g. '../run-1'. */
  readonly outputs: string;
  /** Number of choices; e.g. 40. */
  readonly choices: number;
  /** Choices that named the real voice; e.g. 22. */
  readonly correct: number;
  /** Share of correct choices, from 0 to 1; e.g. 0.55. */
  readonly accuracy: number;
  /** Count per real voice, then per guessed voice; e.g. { a: { b: 2 } }. */
  readonly confusion: Readonly<
    Record<string, Readonly<Record<string, number>>>
  >;
}

export type HumanEvalResult = SideResult | GuessResult;

/**
 * Count the choices of a finished round. Throws when an item has no
 * choice.
 */
export function resultOf({
  round,
  choices,
}: {
  readonly round: Round;
  readonly choices: readonly Choice[];
}): HumanEvalResult {
  if (round.kind === "guess") {
    return {
      kind: "guess",
      outputs: round.outputs,
      ...countGuesses(round.items, choices),
    };
  }
  return {
    kind: round.kind,
    a: round.a,
    b: round.b,
    ...countSides(round.items, choices),
  };
}

type Winner = "a" | "b" | "tie";

/** One decided pair or lineup item, reduced to what the counts need. */
interface SideRow {
  readonly winner: Winner;
  readonly tags: readonly string[];
  readonly labels: Readonly<Record<string, string>>;
}

function countSides(items: readonly SideItem[], choices: readonly Choice[]) {
  const rows: SideRow[] = items.map((item, index) => {
    const choice = choiceOn(choices, index + 1);
    return {
      winner: winnerOf(item, choice),
      tags: choice.tags,
      labels: item.labels,
    };
  });
  const total = countWins(rows.map((row) => row.winner));
  // Grouping uses Maps, not plain objects, so tags or labels named like
  // "__proto__" are counted like any other word.
  const tags = new Map<string, Winner[]>();
  const labels = new Map<string, Map<string, Winner[]>>();
  for (const { winner, tags: rowTags, labels: rowLabels } of rows) {
    for (const tag of rowTags)
      tags.set(tag, [...(tags.get(tag) ?? []), winner]);
    for (const [name, value] of Object.entries(rowLabels)) {
      const values = labels.get(name) ?? new Map<string, Winner[]>();
      labels.set(name, values);
      values.set(value, [...(values.get(value) ?? []), winner]);
    }
  }
  return {
    choices: items.length,
    ...total,
    pValue: signTest({ aWins: total.aWins, bWins: total.bWins }),
    byTag: countEach(tags),
    byLabel: Object.fromEntries(
      [...labels].map(([name, values]) => [name, countEach(values)]),
    ),
  };
}

function countGuesses(items: readonly GuessItem[], choices: readonly Choice[]) {
  let correct = 0;
  const confusion = new Map<string, Map<string, number>>();
  items.forEach((item, index) => {
    const guess = choiceOn(choices, index + 1).picked;
    if (guess === item.voice) correct += 1;
    const row = confusion.get(item.voice) ?? new Map<string, number>();
    confusion.set(item.voice, row);
    row.set(guess, (row.get(guess) ?? 0) + 1);
  });
  return {
    choices: items.length,
    correct,
    accuracy: correct / items.length,
    confusion: Object.fromEntries(
      [...confusion].map(([voice, row]) => [voice, Object.fromEntries(row)]),
    ),
  };
}

function countEach(
  winnersByKey: ReadonlyMap<string, readonly Winner[]>,
): Record<string, WinCounts> {
  return Object.fromEntries(
    [...winnersByKey].map(([key, winners]) => [key, countWins(winners)]),
  );
}

function countWins(winners: readonly Winner[]): WinCounts {
  return {
    aWins: winners.filter((winner) => winner === "a").length,
    bWins: winners.filter((winner) => winner === "b").length,
    ties: winners.filter((winner) => winner === "tie").length,
  };
}

function winnerOf(item: SideItem, choice: Choice): Winner {
  if (choice.picked === "tie") return "tie";
  if (choice.picked === "left") return item.leftSet;
  if (choice.picked === "right") return item.leftSet === "a" ? "b" : "a";
  throw new Error(`The pick "${choice.picked}" is not left, right, or tie.`);
}

function choiceOn(choices: readonly Choice[], item: number): Choice {
  const choice = choices.find((one) => one.item === item);
  if (choice === undefined) throw new Error(`Item ${item} has no choice.`);
  return choice;
}
