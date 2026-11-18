// serving.json marks a round folder whose grading page a process is
// serving, so a second judge or show cannot serve it at the same time.
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { parseJson } from "../file-io.ts";
import { UsageError } from "../usage-error.ts";

const servingFile = "serving.json";

const servingSchema = z.strictObject({
  /** The process serving the page; e.g. 4312. */
  pid: z.int().positive(),
  /** Where it serves the page; e.g. 'http://127.0.0.1:5173/'. */
  url: z.string(),
});

/**
 * Mark the round in `dir` as served by this process at `url`. Throws a
 * one-line message naming the page when a live process already serves it;
 * a mark left by a process that has ended is replaced.
 */
export async function claimServing(dir: string, url: string): Promise<void> {
  const path = join(dir, servingFile);
  const mark = JSON.stringify({ pid: process.pid, url }) + "\n";
  try {
    // The "wx" flag fails when the file exists, so two processes cannot
    // both claim the round.
    await writeFile(path, mark, { flag: "wx" });
    return;
  } catch (error) {
    if (!isCode(error, "EEXIST")) throw error;
  }
  const holder = parseJson({
    text: await readFile(path, "utf8"),
    schema: servingSchema,
    source: path,
  });
  if (isAlive(holder.pid)) {
    throw new UsageError(
      `This round is already open at ${holder.url} (process ${holder.pid}). ` +
        "Use that page. If it does not open, delete serving.json in the " +
        "round folder.",
    );
  }
  await rm(path);
  await writeFile(path, mark, { flag: "wx" });
}

/** Remove this process's mark from the round in `dir`. */
export async function releaseServing(dir: string): Promise<void> {
  await rm(join(dir, servingFile));
}

function isAlive(pid: number): boolean {
  try {
    // Signal 0 only checks that the process exists.
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means it exists but belongs to someone else.
    if (isCode(error, "EPERM")) return true;
    if (isCode(error, "ESRCH")) return false;
    throw error;
  }
}

function isCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}
