// What the person decided on each item of a finished round, told in output
// sets instead of page sides, so reasons can be read on their own.
import type { Labels } from "../project.ts";
import type { Round, RoundItem } from "../round/round.ts";
import type { Choice } from "./choices.ts";

/** Which output set an item went to; e.g. 'b'. */
export type Winner = "a" | "b" | "tie";

/** One item of a finished round and what the person decided on it. */
export interface Decision {
  /** The item's number in the round, counted from 1; e.g. 3. */
  readonly item: number;
  /** The case shown; e.g. 'late-train'. */
  readonly caseId: string;
  /** Which try of the case the outputs are; e.g. 2. */
  readonly sample: number;
  /** The speakers shown on each side; e.g. ['casual', 'formal']. */
  readonly speakers: readonly string[];
  /** Labels all outputs in the item share; e.g. { task: 'reply' }. */
  readonly labels: Labels;
  /** The output set picked, or a tie; e.g. 'b'. */
  readonly winner: Winner;
  /** The person's reason, as written; e.g. 'Warmer and shorter.'. */
  readonly reason: string;
}

/**
 * Every item of a finished round with the set the person picked and why.
 * Throws when an item has no choice.
 */
export function decisionsOf({
  round,
  choices,
}: {
  readonly round: Round;
  readonly choices: readonly Choice[];
}): Decision[] {
  return round.items.map((item, index) => {
    const choice = choiceFor(choices, index + 1);
    return {
      item: index + 1,
      caseId: item.caseId,
      sample: item.sample,
      speakers: item.left.map((output) => output.speaker),
      labels: item.labels,
      winner: winnerOf(item, choice),
      reason: choice.reason,
    };
  });
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

function choiceFor(choices: readonly Choice[], item: number): Choice {
  const choice = choices.find((one) => one.item === item);
  if (choice === undefined) throw new Error(`Item ${item} has no choice.`);
  return choice;
}
