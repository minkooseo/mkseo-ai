// What a project gives the human evaluation tools: its cases, voices,
// model call, and checks, plus the output type checks read.

/** Label names and values; e.g. { group: 'calm', task: 'reply' }. */
export type Labels = Readonly<Record<string, string>>;

/**
 * Which part of the case list a case is in. 'tuning' cases are used while
 * trying changes; 'heldout' cases are kept apart and only used to confirm a
 * win.
 */
export type Split = "tuning" | "heldout";

/** One fixed input the program responds to; e.g. one user message. */
export interface HumanEvalCase {
  /** Unique, stable name; e.g. 'late-train'. */
  readonly id: string;
  /** The part of the case list it is in; e.g. 'tuning'. */
  readonly split: Split;
  /**
   * What the person reads to grasp the case. Free text, so it can hold
   * a single message or a whole conversation; e.g. the user's message.
   */
  readonly context: string;
  /** Names and values for filters and breakdowns; e.g. { task: 'reply' }. */
  readonly labels: Labels;
}

/** A configured speaker that responds to cases; e.g. one tone setting. */
export interface Voice {
  /** Unique name among the voices of a case; e.g. 'formal'. */
  readonly name: string;
  /** Names and values for grouping and breakdowns; e.g. { group: 'calm' }. */
  readonly labels: Labels;
}

/** One model output for one case, one voice, and one sample number. */
export interface Output {
  /** The case this is for; e.g. 'late-train'. */
  readonly caseId: string;
  /** The voice that wrote it; e.g. 'formal'. */
  readonly voice: string;
  /** Which try for the same case and voice, counted from 1; e.g. 2. */
  readonly sample: number;
  /** The case's context, copied for the person; e.g. the user's message. */
  readonly context: string;
  /** The model's output; e.g. 'Sorry the train was late.'. */
  readonly text: string;
  /** Case and voice labels together; e.g. { group: 'calm', task: 'reply' }. */
  readonly labels: Labels;
}

/** A rule that plain code can test on one output. No model is involved. */
export interface Check {
  /** Short, unique, stable name; e.g. 'too-long'. */
  readonly id: string;
  /** The rule in plain words; e.g. 'More than three sentences.'. */
  readonly description: string;
  /** Returns true when the output breaks the rule. */
  readonly violates: (output: Output) => boolean;
}

/**
 * What a project gives the human evaluation tools. `C` is the project's own
 * case type, so `generate` gets back every field the project put on its
 * cases; a project with no extra case fields writes plain
 * `HumanEvalProject`.
 */
export interface HumanEvalProject<C extends HumanEvalCase = HumanEvalCase> {
  /** Every case, both splits. */
  readonly cases: readonly C[];
  /** The voices that respond to a case; a one-voice project returns one. */
  readonly voices: (testCase: C) => readonly Voice[];
  /** Make one model call and return its output text. */
  readonly generate: (input: {
    readonly case: C;
    readonly voice: Voice;
  }) => Promise<string>;
  /** Rules plain code checks on every output. */
  readonly checks: readonly Check[];
  /**
   * Label that puts voices into groups for lineup, guess, and overlap; e.g.
   * 'group'. Null when voices are not grouped, so all voices form one group.
   */
  readonly groupLabel: string | null;
}
