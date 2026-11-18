// Draw the items of a pair or lineup round from two output sets.
import { matchSets } from "../outputs/output.ts";
import type { Labels, Output } from "../project.ts";
import type { RoundItem, SpeakerOutput } from "./round.ts";

interface ItemRequest {
  readonly a: readonly Output[];
  readonly b: readonly Output[];
  /** Most items to return; fewer when there are not enough outputs. */
  readonly itemLimit: number;
}

/**
 * Build pair items, drawn at random: each shows one case, speaker, and
 * sample from set A and set B, on random sides. The speaker description
 * comes from set B's output, since B is the newer set being proposed.
 */
export function pairItems({ a, b, itemLimit }: ItemRequest): RoundItem[] {
  const bOutputFor = matchSets(a, b);
  const picked = shuffle(a).slice(0, itemLimit);
  return drawSides(
    picked.map((output) => {
      const bOutput = bOutputFor(output);
      return {
        example: output,
        a: [speakerOutput(output)],
        b: [speakerOutput(bOutput)],
        labels: output.labels,
        speakerDescription: bOutput.speakerDescription,
      };
    }),
  );
}

/**
 * Build lineup items, drawn at random: each shows, for one case and
 * sample, every speaker from set A against the same speakers from set B,
 * on random sides. A case with one speaker has nothing to compare and
 * gives no item.
 */
export function lineupItems({ a, b, itemLimit }: ItemRequest): RoundItem[] {
  const bOutputFor = matchSets(a, b);
  // One lineup per case and sample, holding every speaker's output.
  const lineups = new Map<string, Output[]>();
  for (const output of a) {
    const key = JSON.stringify([output.caseId, output.sample]);
    lineups.set(key, [...(lineups.get(key) ?? []), output]);
  }
  const comparable = [...lineups.values()].filter(
    (lineup) => lineup.length >= 2,
  );
  const picked = shuffle(comparable).slice(0, itemLimit);
  return drawSides(
    picked.map((lineup) => {
      const outputs = [...lineup].sort((x, y) =>
        x.speaker < y.speaker ? -1 : 1,
      );
      return {
        example: firstOf(outputs),
        a: outputs.map(speakerOutput),
        b: outputs.map((output) => speakerOutput(bOutputFor(output))),
        labels: commonLabels(outputs),
        speakerDescription: null,
      };
    }),
  );
}

interface ItemBeforeSides {
  /** Any one output of the item, read for the case it shows. */
  readonly example: Output;
  readonly a: SpeakerOutput[];
  readonly b: SpeakerOutput[];
  readonly labels: Labels;
  readonly speakerDescription: string | null;
}

/** Put set A on a random side of each item. */
function drawSides(items: readonly ItemBeforeSides[]): RoundItem[] {
  return items.map(({ example, a, b, labels, speakerDescription }) => {
    const leftSet = Math.random() < 0.5 ? "a" : "b";
    return {
      caseId: example.caseId,
      sample: example.sample,
      context: example.context,
      labels,
      speakerDescription,
      leftSet,
      left: leftSet === "a" ? a : b,
      right: leftSet === "a" ? b : a,
    };
  });
}

function commonLabels(outputs: readonly Output[]): Labels {
  return Object.fromEntries(
    Object.entries(firstOf(outputs).labels).filter(([name, value]) =>
      outputs.every((output) => output.labels[name] === value),
    ),
  );
}

function speakerOutput(output: Output): SpeakerOutput {
  return { speaker: output.speaker, text: output.text };
}

function firstOf<T>(items: readonly T[]): T {
  const first = items[0];
  if (first === undefined) throw new Error("Expected at least one item.");
  return first;
}

function shuffle<T>(items: readonly T[]): T[] {
  const remaining = [...items];
  const shuffled: T[] = [];
  while (remaining.length > 0) {
    const index = Math.floor(Math.random() * remaining.length);
    shuffled.push(...remaining.splice(index, 1));
  }
  return shuffled;
}
