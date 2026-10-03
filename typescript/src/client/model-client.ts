import type { z } from "zod";
import {
  generateObject,
  generateText,
  type GenerateInput,
  type ObjectInput,
} from "../generation/generation.ts";
import { validateModelConfig, type ModelConfig } from "./model-config.ts";
import type { ModelFetch } from "./transport.ts";

export { loadPreset } from "./model-config.ts";
export type { ModelConfig, ModelProvider } from "./model-config.ts";
export { ModelClientError } from "./model-client-error.ts";
export type { ModelClientErrorCode } from "./model-client-error.ts";
export type { GenerationMode } from "../generation/schema-contract.ts";
export type { GenerateInput, ObjectInput } from "../generation/generation.ts";
export type { ModelFetch } from "./transport.ts";
export { ConcurrencyGate } from "../generation/concurrency-gate.ts";

export interface ModelClientOptions {
  /** Fixed model selection; e.g. loadPreset('omlx'). */
  readonly model: ModelConfig;
  /** Runtime HTTP transport; e.g. globalThis.fetch or Expo fetch. */
  readonly fetch: ModelFetch;
}

export interface ClientContext {
  /** Validated model snapshot; e.g. the bundled oMLX selection. */
  readonly model: ModelConfig;
  /** Runtime HTTP transport; e.g. Expo fetch. */
  readonly fetch: ModelFetch;
}

export function createModelClient(options: ModelClientOptions) {
  const client: ClientContext = {
    model: validateModelConfig(options.model),
    fetch: options.fetch,
  };
  return {
    text(input: GenerateInput, maxRetries = 3): Promise<string> {
      return generateText({
        client,
        input: { ...input, mode: "unstructured" },
        maxRetries,
      });
    },
    object<S extends z.ZodType>(
      input: ObjectInput<S>,
      maxRetries = 3,
    ): Promise<z.output<S>> {
      return generateObject({ client, input, maxRetries });
    },
  };
}

export type ModelClient = ReturnType<typeof createModelClient>;
