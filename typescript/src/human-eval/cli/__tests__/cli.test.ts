import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readOutputs } from "../../outputs/output.ts";
import type { HumanEvalProject, Voice } from "../../project.ts";
import { runHumanEvalCli } from "../cli.ts";

const nothingToCompare =
  "Nothing to compare: lineup and guess need two or more voices " +
  "responding to the same case in the same group.";

const item1 = [
  "### Item 1 of 2",
  "Case:",
  "> The train is late.",
  "**Left**",
  "*assistant*",
  "> assistant on late-train!",
  "**Right**",
  "*assistant*",
  "> assistant on late-train!",
];

const item2 = [
  "### Item 2 of 2",
  "Case:",
  "> I lost my keys.",
  "**Left**",
  "*assistant*",
  "> assistant on lost-keys.",
  "**Right**",
  "*assistant*",
  "> assistant on lost-keys.",
];

const pairReplyLine = (first: number) =>
  "Reply with one line per item: the item number, then l (left is " +
  "better), r (right is better), or t (tie), then any words about " +
  `it. Example: ${first} l stiff`;

const firstPage = [...item1, ...item2, pairReplyLine(1)].join("\n\n");
const pageForItem2 = [...item2, pairReplyLine(2)].join("\n\n");

let work: string;
let logged: string[];
let errors: string[];

beforeEach(async () => {
  work = await mkdtemp(join(tmpdir(), "human-eval-"));
  logged = [];
  errors = [];
  vi.spyOn(console, "log").mockImplementation((line: string) => {
    logged.push(line);
  });
  vi.spyOn(console, "error").mockImplementation((line: string) => {
    errors.push(line);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe("runHumanEvalCli with a single voice", () => {
  const project = projectWith({
    voices: [{ name: "assistant", labels: {} }],
    groupLabel: null,
  });

  it("generates outputs; one voice has nothing to compare", async () => {
    const out = join(work, "run");
    await runHumanEvalCli(project, ["generate", "--out", out]);
    expect(process.exitCode).toBeUndefined();
    expect(logged).toEqual([
      [
        `Wrote 2 outputs to ${out}.`,
        "",
        "Checks (outputs that break each rule):",
        "  shout: 1 of 2 (50%). Has an exclamation mark.",
        "",
        "Overlap between voices (0 = nothing shared, 1 = the same text):",
        "  Nothing to compare: no case has two voices in the same group.",
      ].join("\n"),
    ]);
    expect(await readOutputs(out)).toEqual([
      {
        caseId: "late-train",
        voice: "assistant",
        sample: 1,
        context: "The train is late.",
        text: "assistant on late-train!",
        labels: { task: "reply" },
      },
      {
        caseId: "lost-keys",
        voice: "assistant",
        sample: 1,
        context: "I lost my keys.",
        text: "assistant on lost-keys.",
        labels: { task: "reply" },
      },
    ]);
  });

  it("runs a blind pair round from first page to result", async () => {
    // With 0 every shuffle keeps its order and set A goes on the left.
    vi.spyOn(Math, "random").mockReturnValue(0);
    const a = join(work, "a");
    const b = join(work, "b");
    const out = join(work, "round");
    await runHumanEvalCli(project, ["generate", "--out", a]);
    await runHumanEvalCli(project, ["generate", "--out", b]);
    logged = [];
    const judge = ["judge", "--kind", "pair", "--a", a, "--b", b];
    await runHumanEvalCli(project, [...judge, "--out", out]);
    expect(logged.splice(0)).toEqual([firstPage]);

    await runHumanEvalCli(project, [
      "choose",
      "--out",
      out,
      "--reply=1 L warm",
    ]);
    await runHumanEvalCli(project, ["show", "--out", out]);
    expect(logged.splice(0)).toEqual([pageForItem2, pageForItem2]);

    await runHumanEvalCli(project, ["choose", "--out", out, "--reply", "1 r"]);
    expect(errors.splice(0)).toEqual([
      '"1 r" does not start with an item on this page (items 2).',
    ]);

    await runHumanEvalCli(project, ["choose", "--out", out, "--reply", "2 t"]);
    await runHumanEvalCli(project, ["show", "--out", out]);
    const result = [
      "Pair round, 2 choices",
      "  A: ../a",
      "  B: ../b",
      "A won 1, B won 0, ties 1.",
      "Sign test p-value (ties left out): 1.000",
      "A p-value of at most 0.05 means the gap is unlikely to be luck.",
      "",
      "Tags (A wins / B wins / ties):",
      "  warm: 1 / 0 / 0",
      "",
      "By label (A wins / B wins / ties):",
      "  task=reply: 1 / 0 / 1",
    ].join("\n");
    expect(logged).toEqual([
      result,
      `This round is finished. The result is in ${join(out, "result.json")}.`,
    ]);
    expect(
      JSON.parse(await readFile(join(out, "result.json"), "utf8")),
    ).toMatchObject({ kind: "pair", a: "../a", b: "../b", aWins: 1 });

    await runHumanEvalCli(project, [...judge, "--out", out]);
    expect(errors.pop()).toBe(`${out} is not empty. Use a new --out folder.`);
  });

  it("writes a missing result when showing a finished round", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const run = join(work, "run");
    const out = join(work, "round");
    await runHumanEvalCli(project, ["generate", "--out", run]);
    await runHumanEvalCli(project, [
      ...["judge", "--kind", "pair", "--a", run, "--b", run, "--out", out],
    ]);
    await runHumanEvalCli(project, [
      "choose",
      "--out",
      out,
      "--reply=1 l, 2 r",
    ]);
    await rm(join(out, "result.json"));
    logged = [];
    await runHumanEvalCli(project, ["show", "--out", out]);
    expect(logged).toEqual([
      `This round is finished. The result is in ${join(out, "result.json")}.`,
    ]);
    expect(await readdir(out)).toEqual([
      "choices.json",
      "result.json",
      "round.json",
    ]);
  });

  it("takes a reply that starts with a dash when joined with =", async () => {
    const run = join(work, "run");
    const out = join(work, "round");
    await runHumanEvalCli(project, ["generate", "--out", run]);
    await runHumanEvalCli(project, [
      ...["judge", "--kind", "pair", "--a", run, "--b", run, "--out", out],
    ]);
    await runHumanEvalCli(project, ["choose", "--out", out, "--reply=-1 l"]);
    expect(errors).toEqual([
      '"-1 l" does not start with an item on this page (items 1, 2).',
    ]);
  });

  it("refuses guess in one plain line", async () => {
    const run = join(work, "run");
    await runHumanEvalCli(project, ["generate", "--out", run]);
    const out = join(work, "round");
    await runHumanEvalCli(project, ["guess", "--outputs", run, "--out", out]);
    expect(errors).toEqual([nothingToCompare]);
    expect(process.exitCode).toBe(1);
  });

  it("refuses a lineup in one plain line", async () => {
    const run = join(work, "run");
    await runHumanEvalCli(project, ["generate", "--out", run]);
    const out = join(work, "round");
    await runHumanEvalCli(project, [
      ...["judge", "--kind", "lineup", "--a", run, "--b", run],
      ...["--out", out],
    ]);
    expect(errors).toEqual([nothingToCompare]);
    expect(process.exitCode).toBe(1);
  });
});

describe("runHumanEvalCli with several voices", () => {
  const voices: Voice[] = [
    { name: "formal", labels: { group: "calm" } },
    { name: "casual", labels: { group: "calm" } },
    { name: "plain", labels: { group: "loud" } },
  ];

  it("compares voices within a group when voices are grouped", async () => {
    const out = join(work, "run");
    await runHumanEvalCli(projectWith({ voices, groupLabel: "group" }), [
      "generate",
      "--out",
      out,
    ]);
    expect(await voicePairs(out)).toEqual([["casual", "formal"]]);
  });

  it("compares all voices when voices are not grouped", async () => {
    const out = join(work, "run");
    await runHumanEvalCli(projectWith({ voices, groupLabel: null }), [
      "generate",
      "--out",
      out,
    ]);
    expect((await voicePairs(out)).sort()).toEqual([
      ["casual", "formal"],
      ["casual", "plain"],
      ["formal", "plain"],
    ]);
  });

  it("runs a lineup round within each group", async () => {
    // With 0 every shuffle keeps its order and set A goes on the left.
    vi.spyOn(Math, "random").mockReturnValue(0);
    const project = projectWith({ voices, groupLabel: "group" });
    const a = join(work, "a");
    const b = join(work, "b");
    const out = join(work, "round");
    await runHumanEvalCli(project, ["generate", "--out", a]);
    await runHumanEvalCli(project, ["generate", "--out", b]);
    logged = [];
    await runHumanEvalCli(project, [
      ...["judge", "--kind", "lineup", "--a", a, "--b", b, "--out", out],
    ]);
    await runHumanEvalCli(project, ["choose", "--out", out, "--reply=1 r"]);
    await runHumanEvalCli(project, ["choose", "--out", out, "--reply=2 l"]);
    expect(logged).toEqual([
      [
        "### Item 1 of 2",
        "Case:",
        "> The train is late.",
        "**Left**",
        "*casual*",
        "> casual on late-train!",
        "*formal*",
        "> formal on late-train!",
        "**Right**",
        "*casual*",
        "> casual on late-train!",
        "*formal*",
        "> formal on late-train!",
        "Reply with the item number, then l or r for the side that sounds " +
          "more like different people, or t (tie), then any words about " +
          "it. Example: 1 r",
      ].join("\n\n"),
      [
        "### Item 2 of 2",
        "Case:",
        "> I lost my keys.",
        "**Left**",
        "*casual*",
        "> casual on lost-keys.",
        "*formal*",
        "> formal on lost-keys.",
        "**Right**",
        "*casual*",
        "> casual on lost-keys.",
        "*formal*",
        "> formal on lost-keys.",
        "Reply with the item number, then l or r for the side that sounds " +
          "more like different people, or t (tie), then any words about " +
          "it. Example: 2 r",
      ].join("\n\n"),
      [
        "Lineup round, 2 choices",
        "  A: ../a",
        "  B: ../b",
        "A won 1, B won 1, ties 0.",
        "Sign test p-value (ties left out): 1.000",
        "A p-value of at most 0.05 means the gap is unlikely to be luck.",
        "",
        "By label (A wins / B wins / ties):",
        "  group=calm: 1 / 1 / 0",
        "  task=reply: 1 / 1 / 0",
      ].join("\n"),
    ]);
  });

  it("runs a guess round across all voices when not grouped", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const project = projectWith({ voices, groupLabel: null });
    const run = join(work, "run");
    const out = join(work, "round");
    await runHumanEvalCli(project, ["generate", "--out", run]);
    await runHumanEvalCli(project, ["guess", "--outputs", run, "--out", out]);
    logged = [];
    await runHumanEvalCli(project, [
      ...["choose", "--out", out, "--reply=1 2, 2 1, 3 3, 4 1, 5 1"],
    ]);
    await runHumanEvalCli(project, ["choose", "--out", out, "--reply=6 3"]);
    expect(logged).toEqual([
      [
        "### Item 6 of 6",
        "Case:",
        "> I lost my keys.",
        "Output:",
        "> plain on lost-keys.",
        "Which voice wrote it? 1 = casual, 2 = formal, 3 = plain",
        "Reply with one line per item: the item number, then the number " +
          "of the voice you think wrote it. Example: 6 2",
      ].join("\n\n"),
      [
        "Guess round, 6 choices on ../run",
        "Right 5 times (83%).",
        "",
        "Guesses for each real voice (real voice: guessed voice count):",
        "  casual: casual 2",
        "  formal: casual 1, formal 1",
        "  plain: plain 2",
      ].join("\n"),
    ]);
  });
});

describe("runHumanEvalCli options", () => {
  const project = projectWith({
    voices: [{ name: "assistant", labels: {} }],
    groupLabel: null,
  });

  it.each([
    {
      argv: ["judge", "--kind", "both", "--a", "x", "--b", "y", "--out", "z"],
      message: '--kind must be pair or lineup, not "both".',
    },
    {
      argv: ["generate", "--out", "z", "--split", "dev"],
      message: '--split must be tuning or heldout, not "dev".',
    },
    {
      argv: ["guess", "--outputs", "x", "--out", "z", "--items", "0"],
      message: "--items must be a whole number of 1 or more.",
    },
  ])("refuses $argv in one line", async ({ argv, message }) => {
    await runHumanEvalCli(project, argv);
    expect(errors).toEqual([message]);
    expect(process.exitCode).toBe(1);
  });

  it("names a folder that holds no output set", async () => {
    const missing = join(work, "missing");
    await runHumanEvalCli(project, [
      ...["guess", "--outputs", missing, "--out", join(work, "round")],
    ]);
    expect(errors).toEqual([`${missing} holds no output set.`]);
  });

  it("refuses an output set cut short", async () => {
    const run = join(work, "run");
    await runHumanEvalCli(project, ["generate", "--out", run]);
    const path = join(run, "outputs.jsonl");
    const text = await readFile(path, "utf8");
    await writeFile(path, text.slice(0, -1));
    await runHumanEvalCli(project, [
      ...["judge", "--kind", "pair", "--a", run, "--b", run],
      ...["--out", join(work, "round")],
    ]);
    expect(errors).toEqual([`${path} does not end with a newline.`]);
  });
});

describe("runHumanEvalCli generate", () => {
  it("stops at a failed model call and writes nothing", async () => {
    const working = projectWith({
      voices: [{ name: "assistant", labels: {} }],
      groupLabel: null,
    });
    const failing: HumanEvalProject = {
      ...working,
      generate: ({ case: testCase }) =>
        testCase.id === "late-train"
          ? Promise.reject(new Error("Model server is not running"))
          : Promise.resolve("Fine."),
    };
    const out = join(work, "run");
    await expect(
      runHumanEvalCli(failing, ["generate", "--out", out]),
    ).rejects.toThrow(
      "The model call for case late-train, voice assistant, sample 1 " +
        "failed: Model server is not running",
    );
    expect(await readdir(work)).toEqual([]);

    await runHumanEvalCli(working, ["generate", "--out", out]);
    expect(await readdir(out)).toEqual([
      "checks.json",
      "outputs.jsonl",
      "overlap.json",
    ]);
  });

  it("does not start queued calls after a failure", async () => {
    let started = 0;
    const failing: HumanEvalProject = {
      ...projectWith({
        voices: [{ name: "assistant", labels: {} }],
        groupLabel: null,
      }),
      generate: () => {
        started += 1;
        return Promise.reject(new Error("Model server is not running"));
      },
    };
    await expect(
      runHumanEvalCli(failing, [
        ...["generate", "--out", join(work, "run"), "--samples", "10"],
      ]),
    ).rejects.toThrow("Model server is not running");
    // Four calls run at once; the other sixteen never start.
    expect(started).toBe(4);
  });

  it("refuses a folder that is not empty", async () => {
    const project = projectWith({
      voices: [{ name: "assistant", labels: {} }],
      groupLabel: null,
    });
    const out = join(work, "run");
    await mkdir(out);
    await writeFile(join(out, "notes.txt"), "Keep me.");
    await runHumanEvalCli(project, ["generate", "--out", out]);
    expect(errors).toEqual([`${out} is not empty. Use a new --out folder.`]);
  });
});

function projectWith({
  voices,
  groupLabel,
}: {
  voices: Voice[];
  groupLabel: string | null;
}): HumanEvalProject {
  return {
    cases: [
      {
        id: "late-train",
        split: "tuning",
        context: "The train is late.",
        labels: { task: "reply" },
      },
      {
        id: "lost-keys",
        split: "tuning",
        context: "I lost my keys.",
        labels: { task: "reply" },
      },
      {
        id: "new-job",
        split: "heldout",
        context: "I start a new job.",
        labels: { task: "reply" },
      },
    ],
    voices: () => voices,
    generate: ({ case: testCase, voice }) =>
      Promise.resolve(
        `${voice.name} on ${testCase.id}` +
          (testCase.id === "late-train" ? "!" : "."),
      ),
    checks: [
      {
        id: "shout",
        description: "Has an exclamation mark.",
        violates: (output) => output.text.includes("!"),
      },
    ],
    groupLabel,
  };
}

async function voicePairs(out: string): Promise<string[][]> {
  const overlap = JSON.parse(
    await readFile(join(out, "overlap.json"), "utf8"),
  ) as { voicePairs: { voices: string[] }[] };
  return overlap.voicePairs.map((pair) => pair.voices);
}
