// Runs the grading page: starts a small web server on this machine, opens
// the page in the browser, takes each pick the page sends, and finishes
// when every item is decided. Picks are kept in memory only.
import { readFile } from "node:fs/promises";
import { startLocalServer, type Reply } from "../local-server/local-server.ts";
import { openBrowser } from "../local-server/open-browser.ts";
import {
  addItemChoice,
  addSpeakerChoice,
  type BlindRound,
  ChoiceRefused,
  finalVerdicts,
  itemChoiceSchema,
  pageView,
  speakerChoiceSchema,
  startBlindRound,
  type Verdict,
} from "./blind-round.ts";
import type { ItemVerdict, Round, SpeakerVerdict } from "./round.ts";

/**
 * Let a person decide a round on a page served from this machine. It opens
 * the page in the browser, prints its address, and resolves once every
 * item is decided, in item order: one verdict per item in an 'item' round,
 * or one verdict per speaker of each item in a 'speaker' round. Each item
 * puts set A on a random side, and the page never learns which. Choices
 * live in memory only: when the process stops, the round is lost. Throws
 * when the round has no items.
 */
export async function gradeRound(
  round: Round & { readonly ask: "item" },
): Promise<ItemVerdict[]>;
export async function gradeRound(
  round: Round & { readonly ask: "speaker" },
): Promise<(readonly SpeakerVerdict[])[]>;
export async function gradeRound(round: Round): Promise<Verdict[]> {
  let blind = startBlindRound(round);
  const page = await readFile(
    new URL("./grading-page.html", import.meta.url),
    "utf8",
  );
  const outcome = promiseWithSettlers<Verdict[]>();
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
        handle: () => Promise.resolve(jsonReply(200, pageView(blind))),
      },
      {
        method: "POST",
        path: "/choices",
        handle: (body) => {
          let next: BlindRound | null;
          try {
            next = addChoice(blind, body);
          } catch (error) {
            if (!(error instanceof ChoiceRefused)) throw error;
            return Promise.resolve(jsonReply(400, { error: error.message }));
          }
          if (next === null) {
            return Promise.resolve(
              jsonReply(400, { error: "The choice is not valid." }),
            );
          }
          blind = next;
          const verdicts = finalVerdicts(blind);
          if (verdicts !== null) outcome.resolve(verdicts);
          return Promise.resolve(
            jsonReply(200, { finished: verdicts !== null }),
          );
        },
      },
    ],
    onError: outcome.reject,
  });
  try {
    console.log(`Grade the round at ${server.url}`);
    console.log("The round ends when every item has a choice.");
    openBrowser(server.url);
    return await outcome.promise;
  } finally {
    await server.close();
  }
}

// The round with the page's choice added, or null when the body is not a
// choice of the round's kind.
function addChoice(blind: BlindRound, body: unknown): BlindRound | null {
  if (blind.round.ask === "item") {
    const parsed = itemChoiceSchema.safeParse(body);
    return parsed.success ? addItemChoice(blind, parsed.data) : null;
  }
  const parsed = speakerChoiceSchema.safeParse(body);
  return parsed.success ? addSpeakerChoice(blind, parsed.data) : null;
}

function jsonReply(status: number, body: unknown): Reply {
  return { kind: "json", status, body };
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
