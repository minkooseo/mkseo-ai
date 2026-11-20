import { describe, expect, it } from "vitest";
import { planOutputs } from "../plan.ts";
import type { HumanEvalProject } from "../../project.ts";

const project: HumanEvalProject = {
  cases: [
    { id: "c1", context: "One.", labels: { task: "reply" } },
    { id: "c2", context: "Two.", labels: { task: "post" } },
  ],
  speakers: () => ({
    addressed: [],
    others: [
      { name: "formal", labels: { tone: "calm" } },
      { name: "casual", labels: { tone: "loud" } },
      { name: "plain", labels: { tone: "calm" } },
      { name: "warm", labels: { tone: "soft" } },
    ],
  }),
  generate: () => Promise.resolve("Unused."),
  questions: { pair: "Which is better?", lineup: "Which is more varied?" },
  describeSpeaker: null,
};

describe("planOutputs", () => {
  it("draws numSamples different speakers for each case", () => {
    const tasks = planOutputs({ project, numSamples: 2 });
    expect(tasks.map((task) => [task.testCase.id, task.speaker.name])).toEqual([
      ["c1", "warm"],
      ["c1", "formal"],
      ["c2", "plain"],
      ["c2", "casual"],
    ]);
    expect(tasks[0]?.labels).toEqual({ task: "reply", tone: "soft" });
  });

  it("draws by case and name, whatever order others come in", () => {
    const { others } = project.speakers(firstCase());
    const reversed = planOutputs({
      project: {
        ...project,
        speakers: () => ({ addressed: [], others: [...others].reverse() }),
      },
      numSamples: 2,
    });
    expect(reversed.map((task) => task.speaker.name)).toEqual(
      planOutputs({ project, numSamples: 2 }).map((task) => task.speaker.name),
    );
  });

  it("keeps a smaller numSamples' speakers when it grows", () => {
    const names = (numSamples: number) =>
      planOutputs({ project, numSamples })
        .filter((task) => task.testCase.id === "c1")
        .map((task) => task.speaker.name);
    expect(names(3).slice(0, 2)).toEqual(names(2));
  });

  it("puts the addressed speakers first and draws the rest", () => {
    const tasks = planOutputs({
      project: {
        ...project,
        speakers: () => ({
          addressed: [{ name: "answered", labels: { tone: "calm" } }],
          others: [
            { name: "formal", labels: { tone: "calm" } },
            { name: "casual", labels: { tone: "loud" } },
          ],
        }),
      },
      numSamples: 2,
    });
    expect(tasks.map((task) => [task.testCase.id, task.speaker.name])).toEqual([
      ["c1", "answered"],
      ["c1", "formal"],
      ["c2", "answered"],
      ["c2", "casual"],
    ]);
  });

  it("rejects a label the case and speaker set differently", () => {
    expect(() =>
      planOutputs({
        project: {
          ...project,
          speakers: () => ({
            addressed: [{ name: "formal", labels: { task: "post" } }],
            others: [],
          }),
        },
        numSamples: 1,
      }),
    ).toThrow(
      "Case c1 sets label task to reply, but speaker formal sets it to post.",
    );
  });

  it("rejects repeated case ids", () => {
    expect(() =>
      planOutputs({
        project: { ...project, cases: [...project.cases, ...project.cases] },
        numSamples: 1,
      }),
    ).toThrow("Case ids must be unique; repeated: c1, c2.");
  });

  it.each([
    {
      change: { cases: [{ ...firstCase(), id: " " }] },
      numSamples: 1,
      message: "Case ids must not be blank.",
    },
    {
      change: {
        speakers: () => ({
          addressed: [],
          others: [{ name: "", labels: { tone: "calm" } }],
        }),
      },
      numSamples: 1,
      message: "Speaker names for case c1 must not be blank.",
    },
    {
      change: {
        speakers: () => ({
          addressed: [{ name: "formal", labels: {} }],
          others: [{ name: "formal", labels: {} }],
        }),
      },
      numSamples: 1,
      message: "Speaker names for case c1 must be unique; repeated: formal.",
    },
    {
      change: {},
      numSamples: 5,
      message: "Case c1 has too few speakers for --num-samples 5: 4.",
    },
    {
      change: {
        speakers: () => ({
          addressed: [
            { name: "formal", labels: {} },
            { name: "casual", labels: {} },
          ],
          others: [],
        }),
      },
      numSamples: 1,
      message: "Case c1 has 2 addressed speakers, more than --num-samples 1.",
    },
    {
      change: { cases: [] },
      numSamples: 1,
      message: "The project has no cases.",
    },
  ])(
    "checks the project before any call: $message",
    ({ change, numSamples, message }) => {
      expect(() =>
        planOutputs({ project: { ...project, ...change }, numSamples }),
      ).toThrow(message);
    },
  );
});

function firstCase() {
  const first = project.cases[0];
  if (first === undefined) throw new Error("The project has cases.");
  return first;
}
