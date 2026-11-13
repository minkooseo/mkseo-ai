import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runHumanEvalCli, type HumanEvalProject } from "@mkseo/ai/human-eval";
import { project } from "../note-summary-project.ts";

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
    const summary = (dir: string, broken: string) =>
      [
        `Wrote 2 outputs to ${dir}.`,
        "",
        "Checks (outputs that break each rule):",
        `  one-sentence: ${broken}. More than one sentence.`,
        "",
        "Overlap between voices (0 = nothing shared, 1 = the same text):",
        "  Nothing to compare: no case has two voices in the same group.",
      ].join("\n");
    expect(logged.slice(0, 2)).toEqual([
      summary(a, "2 of 2 (100%)"),
      summary(b, "0 of 2 (0%)"),
    ]);

    const judge = ["judge", "--kind", "pair", "--a", a, "--b", b];
    await runHumanEvalCli(project, [...judge, "--out", out]);
    const reply = "1 r wordy\n2 r";
    await runHumanEvalCli(project, ["choose", "--out", out, "--reply", reply]);
    const result = [
      "Pair round, 2 choices",
      "  A: ../a",
      "  B: ../b",
      "A won 0, B won 2, ties 0.",
      "Sign test p-value (ties left out): 0.500",
      "A p-value of at most 0.05 means the gap is unlikely to be luck.",
      "",
      "Tags (A wins / B wins / ties):",
      "  wordy: 0 / 1 / 0",
      "",
      "By label (A wins / B wins / ties):",
      "  none",
    ].join("\n");
    expect(logged.slice(3)).toEqual([result]);
  });
});

function fakeModel(text: string): HumanEvalProject {
  return { ...project, generate: () => Promise.resolve(text) };
}
