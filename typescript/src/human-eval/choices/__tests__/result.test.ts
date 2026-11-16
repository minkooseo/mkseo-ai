import { describe, expect, it } from "vitest";
import type { RoundItem } from "../../round/round.ts";
import { resultOf } from "../result.ts";

describe("resultOf", () => {
  it("counts pair choices for each output set, tag, and label", () => {
    const result = resultOf({
      round: {
        kind: "pair",
        a: "/runs/a",
        b: "/runs/b",
        items: [
          roundItem({ leftSet: "a", tone: "formal" }),
          roundItem({ leftSet: "b", tone: "formal" }),
          roundItem({ leftSet: "b", tone: "casual" }),
        ],
      },
      choices: [
        { item: 2, picked: "right", tags: ["warm", "short"] },
        { item: 1, picked: "left", tags: ["warm"] },
        { item: 3, picked: "tie", tags: [] },
      ],
    });
    expect(result).toEqual({
      kind: "pair",
      a: "/runs/a",
      b: "/runs/b",
      choices: 3,
      aWins: 2,
      bWins: 0,
      ties: 1,
      pValue: 0.5,
      byTag: {
        warm: { aWins: 2, bWins: 0, ties: 0 },
        short: { aWins: 1, bWins: 0, ties: 0 },
      },
      byLabel: {
        tone: {
          formal: { aWins: 2, bWins: 0, ties: 0 },
          casual: { aWins: 0, bWins: 0, ties: 1 },
        },
      },
    });
  });

  it("counts tags and labels named like object built-ins", () => {
    const result = resultOf({
      round: {
        kind: "pair",
        a: "../a",
        b: "../b",
        items: [roundItem({ leftSet: "a", tone: "constructor" })],
      },
      choices: [{ item: 1, picked: "left", tags: ["__proto__"] }],
    });
    expect(result.byTag).toEqual(
      Object.fromEntries([["__proto__", { aWins: 1, bWins: 0, ties: 0 }]]),
    );
    expect(result.byLabel).toEqual({
      tone: { constructor: { aWins: 1, bWins: 0, ties: 0 } },
    });
  });

  it("refuses a round with an item that has no choice", () => {
    expect(() =>
      resultOf({
        round: {
          kind: "lineup",
          a: "/runs/a",
          b: "/runs/b",
          items: [roundItem({ leftSet: "a", tone: "formal" })],
        },
        choices: [],
      }),
    ).toThrow("Item 1 has no choice.");
  });
});

function roundItem({
  leftSet,
  tone,
}: {
  leftSet: "a" | "b";
  tone: string;
}): RoundItem {
  return {
    caseId: "c1",
    sample: 1,
    context: "Case c1.",
    labels: { tone },
    leftSet,
    left: [{ voice: tone, text: "Left." }],
    right: [{ voice: tone, text: "Right." }],
  };
}
