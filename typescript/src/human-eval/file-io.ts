// File helpers: read and check JSON, write files whole, and check that an
// --out folder is new.
import { access, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { z } from "zod";
import { UsageError } from "./usage-error.ts";

/** Read a JSON file and check it against `schema`. Throws when invalid. */
export async function readJson<S extends z.ZodType>(
  path: string,
  schema: S,
): Promise<z.output<S>> {
  return parseJson({
    text: await readFile(path, "utf8"),
    schema,
    where: path,
  });
}

/**
 * Parse JSON text and check it against `schema`. `where` names the text in
 * the error; e.g. '/work/run-1/outputs.jsonl line 3'.
 */
export function parseJson<S extends z.ZodType>({
  text,
  schema,
  where,
}: {
  readonly text: string;
  readonly schema: S;
  readonly where: string;
}): z.output<S> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    // Broken JSON is a damaged file the person can fix, not a bug.
    if (!(error instanceof SyntaxError)) throw error;
    throw new UsageError(`${where} is not valid JSON: ${error.message}`);
  }
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new UsageError(
      `${where} is not valid: ${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}

/** Write `value` as indented JSON. A crash never leaves half a file. */
export async function writeJson(path: string, value: unknown): Promise<void> {
  await writeText(path, JSON.stringify(value, null, 2) + "\n");
}

/** Write `text` to `path`. A crash never leaves half a file. */
export async function writeText(path: string, text: string): Promise<void> {
  // Renaming a finished temporary file replaces the old file in one step.
  const temporary = `${path}.tmp`;
  await writeFile(temporary, text);
  await rename(temporary, path);
}

/** True when a file or folder exists at `path`. */
export async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    // A missing path is the expected "no"; any other error is real.
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

/** Throw unless `dir` is missing or empty, so no earlier result is mixed in. */
export async function assertNewFolder(dir: string): Promise<void> {
  if ((await exists(dir)) && (await readdir(dir)).length > 0) {
    throw new UsageError(`${dir} is not empty. Use a new --out folder.`);
  }
}
