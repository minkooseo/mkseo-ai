const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const pythonPresets = JSON.parse(
  readFileSync(
    resolve(__dirname, "../python/src/mkseo_ai/presets/local-models.json"),
    "utf8",
  ),
);
const typescriptPresets = JSON.parse(
  readFileSync(
    resolve(__dirname, "../typescript/src/client/local-models.json"),
    "utf8",
  ),
);

assert.deepEqual(
  pythonPresets,
  typescriptPresets,
  "Local model presets differ between the Python and TypeScript packages",
);
