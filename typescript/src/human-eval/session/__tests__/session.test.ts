import { describe, expect, it } from "vitest";
import type { Round } from "../../round/round.ts";
import { assertValidSession, currentPage } from "../session.ts";

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

describe("currentPage", () => {
  it("shows the first items without a choice, up to the page size", () => {
    expect(
      currentPage({
        round: pairRound,
        choices: [
          { item: 1, picked: "left", tags: [] },
          { item: 3, picked: "tie", tags: [] },
        ],
      }),
    ).toEqual([2, 4, 5, 6, 7]);
  });
});

describe("assertValidSession", () => {
  it("rejects a saved choice on an item the round does not have", () => {
    expect(() =>
      assertValidSession({
        round: pairRound,
        choices: [{ item: 8, picked: "left", tags: [] }],
      }),
    ).toThrow("choices.json has item 8, but the round has 7 items.");
  });

  it("rejects an item chosen twice", () => {
    expect(() =>
      assertValidSession({
        round: pairRound,
        choices: [
          { item: 2, picked: "left", tags: [] },
          { item: 2, picked: "tie", tags: [] },
        ],
      }),
    ).toThrow("choices.json has item 2 twice.");
  });
});
