// The result of a finished round: wins per output set and the sign test.
import type { Round, RoundItem } from "../round/round.ts";
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
export interface HumanEvalResult extends WinCounts {
  readonly kind: Round["kind"];
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
  return {
    kind: round.kind,
    a: round.a,
    b: round.b,
    ...countItems(round.items, choices),
  };
}

type Winner = "a" | "b" | "tie";

/** One decided item, reduced to what the counts need. */
interface ItemRow {
  readonly winner: Winner;
  readonly tags: readonly string[];
  readonly labels: Readonly<Record<string, string>>;
}

function countItems(items: readonly RoundItem[], choices: readonly Choice[]) {
  const rows: ItemRow[] = items.map((item, index) => {
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

function winnerOf(item: RoundItem, choice: Choice): Winner {
  switch (choice.picked) {
    case "tie":
      return "tie";
    case "left":
      return item.leftSet;
    case "right":
      return item.leftSet === "a" ? "b" : "a";
  }
}

function choiceOn(choices: readonly Choice[], item: number): Choice {
  const choice = choices.find((one) => one.item === item);
  if (choice === undefined) throw new Error(`Item ${item} has no choice.`);
  return choice;
}
