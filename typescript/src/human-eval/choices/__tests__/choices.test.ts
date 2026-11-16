import { describe, expect, it } from "vitest";
import { parseReply } from "../choices.ts";

describe("parseReply", () => {
  it("reads choices on lines or after commas, in any case", () => {
    expect(
      parseReply({
        reply: "1 L Stiff off-voice stiff, 3 t\n2 r",
        page: [1, 2, 3],
      }),
    ).toEqual([
      { item: 1, picked: "left", tags: ["stiff", "off-voice"] },
      { item: 3, picked: "tie", tags: [] },
      { item: 2, picked: "right", tags: [] },
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
  ])("rejects the reply '$reply'", ({ reply, message }) => {
    expect(() => parseReply({ reply, page: [1, 2] })).toThrow(message);
  });
});
