// List the model calls generate makes, after checking the project.
import type {
  HumanEvalCase,
  HumanEvalProject,
  Labels,
  Split,
  Voice,
} from "../project.ts";
import { UsageError } from "../usage-error.ts";

/** One model call to make. */
export interface OutputTask<C extends HumanEvalCase> {
  readonly testCase: C;
  readonly voice: Voice;
  /** Which try for this case and voice, counted from 1; e.g. 2. */
  readonly sample: number;
  /** Case and voice labels together; e.g. { group: 'calm', task: 'reply' }. */
  readonly labels: Labels;
}

/**
 * List the model calls to make, in case order, then voice order, then
 * sample order. It checks the project before any model call: case ids,
 * voice names, and check ids must be nonblank and unique, a case and voice
 * must not set one label to different values, every voice must have the
 * group label when there is one, and there must be something to run.
 */
export function planOutputs<C extends HumanEvalCase>({
  project,
  split,
  samples,
}: {
  readonly project: HumanEvalProject<C>;
  readonly split: Split;
  readonly samples: number;
}): OutputTask<C>[] {
  assertNamed(
    project.cases.map((testCase) => testCase.id),
    "Case ids",
  );
  assertNamed(
    project.checks.map((check) => check.id),
    "Check ids",
  );
  const cases = project.cases.filter((testCase) => testCase.split === split);
  if (cases.length === 0) {
    throw new UsageError(`No case is in the ${split} split.`);
  }
  const tasks: OutputTask<C>[] = [];
  for (const testCase of cases) {
    const voices = project.voices(testCase);
    assertNamed(
      voices.map((voice) => voice.name),
      `Voice names for case ${testCase.id}`,
    );
    for (const voice of voices) {
      const labels = mergeLabels(testCase, voice);
      if (
        project.groupLabel !== null &&
        !Object.hasOwn(labels, project.groupLabel)
      ) {
        throw new UsageError(
          `Voice ${voice.name} on case ${testCase.id} has no ` +
            `"${project.groupLabel}" label.`,
        );
      }
      for (let sample = 1; sample <= samples; sample += 1) {
        tasks.push({ testCase, voice, sample, labels });
      }
    }
  }
  if (tasks.length === 0) {
    throw new UsageError(`No voice responds to any ${split} case.`);
  }
  return tasks;
}

function mergeLabels(testCase: HumanEvalCase, voice: Voice): Labels {
  for (const [name, value] of Object.entries(voice.labels)) {
    const caseValue = testCase.labels[name];
    if (Object.hasOwn(testCase.labels, name) && caseValue !== value) {
      throw new UsageError(
        `Case ${testCase.id} sets label ${name} to ${caseValue}, but voice ` +
          `${voice.name} sets it to ${value}.`,
      );
    }
  }
  return { ...testCase.labels, ...voice.labels };
}

function assertNamed(names: readonly string[], what: string) {
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
