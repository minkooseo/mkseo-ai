// The commands that act on a round: judge and guess start one, show prints
// the next page, and choose records the person's reply.
import { relative } from "node:path";
import { parseReply } from "../choices/choices.ts";
import { formatResult } from "../choices/format-result.ts";
import { resultOf } from "../choices/result.ts";
import { assertNewFolder } from "../file-io.ts";
import { readOutputs } from "../outputs/output.ts";
import { guessItems, lineupItems, pairItems } from "../round/items.ts";
import { formatPage } from "../round/page.ts";
import type { Round } from "../round/round.ts";
import { UsageError } from "../usage-error.ts";
import { readSession, saveChoices, saveResult, startSession } from "./files.ts";
import { currentPage, type Session } from "./session.ts";

/** What `judge` or `guess` should put on a new round. */
export type RoundRequest =
  | {
      readonly kind: "pair" | "lineup";
      /** Folder of output set A; e.g. '/work/run-1'. */
      readonly a: string;
      /** Folder of output set B; e.g. '/work/run-2'. */
      readonly b: string;
      /** Most items to show; e.g. 40. */
      readonly itemLimit: number;
      /** Folder for the round files; e.g. '/work/round-1'. */
      readonly out: string;
    }
  | {
      readonly kind: "guess";
      /** Folder of the output set; e.g. '/work/run-1'. */
      readonly outputs: string;
      /** Most items to show; e.g. 40. */
      readonly itemLimit: number;
      /** Folder for the round files; e.g. '/work/round-1'. */
      readonly out: string;
    };

/**
 * The `judge` and `guess` commands: build a blind round, save it in the
 * request's `out` folder, and print its first page.
 */
export async function runNewRound(
  request: RoundRequest,
  groupLabel: string | null,
): Promise<void> {
  await assertNewFolder(request.out);
  const round = await drawRound(request, groupLabel);
  await startSession(request.out, round);
  const page = currentPage({ round, choices: [] });
  console.log(formatPage({ round, page }));
}

/**
 * The `show` command: print the next page of items without a choice. On a
 * finished round, save the result and say where it is.
 */
export async function runShow(out: string): Promise<void> {
  const session = await readSession(out);
  const page = currentPage(session);
  if (page.length > 0) {
    console.log(formatPage({ round: session.round, page }));
    return;
  }
  console.log(finishedMessage(await saveResult(out, resultOf(session))));
}

/**
 * The `choose` command: record the person's reply to the current page. Then
 * print the next page, or, once every item has a choice, save and print the
 * result.
 */
export async function runChoose({
  out,
  reply,
}: {
  readonly out: string;
  /** The person's words, passed on unchanged; e.g. '1 l stiff, 2 r'. */
  readonly reply: string;
}): Promise<void> {
  const saved = await readSession(out);
  const page = currentPage(saved);
  if (page.length === 0) {
    const path = await saveResult(out, resultOf(saved));
    throw new UsageError(finishedMessage(path));
  }
  const choices = parseReply({ reply, round: saved.round, page });
  const session: Session = {
    ...saved,
    choices: [...saved.choices, ...choices],
  };
  const next = currentPage(session);
  if (next.length > 0) {
    await saveChoices(out, session.choices);
    console.log(formatPage({ round: session.round, page: next }));
    return;
  }
  // Count first, so a problem in the count saves nothing.
  const result = resultOf(session);
  await saveChoices(out, session.choices);
  await saveResult(out, result);
  console.log(formatResult(result));
}

function finishedMessage(resultPath: string): string {
  return `This round is finished. The result is in ${resultPath}.`;
}

async function drawRound(
  request: RoundRequest,
  groupLabel: string | null,
): Promise<Round> {
  const { itemLimit, out } = request;
  // The round file keeps the drawn items and sides, so plain Math.random
  // is enough.
  const random = Math.random;
  // Folders are saved relative to the round, so a saved round reads the
  // same from any checkout.
  if (request.kind === "guess") {
    const outputs = await readOutputs(request.outputs);
    const items = guessItems({ outputs, groupLabel, itemLimit, random });
    assertSomeItems(items.length);
    return { kind: "guess", outputs: relative(out, request.outputs), items };
  }
  const a = await readOutputs(request.a);
  const b = await readOutputs(request.b);
  const items =
    request.kind === "pair"
      ? pairItems({ a, b, itemLimit, random })
      : lineupItems({ a, b, groupLabel, itemLimit, random });
  assertSomeItems(items.length);
  return {
    kind: request.kind,
    a: relative(out, request.a),
    b: relative(out, request.b),
    items,
  };
}

function assertSomeItems(count: number) {
  if (count === 0) {
    throw new UsageError(
      "Nothing to compare: lineup and guess need two or more voices " +
        "responding to the same case in the same group.",
    );
  }
}
