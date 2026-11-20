// Read each command's flags from the command line, with one-line errors.
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import type { GenerateOptions } from "../outputs/generate.ts";
import type { RoundRequest } from "../session/commands.ts";
import { UsageError } from "../usage-error.ts";

const defaultNumSamples = "1";
const defaultNumQuestions = "5";

export const usage = `Commands:
  generate --out <dir> [--num-samples <n, default ${defaultNumSamples}>]
  judge --kind pair|lineup --a <dir> --b <dir> --out <dir>
        [--num-questions <n, default ${defaultNumQuestions}>]
  show --out <dir>`;

/** Read the `generate` options. */
export function parseGenerate(args: readonly string[]): GenerateOptions {
  const { values } = parseArgs({
    args: [...args],
    options: {
      out: { type: "string" },
      "num-samples": { type: "string", default: defaultNumSamples },
    },
  });
  return {
    out: resolve(required(values.out, "--out")),
    numSamples: positiveInteger(values["num-samples"], "--num-samples"),
  };
}

/** Read the `judge` options. */
export function parseJudge(args: readonly string[]): RoundRequest {
  const { values } = parseArgs({
    args: [...args],
    options: {
      kind: { type: "string" },
      a: { type: "string" },
      b: { type: "string" },
      out: { type: "string" },
      "num-questions": { type: "string", default: defaultNumQuestions },
    },
  });
  const kind = required(values.kind, "--kind");
  if (kind !== "pair" && kind !== "lineup") {
    throw new UsageError(`--kind must be pair or lineup, not "${kind}".`);
  }
  return {
    kind,
    a: resolve(required(values.a, "--a")),
    b: resolve(required(values.b, "--b")),
    itemLimit: positiveInteger(values["num-questions"], "--num-questions"),
    out: resolve(required(values.out, "--out")),
  };
}

/** Read the `show` options: the round folder. */
export function parseShow(args: readonly string[]): string {
  const { values } = parseArgs({
    args: [...args],
    options: { out: { type: "string" } },
  });
  return resolve(required(values.out, "--out"));
}

function required(value: string | undefined, name: string): string {
  if (value === undefined) {
    throw new UsageError(`${name} is required.\n${usage}`);
  }
  return value;
}

function positiveInteger(text: string, name: string): number {
  if (!/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(Number(text))) {
    throw new UsageError(`${name} must be a whole number of 1 or more.`);
  }
  return Number(text);
}
