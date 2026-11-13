// Measure how alike different voices sound, by shared 3-letter pieces.
import { groupBy } from "../group-by.ts";
import type { Output } from "../project.ts";
import { groupOf } from "./output.ts";

/** How alike two voices sound, averaged over the cases both responded to. */
export interface VoicePairOverlap {
  /** The two voices, in name order; e.g. ['casual', 'formal']. */
  readonly voices: readonly [string, string];
  /** Mean similarity of their outputs, from 0 to 1; e.g. 0.18. */
  readonly mean: number;
  /** How many output pairs went into the mean; e.g. 12. */
  readonly comparisons: number;
}

/** One compared pair of outputs to the same case from different voices. */
interface OutputPair {
  /** The two voices, in name order; e.g. ['casual', 'formal']. */
  readonly voices: readonly [string, string];
  /** Similarity from 0 (no shared 3-grams) to 1 (same 3-grams); e.g. 0.4. */
  readonly similarity: number;
}

/** How alike the voices in one output set sound. */
export interface OverlapReport {
  /** Mean similarity over all compared pairs; null when none were compared. */
  readonly overallMean: number | null;
  /** Every voice pair, most alike first. */
  readonly voicePairs: readonly VoicePairOverlap[];
}

/**
 * Measure how alike different voices sound. For each case, every output is
 * compared with every output from a different voice. When `groupLabel` is
 * set, only outputs with the same value for that label are compared; e.g.
 * only voices in the same group.
 */
export function measureOverlap({
  outputs,
  groupLabel,
}: {
  readonly outputs: readonly Output[];
  readonly groupLabel: string | null;
}): OverlapReport {
  const pairs = compareOutputs(outputs, groupLabel);
  const byVoices = groupBy(pairs, (pair) => JSON.stringify(pair.voices));
  const voicePairs = [...byVoices.values()].map((group) => ({
    voices: firstOf(group).voices,
    mean: meanSimilarity(group),
    comparisons: group.length,
  }));
  return {
    overallMean: pairs.length === 0 ? null : meanSimilarity(pairs),
    voicePairs: voicePairs.sort((x, y) => y.mean - x.mean),
  };
}

/**
 * Jaccard similarity of the two texts' character 3-gram sets: the number
 * of 3-grams both share divided by the number in either. It works for any
 * language. A text shorter than three characters counts as one gram.
 */
export function trigramSimilarity(first: string, second: string): number {
  const firstGrams = trigrams(first);
  const secondGrams = trigrams(second);
  let shared = 0;
  for (const gram of firstGrams) if (secondGrams.has(gram)) shared += 1;
  return shared / (firstGrams.size + secondGrams.size - shared);
}

function compareOutputs(
  outputs: readonly Output[],
  groupLabel: string | null,
): OutputPair[] {
  const sameCaseAndGroup = groupBy(outputs, (output) =>
    JSON.stringify([output.caseId, groupOf(output, groupLabel)]),
  );
  const pairs: OutputPair[] = [];
  for (const group of sameCaseAndGroup.values()) {
    for (const [index, one] of group.entries()) {
      for (const other of group.slice(index + 1)) {
        if (one.voice === other.voice) continue;
        pairs.push({
          voices:
            one.voice < other.voice
              ? [one.voice, other.voice]
              : [other.voice, one.voice],
          similarity: trigramSimilarity(one.text, other.text),
        });
      }
    }
  }
  return pairs;
}

function firstOf(pairs: readonly OutputPair[]): OutputPair {
  const first = pairs[0];
  if (first === undefined) throw new Error("A voice pair has no outputs.");
  return first;
}

function meanSimilarity(pairs: readonly OutputPair[]): number {
  return pairs.reduce((sum, pair) => sum + pair.similarity, 0) / pairs.length;
}

function trigrams(text: string): Set<string> {
  // Array.from splits by Unicode code point, not UTF-16 unit. Characters
  // built from several code points, such as joined emoji, still split.
  const characters = Array.from(text);
  if (characters.length < 3) return new Set([text]);
  const grams = new Set<string>();
  for (let start = 0; start + 3 <= characters.length; start += 1) {
    grams.add(characters.slice(start, start + 3).join(""));
  }
  return grams;
}
