import test from "node:test";
import assert from "node:assert/strict";
import nextConfig from "../next.config.mjs";

test("CSP supports runtime while keeping core restrictions", async () => {
  const headers = await nextConfig.headers();
  const cspHeader = headers[0].headers.find(
    (header) => header.key === "Content-Security-Policy",
  )?.value;

  assert.ok(cspHeader, "Expected a CSP header to be present");
  assert.match(cspHeader, /script-src 'self' 'unsafe-inline'/);
  assert.match(
    cspHeader,
    /style-src 'self' 'unsafe-inline' https:\/\/fonts.googleapis.com/,
  );
  assert.match(cspHeader, /object-src 'none'/);

  if (process.env.NODE_ENV === "production") {
    assert.doesNotMatch(cspHeader, /script-src .*'unsafe-eval'/);
  }
});
