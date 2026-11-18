import { createModelClient, loadPreset } from "@mkseo/ai";
import type { HumanEvalProject } from "@mkseo/ai/human-eval";

const client = createModelClient({
  model: loadPreset("omlx"),
  fetch: globalThis.fetch,
});

// The prompt being tuned. Edit it, run generate again, then compare.
const instructions = "Summarize the note in one short sentence.";

/** One prompt, one speaker: the smallest human evaluation project. */
export const project: HumanEvalProject = {
  cases: [
    { id: "train", labels: {}, context: "Train at 9:30." },
    { id: "rent", labels: {}, context: "Rent up 5% in May." },
  ],
  speakers: () => [{ name: "summary", labels: {} }],
  generate: ({ case: note }) =>
    client.text({ instructions, prompt: note.context, maxOutputTokens: 128 }),
  questions: {
    pair: "Which summary is better?",
    lineup: "Which side sounds more like different summaries?",
  },
  describeSpeaker: null,
};
