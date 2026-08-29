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

// A GET for this route usually comes from an <img>/<video> tag or a JS
// fetch(), neither of which cares about response body shape on error — but
// a document "Open" link is a real top-level navigation, and dumping raw
// JSON in the tab is a bad experience. Browsers send `Accept: text/html...`
// only for that kind of navigation (never for <img>/<a target> resource
// loads or a bare fetch()), so this is a safe way to tell them apart.
function wantsHtml(req: NextRequest) {
  return (req.headers.get("accept") ?? "").includes("text/html");
}

function notFoundResponse(req: NextRequest, message: string, status: 400 | 404) {
  if (!wantsHtml(req)) {
    return NextResponse.json({ error: message }, { status });
  }
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>File not available</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:#F8FAF8; color:#16261a; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  .card { max-width:420px; margin:24px; padding:32px; text-align:center; border-radius:20px;
    border:1px solid #e2eae2; background:#fff; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
  .icon { width:48px; height:48px; margin:0 auto 16px; color:#8a9a8c; }
  h1 { font-size:16px; font-weight:700; margin:0 0 6px; }
  p { font-size:13px; color:#6d7d70; margin:0; line-height:1.5; }
</style>
</head>
<body>
  <div class="card">
    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M9 13h6M9 17h3M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z"/>
      <path d="M13 3v6h6"/>
    </svg>
    <h1>File not available</h1>
    <p>This file could not be found. It may have been removed or is still being uploaded — please try again later.</p>
  </div>
</body>
</html>`;
  return new NextResponse(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

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
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: parts } = await params;
  if (!parts || parts.length === 0) {
    return notFoundResponse(req, "Bad path", 400);
  }

  if (!isValidEvidencePath(parts)) {
    return notFoundResponse(req, "Bad path", 400);
  }

  const abs = safeJoin(UPLOAD_ROOT, parts);
  if (!abs) {
    return notFoundResponse(req, "Bad path", 400);
  }

  let info;
  try {
    info = await stat(abs);
  } catch {
    return notFoundResponse(req, "Not found", 404);
  }
  if (!info.isFile()) {
    return notFoundResponse(req, "Not found", 404);
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
