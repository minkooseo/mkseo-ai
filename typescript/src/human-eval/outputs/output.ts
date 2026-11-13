// An output set on disk: reading and writing outputs.jsonl, matching two
// sets for a comparison, and finding an output's group.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { exists, parseJson, writeText } from "../file-io.ts";
import type { Output, Labels } from "../project.ts";
import { UsageError } from "../usage-error.ts";

export const labelsSchema = z.record(z.string(), z.string());

// The fields are described on the Output type.
const outputSchema: z.ZodType<Output> = z.strictObject({
  caseId: z.string().min(1),
  voice: z.string().min(1),
  sample: z.int().positive(),
  context: z.string(),
  text: z.string(),
  labels: labelsSchema,
});

const outputsFile = "outputs.jsonl";

/** Save an output set as `outputs.jsonl` in `dir`, one output per line. */
export async function writeOutputs(
  dir: string,
  outputs: readonly Output[],
): Promise<void> {
  const lines = outputs.map((output) => JSON.stringify(output) + "\n");
  await writeText(join(dir, outputsFile), lines.join(""));
}

/**
 * Read the output set saved in `dir`. Throws when a line is not a valid
 * output or when two outputs share a case, voice, and sample.
 */
export async function readOutputs(dir: string): Promise<Output[]> {
  const path = join(dir, outputsFile);
  if (!(await exists(path))) {
    throw new UsageError(`${dir} holds no output set.`);
  }
  const lines = (await readFile(path, "utf8")).split("\n");
  // Every output line ends with a newline, so the text after the last one
  // must be empty; anything else means the file was cut short.
  if (lines.pop() !== "") {
    throw new UsageError(`${path} does not end with a newline.`);
  }
  const outputs = lines.map((line, index) =>
    parseJson({
      text: line,
      schema: outputSchema,
      where: `${path} line ${index + 1}`,
    }),
  );
  indexOutputs(outputs);
  return outputs;
}

/**
 * Check that output sets A and B hold the same cases, voices, and samples,
 * with the same case text and labels, and throw a list of the differences
 * otherwise. A comparison only means something when both sets cover the
 * same cases, voices, and samples. Returns a function that gives the B
 * output matching an A output.
 */
export function matchSets(
  a: readonly Output[],
  b: readonly Output[],
): (output: Output) => Output {
  const aByKey = indexOutputs(a);
  const bByKey = indexOutputs(b);
  const problems: string[] = [];
  for (const [key, output] of aByKey) {
    const other = bByKey.get(key);
    if (other === undefined) {
      problems.push(`only in A: ${describeOutput(output)}`);
    } else if (
      other.context !== output.context ||
      !sameLabels(other.labels, output.labels)
    ) {
      problems.push(`different case text or labels: ${describeOutput(output)}`);
    }
  }
  for (const [key, output] of bByKey) {
    if (!aByKey.has(key)) problems.push(`only in B: ${describeOutput(output)}`);
  }
  if (problems.length > 0) {
    throw new UsageError(
      "Output sets A and B must hold the same cases, voices, and samples:\n" +
        problems.map((problem) => `  ${problem}`).join("\n"),
    );
  }
  return (output) => {
    const partner = bByKey.get(outputKey(output));
    if (partner === undefined) {
      throw new Error(
        `Output ${describeOutput(output)} is missing from set B.`,
      );
    }
    return partner;
  };
}

/**
 * The value of `groupLabel` on an output, or "" when voices are not grouped
 * (`groupLabel` is null). Throws when the output lacks the label.
 */
export function groupOf(output: Output, groupLabel: string | null): string {
  if (groupLabel === null) return "";
  // Own labels only, so a name such as "constructor" is not found.
  const value = Object.hasOwn(output.labels, groupLabel)
    ? output.labels[groupLabel]
    : undefined;
  if (value === undefined) {
    throw new UsageError(
      `Output ${describeOutput(output)} has no "${groupLabel}" label.`,
    );
  }
  return value;
}

/** A short name for an output in messages; e.g. 'late-train / formal / 1'. */
function describeOutput(output: Output): string {
  return `${output.caseId} / ${output.voice} / ${output.sample}`;
}

function sameLabels(first: Labels, second: Labels): boolean {
  const sorted = (labels: Labels) =>
    JSON.stringify(Object.entries(labels).sort(([a], [b]) => (a < b ? -1 : 1)));
  return sorted(first) === sorted(second);
}

/** A text key that is the same for outputs with equal case, voice, sample. */
function outputKey(output: Output): string {
  return JSON.stringify([output.caseId, output.voice, output.sample]);
}

/** Map each output's key to the output. Throws on a repeated key. */
function indexOutputs(outputs: readonly Output[]): Map<string, Output> {
  const byKey = new Map<string, Output>();
  for (const output of outputs) {
    const key = outputKey(output);
    if (byKey.has(key)) {
      throw new UsageError(`Output ${describeOutput(output)} appears twice.`);
    }
    byKey.set(key, output);
  }
  return byKey;
}
