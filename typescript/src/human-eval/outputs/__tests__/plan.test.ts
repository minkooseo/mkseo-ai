import { describe, expect, it } from "vitest";
import { planOutputs } from "../plan.ts";
import type { HumanEvalProject } from "../../project.ts";

const project: HumanEvalProject = {
  cases: [
    { id: "c1", split: "tuning", context: "One.", labels: { task: "reply" } },
    { id: "c2", split: "tuning", context: "Two.", labels: { task: "post" } },
    {
      id: "c3",
      split: "heldout",
      context: "Three.",
      labels: { task: "reply" },
    },
  ],
  voices: () => [
    { name: "formal", labels: { group: "calm" } },
    { name: "casual", labels: { group: "loud" } },
  ],
  generate: () => Promise.resolve("Unused."),
  checks: [],
  groupLabel: "group",
};

describe("planOutputs", () => {
  it("makes every sample of every voice for the chosen split", () => {
    const tasks = planOutputs({
      project,
      split: "tuning",
      samples: 2,
    });
    expect(
      tasks.map((task) => [task.testCase.id, task.voice.name, task.sample]),
    ).toEqual([
      ["c1", "formal", 1],
      ["c1", "formal", 2],
      ["c1", "casual", 1],
      ["c1", "casual", 2],
      ["c2", "formal", 1],
      ["c2", "formal", 2],
      ["c2", "casual", 1],
      ["c2", "casual", 2],
    ]);
    expect(tasks[0]?.labels).toEqual({ task: "reply", group: "calm" });
  });

  it("rejects a label the case and voice set differently", () => {
    expect(() =>
      planOutputs({
        project: {
          ...project,
          voices: () => [{ name: "formal", labels: { task: "post" } }],
        },
        split: "heldout",
        samples: 1,
      }),
    ).toThrow(
      "Case c3 sets label task to reply, but voice formal sets it to post.",
    );
  });

  it("rejects repeated case ids", () => {
    expect(() =>
      planOutputs({
        project: { ...project, cases: [...project.cases, ...project.cases] },
        split: "tuning",
        samples: 1,
      }),
    ).toThrow("Case ids must be unique; repeated: c1, c2, c3.");
  });

  it.each([
    {
      change: { cases: [{ ...firstCase(), id: " " }] },
      message: "Case ids must not be blank.",
    },
    {
      change: {
        checks: [
          { id: "short", description: "Short.", violates: () => false },
          { id: "short", description: "Short.", violates: () => false },
        ],
      },
      message: "Check ids must be unique; repeated: short.",
    },
    {
      change: { voices: () => [{ name: "", labels: { group: "calm" } }] },
      message: "Voice names for case c1 must not be blank.",
    },
    {
      change: { voices: () => [{ name: "formal", labels: {} }] },
      message: 'Voice formal on case c1 has no "group" label.',
    },
    {
      change: { voices: () => [] },
      message: "No voice responds to any tuning case.",
    },
    {
      change: { cases: [{ ...firstCase(), split: "heldout" as const }] },
      message: "No case is in the tuning split.",
    },
  ])("checks the project before any call: $message", ({ change, message }) => {
    expect(() =>
      planOutputs({
        project: { ...project, ...change },
        split: "tuning",
        samples: 1,
      }),
    ).toThrow(message);
  });
});

function firstCase() {
  const first = project.cases[0];
  if (first === undefined) throw new Error("The project has cases.");
  return first;
}
