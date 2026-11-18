import { describe, expect, it } from "vitest";
import type { Round } from "../../round/round.ts";
import { addChoice, assertValidSession, isFinished } from "../session.ts";

const pairRound: Round = {
  kind: "pair",
  question: "Which reply is kinder?",
  a: "/runs/a",
  b: "/runs/b",
  items: [1, 2, 3].map((item) => ({
    caseId: `c${item}`,
    sample: 1,
    context: `Case ${item}.`,
    labels: {},
    speakerDescription: null,
    leftSet: "a" as const,
    left: [{ speaker: "formal", text: `Left ${item}.` }],
    right: [{ speaker: "formal", text: `Right ${item}.` }],
  })),
};

describe("addChoice", () => {
  it("records the pick with its reason as written", () => {
    const session = addChoice(
      {
        round: pairRound,
        choices: [{ item: 1, picked: "tie", reason: "Same." }],
      },
      { item: 3, picked: "left", reason: "  Warmer.\n" },
    );
    expect(session.choices).toEqual([
      { item: 1, picked: "tie", reason: "Same." },
      { item: 3, picked: "left", reason: "  Warmer.\n" },
    ]);
    expect(isFinished(session)).toBe(false);
  });

  it("finishes the round when the last item gets a choice", () => {
    const session = [1, 2, 3].reduce(
      (current, item) =>
        addChoice(current, { item, picked: "right", reason: "Shorter." }),
      { round: pairRound, choices: [] } as Parameters<typeof addChoice>[0],
    );
    expect(isFinished(session)).toBe(true);
  });

  it.each([
    {
      what: "a blank reason",
      choice: { item: 2, picked: "left", reason: " \n" },
      message: "Write a reason for the pick.",
    },
    {
      what: "an item already chosen",
      choice: { item: 1, picked: "left", reason: "Warmer." },
      message: "Item 1 already has a choice.",
    },
    {
      what: "an item the round does not have",
      choice: { item: 4, picked: "left", reason: "Warmer." },
      message: "There is no item 4; the round has 3 items.",
    },
  ] as const)("refuses $what", ({ choice, message }) => {
    expect(() =>
      addChoice(
        {
          round: pairRound,
          choices: [{ item: 1, picked: "tie", reason: "Same." }],
        },
        choice,
      ),
    ).toThrow(message);
  });
});

describe("assertValidSession", () => {
  it("rejects a saved choice on an item the round does not have", () => {
    expect(() =>
      assertValidSession({
        round: pairRound,
        choices: [{ item: 4, picked: "left", reason: "Warmer." }],
      }),
    ).toThrow("choices.json has item 4, but the round has 3 items.");
  });

  it("rejects an item chosen twice", () => {
    expect(() =>
      assertValidSession({
        round: pairRound,
        choices: [
          { item: 2, picked: "left", reason: "Warmer." },
          { item: 2, picked: "tie", reason: "Same." },
        ],
      }),
    ).toThrow("choices.json has item 2 twice.");
  });
});
