# TypeScript API verification

Verification performed on 2026-10-03. Independent package checks and integration
evidence are separate from a running model server or native device.

## Passed

- Strict TypeScript checking and all 78 generation, schema, transport, and retry
  tests. The demo is included in type checking. Contract type checks prevent
  mixing prompted, structured, and unstructured payloads.
- Python Ruff formatting/lint, Pyright, all 15 tests, wheel and source builds.
  Local presets load directly from the wheel outside the checkout.
- The repository parity check confirms that both independently shipped local
  preset catalogs agree.
- The TypeScript source tarball imports from an external consumer, loads its
  bundled preset, and returns a validated object using a mock transport.
- The demo prints plain strings and full objects and exits successfully with
  successful mock responses. A mocked strict-mode rejection goes to stderr and
  produces a nonzero exit while the later prompted example still runs.
- Love and Stride's editable uv sources and lockfiles point to the Python
  package. Fresh consumer environments import its moved source successfully.
- An isolated Expo consumer imports the linked TypeScript source and preset JSON
  in an iOS Metro bundle, with the actual Expo fetch implementation. Strict
  TypeScript checking also accepts the Expo transport.

The Expo fixture uses Expo 57.0.20, React Native 0.86.3, and Metro 0.84.6. It
links directly to this checkout's TypeScript package, includes the library
dependency roots in its Metro configuration, and requires no source copy or
compiled library output. Its transport types are compatible with the library's
request and response boundary.

## Remaining runtime evidence

- Automatic Metro refresh is unverified. Native and fallback watchers both fail
  with `EMFILE` in this host environment, including outside the sandbox. Bundle
  success does not establish that source or preset edits refresh a device.
- No device or Hermes runtime was exercised. No simulator was booted.
- The demo's watch command starts, but source and preset edits did not cause an
  observed restart in this environment, including a polling attempt. Automatic
  demo restart remains unverified.
- Neither local model server was reachable at the preset ports. Actual model
  results and backend strict enforcement have not been verified. Mock transport
  tests prove the client contract, not server capabilities.

Before adopting this API in an Expo application, verify a linked source edit and
a preset edit with the app connected to Metro. Both must appear automatically
without building, copying, reinstalling, or publishing the library. Verify all
supported output modes on the target runtime and record which installed
backend/model combinations enforce strict output.

## Reproducing package checks

Ordinary development uses the package-local commands documented in each README.
This host required fresh tool caches and a temporary Python environment because
its existing tool environments could not be updated. The combined command below
was attempted but could not start its lifecycle subprocess (`spawn EPERM`); the
checks were exercised individually instead:

```sh
UV_PROJECT_ENVIRONMENT=/private/tmp/mkseo-ai-python-env \
UV_CACHE_DIR=/private/tmp/mkseo-ai-uv-cache \
COREPACK_HOME=/private/tmp/mkseo-ai-corepack \
corepack pnpm check
```

Existing Love and Stride environments could not be resynced because directory
cleanup was denied. Fresh environments validated their lockfiles and editable
imports; their usual environments still need a successful uv sync.
