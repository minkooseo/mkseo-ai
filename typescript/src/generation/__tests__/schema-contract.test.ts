import { createRequire } from "node:module";
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import {
  compileJsonSchema,
  schemaToPrompt,
  type SchemaContract,
} from "../schema-contract.ts";

describe("schema contract", () => {
  it("keeps mode-specific payloads exclusive for widened values", () => {
    expectTypeOf<{
      mode: "prompted";
      schemaPrompt: string;
      jsonSchema: { type: "object" };
    }>().not.toExtend<SchemaContract>();
    expectTypeOf<{
      mode: "structured";
      jsonSchema: { type: "object" };
      schemaPrompt: string;
    }>().not.toExtend<SchemaContract>();
    expectTypeOf<{
      mode: "unstructured";
      jsonSchema: { type: "object" };
    }>().not.toExtend<SchemaContract>();
    expectTypeOf<{
      mode: "unstructured";
      schemaPrompt: string;
    }>().not.toExtend<SchemaContract>();
    expectTypeOf<{
      mode: "structured-strict";
      jsonSchema: { type: "object" };
    }>().toExtend<SchemaContract>();
  });
  it("includes the native schema and descriptions in the exact prompt", () => {
    const schema = z
      .strictObject({
        summary: z.string().min(1).meta({
          description: "A concise summary of the supplied note.",
        }),
      })
      .meta({
        title: "NoteSummary",
        description: "The main point of one note.",
      });
    expect(schemaToPrompt(schema)).toBe(
      `## Output contract
Return one JSON object matching this JSON Schema.
Do not include Markdown or extra commentary.

{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "summary": {
      "type": "string",
      "minLength": 1,
      "description": "A concise summary of the supplied note."
    }
  },
  "required": [
    "summary"
  ],
  "additionalProperties": false,
  "title": "NoteSummary",
  "description": "The main point of one note."
}`,
    );
  });

  it("accepts schemas from a separate Zod runtime copy", () => {
    const other = createRequire(import.meta.url)("zod") as typeof import("zod");
    const schema = other.z.strictObject({
      answer: other.z.string().meta({ description: "Other runtime." }),
    });
    expect(compileJsonSchema(schema)).toEqual({
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        answer: { type: "string", description: "Other runtime." },
      },
      required: ["answer"],
      additionalProperties: false,
    });
  });

  it("uses the input schema before local transformations", () => {
    const schema = z.object({
      size: z
        .string()
        .transform((value) => value.length)
        .pipe(z.number()),
      count: z.number().default(3),
    });
    expect(compileJsonSchema(schema)).toEqual({
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        size: { type: "string" },
        count: { default: 3, type: "number" },
      },
      required: ["size"],
    });
  });

  it("preserves nested nullable object rules", () => {
    const schema = z.strictObject({
      item: z.strictObject({ name: z.string() }).nullable(),
    });
    expect(compileJsonSchema(schema)).toEqual({
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        item: {
          anyOf: [
            {
              type: "object",
              properties: { name: { type: "string" } },
              required: ["name"],
              additionalProperties: false,
            },
            { type: "null" },
          ],
        },
      },
      required: ["item"],
      additionalProperties: false,
    });
  });

  it.each([
    z.string(),
    z.object({ value: z.date() }),
    z.object({ value: z.bigint() }),
  ])("classifies root or unrepresentable schema failures", (schema) => {
    expect(() => schemaToPrompt(schema)).toThrow(
      expect.objectContaining({ code: "schema", attempts: 0 }),
    );
  });

  it("rejects recursive schemas without a custom traversal", () => {
    const schema = z.object({
      get child(): z.ZodType {
        return schema;
      },
    });
    expect(() => compileJsonSchema(schema)).toThrow(
      expect.objectContaining({ code: "schema", attempts: 0 }),
    );
  });
});
