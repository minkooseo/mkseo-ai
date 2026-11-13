import { describe, expect, it } from "vitest";
import type { Round } from "../round.ts";
import { formatPage } from "../page.ts";

const pairRound: Round = {
  kind: "pair",
  a: "/runs/a",
  b: "/runs/b",
  items: [1, 2, 3, 4, 5, 6, 7].map((item) => ({
    caseId: `c${item}`,
    sample: 1,
    context: `Case ${item}.`,
    labels: {},
    leftSet: "a" as const,
    left: [{ voice: "formal", text: `Left ${item}.` }],
    right: [{ voice: "formal", text: `Right ${item}.` }],
  })),
};

describe("formatPage", () => {
  it("numbers pair items across the round and hides the output sets", () => {
    expect(formatPage({ round: pairRound, page: [6, 7] })).toBe(
      [
        "### Item 6 of 7",
        "Case:",
        "> Case 6.",
        "**Left**",
        "*formal*",
        "> Left 6.",
        "**Right**",
        "*formal*",
        "> Right 6.",
        "### Item 7 of 7",
        "Case:",
        "> Case 7.",
        "**Left**",
        "*formal*",
        "> Left 7.",
        "**Right**",
        "*formal*",
        "> Right 7.",
        "Reply with one line per item: the item number, then l (left is " +
          "better), r (right is better), or t (tie), then any words about " +
          "it. Example: 6 l stiff",
      ].join("\n\n"),
    );
  });

  it("offers numbered voices for a guess item", () => {
    expect(
      formatPage({
        round: {
          kind: "guess",
          outputs: "/runs/a",
          items: [
            {
              caseId: "c1",
              sample: 1,
              context: "First line.\nSecond line.",
              text: "Hello.",
              voice: "formal",
              options: ["casual", "formal"],
            },
          ],
        },
        page: [1],
      }),
    ).toBe(
      [
        "### Item 1 of 1",
        "Case:",
        "> First line.\n> Second line.",
        "Output:",
        "> Hello.",
        "Which voice wrote it? 1 = casual, 2 = formal",
        "Reply with one line per item: the item number, then the number of " +
          "the voice you think wrote it. Example: 1 2",
      ].join("\n\n"),
    );
  });
});
