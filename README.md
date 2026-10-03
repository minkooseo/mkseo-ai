# mkseo-ai

Independent Python and TypeScript packages for configured model access.

- [Python](python/README.md): PydanticAI provider configuration and evaluation
  records, managed with uv.
- [TypeScript](typescript/README.md): text and validated object generation for
  oMLX and LM Studio, managed with pnpm.
- [Product overview](prd/overview.md): capabilities and responsibility map.

Each language package owns its dependencies, runtime, tests, and distribution.
The repository root supplies Prettier, Husky, and a combined quality gate:

```sh
pnpm install
pnpm check
```

Run the TypeScript example from either the repository root or `typescript/`:

```sh
pnpm demo-typescript
```

Local model presets ship independently in both packages. The root gate checks
that their contents match; neither runtime reads the other package's files.

## Editable consumers

Clone this repository beside the consuming application. A Python application
under a sibling project's `server/` directory uses:

```toml
[tool.uv.sources]
mkseo-ai = { path = "../../mkseo-ai/python", editable = true }
```

A TypeScript application under a sibling project's `app/` directory uses:

```json
{
  "dependencies": {
    "@mkseo/ai": "link:../../mkseo-ai/typescript"
  }
}
```

Install each package's dependencies before running its consumers. Python source
edits take effect after restarting the consumer. TypeScript exports source for
Node with `tsx` and Expo with Metro. Metro must watch the linked package and
resolve its dependencies. Source and preset edits refresh connected apps without
building, copying, reinstalling, or publishing the library.
