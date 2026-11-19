import { describe, expect, it } from "vitest";
import { choiceSchema } from "../choices.ts";

describe("choiceSchema", () => {
  it.each([
    { item: 1, picked: "tie", reason: null },
    { item: 1, picked: "tie", reason: "Same." },
    { item: 1, picked: "left", reason: " Warmer." },
  ])("accepts $picked with reason $reason", (choice) => {
    expect(choiceSchema.safeParse(choice).success).toBe(true);
  });

  it.each([
    { item: 1, picked: "left", reason: null },
    { item: 1, picked: "right", reason: null },
    { item: 1, picked: "tie", reason: " \n" },
    { item: 1, picked: "left", reason: "" },
  ])("rejects $picked with reason $reason", (choice) => {
    expect(choiceSchema.safeParse(choice).success).toBe(false);
  });
});
