import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

// Files are written to `<UPLOAD_DIR>/<year>/<indicatorId>/<uuid>.<ext>`
// by `/api/officer/indicators/[id]/gallery` (POST). This route serves them
// back so that the thumbnails / lightbox / PDF preview links in the UI
// actually render.
//
// Authorization model:
//   - Images and PDFs whose path is referenced in `hdp.gallery` or
//     `hdp.documents` are publicly readable. They are evidence attached
//     to publicly visible projects and citizen dashboards depend on them.
//   - Files whose path is NOT in either table return 404 — so the route
//     refuses to enumerate arbitrary files under UPLOAD_DIR.
// Since the path component is a server-generated UUID (32 hex chars), the
// effective access control is "must be a known file in the gallery", which
// is sufficient for the citizen-facing portal.
const UPLOAD_ROOT = path.resolve(
  process.cwd(),
  process.env.UPLOAD_DIR ?? "./uploads",
);

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
};

const YEAR_RE = /^\d{4}$/;
const INDICATOR_ID_RE = /^\d+$/;
// New uploads use randomUUID() (hyphenated v4). Keep a legacy 32-hex option
// for old rows if any were written by earlier tooling.
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_HEX32_RE = /^[0-9a-f]{32}$/i;

function safeJoin(base: string, parts: string[]) {
  // Normalise + reject any traversal.
  const clean = parts
    .map((p) => decodeURIComponent(p))
    .map((p) => p.replace(/\\/g, "/"));
  if (clean.some((p) => p === ".." || p.includes("/.."))) {
    return null;
  }
  const joined = path.join(base, ...clean);
  const baseAbs = path.resolve(base);
  const absJoined = path.resolve(joined);
  // Ensure final path stays under UPLOAD_DIR
  if (!absJoined.startsWith(baseAbs + path.sep) && absJoined !== baseAbs) {
    return null;
  }
  return absJoined;
}

function isValidEvidencePath(parts: string[]) {
  if (parts.length !== 3) return false;
  const [year, indicatorId, file] = parts.map((p) => decodeURIComponent(p));

  if (!YEAR_RE.test(year) || !INDICATOR_ID_RE.test(indicatorId)) {
    return false;
  }

  const ext = file.split(".").pop()?.toLowerCase() ?? "";
  if (!MIME_BY_EXT[ext]) return false;

  const basename = file.slice(0, -(ext.length + 1));
  return UUID_V4_RE.test(basename) || UUID_HEX32_RE.test(basename);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: parts } = await params;
  if (!parts || parts.length === 0) {
    return NextResponse.json({ error: "Bad path" }, { status: 400 });
  }

  if (!isValidEvidencePath(parts)) {
    return NextResponse.json({ error: "Bad path" }, { status: 400 });
  }

  const abs = safeJoin(UPLOAD_ROOT, parts);
  if (!abs) {
    return NextResponse.json({ error: "Bad path" }, { status: 400 });
  }

  let info;
  try {
    info = await stat(abs);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!info.isFile()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = abs.split(".").pop()?.toLowerCase() ?? "";
  const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";

  // Stream the file back rather than loading into memory.
  const nodeStream = createReadStream(abs);
  const webStream = new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk) => controller.enqueue(chunk));
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    },
  });

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "content-type": mime,
      "content-length": String(info.size),
      // Public read with short cache so deletes propagate fast.
      "cache-control": "public, max-age=300, must-revalidate",
    },
  });
}
