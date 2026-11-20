// The commands that act on a round: judge starts one and show reopens it.
import { relative } from "node:path";
import { formatResult } from "../choices/format-result.ts";
import { assertNewFolder } from "../file-io.ts";
import { readOutputs } from "../outputs/output.ts";
import type { HumanEvalCase, HumanEvalProject } from "../project.ts";
import { lineupItems, pairItems } from "../round/items.ts";
import type { Round } from "../round/round.ts";
import { UsageError } from "../usage-error.ts";
import { readSession, saveFinished, startSession } from "./files.ts";
import { gradeRound } from "./grading.ts";
import { isFinished } from "./session.ts";

/** What `judge` should put on a new round. */
export interface RoundRequest {
  readonly kind: Round["kind"];
  /** Folder of output set A; e.g. '/work/run-1'. */
  readonly a: string;
  /** Folder of output set B; e.g. '/work/run-2'. */
  readonly b: string;
  /** Most items to show; e.g. 5. */
  readonly itemLimit: number;
  /** Folder for the round files; e.g. '/work/round-1'. */
  readonly out: string;
}

/**
 * The `judge` command: draw a blind round, save it in the request's `out`
 * folder, and grade it on the page. Prints the result when every item has
 * a choice.
 */
export async function runNewRound<C extends HumanEvalCase>(
  request: RoundRequest,
  project: HumanEvalProject<C>,
): Promise<void> {
  await assertNewFolder(request.out);
  const round = await drawRound(request, project);
  await startSession(request.out, round);
  console.log(formatResult(await gradeRound(request.out)));
}

/**
 * The `show` command: open the grading page again for an unfinished round
 * and print the result when it is done. For a finished round, save the
 * result and decisions and say where the result is.
 */
export async function runShow(out: string): Promise<void> {
  const session = await readSession(out);
  if (isFinished(session)) {
    const { path } = await saveFinished(out, session);
    console.log(`This round is finished. The result is in ${path}.`);
    return;
  }
  console.log(formatResult(await gradeRound(out)));
}

async function drawRound<C extends HumanEvalCase>(
  request: RoundRequest,
  project: HumanEvalProject<C>,
): Promise<Round> {
  const { itemLimit, out } = request;
  const a = await readOutputs(request.a);
  const b = await readOutputs(request.b);
  const items =
    request.kind === "pair"
      ? pairItems({ a, b, itemLimit })
      : lineupItems({ a, b, itemLimit });
  // Only lineup can draw no items: both sets hold outputs and itemLimit is
  // at least 1, so pair always draws one.
  if (items.length === 0) {
    throw new UsageError(
      "Nothing to compare: lineup needs two or more speakers responding " +
        "to the same case; generate both sets with --num-samples 2 or more.",
    );
  }
  // Folders are saved relative to the round, so a saved round reads the
  // same from any checkout.
  return {
    kind: request.kind,
    question: project.questions[request.kind],
    a: relative(out, request.a),
    b: relative(out, request.b),
    items,
  };
}
