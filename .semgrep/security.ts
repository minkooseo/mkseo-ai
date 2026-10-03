function parseModelOutput(text: string) {
  // ruleid: no-dynamic-code-typescript
  eval(text);
  // ruleid: no-dynamic-code-typescript
  globalThis.eval(text);
  // ruleid: no-dynamic-code-typescript
  new Function(text);
  // ruleid: no-dynamic-code-typescript
  Function(text);
  // ok: no-dynamic-code-typescript
  return JSON.parse(text);
}

// ruleid: require-node-certificate-verification
const insecure = { rejectUnauthorized: false };
// ok: require-node-certificate-verification
const verified = { rejectUnauthorized: true };
