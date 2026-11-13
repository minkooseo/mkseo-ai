import { describe, expect, it } from "vitest";
import type { Output } from "../../project.ts";
import { guessItems, lineupItems, pairItems } from "../items.ts";

// With 0 every shuffle keeps its order and set A goes on the left.
const keepOrder = () => 0;

describe("pairItems", () => {
  it("spreads items evenly across voices", () => {
    const a = [
      output({ caseId: "c1", voice: "formal", text: "A" }),
      output({ caseId: "c2", voice: "formal", text: "A" }),
      output({ caseId: "c3", voice: "formal", text: "A" }),
      output({ caseId: "c1", voice: "casual", text: "A" }),
    ];
    const b = a.map((one) => ({ ...one, text: "B" }));
    const items = pairItems({ a, b, itemLimit: 3, random: keepOrder });
    expect(items.map((item) => [item.caseId, item.left, item.right])).toEqual([
      [
        "c1",
        [{ voice: "formal", text: "A" }],
        [{ voice: "formal", text: "B" }],
      ],
      [
        "c1",
        [{ voice: "casual", text: "A" }],
        [{ voice: "casual", text: "B" }],
      ],
      [
        "c2",
        [{ voice: "formal", text: "A" }],
        [{ voice: "formal", text: "B" }],
      ],
    ]);
  });

  it("puts set B on the left when the coin says so", () => {
    const a = [output({ caseId: "c1", voice: "formal", text: "A" })];
    const b = [output({ caseId: "c1", voice: "formal", text: "B" })];
    const [item] = pairItems({ a, b, itemLimit: 1, random: () => 0.9 });
    expect(item?.leftSet).toBe("b");
    expect(item?.left).toEqual([{ voice: "formal", text: "B" }]);
  });
});

describe("lineupItems", () => {
  const a = [
    output({ caseId: "c1", voice: "formal", group: "x", text: "A1" }),
    output({ caseId: "c1", voice: "casual", group: "x", text: "A2" }),
    output({ caseId: "c1", voice: "plain", group: "y", text: "A3" }),
  ];
  const b = a.map((one) => ({ ...one, text: one.text.replace("A", "B") }));

  it("lines up the voices of one group, in name order", () => {
    const items = lineupItems({
      a,
      b,
      groupLabel: "group",
      itemLimit: 10,
      random: keepOrder,
    });
    expect(items).toEqual([
      {
        caseId: "c1",
        sample: 1,
        context: "Case c1.",
        labels: { group: "x" },
        leftSet: "a",
        left: [
          { voice: "casual", text: "A2" },
          { voice: "formal", text: "A1" },
        ],
        right: [
          { voice: "casual", text: "B2" },
          { voice: "formal", text: "B1" },
        ],
      },
    ]);
  });

  it("lines up every voice of a case when voices are not grouped", () => {
    const items = lineupItems({
      a,
      b,
      groupLabel: null,
      itemLimit: 10,
      random: keepOrder,
    });
    expect(items.map((item) => item.left.map((entry) => entry.voice))).toEqual([
      ["casual", "formal", "plain"],
    ]);
    expect(items[0]?.labels).toEqual({});
  });

  it("has nothing to show for a single voice", () => {
    const single = [output({ caseId: "c1", voice: "formal", text: "A" })];
    expect(
      lineupItems({
        a: single,
        b: single,
        groupLabel: null,
        itemLimit: 10,
        random: keepOrder,
      }),
    ).toEqual([]);
  });
});

describe("guessItems", () => {
  const outputs = [
    output({ caseId: "c1", voice: "formal", group: "x", text: "A1" }),
    output({ caseId: "c1", voice: "casual", group: "x", text: "A2" }),
    output({ caseId: "c1", voice: "plain", group: "y", text: "A3" }),
  ];

  it("offers the voices of the same case and group", () => {
    expect(
      guessItems({
        outputs,
        groupLabel: "group",
        itemLimit: 10,
        random: keepOrder,
      }),
    ).toEqual([
      {
        caseId: "c1",
        sample: 1,
        context: "Case c1.",
        text: "A1",
        voice: "formal",
        options: ["casual", "formal"],
      },
      {
        caseId: "c1",
        sample: 1,
        context: "Case c1.",
        text: "A2",
        voice: "casual",
        options: ["casual", "formal"],
      },
    ]);
  });

  it("offers every voice of the case when voices are not grouped", () => {
    const items = guessItems({
      outputs,
      groupLabel: null,
      itemLimit: 10,
      random: keepOrder,
    });
    expect(items.map((item) => [item.voice, item.options])).toEqual([
      ["formal", ["casual", "formal", "plain"]],
      ["casual", ["casual", "formal", "plain"]],
      ["plain", ["casual", "formal", "plain"]],
    ]);
  });

  it("has nothing to show for a single voice", () => {
    expect(
      guessItems({
        outputs: [output({ caseId: "c1", voice: "formal", text: "A" })],
        groupLabel: null,
        itemLimit: 10,
        random: keepOrder,
      }),
    ).toEqual([]);
  });
});

function output({
  caseId,
  voice,
  group,
  text,
}: {
  caseId: string;
  voice: string;
  group?: string;
  text: string;
}): Output {
  return {
    caseId,
    voice,
    sample: 1,
    context: `Case ${caseId}.`,
    text,
    labels: group === undefined ? {} : { group },
  };
}
