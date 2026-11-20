import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addItemChoice,
  addSpeakerChoice,
  type BlindRound,
  finalVerdicts,
  pageView,
  startBlindRound,
} from "../blind-round.ts";
import type { Round } from "../round.ts";

const formal = { title: "Formal", sections: [] };
const casual = { title: "Casual", sections: [] };

const round: Round = {
  question: "Which reply is kinder?",
  ask: "item",
  items: [
    {
      context: "My train was 40 minutes late.",
      speakers: [
        {
          speaker: "formal",
          gender: "man",
          description: formal,
          a: "That is unfortunate.",
          b: "I am sorry to hear it.",
        },
      ],
    },
    {
      context: "I lost my keys.",
      speakers: [
        {
          speaker: "casual",
          gender: "woman",
          description: casual,
          a: "Ugh, keys!",
          b: "Oh no.",
        },
        {
          speaker: "formal",
          gender: "man",
          description: formal,
          a: "Check your coat.",
          b: "Retrace your steps.",
        },
      ],
    },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("startBlindRound", () => {
  it("puts set A on the side each coin says", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0.1).mockReturnValueOnce(0.9);
    expect(startBlindRound(round).leftSets).toEqual(["a", "b"]);
  });

  it("refuses a round without items", () => {
    expect(() =>
      startBlindRound({ question: "Q?", ask: "item", items: [] }),
    ).toThrow("A round needs an item.");
  });
});

describe("pageView", () => {
  it("shows each speaker's sets as Left and Right and the decided items", () => {
    const blind = addItemChoice(at(["a", "b"]), {
      item: 2,
      picked: "tie",
      reason: "",
    });
    expect(pageView(blind)).toEqual({
      question: "Which reply is kinder?",
      ask: "item",
      items: [
        {
          number: 1,
          context: "My train was 40 minutes late.",
          speakers: [
            {
              speaker: "formal",
              gender: "man",
              description: formal,
              left: "That is unfortunate.",
              right: "I am sorry to hear it.",
            },
          ],
        },
        {
          number: 2,
          context: "I lost my keys.",
          speakers: [
            {
              speaker: "casual",
              gender: "woman",
              description: casual,
              left: "Oh no.",
              right: "Ugh, keys!",
            },
            {
              speaker: "formal",
              gender: "man",
              description: formal,
              left: "Retrace your steps.",
              right: "Check your coat.",
            },
          ],
        },
      ],
      chosen: [2],
    });
  });
});

describe("addItemChoice", () => {
  it("turns a picked side into the set shown there", () => {
    const first = addItemChoice(at(["a", "b"]), {
      item: 1,
      picked: "right",
      reason: "Warmer.",
    });
    const both = addItemChoice(first, {
      item: 2,
      picked: "right",
      reason: " Shorter. ",
    });
    expect(finalVerdicts(both)).toEqual([
      { winner: "b", reason: "Warmer." },
      { winner: "a", reason: " Shorter. " },
    ]);
  });

  it("keeps no reason for a tie left blank", () => {
    const blind = addItemChoice(at(["a", "b"]), {
      item: 1,
      picked: "tie",
      reason: " ",
    });
    expect(blind.verdicts.get(1)).toEqual({ winner: "tie", reason: null });
  });

  it("refuses a pick without a reason", () => {
    expect(() =>
      addItemChoice(at(["a", "b"]), { item: 1, picked: "left", reason: " " }),
    ).toThrow("Write a reason for the pick.");
  });

  it("refuses an item that is not in the round", () => {
    expect(() =>
      addItemChoice(at(["a", "b"]), { item: 3, picked: "tie", reason: "" }),
    ).toThrow("There is no item 3; the round has 2.");
  });

  it("refuses a second choice on an item", () => {
    const blind = addItemChoice(at(["a", "b"]), {
      item: 1,
      picked: "tie",
      reason: "",
    });
    expect(() =>
      addItemChoice(blind, { item: 1, picked: "left", reason: "Warm." }),
    ).toThrow("Item 1 already has a choice.");
  });
});

describe("addSpeakerChoice", () => {
  it("gives every speaker a verdict, unmarked ones a tie", () => {
    const blind = addSpeakerChoice(at(["a", "b"]), {
      item: 2,
      marks: [{ speaker: "formal", picked: "left", reason: "Clearer." }],
    });
    expect(blind.verdicts.get(2)).toEqual([
      { speaker: "casual", winner: "tie", reason: null },
      { speaker: "formal", winner: "b", reason: "Clearer." },
    ]);
  });

  it("refuses a mark without a reason", () => {
    expect(() =>
      addSpeakerChoice(at(["a", "b"]), {
        item: 2,
        marks: [{ speaker: "casual", picked: "right", reason: " " }],
      }),
    ).toThrow("Write a reason for casual.");
  });

  it("refuses an unknown speaker", () => {
    expect(() =>
      addSpeakerChoice(at(["a", "b"]), {
        item: 1,
        marks: [{ speaker: "casual", picked: "right", reason: "Kind." }],
      }),
    ).toThrow("There is no speaker casual.");
  });

  it("refuses a speaker marked twice", () => {
    expect(() =>
      addSpeakerChoice(at(["a", "b"]), {
        item: 2,
        marks: [
          { speaker: "casual", picked: "right", reason: "Kind." },
          { speaker: "casual", picked: "left", reason: "Short." },
        ],
      }),
    ).toThrow("casual is marked twice.");
  });
});

describe("finalVerdicts", () => {
  it("is null while an item is undecided", () => {
    const blind = addItemChoice(at(["a", "b"]), {
      item: 1,
      picked: "tie",
      reason: "",
    });
    expect(finalVerdicts(blind)).toBeNull();
  });
});

// The round with set A on the given sides and nothing decided.
function at(leftSets: readonly ("a" | "b")[]): BlindRound {
  return { round, leftSets, verdicts: new Map() };
}
