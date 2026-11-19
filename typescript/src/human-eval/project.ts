// What a project gives the human evaluation tools, and the output type an
// output set holds.

/** Label names and values; e.g. { tone: 'calm', task: 'reply' }. */
export type Labels = Readonly<Record<string, string>>;

/** One fixed input the program responds to, such as one user message. */
export interface HumanEvalCase {
  /** Unique, stable name; e.g. 'late-train'. */
  readonly id: string;
  /**
   * What the person reads to grasp the case: one message or a whole
   * conversation; e.g. 'My train was 40 minutes late.'.
   *
   * The grading page reads each line by its start: "### " makes a heading,
   * "- " a list item (lines in a row form one list), and "> " a highlighted
   * quote (lines in a row form one quote, line breaks kept). Any other line
   * is a plain paragraph, so text without these starts shows as
   * paragraphs. Blank lines are skipped: they neither show nor split a list
   * or quote. There is no inline markup such as **bold**.
   */
  readonly context: string;
  /** Names and values for breakdowns; e.g. { task: 'reply' }. */
  readonly labels: Labels;
}

/** Who writes outputs for a case, such as one persona or one tone setting. */
export interface Speaker {
  /** Unique name among the speakers of a case; e.g. 'formal'. */
  readonly name: string;
  /** Names and values for result breakdowns; e.g. { tone: 'calm' }. */
  readonly labels: Labels;
}

/** One model output for one case, one speaker, and one sample number. */
export interface Output {
  /** The case this is for; e.g. 'late-train'. */
  readonly caseId: string;
  /** The speaker that wrote it; e.g. 'formal'. */
  readonly speaker: string;
  /** Which try for the same case and speaker, counted from 1; e.g. 2. */
  readonly sample: number;
  /** The case's context, copied; e.g. 'My train was 40 minutes late.'. */
  readonly context: string;
  /** The model's output; e.g. 'Sorry the train was late.'. */
  readonly text: string;
  /** Case and speaker labels together; e.g. { tone: 'calm', task: 'reply' }. */
  readonly labels: Labels;
  /**
   * What the speaker was meant to sound like when this output was made, or
   * null when the project has no descriptions.
   */
  readonly speakerDescription: SpeakerDescription | null;
}

/**
 * What a speaker is meant to sound like, as the grading page shows it: a
 * title, then sections of named fields.
 */
export interface SpeakerDescription {
  /** The top line; e.g. 'Chaehee · 22, woman · over-the-top praise group'. */
  readonly title: string;
  /** The sections in the order shown. */
  readonly sections: readonly DescriptionSection[];
}

/** One titled group of fields in a speaker description. */
export interface DescriptionSection {
  /** The section's heading; e.g. 'Speech style'. */
  readonly title: string;
  /**
   * 'open' always shows the fields; 'collapsed' hides them until the
   * grader opens the section, for long detail; e.g. 'collapsed'.
   */
  readonly display: "open" | "collapsed";
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

/**
 * What a project gives the human evaluation tools. `C` is the project's own
 * case type, so `generate` and `describeSpeaker` get back every field the
 * project put on its cases.
 */
export interface HumanEvalProject<C extends HumanEvalCase = HumanEvalCase> {
  /** Every case; e.g. 20 user messages to reply to. */
  readonly cases: readonly C[];
  /** The speakers that respond to a case; a one-speaker project returns one. */
  readonly speakers: (testCase: C) => readonly Speaker[];
  /** Make one model call and return its output text. */
  readonly generate: (input: {
    readonly case: C;
    readonly speaker: Speaker;
  }) => Promise<string>;
  /**
   * The question the grader answers on each kind of round. E.g. { pair:
   * 'Which reply is kinder?', lineup: 'Which side sounds more like
   * different people?' }.
   */
  readonly questions: {
    readonly pair: string;
    readonly lineup: string;
  };
  /**
   * What a speaker is meant to sound like, saved with each output when it
   * is made, so it matches the files that made it. E.g. { title: 'Formal',
   * sections: [{ title: 'Style', display: 'open', fields: [{ name:
   * 'Tone', value: 'Short sentences, no slang.' }] }] }. Null when the
   * project has no descriptions.
   */
  readonly describeSpeaker:
    | ((input: {
        readonly case: C;
        readonly speaker: Speaker;
      }) => SpeakerDescription)
    | null;
}
