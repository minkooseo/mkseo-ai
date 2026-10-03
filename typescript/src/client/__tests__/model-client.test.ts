import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  createModelClient,
  loadPreset,
  type GenerateInput,
  type ModelConfig,
  type ModelFetch,
} from "../model-client.ts";

const schema = z.strictObject({ answer: z.string().min(1) });
const input = (): GenerateInput => ({
  instructions: "Answer clearly.",
  prompt: "A question.",
  maxOutputTokens: 128,
});
const completion = (content: string, reason: string): Response =>
  Response.json({
    choices: [
      {
        message: { role: "assistant", content, reasoning_content: "Ignore me" },
        finish_reason: reason,
      },
    ],
  });
const setup = (fetch: ModelFetch) =>
  createModelClient({
    model: loadPreset("omlx"),
    fetch,
  });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-03T00:00:00Z"));
  vi.spyOn(Math, "random").mockReturnValue(0.5);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("createModelClient", () => {
  it("snapshots explicit model configuration and sends exact text request", async () => {
    const model: ModelConfig = {
      provider: "lmstudio",
      name: "distinct-alias",
      baseUrl: "http://different.test:4567/v1/",
    };
    const fetch = vi
      .fn<ModelFetch>()
      .mockResolvedValue(completion("  Plain answer.  ", "stop"));
    const client = createModelClient({
      model,
      fetch,
    });
    Object.assign(model, { name: "mutated", baseUrl: "http://wrong.test/v1" });
    expect(fetch).not.toHaveBeenCalled();
    const call = input();
    expect(await client.text(call)).toBe("  Plain answer.  ");
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      "http://different.test:4567/v1/chat/completions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "distinct-alias",
          messages: [
            { role: "system", content: "Answer clearly." },
            { role: "user", content: "A question." },
          ],
          max_tokens: 128,
          stream: false,
        }),
      },
    );
  });

  it.each(["structured", "structured-strict", "prompted"] as const)(
    "validates %s objects and emits the matching wire contract",
    async (mode) => {
      const fetch = vi
        .fn<ModelFetch>()
        .mockResolvedValue(
          completion(' \n```json\n{"answer":"yes"}\n```\n ', "stop"),
        );
      expect(await setup(fetch).object({ ...input(), schema, mode })).toEqual({
        answer: "yes",
      });
      const request = fetch.mock.calls[0]?.[1];
      expect(request).toBeDefined();
      const body: unknown = JSON.parse(request?.body ?? "null");
      if (mode === "prompted") {
        expect(body).toEqual({
          model: "Jundot--gemma-4-E4B-it-oQ4e-mtp",
          messages: [
            { role: "system", content: "Answer clearly." },
            {
              role: "user",
              content: `A question.

## Output contract
Return one JSON object matching this JSON Schema.
Do not include Markdown or extra commentary.

{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "answer": {
      "type": "string",
      "minLength": 1
    }
  },
  "required": [
    "answer"
  ],
  "additionalProperties": false
}`,
            },
          ],
          max_tokens: 128,
          stream: false,
        });
      } else {
        expect(body).toEqual({
          model: "Jundot--gemma-4-E4B-it-oQ4e-mtp",
          messages: [
            { role: "system", content: "Answer clearly." },
            { role: "user", content: "A question." },
          ],
          max_tokens: 128,
          stream: false,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "output",
              schema: {
                $schema: "http://json-schema.org/draft-07/schema#",
                type: "object",
                additionalProperties: false,
                properties: { answer: { type: "string", minLength: 1 } },
                required: ["answer"],
              },
              ...(mode === "structured-strict" ? { strict: true } : {}),
            },
          },
        });
      }
    },
  );

  it("applies Zod refinements, defaults and transformations locally", async () => {
    const schema = z.object({
      answer: z
        .string()
        .refine((value) => value === "YES")
        .transform((value) => value.length),
      rank: z.literal(2),
      tag: z.string().default("automatic"),
    });
    const fetch = vi
      .fn<ModelFetch>()
      .mockResolvedValueOnce(completion('{"answer":"NO","rank":2}', "stop"))
      .mockResolvedValueOnce(completion('{"answer":"YES","rank":2}', "stop"));
    const pending = setup(fetch).object({
      ...input(),
      schema,
      mode: "structured",
    });
    await vi.runAllTimersAsync();
    const result = await pending;
    const answer: number = result.answer;
    expect(result).toEqual({ answer: 3, rank: 2, tag: "automatic" });
    expect(answer).toBe(3);
    expect(fetch).toHaveBeenCalledTimes(2);
    const body: unknown = JSON.parse(fetch.mock.calls[0]?.[1].body ?? "null");
    expect(body).toMatchObject({
      response_format: {
        json_schema: {
          schema: { properties: { answer: { type: "string" } } },
        },
      },
    });
  });

  it("does not retry programmer errors thrown by a schema transform", async () => {
    const cause = new Error("Transform implementation failed");
    const schema = z.object({
      answer: z.string().transform(() => {
        throw cause;
      }),
    });
    const fetch = vi
      .fn<ModelFetch>()
      .mockResolvedValue(completion('{"answer":"yes"}', "stop"));
    await expect(
      setup(fetch).object({ ...input(), schema, mode: "structured" }),
    ).rejects.toMatchObject({ code: "internal", attempts: 1, cause });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each([undefined, 0, 1, 2])(
    "uses one shared retry budget %s",
    async (limit) => {
      const cause = new TypeError("offline");
      const fetch = vi.fn<ModelFetch>().mockRejectedValue(cause);
      const client = setup(fetch);
      const call =
        limit === undefined
          ? client.text(input())
          : client.text(input(), limit);
      const expectation = expect(call).rejects.toMatchObject({
        code: "transport",
        attempts: (limit ?? 3) + 1,
        cause,
      });
      await vi.runAllTimersAsync();
      await expectation;
      expect(fetch).toHaveBeenCalledTimes((limit ?? 3) + 1);
    },
  );

  it("shares budget across transport, HTTP and generated-output failures", async () => {
    const fetch = vi
      .fn<ModelFetch>()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(completion('{"answer":4}', "stop"))
      .mockResolvedValueOnce(completion('{"answer":"fourth"}', "stop"));
    const pending = setup(fetch).object({
      ...input(),
      schema,
      mode: "prompted",
    });
    await vi.runAllTimersAsync();
    expect(await pending).toEqual({ answer: "fourth" });
    expect(fetch).toHaveBeenCalledTimes(4);
    const requests = fetch.mock.calls.map((call) => call[1]);
    expect(
      requests.every((request) => request.body === requests[0]?.body),
    ).toBe(true);
  });

  it.each([408, 429, 500, 502, 503, 504])("retries HTTP %i", async (status) => {
    const fetch = vi
      .fn<ModelFetch>()
      .mockResolvedValueOnce(new Response("busy", { status }))
      .mockResolvedValueOnce(completion("ok", "stop"));
    const pending = setup(fetch).text(input());
    await vi.runAllTimersAsync();
    expect(await pending).toBe("ok");
  });

  it.each([400, 401, 403, 404, 422, 501])(
    "fails HTTP %i immediately",
    async (status) => {
      const fetch = vi
        .fn<ModelFetch>()
        .mockResolvedValue(new Response("bad request", { status }));
      await expect(setup(fetch).text(input())).rejects.toMatchObject({
        code: "http",
        attempts: 1,
        status,
      });
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["2", "Sat, 03 Oct 2026 00:00:02 GMT"])(
    "honors Retry-After %s and releases the failed stream",
    async (retryAfter) => {
      const response = new Response("busy", {
        status: 429,
        headers: { "Retry-After": retryAfter },
      });
      const fetch = vi
        .fn<ModelFetch>()
        .mockResolvedValueOnce(response)
        .mockResolvedValueOnce(completion("ok", "stop"));
      const pending = setup(fetch).text(input());
      await vi.advanceTimersByTimeAsync(1999);
      expect(response.bodyUsed).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(await pending).toBe("ok");
    },
  );

  it("retries a stream read failure as transport", async () => {
    const fetch = vi
      .fn<ModelFetch>()
      .mockResolvedValueOnce(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new Error("connection reset"));
            },
          }),
        ),
      )
      .mockResolvedValueOnce(completion("recovered", "stop"));
    const pending = setup(fetch).text(input());
    await vi.runAllTimersAsync();
    expect(await pending).toBe("recovered");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("never retries a permanent HTTP status when its body fails", async () => {
    const fetch = vi.fn<ModelFetch>().mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new Error("body failed"));
          },
        }),
        { status: 401 },
      ),
    );
    await expect(setup(fetch).text(input())).rejects.toMatchObject({
      code: "http",
      status: 401,
      attempts: 1,
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("preserves strict downgrade when stream release also fails", async () => {
    const response = new Response(
      new ReadableStream({
        cancel() {
          throw new Error("release failed");
        },
      }),
      { headers: { Warning: "Strict schema enforcement is unsupported" } },
    );
    const fetch = vi.fn<ModelFetch>().mockResolvedValue(response);
    await expect(
      setup(fetch).object({
        ...input(),
        schema,
        mode: "structured-strict",
      }),
    ).rejects.toMatchObject({
      code: "unsupported-capability",
      attempts: 1,
      cause: "Strict schema enforcement is unsupported",
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("keeps the output schema fixed when the call object is mutated", async () => {
    const fetch = vi
      .fn<ModelFetch>()
      .mockResolvedValue(completion('{"answer":"yes"}', "stop"));
    const call = { ...input(), schema, mode: "prompted" as const };
    const pending = setup(fetch).object(call);
    Object.assign(call, { schema: z.strictObject({ different: z.number() }) });
    expect(await pending).toEqual({ answer: "yes" });
  });

  it.each([
    ["not json", "protocol"],
    ['{"choices":[]}', "protocol"],
    ['{"choices":[{"finish_reason":"unexpected"}]}', "protocol"],
    ['{"choices":[{"finish_reason":"length"}]}', "truncation"],
    ['{"choices":[{"finish_reason":"stop","message":{}}]}', "protocol"],
  ])("classifies permanent completion failure %s", async (body, code) => {
    const fetch = vi.fn<ModelFetch>().mockResolvedValue(new Response(body));
    await expect(setup(fetch).text(input())).rejects.toMatchObject({
      code,
      attempts: 1,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    'prefix {"answer":"yes"}',
    '```json\n{"answer":"yes"}\n``` suffix',
    '{"answer":',
    '{"answer":0}',
    '{"answer":"yes","extra":true}',
  ])("never salvages an invalid object %s", async (content) => {
    const fetch = vi
      .fn<ModelFetch>()
      .mockResolvedValue(completion(content, "stop"));
    await expect(
      setup(fetch).object(
        {
          ...input(),
          schema,
          mode: "prompted",
        },
        0,
      ),
    ).rejects.toMatchObject({ code: "output", attempts: 1 });
  });

  it("rejects an explicit strict downgrade and accepts unrelated warnings", async () => {
    const makeResponse = (warning: string) => {
      const response = completion('{"answer":"yes"}', "stop");
      response.headers.set("Warning", warning);
      return response;
    };
    const fetch = vi
      .fn<ModelFetch>()
      .mockResolvedValueOnce(
        makeResponse(
          '299 omlx "strict JSON schema enforcement unsupported; fallback"',
        ),
      )
      .mockResolvedValueOnce(makeResponse('299 server "cache is stale"'));
    const client = setup(fetch);
    await expect(
      client.object({ ...input(), schema, mode: "structured-strict" }),
    ).rejects.toMatchObject({ code: "unsupported-capability", attempts: 1 });
    expect(
      await client.object({ ...input(), schema, mode: "structured-strict" }),
    ).toEqual({ answer: "yes" });
  });

  it("classifies an explicit unsupported response format", async () => {
    const fetch = vi.fn<ModelFetch>().mockResolvedValue(
      new Response('{"error":"response_format json_schema is unsupported"}', {
        status: 400,
      }),
    );
    await expect(
      setup(fetch).object({ ...input(), schema, mode: "structured" }),
    ).rejects.toMatchObject({ code: "unsupported-capability", attempts: 1 });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("lets the backend reject an unsupported strict schema", async () => {
    const fetch = vi.fn<ModelFetch>().mockResolvedValue(
      new Response('{"error":"All object properties must be required"}', {
        status: 400,
      }),
    );
    await expect(
      setup(fetch).object({
        ...input(),
        schema: z.object({ answer: z.string().optional() }),
        mode: "structured-strict",
      }),
    ).rejects.toMatchObject({ code: "http", status: 400, attempts: 1 });
    expect(fetch).toHaveBeenCalledOnce();
    const body: unknown = JSON.parse(fetch.mock.calls[0]?.[1].body ?? "null");
    expect(body).toMatchObject({
      response_format: {
        json_schema: {
          strict: true,
          schema: {
            type: "object",
            properties: { answer: { type: "string" } },
          },
        },
      },
    });
  });

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid retry count %s before fetch",
    async (maxRetries) => {
      const fetch = vi.fn<ModelFetch>();
      await expect(
        setup(fetch).text(input(), maxRetries),
      ).rejects.toMatchObject({ code: "configuration", attempts: 0 });
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it.each([0, -1, 1.5, NaN, Infinity])(
    "rejects invalid output limit %s before fetch",
    async (maxOutputTokens) => {
      const fetch = vi.fn<ModelFetch>();
      await expect(
        setup(fetch).text({ ...input(), maxOutputTokens }),
      ).rejects.toMatchObject({ code: "configuration", attempts: 0 });
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it.each(["", "   ", "\n\t"])("rejects a blank prompt", async (prompt) => {
    const fetch = vi.fn<ModelFetch>();
    await expect(
      setup(fetch).text({ ...input(), prompt }),
    ).rejects.toMatchObject({ code: "configuration", attempts: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("preserves nonblank prompt whitespace in the request", async () => {
    const fetch = vi
      .fn<ModelFetch>()
      .mockResolvedValue(completion("ok", "stop"));
    await setup(fetch).text({ ...input(), prompt: "  A question.\n" });
    const body: unknown = JSON.parse(fetch.mock.calls[0]?.[1].body ?? "null");
    expect(body).toMatchObject({
      messages: [
        { role: "system", content: "Answer clearly." },
        { role: "user", content: "  A question.\n" },
      ],
    });
  });

  it("rejects unsupported schema before fetch", async () => {
    const fetch = vi.fn<ModelFetch>();
    await expect(
      setup(fetch).object({
        ...input(),
        schema: z.string(),
        mode: "prompted",
      }),
    ).rejects.toMatchObject({ code: "schema", attempts: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });
});
