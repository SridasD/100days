import { NextRequest, NextResponse } from "next/server";
import { createApiAliasRedirect } from "@/lib/http/api-alias-redirect";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sectorPublicId: string }> },
) {
  const { sectorPublicId } = await params;
  const target = new URL(
    `/api/public/sector/${sectorPublicId}/departments`,
    req.url,
  );
  return createApiAliasRedirect({
    target,
    aliasPath: `/api/public/sectors/${sectorPublicId}/departments`,
    legacyPath: `/api/public/sector/${sectorPublicId}/departments`,
  });
}
