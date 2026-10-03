import type { z } from "zod";
import { generateWithRetry } from "./retry.ts";
import type { ClientContext } from "../client/model-client.ts";
import { ModelClientError } from "../client/model-client-error.ts";
import { failure, type RequestContext } from "../client/transport.ts";
import {
  compileJsonSchema,
  schemaToPrompt,
  type GenerationMode,
  type SchemaContract,
} from "./schema-contract.ts";

export interface GenerateInput {
  /** Caller-owned instructions; e.g. 'Summarize the supplied note.'. */
  readonly instructions: string;
  /** Nonblank task input; e.g. 'The train leaves at 09:30.'. */
  readonly prompt: string;
  /** Positive safe-integer output limit; e.g. 256 tokens. */
  readonly maxOutputTokens: number;
}

export interface UnstructuredInput extends GenerateInput {
  /** Plain-text output mechanism, always 'unstructured'. */
  readonly mode: "unstructured";
}

export interface ObjectInput<S extends z.ZodType> extends GenerateInput {
  /** Runtime output contract; e.g. a strict object with a summary field. */
  readonly schema: S;
  /** Explicit output mechanism; e.g. 'prompted'. */
  readonly mode: Exclude<GenerationMode, "unstructured">;
}

interface GenerationInput<I extends GenerateInput> {
  readonly client: ClientContext;
  readonly input: I;
  readonly maxRetries: number;
}

export async function generateText({
  client,
  input,
  maxRetries,
}: GenerationInput<UnstructuredInput>): Promise<string> {
  validateInput(input);
  return generateWithRetry(
    prepareRequest({ client, input, contract: { mode: input.mode } }),
    maxRetries,
    (text) => text,
  );
}

export async function generateObject<S extends z.ZodType>({
  client,
  input,
  maxRetries,
}: GenerationInput<ObjectInput<S>>): Promise<z.output<S>> {
  validateInput(input);
  const schema = input.schema;
  const contract: SchemaContract =
    input.mode === "prompted"
      ? { mode: "prompted", schemaPrompt: schemaToPrompt(schema) }
      : { mode: input.mode, jsonSchema: compileJsonSchema(schema) };
  const request = prepareRequest({ client, input, contract });
  return generateWithRetry(request, maxRetries, (text, context) => {
    const clean = text
      .trim()
      .replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, "$1");
    let value: unknown;
    try {
      value = JSON.parse(clean);
    } catch (cause) {
      throw failure("output", "Generated object is invalid", cause, context);
    }
    const result = schema.safeParse(value);
    if (!result.success) {
      throw failure(
        "output",
        "Generated object is invalid",
        result.error,
        context,
      );
    }
    return result.data;
  });
}

interface RequestInput {
  readonly client: ClientContext;
  readonly input: GenerateInput;
  readonly contract: SchemaContract;
}

function prepareRequest({
  client,
  input,
  contract,
}: RequestInput): RequestContext {
  const prompt =
    contract.mode === "prompted"
      ? `${input.prompt}\n\n${contract.schemaPrompt}`
      : input.prompt;
  const body = {
    model: client.model.name,
    messages: [
      { role: "system", content: input.instructions },
      { role: "user", content: prompt },
    ],
    max_tokens: input.maxOutputTokens,
    stream: false,
    ...(contract.mode === "structured" || contract.mode === "structured-strict"
      ? {
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "output",
              schema: contract.jsonSchema,
              ...(contract.mode === "structured-strict"
                ? { strict: true }
                : {}),
            },
          },
        }
      : {}),
  };
  return {
    fetch: client.fetch,
    url: `${client.model.baseUrl}/chat/completions`,
    body: JSON.stringify(body),
    strict: contract.mode === "structured-strict",
  };
}

function validateInput(input: GenerateInput): void {
  if (input.prompt.trim() === "") {
    throw new ModelClientError("Prompt must be nonempty", {
      code: "configuration",
      attempts: 0,
      status: null,
      cause: null,
    });
  }
  if (
    !Number.isSafeInteger(input.maxOutputTokens) ||
    input.maxOutputTokens <= 0
  ) {
    throw new ModelClientError("Output limit must be positive", {
      code: "configuration",
      attempts: 0,
      status: null,
      cause: null,
    });
  }
}
