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
        pValue: 0.5,
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
        "Sign test p-value (ties left out): 0.500",
        "A p-value of at most 0.05 means the gap is unlikely to be luck.",
        "",
        "By label (A wins / B wins / ties):",
        "  tone=casual: 0 / 0 / 1",
        "  tone=formal: 2 / 0 / 0",
      ].join("\n"),
    );
  });

  it("says when a p-value is very small and there are no labels", () => {
    expect(
      formatResult({
        kind: "lineup",
        a: "../a",
        b: "../b",
        choiceCount: 12,
        aWins: 0,
        bWins: 12,
        ties: 0,
        pValue: 0.00048828125,
        byLabel: {},
      }),
    ).toBe(
      [
        "Lineup round, 12 choices",
        "  A: ../a",
        "  B: ../b",
        "A won 0, B won 12, ties 0.",
        "Sign test p-value (ties left out): below 0.001",
        "A p-value of at most 0.05 means the gap is unlikely to be luck.",
        "",
        "By label (A wins / B wins / ties):",
        "  none",
      ].join("\n"),
    );
  });
});
