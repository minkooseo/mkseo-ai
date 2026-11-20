// The state of a round while a person grades it. For each item it decides
// at random whether set A shows on the left or the right, and keeps that
// from the page. It turns each pick of Left or Right back into A or B, and
// collects the verdicts until every item has one.
import { z } from "zod";
import type {
  Description,
  ItemVerdict,
  Round,
  SpeakerVerdict,
  Winner,
} from "./round.ts";

/** An output set; e.g. 'b'. */
type OutputSet = "a" | "b";

/**
 * One item's verdict: one ItemVerdict in an 'item' round, or one
 * SpeakerVerdict per speaker in a 'speaker' round.
 */
export type Verdict = ItemVerdict | readonly SpeakerVerdict[];

/** A round in progress. */
export interface BlindRound {
  readonly round: Round;
  /** The set shown on the left of each item, in item order; e.g. ['b']. */
  readonly leftSets: readonly OutputSet[];
  /** Each decided item's verdict, by item number from 1. */
  readonly verdicts: ReadonlyMap<number, Verdict>;
}

/** What the page gets: the items as Left and Right, and the decided ones. */
export interface PageView {
  readonly question: string;
  readonly ask: Round["ask"];
  readonly items: readonly PageItem[];
  /** Numbers of the items already decided; e.g. [1, 3]. */
  readonly chosen: readonly number[];
}

/** One item as the page shows it. */
interface PageItem {
  /** The item's number, counted from 1; e.g. 3. */
  readonly number: number;
  readonly context: string;
  readonly speakers: readonly PageSpeaker[];
}

/** One speaker's outputs as the page shows them. */
interface PageSpeaker {
  readonly speaker: string;
  readonly gender: "woman" | "man";
  readonly description: Description;
  readonly left: string;
  readonly right: string;
}

/** A choice on an item of an 'item' round; the reason box may be blank. */
export const itemChoiceSchema = z.strictObject({
  /** The item, counted from 1; e.g. 3. */
  item: z.int().positive(),
  /** The side picked, or a tie; e.g. 'left'. */
  picked: z.enum(["left", "right", "tie"]),
  /** The reason box's text, possibly blank; e.g. 'Too stiff.'. */
  reason: z.string(),
});

/** A choice on an item of a 'speaker' round: the speakers marked, if any. */
export const speakerChoiceSchema = z.strictObject({
  /** The item, counted from 1; e.g. 3. */
  item: z.int().positive(),
  marks: z.array(
    z.strictObject({
      /** The speaker marked; e.g. 'formal'. */
      speaker: z.string(),
      /** The side marked better; e.g. 'left'. */
      picked: z.enum(["left", "right"]),
      /** The reason box's text, possibly blank; e.g. 'Warmer.'. */
      reason: z.string(),
    }),
  ),
});

type ItemChoice = z.infer<typeof itemChoiceSchema>;
type SpeakerChoice = z.infer<typeof speakerChoiceSchema>;

/** A choice the page sent that the round cannot take; the page shows why. */
export class ChoiceRefused extends Error {}

/**
 * Start a round with no verdicts, putting set A on a random side of each
 * item. Throws when the round has no items, since nothing could finish it.
 */
export function startBlindRound(round: Round): BlindRound {
  if (round.items.length === 0) throw new Error("A round needs an item.");
  return {
    round,
    leftSets: round.items.map(() => (Math.random() < 0.5 ? "a" : "b")),
    verdicts: new Map(),
  };
}

/** The page's view of the round, which never says which set is which. */
export function pageView({ round, leftSets, verdicts }: BlindRound): PageView {
  return {
    question: round.question,
    ask: round.ask,
    items: round.items.map((item, index) => {
      const leftSet = itemAt(leftSets, index);
      return {
        number: index + 1,
        context: item.context,
        speakers: item.speakers.map(
          ({ speaker, gender, description, a, b }) => ({
            speaker,
            gender,
            description,
            left: leftSet === "a" ? a : b,
            right: leftSet === "a" ? b : a,
          }),
        ),
      };
    }),
    chosen: [...verdicts.keys()],
  };
}

/**
 * The round with one more item decided by an 'item' round's choice. A tie
 * with a blank reason keeps no reason; any other reason is kept as
 * written. Throws ChoiceRefused when the item cannot take a choice or a
 * side is picked without a reason.
 */
export function addItemChoice(
  blind: BlindRound,
  { item, picked, reason }: ItemChoice,
): BlindRound {
  const leftSet = openItem(blind, item);
  const blank = reason.trim() === "";
  if (blank && picked !== "tie") {
    throw new ChoiceRefused("Write a reason for the pick.");
  }
  const winner = picked === "tie" ? "tie" : setOn(picked, leftSet);
  return withVerdict(blind, item, { winner, reason: blank ? null : reason });
}

/**
 * The round with one more item decided by a 'speaker' round's marks. Every
 * speaker gets a verdict, in the item's order: a marked one the set on the
 * side marked and its reason, any other a tie without one. Throws
 * ChoiceRefused when the item cannot take a choice, or a mark names an
 * unknown speaker, repeats one, or has no reason.
 */
export function addSpeakerChoice(
  blind: BlindRound,
  { item, marks }: SpeakerChoice,
): BlindRound {
  const leftSet = openItem(blind, item);
  const { speakers } = itemAt(blind.round.items, item - 1);
  for (const [index, mark] of marks.entries()) {
    if (!speakers.some(({ speaker }) => speaker === mark.speaker)) {
      throw new ChoiceRefused(`There is no speaker ${mark.speaker}.`);
    }
    if (marks.findIndex(({ speaker }) => speaker === mark.speaker) < index) {
      throw new ChoiceRefused(`${mark.speaker} is marked twice.`);
    }
    if (mark.reason.trim() === "") {
      throw new ChoiceRefused(`Write a reason for ${mark.speaker}.`);
    }
  }
  const verdicts = speakers.map(({ speaker }): SpeakerVerdict => {
    const mark = marks.find((one) => one.speaker === speaker);
    return mark === undefined
      ? { speaker, winner: "tie", reason: null }
      : { speaker, winner: setOn(mark.picked, leftSet), reason: mark.reason };
  });
  return withVerdict(blind, item, verdicts);
}

/** Every item's verdict in item order, or null while one is undecided. */
export function finalVerdicts({
  round,
  verdicts,
}: BlindRound): Verdict[] | null {
  if (verdicts.size < round.items.length) return null;
  return round.items.map((_, index) => {
    const verdict = verdicts.get(index + 1);
    if (verdict === undefined) throw new Error(`Item ${index + 1} is open.`);
    return verdict;
  });
}

// The set on the left of an item that can still take a choice.
function openItem(blind: BlindRound, item: number): OutputSet {
  const count = blind.round.items.length;
  if (item > count) {
    throw new ChoiceRefused(
      `There is no item ${item}; the round has ${count}.`,
    );
  }
  if (blind.verdicts.has(item)) {
    throw new ChoiceRefused(`Item ${item} already has a choice.`);
  }
  return itemAt(blind.leftSets, item - 1);
}

function setOn(side: "left" | "right", leftSet: OutputSet): Winner {
  if (side === "left") return leftSet;
  return leftSet === "a" ? "b" : "a";
}

function withVerdict(
  blind: BlindRound,
  item: number,
  verdict: Verdict,
): BlindRound {
  return { ...blind, verdicts: new Map([...blind.verdicts, [item, verdict]]) };
}

function itemAt<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`No item at index ${index}.`);
  return item;
}
