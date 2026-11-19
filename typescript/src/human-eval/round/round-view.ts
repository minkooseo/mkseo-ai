// What the grading page shows of a round: every item as Left and Right,
// without anything that says which output set is on which side.
import type { SpeakerDescription } from "../project.ts";
import type { Round, SpeakerOutput } from "./round.ts";

/** One round item as the page shows it. */
export interface ItemView {
  /** The item's number in the round, counted from 1; e.g. 3. */
  readonly number: number;
  /** What the person reads to grasp the case; e.g. 'I lost my keys.'. */
  readonly context: string;
  /** What a pair item's speaker is meant to sound like, or null for none. */
  readonly speakerDescription: SpeakerDescription | null;
  readonly left: readonly SpeakerOutput[];
  readonly right: readonly SpeakerOutput[];
}

/** A whole round as the page shows it. */
export interface RoundView {
  readonly kind: Round["kind"];
  /** What the person decides on every item; e.g. 'Which side is better?'. */
  readonly question: string;
  readonly items: readonly ItemView[];
}

/**
 * The blind view of a round for the grading page. It never holds which
 * output set is on which side, nor the output sets' folders.
 */
export function roundView(round: Round): RoundView {
  return {
    kind: round.kind,
    question: round.question,
    items: round.items.map((item, index) => ({
      number: index + 1,
      context: item.context,
      speakerDescription: item.speakerDescription,
      left: item.left,
      right: item.right,
    })),
  };
}
