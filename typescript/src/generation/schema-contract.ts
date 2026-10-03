import { z } from "zod";
import { ModelClientError } from "../client/model-client-error.ts";

export type SchemaContract =
  | {
      readonly mode: "unstructured";
      readonly jsonSchema?: never;
      readonly schemaPrompt?: never;
    }
  | {
      readonly mode: "prompted";
      readonly schemaPrompt: string;
      readonly jsonSchema?: never;
    }
  | {
      readonly mode: "structured";
      readonly jsonSchema: z.core.JSONSchema.JSONSchema;
      readonly schemaPrompt?: never;
    }
  | {
      readonly mode: "structured-strict";
      readonly jsonSchema: z.core.JSONSchema.JSONSchema;
      readonly schemaPrompt?: never;
    };

export type GenerationMode = SchemaContract["mode"];

export function compileJsonSchema(
  schema: z.ZodType,
): z.core.JSONSchema.JSONSchema {
  try {
    const jsonSchema = z.toJSONSchema(schema, {
      io: "input",
      target: "draft-07",
      cycles: "throw",
    });
    if (jsonSchema.type !== "object") {
      throw new Error("Output schema must have an object root");
    }
    return jsonSchema;
  } catch (cause) {
    throw new ModelClientError("Unsupported output schema", {
      code: "schema",
      attempts: 0,
      status: null,
      cause,
    });
  }
}

export function schemaToPrompt(schema: z.ZodType): string {
  return [
    "## Output contract",
    "Return one JSON object matching this JSON Schema.",
    "Do not include Markdown or extra commentary.",
    "",
    JSON.stringify(compileJsonSchema(schema), null, 2),
  ].join("\n");
}
