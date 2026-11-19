import { describe, expect, it } from "vitest";
import type { Round, RoundItem } from "../../round/round.ts";
import { decisionsOf } from "../decisions.ts";

describe("decisionsOf", () => {
  it("tells each side's texts by output set, with the case", () => {
    const round = roundWith(
      lineupItem({
        leftSet: "b",
        left: [
          { speaker: "casual", text: "B casual." },
          { speaker: "formal", text: "B formal." },
        ],
        right: [
          { speaker: "casual", text: "A casual." },
          { speaker: "formal", text: "A formal." },
        ],
      }),
    );
    expect(
      decisionsOf({
        round,
        choices: [{ item: 1, picked: "left", reason: "More varied." }],
      }),
    ).toEqual([
      {
        item: 1,
        caseId: "late-train",
        sample: 2,
        context: "### Situation\nMy train was late.",
        outputs: [
          { speaker: "casual", a: "A casual.", b: "B casual." },
          { speaker: "formal", a: "A formal.", b: "B formal." },
        ],
        labels: { task: "reply" },
        winner: "b",
        reason: "More varied.",
      },
    ]);
  });
});

function roundWith(item: RoundItem): Round {
  return {
    kind: "lineup",
    question: "Which side sounds more like different people?",
    a: "../a",
    b: "../b",
    items: [item],
  };
}

function lineupItem({
  leftSet,
  left,
  right,
}: Pick<RoundItem, "leftSet" | "left" | "right">): RoundItem {
  return {
    caseId: "late-train",
    sample: 2,
    context: "### Situation\nMy train was late.",
    labels: { task: "reply" },
    speakerDescription: null,
    leftSet,
    left,
    right,
  };
}
