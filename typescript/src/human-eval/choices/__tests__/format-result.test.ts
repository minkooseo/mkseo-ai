import { describe, expect, it } from "vitest";
import { formatResult } from "../format-result.ts";

describe("formatResult", () => {
  it("describes a pair result with labels in name order", () => {
    expect(
      formatResult({
        kind: "pair",
        a: "../a",
        b: "../b",
        choiceCount: 3,
        aWins: 2,
        bWins: 0,
        ties: 1,
        winner: "a",
        byLabel: {
          tone: {
            formal: { aWins: 2, bWins: 0, ties: 0 },
            casual: { aWins: 0, bWins: 0, ties: 1 },
          },
        },
      }),
    ).toBe(
      [
        "Pair round, 3 choices",
        "  A: ../a",
        "  B: ../b",
        "A won 2, B won 0, ties 1.",
        "A wins: it has more wins than B.",
        "",
        "By label (A wins / B wins / ties):",
        "  tone=casual: 0 / 0 / 1",
        "  tone=formal: 2 / 0 / 0",
      ].join("\n"),
    );
  });

  it.each([
    {
      aWins: 1,
      bWins: 3,
      winner: "b",
      counts: "A won 1, B won 3, ties 1.",
      line: "B wins: it has more wins than A.",
    },
    {
      aWins: 2,
      bWins: 2,
      winner: null,
      counts: "A won 2, B won 2, ties 1.",
      line: "No winner: A and B have as many wins.",
    },
  ] as const)("says $line", ({ aWins, bWins, winner, counts, line }) => {
    expect(
      formatResult({
        kind: "lineup",
        a: "../a",
        b: "../b",
        choiceCount: 5,
        aWins,
        bWins,
        ties: 1,
        winner,
        byLabel: {},
      }),
    ).toBe(
      [
        "Lineup round, 5 choices",
        "  A: ../a",
        "  B: ../b",
        counts,
        line,
        "",
        "By label (A wins / B wins / ties):",
        "  none",
      ].join("\n"),
    );
  });
});
