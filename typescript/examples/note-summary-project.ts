import { createModelClient, loadPreset } from "@mkseo/ai";
import type { HumanEvalProject } from "@mkseo/ai/human-eval";

const client = createModelClient({
  model: loadPreset("omlx"),
  fetch: globalThis.fetch,
});

// The prompt being tuned. Edit it, run generate again, then compare.
const instructions = "Summarize the note in one short sentence.";

/** One prompt, one voice: the smallest human evaluation project. */
export const project: HumanEvalProject = {
  cases: [
    { id: "train", split: "tuning", labels: {}, context: "Train at 9:30." },
    { id: "rent", split: "tuning", labels: {}, context: "Rent up 5% in May." },
    { id: "party", split: "heldout", labels: {}, context: "Party Sat 7pm." },
  ],
  voices: () => [{ name: "summary", labels: {} }],
  generate: ({ case: note }) =>
    client.text({ instructions, prompt: note.context, maxOutputTokens: 128 }),
  checks: [
    {
      id: "one-sentence",
      description: "More than one sentence.",
      violates: (output) => /[.!?]\s+\S/.test(output.text),
    },
  ],
  groupLabel: null,
};
