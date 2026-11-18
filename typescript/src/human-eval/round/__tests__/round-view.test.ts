import { describe, expect, it } from "vitest";
import type { Round } from "../round.ts";
import { roundView } from "../round-view.ts";

describe("roundView", () => {
  it("shows Left and Right without saying which set is which", () => {
    const round: Round = {
      kind: "pair",
      question: "Which reply is kinder?",
      a: "../run-a",
      b: "../run-b",
      items: [
        {
          caseId: "late-train",
          sample: 1,
          context: "My train was 40 minutes late.",
          labels: { task: "reply" },
          speakerDescription: "Formal. Short sentences, no slang.",
          leftSet: "b",
          left: [{ speaker: "formal", text: "That is unfortunate." }],
          right: [{ speaker: "formal", text: "I am sorry to hear it." }],
        },
      ],
    };
    const view = roundView(round);
    expect(view).toEqual({
      kind: "pair",
      question: "Which reply is kinder?",
      items: [
        {
          number: 1,
          context: "My train was 40 minutes late.",
          speakerDescription: "Formal. Short sentences, no slang.",
          left: [{ speaker: "formal", text: "That is unfortunate." }],
          right: [{ speaker: "formal", text: "I am sorry to hear it." }],
        },
      ],
    });
    const json = JSON.stringify(view);
    expect(json).not.toContain("leftSet");
    expect(json).not.toContain("run-a");
    expect(json).not.toContain("run-b");
  });
});
