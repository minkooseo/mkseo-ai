import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Labels, Output, SpeakerDescription } from "../../project.ts";
import { lineupItems, pairItems } from "../items.ts";

beforeEach(() => {
  // With 0 every shuffle keeps its order and set A goes on the left.
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("pairItems", () => {
  it("draws up to the item limit from the shuffled outputs", () => {
    const a = [
      output({ caseId: "c1", speaker: "formal", text: "A" }),
      output({ caseId: "c2", speaker: "formal", text: "A" }),
      output({ caseId: "c1", speaker: "casual", text: "A" }),
    ];
    const b = a.map((one) => ({ ...one, text: "B" }));
    // 0.5 takes the middle output, then the second of the two left, and
    // puts set B on the left.
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const items = pairItems({ a, b, itemLimit: 2 });
    expect(items.map((item) => [item.caseId, item.left, item.right])).toEqual([
      [
        "c2",
        [{ speaker: "formal", text: "B" }],
        [{ speaker: "formal", text: "A" }],
      ],
      [
        "c1",
        [{ speaker: "casual", text: "B" }],
        [{ speaker: "casual", text: "A" }],
      ],
    ]);
  });

  it("puts set B on the left when the coin says so", () => {
    const a = [output({ caseId: "c1", speaker: "formal", text: "A" })];
    const b = [output({ caseId: "c1", speaker: "formal", text: "B" })];
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const [item] = pairItems({ a, b, itemLimit: 1 });
    expect(item?.leftSet).toBe("b");
    expect(item?.left).toEqual([{ speaker: "formal", text: "B" }]);
  });

  it.each([
    { coin: 0, leftSet: "a" },
    { coin: 0.9, leftSet: "b" },
  ])(
    "shows set B's speaker description with B on the $leftSet side",
    ({ coin, leftSet }) => {
      const a = [
        output({
          caseId: "c1",
          speaker: "formal",
          text: "A",
          description: { title: "Old.", sections: [] },
        }),
      ];
      const b = [
        output({
          caseId: "c1",
          speaker: "formal",
          text: "B",
          description: { title: "New.", sections: [] },
        }),
      ];
      vi.spyOn(Math, "random").mockReturnValue(coin);
      const [item] = pairItems({ a, b, itemLimit: 1 });
      expect([item?.leftSet, item?.speakerDescription]).toEqual([
        leftSet,
        { title: "New.", sections: [] },
      ]);
    },
  );
});

describe("lineupItems", () => {
  const a = [
    output({ caseId: "c1", speaker: "formal", text: "A1" }),
    output({ caseId: "c1", speaker: "casual", text: "A2", tone: "calm" }),
    output({ caseId: "c1", speaker: "plain", text: "A3", tone: "calm" }),
    output({ caseId: "c2", speaker: "formal", text: "A4" }),
  ];
  const b = a.map((one) => ({ ...one, text: one.text.replace("A", "B") }));

  it("lines up every speaker of a case, in name order", () => {
    const items = lineupItems({ a, b, itemLimit: 10 });
    expect(items).toEqual([
      {
        caseId: "c1",
        context: "Case c1.",
        labels: {},
        speakerDescription: null,
        leftSet: "a",
        left: [
          { speaker: "casual", text: "A2" },
          { speaker: "formal", text: "A1" },
          { speaker: "plain", text: "A3" },
        ],
        right: [
          { speaker: "casual", text: "B2" },
          { speaker: "formal", text: "B1" },
          { speaker: "plain", text: "B3" },
        ],
      },
    ]);
  });

  it("keeps the labels every speaker of the item shares", () => {
    const calm = a.filter((one) => one.labels["tone"] === "calm");
    const [item] = lineupItems({
      a: calm,
      b: calm,
      itemLimit: 10,
    });
    expect(item?.labels).toEqual({ tone: "calm" });
  });

  it("draws at most the item limit", () => {
    const twoCases = [
      ...a,
      output({ caseId: "c2", speaker: "casual", text: "A5" }),
    ];
    expect(lineupItems({ a: twoCases, b: twoCases, itemLimit: 1 }).length).toBe(
      1,
    );
  });

  it("has nothing to show for a single speaker", () => {
    const single = [output({ caseId: "c1", speaker: "formal", text: "A" })];
    expect(lineupItems({ a: single, b: single, itemLimit: 10 })).toEqual([]);
  });
});

function output({
  caseId,
  speaker,
  tone,
  text,
  description = null,
}: {
  caseId: string;
  speaker: string;
  tone?: string;
  text: string;
  description?: SpeakerDescription | null;
}): Output {
  const labels: Labels = tone === undefined ? {} : { tone };
  return {
    caseId,
    speaker,
    context: `Case ${caseId}.`,
    text,
    labels,
    speakerDescription: description,
  };
}
