import { describe, expect, it } from "vitest";
import { formatResult } from "../format-result.ts";

describe("formatResult", () => {
  it("describes a pair result with tags and labels in name order", () => {
    expect(
      formatResult({
        kind: "pair",
        a: "../a",
        b: "../b",
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
        "Tags (A wins / B wins / ties):",
        "  short: 1 / 0 / 0",
        "  warm: 2 / 0 / 0",
        "",
        "By label (A wins / B wins / ties):",
        "  tone=casual: 0 / 0 / 1",
        "  tone=formal: 2 / 0 / 0",
      ].join("\n"),
    );
  });

  it("says when a p-value is very small and there are no tags", () => {
    expect(
      formatResult({
        kind: "lineup",
        a: "../a",
        b: "../b",
        choices: 12,
        aWins: 0,
        bWins: 12,
        ties: 0,
        pValue: 0.00048828125,
        byTag: {},
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

  it("describes a guess result", () => {
    expect(
      formatResult({
        kind: "guess",
        outputs: "../a",
        choices: 4,
        correct: 3,
        accuracy: 0.75,
        confusion: {
          plain: { plain: 2 },
          formal: { formal: 1, casual: 1 },
        },
      }),
    ).toBe(
      [
        "Guess round, 4 choices on ../a",
        "Right 3 times (75%).",
        "",
        "Guesses for each real voice (real voice: guessed voice count):",
        "  formal: casual 1, formal 1",
        "  plain: plain 2",
      ].join("\n"),
    );
  });
});
