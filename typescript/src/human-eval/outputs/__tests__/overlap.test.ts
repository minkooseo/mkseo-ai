import { describe, expect, it } from "vitest";
import type { Output } from "../../project.ts";
import { measureOverlap, trigramSimilarity } from "../overlap.ts";

describe("trigramSimilarity", () => {
  it.each([
    { first: "abcd", second: "abce", similarity: 1 / 3 },
    { first: "abc", second: "xyz", similarity: 0 },
    { first: "ok", second: "ok", similarity: 1 },
    { first: "ok", second: "okay", similarity: 0 },
  ])("compares $first with $second", ({ first, second, similarity }) => {
    expect(trigramSimilarity(first, second)).toBeCloseTo(similarity);
  });
});

describe("measureOverlap", () => {
  it("compares only different voices in the same case and group", () => {
    const report = measureOverlap({
      groupLabel: "group",
      outputs: [
        output({ caseId: "c1", voice: "formal", group: "x", text: "abcd" }),
        output({ caseId: "c1", voice: "casual", group: "x", text: "abce" }),
        output({ caseId: "c1", voice: "plain", group: "y", text: "abcd" }),
        output({ caseId: "c2", voice: "formal", group: "x", text: "abc" }),
        output({ caseId: "c2", voice: "casual", group: "x", text: "abc" }),
        output({ caseId: "c2", voice: "casual", group: "x", text: "abd" }),
      ],
    });
    expect(report.overallMean).toBeCloseTo((1 / 3 + 1 + 0) / 3);
    expect(report.voicePairs).toEqual([
      {
        voices: ["casual", "formal"],
        mean: (1 / 3 + 1 + 0) / 3,
        comparisons: 3,
      },
    ]);
  });

  it("gives no mean when no two voices responded to the same case", () => {
    const report = measureOverlap({
      groupLabel: null,
      outputs: [
        output({ caseId: "c1", voice: "formal", group: "x", text: "a" }),
      ],
    });
    expect(report.overallMean).toBeNull();
    expect(report.voicePairs).toEqual([]);
  });

  it("rejects an output without the group label", () => {
    expect(() =>
      measureOverlap({
        groupLabel: "tone",
        outputs: [
          output({ caseId: "c1", voice: "formal", group: "x", text: "a" }),
        ],
      }),
    ).toThrow('Output c1 / formal / 1 has no "tone" label.');
  });
});

function output({
  caseId,
  voice,
  group,
  text,
}: {
  caseId: string;
  voice: string;
  group: string;
  text: string;
}): Output {
  return { caseId, voice, sample: 1, context: "", text, labels: { group } };
}
