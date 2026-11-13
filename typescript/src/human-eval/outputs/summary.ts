// The short plain-text summary that generate prints.
import type { Output } from "../project.ts";
import type { CheckReport } from "./checks.ts";
import type { OverlapReport } from "./overlap.ts";

/** Describe a finished `generate` run in plain words for the terminal. */
export function formatGenerateSummary({
  out,
  outputs,
  checks,
  overlap,
}: {
  readonly out: string;
  readonly outputs: readonly Output[];
  readonly checks: readonly CheckReport[];
  readonly overlap: OverlapReport;
}): string {
  const checkLines = checks.map(
    (check) =>
      `  ${check.id}: ${check.violations.length} of ${check.outputs} ` +
      `(${Math.round(check.rate * 100)}%). ${check.description}`,
  );
  const pairLines = overlap.voicePairs
    .slice(0, 3)
    .map(
      (pair) =>
        `  ${pair.voices[0]} & ${pair.voices[1]}: ${pair.mean.toFixed(3)} ` +
        `(${pair.comparisons} output pairs)`,
    );
  return [
    `Wrote ${outputs.length} outputs to ${out}.`,
    "",
    "Checks (outputs that break each rule):",
    ...(checkLines.length > 0 ? checkLines : ["  none"]),
    "",
    "Overlap between voices (0 = nothing shared, 1 = the same text):",
    overlap.overallMean === null
      ? "  Nothing to compare: no case has two voices in the same group."
      : `  Overall mean: ${overlap.overallMean.toFixed(3)}`,
    ...(pairLines.length > 0 ? ["  Most alike voices:", ...pairLines] : []),
  ].join("\n");
}
