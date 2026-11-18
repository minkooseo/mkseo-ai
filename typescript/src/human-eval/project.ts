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
   * null without descriptions; e.g. 'Formal. Short sentences, no slang.'.
   */
  readonly speakerDescription: string | null;
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
   * is made, so it matches the files that made it. E.g. 'Formal. Short
   * sentences, no slang.'. Null when the project has no descriptions.
   */
  readonly describeSpeaker:
    ((input: { readonly case: C; readonly speaker: Speaker }) => string) | null;
}
