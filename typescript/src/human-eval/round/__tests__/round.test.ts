import { describe, expect, it } from "vitest";
import { roundSchema } from "../round.ts";

describe("roundSchema", () => {
  it("rejects an item whose sides show different speakers", () => {
    const parsed = roundSchema.safeParse({
      kind: "lineup",
      question: "Which side sounds more like different people?",
      a: "../a",
      b: "../b",
      items: [
        {
          caseId: "late-train",
          context: "My train was late.",
          labels: {},
          speakerDescription: null,
          leftSet: "a",
          left: [{ speaker: "casual", text: "A." }],
          right: [{ speaker: "formal", text: "B." }],
        },
      ],
    });
    expect(parsed.error?.issues.map((issue) => issue.message)).toEqual([
      "Both sides must show the same speakers in the same order.",
    ]);
  });
});
