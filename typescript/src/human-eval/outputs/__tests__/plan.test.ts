import { describe, expect, it } from "vitest";
import { planOutputs } from "../plan.ts";
import type { HumanEvalProject } from "../../project.ts";

const project: HumanEvalProject = {
  cases: [
    { id: "c1", context: "One.", labels: { task: "reply" } },
    { id: "c2", context: "Two.", labels: { task: "post" } },
  ],
  speakers: () => [
    { name: "formal", labels: { tone: "calm" } },
    { name: "casual", labels: { tone: "loud" } },
  ],
  generate: () => Promise.resolve("Unused."),
  questions: { pair: "Which is better?", lineup: "Which is more varied?" },
  describeSpeaker: null,
};

describe("planOutputs", () => {
  it("makes every sample of every speaker for every case", () => {
    const tasks = planOutputs({ project, samples: 2 });
    expect(
      tasks.map((task) => [task.testCase.id, task.speaker.name, task.sample]),
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
    expect(tasks[0]?.labels).toEqual({ task: "reply", tone: "calm" });
  });

  it("rejects a label the case and speaker set differently", () => {
    expect(() =>
      planOutputs({
        project: {
          ...project,
          speakers: () => [{ name: "formal", labels: { task: "post" } }],
        },
        samples: 1,
      }),
    ).toThrow(
      "Case c1 sets label task to reply, but speaker formal sets it to post.",
    );
  });

  it("rejects repeated case ids", () => {
    expect(() =>
      planOutputs({
        project: { ...project, cases: [...project.cases, ...project.cases] },
        samples: 1,
      }),
    ).toThrow("Case ids must be unique; repeated: c1, c2.");
  });

  it.each([
    {
      change: { cases: [{ ...firstCase(), id: " " }] },
      message: "Case ids must not be blank.",
    },
    {
      change: { speakers: () => [{ name: "", labels: { tone: "calm" } }] },
      message: "Speaker names for case c1 must not be blank.",
    },
    {
      change: { speakers: () => [] },
      message: "No speaker responds to any case.",
    },
    {
      change: { cases: [] },
      message: "The project has no cases.",
    },
  ])("checks the project before any call: $message", ({ change, message }) => {
    expect(() =>
      planOutputs({
        project: { ...project, ...change },
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
