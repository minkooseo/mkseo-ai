import { describe, expect, it } from "vitest";
import type { Round } from "../../round/round.ts";
import { parseReply } from "../choices.ts";

const pairRound: Round = {
  kind: "pair",
  a: "/runs/a",
  b: "/runs/b",
  items: [1, 2, 3].map((item) => ({
    caseId: `c${item}`,
    sample: 1,
    context: `Case ${item}.`,
    labels: {},
    leftSet: "a" as const,
    left: [{ voice: "formal", text: "Left." }],
    right: [{ voice: "formal", text: "Right." }],
  })),
};

const guessRound: Round = {
  kind: "guess",
  outputs: "/runs/a",
  items: [
    {
      caseId: "c1",
      sample: 1,
      context: "Case 1.",
      text: "Hello.",
      voice: "formal",
      options: ["casual", "formal"],
    },
  ],
};

describe("parseReply", () => {
  it("reads pair choices on lines or after commas, in any case", () => {
    expect(
      parseReply({
        reply: "1 L Stiff off-voice stiff, 3 t\n2 r",
        round: pairRound,
        page: [1, 2, 3],
      }),
    ).toEqual([
      { item: 1, picked: "left", tags: ["stiff", "off-voice"] },
      { item: 3, picked: "tie", tags: [] },
      { item: 2, picked: "right", tags: [] },
    ]);
  });

  it("reads a guess choice as the chosen voice", () => {
    expect(parseReply({ reply: "1 2", round: guessRound, page: [1] })).toEqual([
      { item: 1, picked: "formal", tags: [] },
    ]);
  });

  it.each([
    { reply: "", message: "The reply has no choices." },
    {
      reply: "4 l",
      message: '"4 l" does not start with an item on this page (items 1, 2).',
    },
    {
      reply: "1 l, 1 r",
      message: "Item 1 appears more than once in the reply.",
    },
    { reply: "1 x", message: '"1 x": pick l, r, or t.' },
    { reply: "2", message: '"2" does not say what was picked.' },
    {
      reply: "1 l 2 r",
      message: '"1 l 2 r": put each choice on its own line or after a comma.',
    },
    { reply: "1 constructor", message: '"1 constructor": pick l, r, or t.' },
  ])("rejects the pair reply '$reply'", ({ reply, message }) => {
    expect(() => parseReply({ reply, round: pairRound, page: [1, 2] })).toThrow(
      message,
    );
  });

  it.each([
    {
      reply: "1 3",
      message: '"1 3": pick a voice number from 1 to 2.',
    },
    {
      reply: "1 1 warm",
      message:
        '"1 1 warm": a guess takes no tags; put each choice on its own line ' +
        "or after a comma.",
    },
  ])("rejects the guess reply '$reply'", ({ reply, message }) => {
    expect(() => parseReply({ reply, round: guessRound, page: [1] })).toThrow(
      message,
    );
  });
});
