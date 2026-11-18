import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Output } from "../../project.ts";
import { matchSets, readOutputs } from "../output.ts";

describe("readOutputs", () => {
  it("rejects an empty output set", async () => {
    const dir = await mkdtemp(join(tmpdir(), "human-eval-"));
    const path = join(dir, "outputs.jsonl");
    await writeFile(path, "");
    await expect(readOutputs(dir)).rejects.toThrow(`${path} holds no outputs.`);
  });
});

describe("matchSets", () => {
  it("matches outputs whose speaker descriptions differ", () => {
    const a = output({ speaker: "formal", text: "A" });
    const b = output({ speaker: "formal", text: "B" });
    expect(matchSets([a], [b])(a)).toBe(b);
  });

  it("lists every output that is missing or differs", () => {
    expect(() =>
      matchSets(
        [
          output({ speaker: "formal", text: "A" }),
          output({ speaker: "casual", text: "A" }),
        ],
        [
          { ...output({ speaker: "formal", text: "B" }), context: "Other." },
          output({ speaker: "plain", text: "B" }),
        ],
      ),
    ).toThrow(
      "Output sets A and B must hold the same cases, speakers, and samples:\n" +
        "  different case text or labels: late-train / formal / 1\n" +
        "  only in A: late-train / casual / 1\n" +
        "  only in B: late-train / plain / 1",
    );
  });

  it("rejects a repeated output", () => {
    const one = output({ speaker: "formal", text: "A" });
    expect(() => matchSets([one, one], [one])).toThrow(
      "Output late-train / formal / 1 appears twice.",
    );
  });
});

function output({ speaker, text }: { speaker: string; text: string }): Output {
  return {
    caseId: "late-train",
    speaker,
    sample: 1,
    context: "The train is late.",
    text,
    labels: { task: "reply" },
    speakerDescription: `${speaker}, as of set ${text}.`,
  };
}
