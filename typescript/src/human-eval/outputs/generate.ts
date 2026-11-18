// The generate command: make an output set by running every case with
// every speaker, then save it.
import { mkdir } from "node:fs/promises";
import { ConcurrencyGate } from "../../generation/concurrency-gate.ts";
import { assertNewFolder } from "../file-io.ts";
import type { HumanEvalCase, HumanEvalProject, Output } from "../project.ts";
import { writeOutputs } from "./output.ts";
import { planOutputs, type OutputTask } from "./plan.ts";

export interface GenerateOptions {
  /** Folder for the output set; e.g. '/work/run-1'. */
  readonly out: string;
  /** Outputs per case and speaker; e.g. 2. */
  readonly samples: number;
}

/** Most model calls running at once. */
const concurrency = 4;

/**
 * The `generate` command: run every case with every speaker
 * and save the outputs in `out`. A failed model call throws naming the case
 * and speaker, and nothing is written.
 */
export async function runGenerate<C extends HumanEvalCase>(
  project: HumanEvalProject<C>,
  { out, samples }: GenerateOptions,
): Promise<void> {
  await assertNewFolder(out);
  const tasks = planOutputs({ project, samples });
  const outputs = await generateAll(project, tasks);
  await mkdir(out, { recursive: true });
  await writeOutputs(out, outputs);
  console.log(`Wrote ${outputs.length} outputs to ${out}.`);
}

async function generateAll<C extends HumanEvalCase>(
  project: HumanEvalProject<C>,
  tasks: readonly OutputTask<C>[],
): Promise<Output[]> {
  const gate = new ConcurrencyGate(concurrency);
  // Aborting on the first failure keeps queued calls from starting. Calls
  // already running may finish, but their results are dropped.
  const stop = new AbortController();
  return Promise.all(
    tasks.map((task) =>
      gate.run(stop.signal, async () => {
        try {
          return await generateOne(project, task);
        } catch (error) {
          stop.abort(error);
          throw error;
        }
      }),
    ),
  );
}

async function generateOne<C extends HumanEvalCase>(
  project: HumanEvalProject<C>,
  task: OutputTask<C>,
): Promise<Output> {
  const { testCase, speaker, sample, labels } = task;
  let text: string;
  try {
    text = await project.generate({ case: testCase, speaker });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `The model call for case ${testCase.id}, speaker ${speaker.name}, ` +
        `sample ${sample} failed: ${reason}`,
      { cause: error },
    );
  }
  return {
    caseId: testCase.id,
    speaker: speaker.name,
    sample,
    context: testCase.context,
    text,
    labels,
    speakerDescription:
      project.describeSpeaker === null
        ? null
        : project.describeSpeaker({ case: testCase, speaker }),
  };
}
