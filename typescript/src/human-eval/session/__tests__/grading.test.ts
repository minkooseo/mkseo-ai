import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openBrowser } from "../../../local-server/open-browser.ts";
import type { SpeakerDescription } from "../../project.ts";
import type { Round } from "../../round/round.ts";
import { startSession } from "../files.ts";
import { gradeRound } from "../grading.ts";

vi.mock("../../../local-server/open-browser.ts", () => ({
  openBrowser: vi.fn(),
}));

const description: SpeakerDescription = {
  title: "Formal",
  sections: [
    {
      title: "Style",
      display: "open",
      fields: [{ name: "Tone", value: "Short sentences, no slang." }],
    },
  ],
};

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
      speakerDescription: description,
      leftSet: "a",
      left: [{ speaker: "formal", text: "That is unfortunate." }],
      right: [{ speaker: "formal", text: "I am sorry to hear it." }],
    },
    {
      caseId: "lost-keys",
      sample: 1,
      context: "I lost my keys.",
      labels: { task: "reply" },
      speakerDescription: description,
      leftSet: "b",
      left: [{ speaker: "formal", text: "Check your coat." }],
      right: [{ speaker: "formal", text: "Retrace your steps." }],
    },
  ],
};

let dir: string;
let logged: string[];

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "grading-"));
  logged = [];
  vi.spyOn(console, "log").mockImplementation((line: string) => {
    logged.push(line);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(openBrowser).mockReset();
});

describe("gradeRound", () => {
  it("records picks and resolves with the result", async () => {
    await startSession(dir, round);
    const grading = gradeRound(dir);
    const url = await openedUrl();
    expect(logged).toEqual([
      `Grade the round at ${url}`,
      "This command ends when every item has a choice.",
    ]);

    const state: unknown = await (await fetch(`${url}round`)).json();
    expect(state).toMatchObject({
      chosen: [],
      view: { kind: "pair", question: "Which reply is kinder?" },
    });
    expect(JSON.stringify(state)).not.toContain("leftSet");

    expect(await send(url, { item: 1, picked: "left", reason: " " })).toEqual({
      status: 400,
      body: { error: "Write a reason for the pick." },
    });
    expect(await savedChoices()).toEqual([]);

    expect(
      await send(url, { item: 1, picked: "left", reason: "Warm. " }),
    ).toEqual({ status: 200, body: { finished: false } });
    expect(await savedChoices()).toEqual([
      { item: 1, picked: "left", reason: "Warm. " },
    ]);
    expect(
      await send(url, { item: 1, picked: "tie", reason: "Same." }),
    ).toEqual({ status: 400, body: { error: "Item 1 already has a choice." } });
    expect(await send(url, { item: 2, picked: "left" })).toEqual({
      status: 400,
      body: { error: "The choice is not valid." },
    });

    expect(await send(url, { item: 2, picked: "tie", reason: " " })).toEqual({
      status: 200,
      body: { finished: true },
    });
    expect(await savedChoices()).toEqual([
      { item: 1, picked: "left", reason: "Warm. " },
      { item: 2, picked: "tie", reason: null },
    ]);
    const result = await grading;
    // Item 1 has set A on the left, so A wins it.
    expect(result).toMatchObject({
      choiceCount: 2,
      aWins: 1,
      bWins: 0,
      ties: 1,
      winner: "a",
    });
    expect(
      JSON.parse(await readFile(join(dir, "result.json"), "utf8")),
    ).toEqual(result);
    await expect(fetch(url)).rejects.toThrow();
  });

  it("resumes a round from the choices saved earlier", async () => {
    await startSession(dir, round);
    await writeFile(
      join(dir, "choices.json"),
      JSON.stringify([{ item: 2, picked: "tie", reason: "Same." }]),
    );
    const grading = gradeRound(dir);
    const url = await openedUrl();
    expect(await (await fetch(`${url}round`)).json()).toMatchObject({
      chosen: [2],
    });
    expect(
      await send(url, { item: 1, picked: "right", reason: "Kinder." }),
    ).toEqual({ status: 200, body: { finished: true } });
    expect(await grading).toMatchObject({ aWins: 0, bWins: 1, ties: 1 });
    expect(await savedChoices()).toEqual([
      { item: 2, picked: "tie", reason: "Same." },
      { item: 1, picked: "right", reason: "Kinder." },
    ]);
  });

  it("replaces a serving mark left by a process that has ended", async () => {
    await startSession(dir, round);
    // No process has this id, so the mark is stale.
    await writeFile(
      join(dir, "serving.json"),
      JSON.stringify({ pid: 999_999, url: "http://127.0.0.1:1/" }),
    );
    const grading = gradeRound(dir);
    const url = await openedUrl();
    expect(
      JSON.parse(await readFile(join(dir, "serving.json"), "utf8")),
    ).toEqual({ pid: process.pid, url });
    await send(url, { item: 1, picked: "left", reason: "Warm." });
    await send(url, { item: 2, picked: "tie", reason: "Same." });
    await grading;
    expect(await readdir(dir)).toEqual([
      "choices.json",
      "decisions.json",
      "result.json",
      "round.json",
    ]);
  });
});

async function openedUrl(): Promise<string> {
  return vi.waitFor(() => {
    const [call] = vi.mocked(openBrowser).mock.calls;
    if (call === undefined) throw new Error("The page is not open yet.");
    return call[0];
  });
}

async function send(
  url: string,
  choice: unknown,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${url}choices`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(choice),
  });
  return { status: response.status, body: await response.json() };
}

async function savedChoices(): Promise<unknown> {
  return JSON.parse(await readFile(join(dir, "choices.json"), "utf8"));
}
