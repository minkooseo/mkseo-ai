// The files of a round folder: round.json, choices.json, and result.json.
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { choiceSchema, type Choice } from "../choices/choices.ts";
import type { HumanEvalResult } from "../choices/result.ts";
import { exists, readJson, writeJson } from "../file-io.ts";
import { roundSchema, type Round } from "../round/round.ts";
import { UsageError } from "../usage-error.ts";
import { assertValidSession, type Session } from "./session.ts";

const roundFile = "round.json";
const choicesFile = "choices.json";
const resultFile = "result.json";

/** Read the session saved in `dir`. Throws when it holds no round. */
export async function readSession(dir: string): Promise<Session> {
  if (!(await exists(join(dir, roundFile)))) {
    throw new UsageError(`${dir} holds no round. Run judge or guess first.`);
  }
  const session = {
    round: await readJson(join(dir, roundFile), roundSchema),
    choices: await readJson(join(dir, choicesFile), z.array(choiceSchema)),
  };
  assertValidSession(session);
  return session;
}

/**
 * Save a new round with no choices in `dir`, which the caller has checked
 * is new.
 */
export async function startSession(dir: string, round: Round): Promise<void> {
  await mkdir(dir, { recursive: true });
  // The round file goes last: a folder with a round always has choices.
  await writeJson(join(dir, choicesFile), []);
  await writeJson(join(dir, roundFile), round);
}

/** Save a session's choices, replacing the saved ones. */
export async function saveChoices(
  dir: string,
  choices: readonly Choice[],
): Promise<void> {
  await writeJson(join(dir, choicesFile), choices);
}

/** Save the result of a finished round and return the file's path. */
export async function saveResult(
  dir: string,
  result: HumanEvalResult,
): Promise<string> {
  const path = join(dir, resultFile);
  await writeJson(path, result);
  return path;
}
