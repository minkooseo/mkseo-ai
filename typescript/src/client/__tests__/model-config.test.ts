import { describe, expect, it } from "vitest";
import { createModelClient, loadPreset } from "../model-client.ts";

describe("loadPreset", () => {
  it("supplies complete reusable local provider selections", () => {
    expect(loadPreset("omlx")).toEqual({
      provider: "omlx",
      name: "Jundot--gemma-4-E4B-it-oQ4e-mtp",
      baseUrl: "http://127.0.0.1:8000/v1",
    });
    expect(loadPreset("lmstudio")).toEqual({
      provider: "lmstudio",
      name: "google/gemma-4-e4b",
      baseUrl: "http://127.0.0.1:1234/v1",
    });
  });

  it.each([
    { ...loadPreset("omlx"), name: " " },
    { ...loadPreset("omlx"), baseUrl: "file:///tmp/model" },
    { ...loadPreset("omlx"), baseUrl: "ftp://model.test/v1" },
    { ...loadPreset("omlx"), baseUrl: "not a URL" },
    { ...loadPreset("omlx"), baseUrl: "http://user:secret@model.test/v1" },
    { ...loadPreset("omlx"), baseUrl: "http://model.test/v1?key=value" },
    { ...loadPreset("omlx"), baseUrl: "http://model.test/v1#fragment" },
  ])("validates custom configuration before transport", (model) => {
    expect(() =>
      createModelClient({
        model,
        fetch: globalThis.fetch,
      }),
    ).toThrow(
      expect.objectContaining({
        code: "configuration",
        attempts: 0,
      }),
    );
  });
});
