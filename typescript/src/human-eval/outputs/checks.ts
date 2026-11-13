// Run a project's checks over an output set and count the outputs that
// break each rule.
import type { Check, Output } from "../project.ts";

/** How often one check was broken in an output set. */
export interface CheckReport {
  /** The check's name; e.g. 'too-long'. */
  readonly id: string;
  /** The rule in plain words; e.g. 'More than three sentences.'. */
  readonly description: string;
  /** How many outputs were checked; e.g. 36. */
  readonly outputs: number;
  /** Share of outputs that broke the rule, from 0 to 1; e.g. 0.25. */
  readonly rate: number;
  /** The outputs that broke the rule, in output-set order. */
  readonly violations: readonly Output[];
}

/** Run every check over every output and report each check's breaks. */
export function runChecks({
  checks,
  outputs,
}: {
  readonly checks: readonly Check[];
  readonly outputs: readonly Output[];
}): CheckReport[] {
  if (outputs.length === 0) throw new Error("There are no outputs to check.");
  return checks.map((check) => {
    const violations = outputs.filter((output) => check.violates(output));
    return {
      id: check.id,
      description: check.description,
      outputs: outputs.length,
      rate: violations.length / outputs.length,
      violations,
    };
  });
}
