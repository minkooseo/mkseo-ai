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

  it("quotes a lineup item and asks for the more varied side", () => {
    expect(
      formatPage({
        round: {
          kind: "lineup",
          a: "/runs/a",
          b: "/runs/b",
          items: [
            {
              caseId: "c1",
              sample: 1,
              context: "First line.\nSecond line.",
              labels: {},
              leftSet: "b",
              left: [
                { voice: "casual", text: "Hey." },
                { voice: "formal", text: "Hello." },
              ],
              right: [
                { voice: "casual", text: "Hi." },
                { voice: "formal", text: "Good day." },
              ],
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
        "**Left**",
        "*casual*",
        "> Hey.",
        "*formal*",
        "> Hello.",
        "**Right**",
        "*casual*",
        "> Hi.",
        "*formal*",
        "> Good day.",
        "Reply with the item number, then l or r for the side that sounds " +
          "more like different people, or t (tie), then any words about " +
          "it. Example: 1 r",
      ].join("\n\n"),
    );
  });
});
