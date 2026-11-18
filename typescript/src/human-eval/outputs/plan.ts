// List the model calls generate makes, after checking the project.
import type {
  HumanEvalCase,
  HumanEvalProject,
  Labels,
  Speaker,
} from "../project.ts";
import { UsageError } from "../usage-error.ts";

/** One model call to make. */
export interface OutputTask<C extends HumanEvalCase> {
  readonly testCase: C;
  readonly speaker: Speaker;
  /** Which try for this case and speaker, counted from 1; e.g. 2. */
  readonly sample: number;
  /** Case and speaker labels together; e.g. { tone: 'calm', task: 'reply' }. */
  readonly labels: Labels;
}

/**
 * List the model calls to make, in case, speaker, then sample order. It
 * first checks the project and throws on blank or repeated case ids or
 * speaker names, a label the case and speaker set differently, or nothing
 * to run.
 */
export function planOutputs<C extends HumanEvalCase>({
  project,
  samples,
}: {
  readonly project: HumanEvalProject<C>;
  readonly samples: number;
}): OutputTask<C>[] {
  assertUniqueNames(
    project.cases.map((testCase) => testCase.id),
    "Case ids",
  );
  if (project.cases.length === 0)
    throw new UsageError("The project has no cases.");
  const tasks: OutputTask<C>[] = [];
  for (const testCase of project.cases) {
    const speakers = project.speakers(testCase);
    assertUniqueNames(
      speakers.map((speaker) => speaker.name),
      `Speaker names for case ${testCase.id}`,
    );
    for (const speaker of speakers) {
      const labels = mergeLabels(testCase, speaker);
      for (let sample = 1; sample <= samples; sample += 1) {
        tasks.push({ testCase, speaker, sample, labels });
      }
    }
  }
  if (tasks.length === 0) {
    throw new UsageError("No speaker responds to any case.");
  }
  return tasks;
}

function mergeLabels(testCase: HumanEvalCase, speaker: Speaker): Labels {
  for (const [name, value] of Object.entries(speaker.labels)) {
    const caseValue = testCase.labels[name];
    if (Object.hasOwn(testCase.labels, name) && caseValue !== value) {
      throw new UsageError(
        `Case ${testCase.id} sets label ${name} to ${caseValue}, but speaker ` +
          `${speaker.name} sets it to ${value}.`,
      );
    }
  }
  return { ...testCase.labels, ...speaker.labels };
}

function assertUniqueNames(names: readonly string[], what: string) {
  if (names.some((name) => name.trim() === "")) {
    throw new UsageError(`${what} must not be blank.`);
  }
  const repeated = names.filter((name, index) => names.indexOf(name) !== index);
  if (repeated.length > 0) {
    throw new UsageError(
      `${what} must be unique; repeated: ${repeated.join(", ")}.`,
    );
  }
}
