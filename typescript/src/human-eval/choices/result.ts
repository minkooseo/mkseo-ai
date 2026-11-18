// The result of a finished round: wins per output set and the sign test.
import type { Round } from "../round/round.ts";
import type { Choice } from "./choices.ts";
import { decisionsOf, type Decision, type Winner } from "./decisions.ts";
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
  /** How many items got a choice; e.g. 40. */
  readonly choiceCount: number;
  /** Two-sided sign test p-value with ties left out; e.g. 0.03. */
  readonly pValue: number;
  /** Wins per label name, then per value; e.g. { tone: { calm: ... } }. */
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
    ...countDecisions(decisionsOf({ round, choices })),
  };
}

function countDecisions(decided: readonly Decision[]) {
  const total = countWins(decided.map((one) => one.winner));
  // Grouping uses Maps, not plain objects, so labels named like
  // "__proto__" are counted like any other word.
  const labels = new Map<string, Map<string, Winner[]>>();
  for (const { winner, labels: itemLabels } of decided) {
    for (const [name, value] of Object.entries(itemLabels)) {
      const values = labels.get(name) ?? new Map<string, Winner[]>();
      labels.set(name, values);
      values.set(value, [...(values.get(value) ?? []), winner]);
    }
  }
  return {
    choiceCount: decided.length,
    ...total,
    pValue: signTest({ aWins: total.aWins, bWins: total.bWins }),
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
