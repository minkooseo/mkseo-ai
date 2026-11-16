// The generate command: make an output set by running every case with
// every voice, then save it.
import { mkdir } from "node:fs/promises";
import { ConcurrencyGate } from "../../generation/concurrency-gate.ts";
import { assertNewFolder } from "../file-io.ts";
import type {
  HumanEvalCase,
  HumanEvalProject,
  Output,
  Split,
} from "../project.ts";
import { writeOutputs } from "./output.ts";
import { planOutputs, type OutputTask } from "./plan.ts";

export interface GenerateOptions {
  /** Folder for the output set; e.g. '/work/run-1'. */
  readonly out: string;
  /** Cases to run; e.g. 'tuning'. */
  readonly split: Split;
  /** Outputs per case and voice; e.g. 2. */
  readonly samples: number;
}

/** Most model calls running at once. */
const concurrency = 4;

/**
 * The `generate` command: run every case of the split with every voice,
 * then save the outputs in `out` and print how many it wrote. If a model
 * call fails, it throws naming the case and voice and writes nothing, so
 * the same command can simply run again.
 */
export async function runGenerate<C extends HumanEvalCase>(
  project: HumanEvalProject<C>,
  { out, split, samples }: GenerateOptions,
): Promise<void> {
  await assertNewFolder(out);
  const tasks = planOutputs({ project, split, samples });
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
  const { testCase, voice, sample, labels } = task;
  let text: string;
  try {
    text = await project.generate({ case: testCase, voice });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `The model call for case ${testCase.id}, voice ${voice.name}, ` +
        `sample ${sample} failed: ${reason}`,
      { cause: error },
    );
  }
  return {
    caseId: testCase.id,
    voice: voice.name,
    sample,
    context: testCase.context,
    text,
    labels,
  };
}
