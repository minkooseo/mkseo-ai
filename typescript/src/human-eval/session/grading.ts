// The grading page: a local web page where the person decides a round's
// items one at a time, each choice saved as it arrives.
import { readFile } from "node:fs/promises";
import {
  startLocalServer,
  type Reply,
} from "../../local-server/local-server.ts";
import { openBrowser } from "../../local-server/open-browser.ts";
import { choiceRequestSchema } from "../choices/choices.ts";
import type { HumanEvalResult } from "../choices/result.ts";
import { roundView } from "../round/round-view.ts";
import { UsageError } from "../usage-error.ts";
import { readSession, saveChoices, saveFinished } from "./files.ts";
import { claimServing, releaseServing } from "./serving.ts";
import { addChoice, isFinished, type Session } from "./session.ts";

/**
 * Serve the grading page for the unfinished round in `dir`, open it, and
 * resolve with the result once every item has a choice. Throws when
 * another live process already serves the round.
 */
export async function gradeRound(dir: string): Promise<HumanEvalResult> {
  const page = await readFile(
    new URL("./grading-page.html", import.meta.url),
    "utf8",
  );
  const outcome = promiseWithSettlers<HumanEvalResult>();
  const enqueue = taskQueue();
  const server = await startLocalServer({
    routes: [
      {
        method: "GET",
        path: "/",
        handle: () => Promise.resolve({ kind: "html", html: page }),
      },
      {
        method: "GET",
        path: "/round",
        handle: () =>
          enqueue(async () => {
            const session = await readSession(dir);
            return jsonReply(200, {
              view: roundView(session.round),
              chosen: session.choices.map((choice) => choice.item),
            });
          }),
      },
      {
        method: "POST",
        path: "/choices",
        handle: (body) =>
          enqueue(async () => {
            const parsed = choiceRequestSchema.safeParse(body);
            if (!parsed.success) {
              return jsonReply(400, { error: "The choice is not valid." });
            }
            const saved = await readSession(dir);
            if (isFinished(saved)) {
              return jsonReply(409, { error: "The round is finished." });
            }
            let session: Session;
            try {
              session = addChoice(saved, parsed.data);
            } catch (error) {
              if (!(error instanceof UsageError)) throw error;
              return jsonReply(400, { error: error.message });
            }
            await saveChoices(dir, session.choices);
            if (!isFinished(session)) {
              return jsonReply(200, { finished: false });
            }
            outcome.resolve((await saveFinished(dir, session)).result);
            return jsonReply(200, { finished: true });
          }),
      },
    ],
    onError: outcome.reject,
  });
  try {
    await claimServing(dir, server.url);
  } catch (error) {
    await server.close();
    throw error;
  }
  try {
    console.log(`Grade the round at ${server.url}`);
    console.log("This command ends when every item has a choice.");
    openBrowser(server.url);
    return await outcome.promise;
  } finally {
    await server.close();
    await releaseServing(dir);
  }
}

function jsonReply(status: number, body: unknown): Reply {
  return { kind: "json", status, body };
}

// Runs tasks one after another, so two requests never interleave their
// reads and writes of the round folder.
function taskQueue() {
  let last: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = last.then(task);
    last = run.catch(() => undefined);
    return run;
  };
}

// A promise with its resolve and reject at hand; only the first call
// counts.
function promiseWithSettlers<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}
