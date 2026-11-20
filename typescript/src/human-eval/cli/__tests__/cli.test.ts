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
import { openBrowser } from "../../../local-server/open-browser.ts";
import { readOutputs } from "../../outputs/output.ts";
import type { HumanEvalProject, Speaker } from "../../project.ts";
import { runHumanEvalCli } from "../cli.ts";

vi.mock("../../../local-server/open-browser.ts", () => ({
  openBrowser: vi.fn(),
}));

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
  vi.mocked(openBrowser).mockReset();
  process.exitCode = undefined;
});

describe("runHumanEvalCli with a single speaker", () => {
  const project = projectWith({
    speakers: [{ name: "assistant", labels: {} }],
  });

  it("generates outputs for the tuning cases", async () => {
    const out = join(work, "run");
    await runHumanEvalCli(project, ["generate", "--out", out]);
    expect(process.exitCode).toBeUndefined();
    expect(logged).toEqual([`Wrote 2 outputs to ${out}.`]);
    expect(await readOutputs(out)).toEqual([
      {
        caseId: "late-train",
        speaker: "assistant",
        context: "My train was 40 minutes late.",
        text: "assistant on late-train!",
        labels: { task: "reply" },
        speakerDescription: {
          title: "assistant",
          sections: [
            {
              title: "Style",
              display: "open",
              fields: [{ name: "Tone", value: "Plain and short." }],
            },
          ],
        },
      },
      {
        caseId: "lost-keys",
        speaker: "assistant",
        context: "I lost my keys.",
        text: "assistant on lost-keys.",
        labels: { task: "reply" },
        speakerDescription: {
          title: "assistant",
          sections: [
            {
              title: "Style",
              display: "open",
              fields: [{ name: "Tone", value: "Plain and short." }],
            },
          ],
        },
      },
    ]);
  });

  it("grades a pair round on the page and prints the result", async () => {
    // With 0 every shuffle keeps its order and set A goes on the left.
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { a, b } = await generateBoth(project, 1);
    const out = join(work, "round");
    const judge = ["judge", "--kind", "pair", "--a", a, "--b", b];
    const judging = runHumanEvalCli(project, [...judge, "--out", out]);
    const url = await pageUrl(1);

    const state = (await (await fetch(`${url}round`)).json()) as {
      view: {
        items: { context: string; speakerDescription: { title: string } }[];
      };
    };
    expect(
      state.view.items.map((item) => [
        item.context,
        item.speakerDescription.title,
      ]),
    ).toEqual([
      ["My train was 40 minutes late.", "assistant"],
      ["I lost my keys.", "assistant"],
    ]);
    expect(await choose(url, { item: 1, picked: "left", reason: "" })).toBe(
      400,
    );
    expect(await choose(url, { item: 1, picked: "left", reason: "warm" })).toBe(
      200,
    );
    expect(await choose(url, { item: 2, picked: "tie", reason: "" })).toBe(200);
    await judging;

    const result = [
      "Pair round, 2 choices",
      "  A: ../a",
      "  B: ../b",
      "A won 1, B won 0, ties 1.",
      "A wins: it has more wins than B.",
      "",
      "By label (A wins / B wins / ties):",
      "  task=reply: 1 / 0 / 1",
    ].join("\n");
    expect(logged).toEqual([
      `Grade the round at ${url}`,
      "This command ends when every item has a choice.",
      result,
    ]);
    expect(
      JSON.parse(await readFile(join(out, "result.json"), "utf8")),
    ).toMatchObject({ kind: "pair", a: "../a", b: "../b", aWins: 1 });
    expect(
      JSON.parse(await readFile(join(out, "decisions.json"), "utf8")),
    ).toEqual([
      {
        item: 1,
        caseId: "late-train",
        context: "My train was 40 minutes late.",
        outputs: [
          {
            speaker: "assistant",
            a: "assistant on late-train!",
            b: "B: assistant on late-train!",
          },
        ],
        labels: { task: "reply" },
        winner: "a",
        reason: "warm",
      },
      {
        item: 2,
        caseId: "lost-keys",
        context: "I lost my keys.",
        outputs: [
          {
            speaker: "assistant",
            a: "assistant on lost-keys.",
            b: "B: assistant on lost-keys.",
          },
        ],
        labels: { task: "reply" },
        winner: "tie",
        reason: null,
      },
    ]);

    logged = [];
    await runHumanEvalCli(project, ["show", "--out", out]);
    expect(logged).toEqual([
      `This round is finished. The result is in ${join(out, "result.json")}.`,
    ]);
    await runHumanEvalCli(project, [...judge, "--out", out]);
    expect(errors.pop()).toBe(`${out} is not empty. Use a new --out folder.`);
  });

  it("refuses show while judge serves the round, naming its page", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { a, b } = await generateBoth(project, 1);
    const out = join(work, "round");
    const judging = runHumanEvalCli(project, [
      ...["judge", "--kind", "pair", "--a", a, "--b", b, "--out", out],
    ]);
    const url = await pageUrl(1);
    await choose(url, { item: 1, picked: "right", reason: "Kinder." });

    await runHumanEvalCli(project, ["show", "--out", out]);
    expect(errors).toEqual([
      `This round is already open at ${url} (process ${process.pid}). ` +
        "Use that page. If it does not open, delete serving.json in the " +
        "round folder.",
    ]);
    process.exitCode = undefined;

    await choose(url, { item: 2, picked: "right", reason: "Kinder." });
    await judging;
    expect(logged.at(-1)).toBe(
      [
        "Pair round, 2 choices",
        "  A: ../a",
        "  B: ../b",
        "A won 0, B won 2, ties 0.",
        "B wins: it has more wins than A.",
        "",
        "By label (A wins / B wins / ties):",
        "  task=reply: 0 / 2 / 0",
      ].join("\n"),
    );
    expect(await readdir(out)).not.toContain("serving.json");
  });

  it("writes a missing result when showing a finished round", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const run = join(work, "run");
    const out = join(work, "round");
    await runHumanEvalCli(project, ["generate", "--out", run]);
    const judging = runHumanEvalCli(project, [
      ...["judge", "--kind", "pair", "--a", run, "--b", run, "--out", out],
    ]);
    const url = await pageUrl(1);
    await choose(url, { item: 1, picked: "left", reason: "Same." });
    await choose(url, { item: 2, picked: "right", reason: "Same." });
    await judging;
    await rm(join(out, "result.json"));
    logged = [];
    await runHumanEvalCli(project, ["show", "--out", out]);
    expect(logged).toEqual([
      `This round is finished. The result is in ${join(out, "result.json")}.`,
    ]);
    expect(await readdir(out)).toEqual([
      "choices.json",
      "decisions.json",
      "result.json",
      "round.json",
    ]);
  });

  it("refuses a lineup in one plain line", async () => {
    const run = join(work, "run");
    await runHumanEvalCli(project, ["generate", "--out", run]);
    const out = join(work, "round");
    await runHumanEvalCli(project, [
      ...["judge", "--kind", "lineup", "--a", run, "--b", run],
      ...["--out", out],
    ]);
    expect(errors).toEqual([
      "Nothing to compare: lineup needs two or more speakers responding " +
        "to the same case; generate both sets with --num-samples 2 or more.",
    ]);
    expect(process.exitCode).toBe(1);
  });
});

describe("runHumanEvalCli with several speakers", () => {
  const speakers: Speaker[] = [
    { name: "formal", labels: { tone: "calm" } },
    { name: "casual", labels: { tone: "calm" } },
    { name: "plain", labels: { tone: "loud" } },
  ];

  it("runs a lineup round of every speaker on a case", async () => {
    // With 0 every shuffle keeps its order and set A goes on the left.
    vi.spyOn(Math, "random").mockReturnValue(0);
    const project = projectWith({ speakers });
    const { a, b } = await generateBoth(project, 3);
    const out = join(work, "round");
    const judging = runHumanEvalCli(project, [
      ...["judge", "--kind", "lineup", "--a", a, "--b", b, "--out", out],
    ]);
    const url = await pageUrl(1);
    const state = (await (await fetch(`${url}round`)).json()) as {
      view: { items: { left: { speaker: string }[] }[] };
    };
    expect(
      state.view.items.map((item) => item.left.map((one) => one.speaker)),
    ).toEqual([
      ["casual", "formal", "plain"],
      ["casual", "formal", "plain"],
    ]);
    await choose(url, { item: 1, picked: "right", reason: "Varied." });
    await choose(url, { item: 2, picked: "left", reason: "Varied." });
    await judging;
    expect(logged.at(-1)).toBe(
      [
        "Lineup round, 2 choices",
        "  A: ../a",
        "  B: ../b",
        "A won 1, B won 1, ties 0.",
        "No winner: A and B have as many wins.",
        "",
        "By label (A wins / B wins / ties):",
        "  task=reply: 1 / 1 / 0",
      ].join("\n"),
    );
  });
});

describe("runHumanEvalCli options", () => {
  const project = projectWith({
    speakers: [{ name: "assistant", labels: {} }],
  });

  it.each([
    {
      argv: ["judge", "--kind", "both", "--a", "x", "--b", "y", "--out", "z"],
      message: '--kind must be pair or lineup, not "both".',
    },
    {
      argv: [
        ...["judge", "--kind", "pair", "--a", "x", "--b", "y", "--out", "z"],
        ...["--num-questions", "0"],
      ],
      message: "--num-questions must be a whole number of 1 or more.",
    },
    {
      argv: ["generate", "--out", "z", "--num-samples", "2"],
      message: "Case late-train has too few speakers for --num-samples 2: 1.",
    },
  ])("refuses $argv in one line", async ({ argv, message }) => {
    await runHumanEvalCli(project, argv);
    expect(errors).toEqual([message]);
    expect(process.exitCode).toBe(1);
  });

  it("names a folder that holds no output set", async () => {
    const missing = join(work, "missing");
    await runHumanEvalCli(project, [
      ...["judge", "--kind", "pair", "--a", missing, "--b", missing],
      ...["--out", join(work, "round")],
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
      speakers: [{ name: "assistant", labels: {} }],
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
      "The model call for case late-train, speaker assistant failed: " +
        "Model server is not running",
    );
    expect(await readdir(work)).toEqual([]);

    await runHumanEvalCli(working, ["generate", "--out", out]);
    expect(await readdir(out)).toEqual(["outputs.jsonl"]);
  });

  it("does not start queued calls after a failure", async () => {
    let started = 0;
    const failing: HumanEvalProject = {
      ...projectWith({
        speakers: Array.from({ length: 10 }, (_, index) => ({
          name: `speaker-${index}`,
          labels: {},
        })),
      }),
      generate: () => {
        started += 1;
        return Promise.reject(new Error("Model server is not running"));
      },
    };
    await expect(
      runHumanEvalCli(failing, [
        ...["generate", "--out", join(work, "run"), "--num-samples", "10"],
      ]),
    ).rejects.toThrow("Model server is not running");
    // Four calls run at once; the other sixteen never start.
    expect(started).toBe(4);
  });

  it("refuses a folder that is not empty", async () => {
    const project = projectWith({
      speakers: [{ name: "assistant", labels: {} }],
    });
    const out = join(work, "run");
    await mkdir(out);
    await writeFile(join(out, "notes.txt"), "Keep me.");
    await runHumanEvalCli(project, ["generate", "--out", out]);
    expect(errors).toEqual([`${out} is not empty. Use a new --out folder.`]);
  });
});

// Generates output sets A and B into the work folder, leaving no log. Set
// B's texts start with "B: ".
async function generateBoth(
  project: HumanEvalProject,
  numSamples: number,
): Promise<{ a: string; b: string }> {
  const a = join(work, "a");
  const b = join(work, "b");
  const projectB: HumanEvalProject = {
    ...project,
    generate: async (input) => `B: ${await project.generate(input)}`,
  };
  const samples = ["--num-samples", String(numSamples)];
  await runHumanEvalCli(project, ["generate", "--out", a, ...samples]);
  await runHumanEvalCli(projectB, ["generate", "--out", b, ...samples]);
  logged = [];
  return { a, b };
}

// The address of the nth grading page opened in this test, counted from 1.
async function pageUrl(nth: number): Promise<string> {
  return vi.waitFor(() => {
    const call = vi.mocked(openBrowser).mock.calls[nth - 1];
    if (call === undefined) throw new Error(`Page ${nth} is not open yet.`);
    return call[0];
  });
}

// Sends one choice to the page's server and gives back the status.
async function choose(url: string, choice: unknown): Promise<number> {
  const response = await fetch(`${url}choices`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(choice),
  });
  await response.body?.cancel();
  return response.status;
}

function projectWith({ speakers }: { speakers: Speaker[] }): HumanEvalProject {
  return {
    cases: [
      {
        id: "late-train",
        context: "My train was 40 minutes late.",
        labels: { task: "reply" },
      },
      {
        id: "lost-keys",
        context: "I lost my keys.",
        labels: { task: "reply" },
      },
    ],
    speakers: () => ({ addressed: [], others: speakers }),
    generate: ({ case: testCase, speaker }) =>
      Promise.resolve(
        `${speaker.name} on ${testCase.id}` +
          (testCase.id === "late-train" ? "!" : "."),
      ),
    questions: {
      pair: "Which reply is kinder?",
      lineup: "Which side sounds more like different people?",
    },
    describeSpeaker: ({ speaker }) => ({
      title: speaker.name,
      sections: [
        {
          title: "Style",
          display: "open",
          fields: [{ name: "Tone", value: "Plain and short." }],
        },
      ],
    }),
  };
}
