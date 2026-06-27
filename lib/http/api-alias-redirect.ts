import { NextResponse } from "next/server";

const LEGACY_ALIAS_SUNSET = "Wed, 31 Dec 2026 23:59:59 GMT";

interface AliasRedirectOptions {
  target: URL;
  aliasPath: string;
  legacyPath: string;
}

export function createApiAliasRedirect({
  target,
  aliasPath,
  legacyPath,
}: AliasRedirectOptions) {
  const response = NextResponse.redirect(target, 307);
  response.headers.set("Deprecation", "true");
  response.headers.set("Sunset", LEGACY_ALIAS_SUNSET);
  response.headers.set("Link", `<${target.pathname}>; rel=\"canonical\"`);
  response.headers.set("X-Alias-Redirect", "true");
  response.headers.set("X-Alias-Source", aliasPath);
  response.headers.set("X-Legacy-Handler", legacyPath);
  return response;
}
