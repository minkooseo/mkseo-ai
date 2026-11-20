// What the person decided on each item of a finished round, told in output
// sets instead of page sides, with the case and both sets' texts, so each
// decision can be read on its own.
import type { Labels } from "../project.ts";
import type { Round, RoundItem } from "../round/round.ts";
import type { Choice } from "./choices.ts";

/** Which output set an item went to; e.g. 'b'. */
export type Winner = "a" | "b" | "tie";

/** What one speaker wrote in set A and in set B on an item. */
export interface DecisionOutput {
  /** The speaker; e.g. 'formal'. */
  readonly speaker: string;
  /** Set A's output; e.g. 'That is unfortunate.'. */
  readonly a: string;
  /** Set B's output; e.g. 'I am sorry to hear it.'. */
  readonly b: string;
}

/** One item of a finished round and what the person decided on it. */
export interface Decision {
  /** The item's number in the round, counted from 1; e.g. 3. */
  readonly item: number;
  /** The case shown; e.g. 'late-train'. */
  readonly caseId: string;
  /** The case as the person read it; e.g. 'My train was 40 minutes late.'. */
  readonly context: string;
  /** Each speaker's outputs from both sets, in the order shown. */
  readonly outputs: readonly DecisionOutput[];
  /** Labels all outputs in the item share; e.g. { task: 'reply' }. */
  readonly labels: Labels;
  /** The output set picked, or a tie; e.g. 'b'. */
  readonly winner: Winner;
  /**
   * The person's reason, as written, or null for a tie without one; e.g.
   * 'Warmer and shorter.'.
   */
  readonly reason: string | null;
}

/**
 * Every item of a finished round with both sets' outputs, the set the
 * person picked, and why. Throws when an item has no choice.
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
      context: item.context,
      outputs: outputsOf(item),
      labels: item.labels,
      winner: winnerOf(item, choice),
      reason: choice.reason,
    };
  });
}

// Pair each speaker's left and right outputs back into sets A and B; the
// round schema guarantees both sides show the same speakers in order.
function outputsOf(item: RoundItem): DecisionOutput[] {
  const [a, b] =
    item.leftSet === "a" ? [item.left, item.right] : [item.right, item.left];
  return a.map((aOutput, index) => ({
    speaker: aOutput.speaker,
    a: aOutput.text,
    b: nth(b, index).text,
  }));
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

function nth<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`No entry at index ${index}.`);
  return item;
}
