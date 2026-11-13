// Draw the items of a pair, lineup, or guess round from output sets.
import { groupBy } from "../group-by.ts";
import { groupOf, matchSets } from "../outputs/output.ts";
import type { Labels, Output } from "../project.ts";
import type { GuessItem, SideItem, VoiceOutput } from "./round.ts";
import { spreadPick } from "./spread-pick.ts";

interface ItemRequest {
  /** Most items to return; fewer when there are not enough outputs. */
  readonly itemLimit: number;
  /** Random number source from 0 up to 1; e.g. Math.random. */
  readonly random: () => number;
}

/**
 * Build pair items: each shows one case, voice, and sample from set A and
 * set B, on random sides. Items are spread evenly across voices.
 */
export function pairItems({
  a,
  b,
  itemLimit,
  random,
}: ItemRequest & {
  readonly a: readonly Output[];
  readonly b: readonly Output[];
}): SideItem[] {
  const partnerOf = matchSets(a, b);
  const picked = spreadPick({
    candidates: a,
    spreadBy: (output) => output.voice,
    itemLimit,
    random,
  });
  return drawSides(
    picked.map((output) => ({
      first: output,
      a: [voiceOutput(output)],
      b: [voiceOutput(partnerOf(output))],
      labels: output.labels,
    })),
    random,
  );
}

/**
 * Build lineup items: each shows, for one case and sample, every voice in
 * one group from set A against the same voices from set B, on random
 * sides. Groups with a single voice are skipped. Items are spread evenly
 * across groups.
 */
export function lineupItems({
  a,
  b,
  groupLabel,
  itemLimit,
  random,
}: ItemRequest & {
  readonly a: readonly Output[];
  readonly b: readonly Output[];
  readonly groupLabel: string | null;
}): SideItem[] {
  const partnerOf = matchSets(a, b);
  const lineups = [
    ...groupBy(a, (output) =>
      JSON.stringify([
        output.caseId,
        groupOf(output, groupLabel),
        output.sample,
      ]),
    ).values(),
  ].filter((lineup) => lineup.length >= 2);
  const picked = spreadPick({
    candidates: lineups,
    spreadBy: (lineup) => groupOf(firstOf(lineup), groupLabel),
    itemLimit,
    random,
  });
  return drawSides(
    picked.map((lineup) => {
      const outputs = [...lineup].sort((x, y) => (x.voice < y.voice ? -1 : 1));
      return {
        first: firstOf(outputs),
        a: outputs.map(voiceOutput),
        b: outputs.map((output) => voiceOutput(partnerOf(output))),
        labels: commonLabels(outputs),
      };
    }),
    random,
  );
}

/**
 * Build guess items from one output set: each shows one output with no
 * name and offers the voices that responded to the same case in the same
 * group. Outputs with no other voice in their group are skipped. Items are
 * spread evenly across voices.
 */
export function guessItems({
  outputs,
  groupLabel,
  itemLimit,
  random,
}: ItemRequest & {
  readonly outputs: readonly Output[];
  readonly groupLabel: string | null;
}): GuessItem[] {
  const sameCaseAndGroup = (output: Output) =>
    JSON.stringify([output.caseId, groupOf(output, groupLabel)]);
  const voicesOf = new Map(
    [...groupBy(outputs, sameCaseAndGroup)].map(([key, group]) => [
      key,
      [...new Set(group.map((output) => output.voice))].sort(),
    ]),
  );
  const options = (output: Output) => {
    const voices = voicesOf.get(sameCaseAndGroup(output));
    if (voices === undefined) throw new Error("Every output has a group.");
    return voices;
  };
  const picked = spreadPick({
    candidates: outputs.filter((output) => options(output).length >= 2),
    spreadBy: (output) => output.voice,
    itemLimit,
    random,
  });
  return picked.map((output) => ({
    caseId: output.caseId,
    sample: output.sample,
    context: output.context,
    text: output.text,
    voice: output.voice,
    options: options(output),
  }));
}

interface SidePair {
  /**
   * One output of the item, read for the case, sample, and context all its
   * outputs share.
   */
  readonly first: Output;
  readonly a: VoiceOutput[];
  readonly b: VoiceOutput[];
  readonly labels: Labels;
}

/** Put set A on a random side of each item. */
function drawSides(
  pairs: readonly SidePair[],
  random: () => number,
): SideItem[] {
  return pairs.map(({ first, a, b, labels }) => {
    const leftSet = random() < 0.5 ? "a" : "b";
    return {
      caseId: first.caseId,
      sample: first.sample,
      context: first.context,
      labels,
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

function voiceOutput(output: Output): VoiceOutput {
  return { voice: output.voice, text: output.text };
}

function firstOf<T>(items: readonly T[]): T {
  const first = items[0];
  if (first === undefined) throw new Error("Expected at least one item.");
  return first;
}
