import { describe, expect, it } from "vitest";
import type { Output, Check } from "../../project.ts";
import { runChecks } from "../checks.ts";

const tooLong: Check = {
  id: "too-long",
  description: "More than ten characters.",
  violates: (output) => output.text.length > 10,
};

describe("runChecks", () => {
  it("reports the rate and the outputs that break each rule", () => {
    const short = output("Thanks.");
    const long = output("Thank you very much.");
    expect(runChecks({ checks: [tooLong], outputs: [short, long] })).toEqual([
      {
        id: "too-long",
        description: "More than ten characters.",
        outputs: 2,
        rate: 0.5,
        violations: [long],
      },
    ]);
  });
});

function output(text: string): Output {
  return {
    caseId: "late-train",
    voice: "formal",
    sample: 1,
    context: "The train is late.",
    text,
    labels: {},
  };
}
