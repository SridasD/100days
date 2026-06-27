import { NextRequest, NextResponse } from "next/server";
import { createApiAliasRedirect } from "@/lib/http/api-alias-redirect";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ districtPublicId: string }> },
) {
  const { districtPublicId } = await params;
  const target = new URL(`/api/public/district/${districtPublicId}`, req.url);
  return createApiAliasRedirect({
    target,
    aliasPath: `/api/public/districts/${districtPublicId}`,
    legacyPath: `/api/public/district/${districtPublicId}`,
  });
}
