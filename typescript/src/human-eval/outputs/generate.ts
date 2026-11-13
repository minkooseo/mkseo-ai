// The generate command: make an output set by running every case with
// every voice, then save it with its checks and overlap.
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { ConcurrencyGate } from "../../generation/concurrency-gate.ts";
import { assertNewFolder, writeJson } from "../file-io.ts";
import type {
  HumanEvalCase,
  HumanEvalProject,
  Output,
  Split,
} from "../project.ts";
import { runChecks } from "./checks.ts";
import { writeOutputs } from "./output.ts";
import { measureOverlap } from "./overlap.ts";
import { planOutputs, type OutputTask } from "./plan.ts";
import { formatGenerateSummary } from "./summary.ts";

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
 * then save the outputs, check results, and voice overlap in `out`. If a
 * model call fails, it throws naming the case and voice and writes
 * nothing, so the same command can simply run again.
 */
export async function runGenerate<C extends HumanEvalCase>(
  project: HumanEvalProject<C>,
  { out, split, samples }: GenerateOptions,
): Promise<void> {
  await assertNewFolder(out);
  const tasks = planOutputs({ project, split, samples });
  const outputs = await generateAll(project, tasks);
  const checks = runChecks({ checks: project.checks, outputs });
  const overlap = measureOverlap({ outputs, groupLabel: project.groupLabel });
  await mkdir(out, { recursive: true });
  await writeJson(join(out, "checks.json"), checks);
  await writeJson(join(out, "overlap.json"), overlap);
  await writeOutputs(out, outputs);
  console.log(formatGenerateSummary({ out, outputs, checks, overlap }));
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
