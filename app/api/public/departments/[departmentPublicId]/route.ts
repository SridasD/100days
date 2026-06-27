import { NextRequest, NextResponse } from "next/server";
import { createApiAliasRedirect } from "@/lib/http/api-alias-redirect";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ departmentPublicId: string }> },
) {
  const { departmentPublicId } = await params;
  const target = new URL(
    `/api/public/department/${departmentPublicId}`,
    req.url,
  );
  return createApiAliasRedirect({
    target,
    aliasPath: `/api/public/departments/${departmentPublicId}`,
    legacyPath: `/api/public/department/${departmentPublicId}`,
  });
}
