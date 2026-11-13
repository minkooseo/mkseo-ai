import { describe, expect, it } from "vitest";
import type { Output } from "../../project.ts";
import { matchSets } from "../output.ts";

describe("matchSets", () => {
  it("gives the B output for an A output of the same case and voice", () => {
    const a = output({ voice: "formal", text: "A" });
    const b = output({ voice: "formal", text: "B" });
    expect(matchSets([a], [b])(a)).toBe(b);
  });

  it("lists every output that is missing or differs", () => {
    expect(() =>
      matchSets(
        [
          output({ voice: "formal", text: "A" }),
          output({ voice: "casual", text: "A" }),
        ],
        [
          { ...output({ voice: "formal", text: "B" }), context: "Other." },
          output({ voice: "plain", text: "B" }),
        ],
      ),
    ).toThrow(
      "Output sets A and B must hold the same cases, voices, and samples:\n" +
        "  different case text or labels: late-train / formal / 1\n" +
        "  only in A: late-train / casual / 1\n" +
        "  only in B: late-train / plain / 1",
    );
  });

  it("rejects a repeated output", () => {
    const one = output({ voice: "formal", text: "A" });
    expect(() => matchSets([one, one], [one])).toThrow(
      "Output late-train / formal / 1 appears twice.",
    );
  });
});

function output({ voice, text }: { voice: string; text: string }): Output {
  return {
    caseId: "late-train",
    voice,
    sample: 1,
    context: "The train is late.",
    text,
    labels: { task: "reply" },
  };
}
