import { createModelClient, loadPreset } from "@mkseo/ai";
import { z } from "zod";

const noteSchema = z
  .strictObject({
    summary: z.string().min(1).meta({
      description: "A concise summary of the supplied note.",
    }),
  })
  .meta({
    title: "NoteSummary",
    description: "The main point of one note.",
  });

// Change only the preset to "lmstudio" to use the other local server.
const client = createModelClient({
  model: loadPreset("omlx"),
  fetch: globalThis.fetch,
});

const input = {
  instructions: "Summarize accurately.",
  prompt: "The train leaves at 09:30. Meet at the station at 09:15.",
  maxOutputTokens: 256,
};

async function show(title: string, run: () => Promise<unknown>): Promise<void> {
  console.log(`\n* ${title}`);
  console.log("Input:");
  console.log(JSON.stringify(input, null, 2));
  try {
    const output = await run();
    console.log("Output:");
    console.log(
      typeof output === "string" ? output : JSON.stringify(output, null, 2),
    );
  } catch (error) {
    console.error(`${title} error:`, error);
    process.exitCode = 1;
  }
}

await show("Unstructured: plain string", async () => {
  const text: string = await client.text(input);
  return text;
});

await show("Structured", () =>
  client.object({
    ...input,
    schema: noteSchema,
    mode: "structured",
  }),
);

await show("Structured strict", () =>
  client.object({
    ...input,
    schema: noteSchema,
    mode: "structured-strict",
  }),
);

await show("Prompted", () =>
  client.object({
    ...input,
    schema: noteSchema,
    mode: "prompted",
  }),
);
