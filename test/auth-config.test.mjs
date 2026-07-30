import test from "node:test";
import assert from "node:assert/strict";
import { authConfig } from "../auth.config.ts";

function createRequest({
  pathname = "/api/admin/dashboard",
  method = "GET",
} = {}) {
  const cookies = new Map([["authjs.session-token", "dummy"]]);
  return {
    nextUrl: new URL(`http://localhost${pathname}`),
    method,
    headers: new Headers(),
    cookies: {
      get(name) {
        return cookies.get(name) ?? null;
      },
    },
  };
}

test("returns a JSON 403 response for unauthorized API routes", async () => {
  const response = await authConfig.callbacks.authorized({
    auth: { user: { roleId: 5 } },
    request: createRequest({ pathname: "/api/admin/dashboard" }),
  });

  assert.ok(response instanceof Response, "expected an HTTP response");
  assert.equal(response.status, 403);
  assert.match(await response.text(), /Forbidden/);
});

test("sanitizes sensitive login query parameters", async () => {
  const response = await authConfig.callbacks.authorized({
    auth: null,
    request: createRequest({
      pathname:
        "/login?loginName=seccm&password=Admin%402026&callbackUrl=%2Fofficer%2Fprojects",
    }),
  });

  assert.ok(response instanceof Response, "expected an HTTP response");
  assert.equal(response.status, 302);
  const location = response.headers.get("location");
  assert.equal(
    location,
    "http://localhost/login?callbackUrl=%2Fofficer%2Fprojects",
  );
});

test("allows OSD admin access to /api/admin/master", async () => {
  const result = await authConfig.callbacks.authorized({
    auth: { user: { roleId: 4 } },
    request: createRequest({ pathname: "/api/admin/master" }),
  });

  assert.equal(result, true);
});
