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
  /** Case and speaker labels together; e.g. { tone: 'calm', task: 'reply' }. */
  readonly labels: Labels;
}

/**
 * List the model calls to make: for each case, in case order, its `addressed`
 * speakers and then speakers drawn from its `others` until the case has
 * `numSamples` responses. The draw is random but the same every time for a
 * case, so two output sets made with the same `numSamples` hold the same
 * speakers. It first checks the project and throws on blank or repeated
 * case ids or speaker names, a label the case and speaker set differently,
 * or a case that cannot get exactly `numSamples` responses.
 */
export function planOutputs<C extends HumanEvalCase>({
  project,
  numSamples,
}: {
  readonly project: HumanEvalProject<C>;
  readonly numSamples: number;
}): OutputTask<C>[] {
  assertUniqueNames(
    project.cases.map((testCase) => testCase.id),
    "Case ids",
  );
  if (project.cases.length === 0)
    throw new UsageError("The project has no cases.");
  return project.cases.flatMap((testCase) =>
    responders(project, testCase, numSamples).map((speaker) => ({
      testCase,
      speaker,
      labels: mergeLabels(testCase, speaker),
    })),
  );
}

function responders<C extends HumanEvalCase>(
  project: HumanEvalProject<C>,
  testCase: C,
  numSamples: number,
): readonly Speaker[] {
  const { addressed, others } = project.speakers(testCase);
  assertUniqueNames(
    [...addressed, ...others].map((speaker) => speaker.name),
    `Speaker names for case ${testCase.id}`,
  );
  if (addressed.length > numSamples) {
    throw new UsageError(
      `Case ${testCase.id} has ${addressed.length} addressed speakers, more ` +
        `than --num-samples ${numSamples}.`,
    );
  }
  if (addressed.length + others.length < numSamples) {
    throw new UsageError(
      `Case ${testCase.id} has too few speakers for --num-samples ` +
        `${numSamples}: ${addressed.length + others.length}.`,
    );
  }
  return [
    ...addressed,
    ...drawOrder(testCase.id, others).slice(0, numSamples - addressed.length),
  ];
}

// Sorting by a hash of the case id and speaker name gives each case its own
// random-looking order that never changes between runs. A larger
// --num-samples keeps every speaker a smaller one drew.
function drawOrder(caseId: string, speakers: readonly Speaker[]): Speaker[] {
  const keyed = speakers.map((speaker) => ({
    speaker,
    key: fnv1a(`${caseId}\n${speaker.name}`),
  }));
  keyed.sort((x, y) => x.key - y.key);
  return keyed.map(({ speaker }) => speaker);
}

// 32-bit FNV-1a over UTF-16 code units.
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
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
