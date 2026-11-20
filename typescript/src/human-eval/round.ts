// The data a caller passes to the grading page and gets back. A round is
// one grading session: a question and a list of items. An item shows some
// speakers' outputs from two output sets, A and B. A verdict is what the
// person decided: one per item, or one per speaker of each item.

/** A blind round: the question asked on every item, and the items. */
export interface Round {
  /** What the grader answers on every item; e.g. 'Which reply is kinder?'. */
  readonly question: string;
  /**
   * What the grader decides on each item: 'item' picks one side for the
   * whole item, or a tie; 'speaker' marks, for any speaker, the side whose
   * output is better, leaving the others as ties.
   */
  readonly ask: "item" | "speaker";
  /** The items in the order shown, item 1 first; at least one. */
  readonly items: readonly RoundItem[];
}

/**
 * One thing to decide: some speakers' outputs from output set A and from
 * output set B. The page shows the two sets as Left and Right, on sides
 * drawn at random, and never says which set is which.
 */
export interface RoundItem {
  /**
   * What the grader reads to grasp the case: one message or a whole
   * conversation; e.g. 'My train was 40 minutes late.'.
   *
   * The page reads each line by its start: "### " makes a heading, "- " a
   * list item (lines in a row form one list), and "> " a highlighted quote
   * (lines in a row form one quote, line breaks kept). Any other line is a
   * plain paragraph. Blank lines are skipped. There is no inline markup
   * such as **bold**.
   */
  readonly context: string;
  /** Each speaker's output in both sets, in the order shown. */
  readonly speakers: readonly SpeakerOutputs[];
}

/** One speaker's output on an item, in set A and in set B. */
export interface SpeakerOutputs {
  /** Who wrote it, unique within the item; e.g. 'formal'. */
  readonly speaker: string;
  /**
   * The speaker's gender, which colours its name so the grader tells
   * speakers apart at a glance: pink for a woman, blue for a man; e.g.
   * 'woman'.
   */
  readonly gender: "woman" | "man";
  /** What the speaker is meant to sound like, shown on hovering its name. */
  readonly description: Description;
  /** Set A's output; e.g. 'That is unfortunate.'. */
  readonly a: string;
  /** Set B's output; e.g. 'I am sorry to hear it.'. */
  readonly b: string;
}

/**
 * What a speaker is meant to sound like, as the page shows it: a title,
 * then sections of named fields.
 */
export interface Description {
  /** The top line; e.g. 'Chaehee · 22, woman · over-the-top praise group'. */
  readonly title: string;
  /** The sections in the order shown. */
  readonly sections: readonly DescriptionSection[];
}

/** One titled group of fields in a description. */
export interface DescriptionSection {
  /** The section's heading; e.g. 'Speech style'. */
  readonly title: string;
  /** The fields in the order shown. */
  readonly fields: readonly DescriptionField[];
}

/** One named value in a description section. */
export interface DescriptionField {
  /** What the value is about; e.g. 'Tone'. */
  readonly name: string;
  /**
   * One text, shown with its line breaks, or several shown as a list;
   * e.g. 'Warm, short sentences.' or ['No slang.', 'No emoji.'].
   */
  readonly value: string | readonly string[];
}

/** An output set picked, or a tie; e.g. 'b'. */
export type Winner = "a" | "b" | "tie";

/** What the grader decided on one item of an 'item' round. */
export interface ItemVerdict {
  readonly winner: Winner;
  /**
   * The grader's reason as written, or null for a tie left without one;
   * e.g. 'Warmer and shorter.'.
   */
  readonly reason: string | null;
}

/** What the grader decided on one speaker of an item in a 'speaker' round. */
export interface SpeakerVerdict {
  /** The speaker; e.g. 'formal'. */
  readonly speaker: string;
  /** The set marked better, or a tie when the speaker was left unmarked. */
  readonly winner: Winner;
  /** The reason written with the mark, or null when unmarked. */
  readonly reason: string | null;
}
