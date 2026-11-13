import { describe, expect, it } from "vitest";
import { signTest } from "../sign-test.ts";

describe("signTest", () => {
  it.each([
    { aWins: 9, bWins: 1, pValue: 22 / 1024 },
    { aWins: 0, bWins: 6, pValue: 2 / 64 },
    { aWins: 5, bWins: 5, pValue: 1 },
    { aWins: 0, bWins: 0, pValue: 1 },
    { aWins: 1000, bWins: 1100, pValue: 0.0307207 },
  ])("gives $pValue for $aWins against $bWins", ({ aWins, bWins, pValue }) => {
    expect(signTest({ aWins, bWins })).toBeCloseTo(pValue, 5);
  });

  it("rejects counts that are not whole numbers", () => {
    expect(() => signTest({ aWins: 1.5, bWins: 0 })).toThrow(
      "Win counts must be whole numbers of zero or more.",
    );
  });
});
