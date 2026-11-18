// Read each command's flags from the command line, with one-line errors.
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import type { GenerateOptions } from "../outputs/generate.ts";
import type { RoundRequest } from "../session/commands.ts";
import { UsageError } from "../usage-error.ts";

const defaultSamples = "1";
const defaultItems = "40";

export const usage = `Commands:
  generate --out <dir> [--samples <n, default ${defaultSamples}>]
  judge --kind pair|lineup --a <dir> --b <dir> --out <dir>
        [--items <n, default ${defaultItems}>]
  show --out <dir>`;

/** Read the `generate` options. */
export function parseGenerate(args: readonly string[]): GenerateOptions {
  const { values } = parseArgs({
    args: [...args],
    options: {
      out: { type: "string" },
      samples: { type: "string", default: defaultSamples },
    },
  });
  return {
    out: resolve(required(values.out, "--out")),
    samples: positiveInteger(values.samples, "--samples"),
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
      items: { type: "string", default: defaultItems },
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
    itemLimit: positiveInteger(values.items, "--items"),
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
