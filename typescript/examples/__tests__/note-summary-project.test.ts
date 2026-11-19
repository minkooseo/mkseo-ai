import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runHumanEvalCli, type HumanEvalProject } from "@mkseo/ai/human-eval";
import { openBrowser } from "../../src/local-server/open-browser.ts";
import { project } from "../note-summary-project.ts";

vi.mock("../../src/local-server/open-browser.ts", () => ({
  openBrowser: vi.fn(),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("note summary project", () => {
  it("runs generate and a blind round with a fake model", async () => {
    const logged: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line: string) => {
      logged.push(line);
    });
    // With 0 set A always goes on the left.
    vi.spyOn(Math, "random").mockReturnValue(0);
    const work = await mkdtemp(join(tmpdir(), "note-summary-"));
    const a = join(work, "a");
    const b = join(work, "b");
    const out = join(work, "round");

    await runHumanEvalCli(fakeModel("Meet at 9:15. Train at 9:30."), [
      ...["generate", "--out", a],
    ]);
    await runHumanEvalCli(fakeModel("Meet at 9:15 for the 9:30 train."), [
      ...["generate", "--out", b],
    ]);
    expect(logged.slice(0, 2)).toEqual([
      `Wrote 2 outputs to ${a}.`,
      `Wrote 2 outputs to ${b}.`,
    ]);

    const judge = ["judge", "--kind", "pair", "--a", a, "--b", b];
    const judging = runHumanEvalCli(project, [...judge, "--out", out]);
    const url = await vi.waitFor(() => {
      const [call] = vi.mocked(openBrowser).mock.calls;
      if (call === undefined) throw new Error("The page is not open yet.");
      return call[0];
    });
    for (const [item, reason] of [
      [1, "wordy"],
      [2, "clearer"],
    ] as const) {
      await fetch(`${url}choices`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ item, picked: "right", reason }),
      });
    }
    await judging;
    const result = [
      "Pair round, 2 choices",
      "  A: ../a",
      "  B: ../b",
      "A won 0, B won 2, ties 0.",
      "B wins: it has more wins than A.",
      "",
      "By label (A wins / B wins / ties):",
      "  none",
    ].join("\n");
    expect(logged.at(-1)).toBe(result);
  });
});

function fakeModel(text: string): HumanEvalProject {
  return { ...project, generate: () => Promise.resolve(text) };
}
