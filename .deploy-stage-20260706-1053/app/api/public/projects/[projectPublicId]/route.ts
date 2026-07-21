import { NextRequest, NextResponse } from "next/server";
import { createApiAliasRedirect } from "@/lib/http/api-alias-redirect";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectPublicId: string }> },
) {
  const { projectPublicId } = await params;
  const target = new URL(`/api/public/project/${projectPublicId}`, req.url);
  return createApiAliasRedirect({
    target,
    aliasPath: `/api/public/projects/${projectPublicId}`,
    legacyPath: `/api/public/project/${projectPublicId}`,
  });
}
