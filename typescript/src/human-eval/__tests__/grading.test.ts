import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openBrowser } from "../../local-server/open-browser.ts";
import { gradeRound } from "../grading.ts";
import type { Round } from "../round.ts";

vi.mock("../../local-server/open-browser.ts", () => ({
  openBrowser: vi.fn(),
}));

const description = { title: "Formal", sections: [] };

const round: Round & { readonly ask: "item" } = {
  question: "Which reply is kinder?",
  ask: "item",
  items: [
    {
      context: "My train was 40 minutes late.",
      speakers: [
        {
          speaker: "formal",
          gender: "man",
          description,
          a: "That is unfortunate.",
          b: "I am sorry to hear it.",
        },
      ],
    },
    {
      context: "I lost my keys.",
      speakers: [
        {
          speaker: "formal",
          gender: "man",
          description,
          a: "Check your coat.",
          b: "Retrace your steps.",
        },
      ],
    },
  ],
};

let logged: string[];

beforeEach(() => {
  logged = [];
  vi.spyOn(console, "log").mockImplementation((line: string) => {
    logged.push(line);
  });
  // Set A goes on the left of every item.
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(openBrowser).mockReset();
});

describe("gradeRound", () => {
  it("serves the round blind and resolves with the verdicts", async () => {
    const grading = gradeRound(round);
    const url = await openedUrl();
    expect(logged).toEqual([
      `Grade the round at ${url}`,
      "The round ends when every item has a choice.",
    ]);
    const view: unknown = await (await fetch(`${url}round`)).json();
    expect(view).toMatchObject({
      question: "Which reply is kinder?",
      chosen: [],
    });
    expect(JSON.stringify(view)).not.toMatch(/"a"|"b"|leftSet/);

    expect(await send(url, { item: 1, picked: "left", reason: " " })).toEqual({
      status: 400,
      body: { error: "Write a reason for the pick." },
    });
    expect(await send(url, { item: 2, picked: "left" })).toEqual({
      status: 400,
      body: { error: "The choice is not valid." },
    });
    expect(
      await send(url, { item: 1, picked: "left", reason: "Warm." }),
    ).toEqual({ status: 200, body: { finished: false } });
    expect(await (await fetch(`${url}round`)).json()).toMatchObject({
      chosen: [1],
    });
    expect(await send(url, { item: 2, picked: "tie", reason: "" })).toEqual({
      status: 200,
      body: { finished: true },
    });

    expect(await grading).toEqual([
      { winner: "a", reason: "Warm." },
      { winner: "tie", reason: null },
    ]);
    await expect(fetch(url)).rejects.toThrow();
  });
});

describe("gradeRound with marks per speaker", () => {
  it("resolves with every speaker's verdict", async () => {
    const grading = gradeRound({ ...round, ask: "speaker" });
    const url = await openedUrl();
    expect(
      await send(url, { item: 1, picked: "left", reason: "Warm." }),
    ).toEqual({ status: 400, body: { error: "The choice is not valid." } });
    expect(
      await send(url, {
        item: 1,
        marks: [{ speaker: "formal", picked: "right", reason: "Kinder." }],
      }),
    ).toEqual({ status: 200, body: { finished: false } });
    expect(await send(url, { item: 2, marks: [] })).toEqual({
      status: 200,
      body: { finished: true },
    });
    expect(await grading).toEqual([
      [{ speaker: "formal", winner: "b", reason: "Kinder." }],
      [{ speaker: "formal", winner: "tie", reason: null }],
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
