import presets from "./local-models.json";
import { ModelClientError } from "./model-client-error.ts";

export type ModelProvider = "omlx" | "lmstudio";

export interface ModelConfig {
  /** Local model host; e.g. 'lmstudio'. */
  readonly provider: ModelProvider;
  /** Provider model identifier; e.g. 'google/gemma-4-e4b'. */
  readonly name: string;
  /** API root; e.g. 'http://127.0.0.1:1234/v1'. */
  readonly baseUrl: string;
}

export function loadPreset(provider: ModelProvider): ModelConfig {
  if (provider !== "omlx" && provider !== "lmstudio") {
    throw new ModelClientError("Unknown model provider", {
      code: "configuration",
      attempts: 0,
      status: null,
      cause: null,
    });
  }
  return validateModelConfig(presets[provider] as ModelConfig);
}

export function validateModelConfig(model: ModelConfig): ModelConfig {
  if (model.provider !== "omlx" && model.provider !== "lmstudio") {
    throw new ModelClientError("Unknown model provider", {
      code: "configuration",
      attempts: 0,
      status: null,
      cause: null,
    });
  }
  if (model.name.trim() === "") {
    throw new ModelClientError("Model name must be nonempty", {
      code: "configuration",
      attempts: 0,
      status: null,
      cause: null,
    });
  }
  try {
    const url = new URL(model.baseUrl.trim());
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error("API root must be HTTP(S) without credentials or query");
    }
    return Object.freeze({
      provider: model.provider,
      name: model.name.trim(),
      baseUrl: url.href.replace(/\/+$/, ""),
    });
  } catch (cause) {
    throw new ModelClientError("Invalid model API root", {
      code: "configuration",
      attempts: 0,
      status: null,
      cause,
    });
  }
}
