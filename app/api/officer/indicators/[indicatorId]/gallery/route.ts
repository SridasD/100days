import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { isSession, requireOfficerSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { listGallery, officerOwnsIndicator } from "@/lib/db/queries/officer";
import { writeAudit } from "@/lib/audit/writeAudit";
import { AUDIT_ACTIONS } from "@/lib/db/schema/audit";

export const runtime = "nodejs";

const UPLOAD_ROOT = path.resolve(
  process.cwd(),
  process.env.UPLOAD_DIR ?? "./uploads",
);
const MAX_SIZE_BYTES = (Number(process.env.MAX_UPLOAD_MB) || 5) * 1024 * 1024;

const IMG_EXTS = new Set(["jpg", "jpeg", "png"]);
const DOC_EXTS = new Set(["pdf"]);

// ---------------------------------------------------------------------------
// GET — list gallery items for an indicator
// ---------------------------------------------------------------------------
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ indicatorId: string }> },
) {
  const sessionOrResponse = await requireOfficerSession();
  if (!isSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse;

  const { indicatorId } = await params;
  const id = Number(indicatorId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid indicatorId" }, { status: 400 });
  }

  const owns = await officerOwnsIndicator(id, session.secId);
  if (!owns) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const typeParam = req.nextUrl.searchParams.get("type");
  const galleryType = typeParam === "1" ? 1 : typeParam === "2" ? 2 : undefined;

  const rows = await listGallery(id, galleryType);
  return NextResponse.json({
    items: rows.map((r) => ({
      galleryId: r.gallery_id,
      indicatorId: r.indicator_id,
      galleryType: r.gallery_type,
      imagePath: r.image_path,
      description: r.description,
      uploadedOn: r.uploaded_on,
      isVerified: r.is_verified,
    })),
  });
}

// ---------------------------------------------------------------------------
// POST — upload file (multipart) OR embed video URL (JSON)
// ---------------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ indicatorId: string }> },
) {
  const sessionOrResponse = await requireOfficerSession();
  if (!isSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse;

  const { indicatorId } = await params;
  const id = Number(indicatorId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid indicatorId" }, { status: 400 });
  }

  const owns = await officerOwnsIndicator(id, session.secId);
  if (!owns) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.startsWith("multipart/form-data")) {
    return handleFileUpload(req, id, session.userId, session.secId);
  }

  // Otherwise treat as JSON video embed request
  return handleVideoEmbed(req, id, session.userId, session.secId);
}

// ---------------------------------------------------------------------------
// File upload (image or document)
// ---------------------------------------------------------------------------
async function handleFileUpload(
  req: NextRequest,
  indicatorId: number,
  userId: number,
  secId: number,
) {
  const form = await req.formData();
  const file = form.get("file");
  const description = String(form.get("description") ?? "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const isImage = IMG_EXTS.has(ext);
  const isDoc = DOC_EXTS.has(ext);
  if (!isImage && !isDoc) {
    return NextResponse.json(
      { error: `Unsupported file type .${ext}` },
      { status: 415 },
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File size exceeds 5MB limit." },
      { status: 413 },
    );
  }

  // Save file to disk — UPLOAD_DIR/<year>/<indicatorId>/<uuid>.<ext>
  const year = new Date().getFullYear();
  const dir = path.join(UPLOAD_ROOT, String(year), String(indicatorId));
  await mkdir(dir, { recursive: true });
  const safeName = `${randomUUID()}.${ext}`;
  const absPath = path.join(dir, safeName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absPath, buffer);

  // Store relative path so it can be served behind a download/route handler.
  const relPath = path.posix.join(String(year), String(indicatorId), safeName);

  try {
    if (isImage) {
      // gallery_type = 1 (image)
      const inserted = await db.execute(sql`
        INSERT INTO hdp.gallery
          (indicator_id, gallery_type, image_path, description,
           uploaded_by, uploaded_on, is_verified)
        VALUES
          (${indicatorId}, 1, ${relPath}, ${description || null},
           ${userId}, now(), false)
        RETURNING gallery_id, indicator_id, gallery_type, image_path,
                  description, uploaded_on, is_verified
      `);
      const row = inserted.rows[0] as {
        gallery_id: number;
        indicator_id: number;
        gallery_type: number;
        image_path: string;
        description: string | null;
        uploaded_on: string;
        is_verified: boolean | null;
      };

      await writeAudit({
        userId,
        action: AUDIT_ACTIONS.MEDIA_UPLOADED,
        entity: "gallery",
        entityId: row.gallery_id,
        request: req,
        secId,
        meta: {
          indicatorId,
          kind: "image",
          filename: file.name,
          size: file.size,
          requires_reverification: true,
        },
      });

      await db.execute(sql`
        UPDATE hdp.indicators
        SET submitted_by = ${userId}, submitted_date = now()
        WHERE indicator_id = ${indicatorId}
      `);

      return NextResponse.json(
        {
          item: {
            galleryId: row.gallery_id,
            indicatorId: row.indicator_id,
            galleryType: 1,
            imagePath: row.image_path,
            description: row.description,
            uploadedOn: row.uploaded_on,
            isVerified: row.is_verified,
          },
        },
        { status: 201 },
      );
    }

    // PDF → hdp.documents
    const inserted = await db.execute(sql`
      INSERT INTO hdp.documents
        (indicator_id, document_path, description, uploaded_by, uploaded_on)
      VALUES
        (${indicatorId}, ${relPath}, ${description || null}, ${userId}, now())
      RETURNING document_id, indicator_id, document_path, description, uploaded_on
    `);
    const row = inserted.rows[0] as {
      document_id: number;
      indicator_id: number;
      document_path: string;
      description: string | null;
      uploaded_on: string;
    };

    await writeAudit({
      userId,
      action: AUDIT_ACTIONS.MEDIA_UPLOADED,
      entity: "documents",
      entityId: row.document_id,
      request: req,
      secId,
      meta: {
        indicatorId,
        kind: "document",
        filename: file.name,
        size: file.size,
        requires_reverification: true,
      },
    });

    await db.execute(sql`
      UPDATE hdp.indicators
      SET submitted_by = ${userId}, submitted_date = now()
      WHERE indicator_id = ${indicatorId}
    `);

    return NextResponse.json(
      {
        item: {
          documentId: row.document_id,
          indicatorId: row.indicator_id,
          filename: file.name,
          path: row.document_path,
          description: row.description,
          uploadedOn: row.uploaded_on,
          size: file.size,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    // Roll back the on-disk file if DB insert failed
    try {
      await unlink(absPath);
    } catch {
      /* swallow */
    }
    console.error("Gallery file upload failed", err);
    return NextResponse.json(
      { error: "Failed to save upload" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Video embed (JSON body { url: string })
// ---------------------------------------------------------------------------
const YT_PATTERNS = [
  /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
];
const FB_PATTERN =
  /(?:facebook\.com\/(?:[A-Za-z0-9.\-_]+\/videos\/\d+|watch\/?\?v=\d+|share\/v\/[A-Za-z0-9_-]+)|fb\.watch\/[A-Za-z0-9_-]+)/i;

function toEmbed(
  url: string,
): { platform: "youtube" | "facebook"; embedSrc: string } | null {
  for (const p of YT_PATTERNS) {
    const m = url.match(p);
    if (m) {
      return {
        platform: "youtube",
        embedSrc: `https://www.youtube.com/embed/${m[1]}`,
      };
    }
  }
  if (FB_PATTERN.test(url)) {
    return {
      platform: "facebook",
      embedSrc: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
        url,
      )}&show_text=false&width=560`,
    };
  }
  return null;
}

async function handleVideoEmbed(
  req: NextRequest,
  indicatorId: number,
  userId: number,
  secId: number,
) {
  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  const parsed = toEmbed(url);
  if (!parsed) {
    return NextResponse.json(
      { error: "URL must be a valid YouTube or Facebook video link." },
      { status: 400 },
    );
  }

  try {
    const inserted = await db.execute(sql`
      INSERT INTO hdp.gallery
        (indicator_id, gallery_type, image_path, description,
         uploaded_by, uploaded_on, is_verified)
      VALUES
        (${indicatorId}, 2, ${parsed.embedSrc}, ${url},
         ${userId}, now(), false)
      RETURNING gallery_id, indicator_id, gallery_type, image_path,
                description, uploaded_on, is_verified
    `);
    const row = inserted.rows[0] as {
      gallery_id: number;
      indicator_id: number;
      gallery_type: number;
      image_path: string;
      description: string | null;
      uploaded_on: string;
      is_verified: boolean | null;
    };

    await writeAudit({
      userId,
      action: AUDIT_ACTIONS.VIDEO_EMBEDDED,
      entity: "gallery",
      entityId: row.gallery_id,
      request: req,
      secId,
      meta: { indicatorId, platform: parsed.platform, originalUrl: url },
    });

    await db.execute(sql`
      UPDATE hdp.indicators
      SET submitted_by = ${userId}, submitted_date = now()
      WHERE indicator_id = ${indicatorId}
    `);

    return NextResponse.json(
      {
        item: {
          galleryId: row.gallery_id,
          indicatorId: row.indicator_id,
          galleryType: 2,
          imagePath: row.image_path,
          description: row.description,
          uploadedOn: row.uploaded_on,
          isVerified: row.is_verified,
          platform: parsed.platform,
          embedSrc: parsed.embedSrc,
          originalUrl: url,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Video embed failed", err);
    return NextResponse.json(
      { error: "Failed to save video" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — remove a gallery item (and the physical file when it's an image)
// ---------------------------------------------------------------------------
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ indicatorId: string }> },
) {
  const sessionOrResponse = await requireOfficerSession();
  if (!isSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse;

  const { indicatorId } = await params;
  const id = Number(indicatorId);
  const galleryId = Number(req.nextUrl.searchParams.get("galleryId"));
  if (!Number.isFinite(id) || !Number.isFinite(galleryId)) {
    return NextResponse.json(
      { error: "Invalid indicatorId or galleryId" },
      { status: 400 },
    );
  }

  const owns = await officerOwnsIndicator(id, session.secId);
  if (!owns) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const found = await db.execute(sql`
      SELECT gallery_type, image_path FROM hdp.gallery
      WHERE gallery_id = ${galleryId} AND indicator_id = ${id}
      LIMIT 1
    `);
    const row = found.rows[0] as
      | { gallery_type: number; image_path: string | null }
      | undefined;
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.execute(
      sql`DELETE FROM hdp.gallery WHERE gallery_id = ${galleryId}`,
    );

    // Best-effort file cleanup for type 1 (images stored on disk)
    if (row.gallery_type === 1 && row.image_path) {
      try {
        await unlink(path.join(UPLOAD_ROOT, row.image_path));
      } catch {
        /* file already gone — ignore */
      }
    }

    await writeAudit({
      userId: session.userId,
      action: AUDIT_ACTIONS.MEDIA_DELETED,
      entity: "gallery",
      entityId: galleryId,
      request: req,
      secId: session.secId,
      meta: {
        indicatorId: id,
        galleryType: row.gallery_type,
        requires_reverification: true,
      },
    });

    await db.execute(sql`
      UPDATE hdp.indicators
      SET submitted_by = ${session.userId}, submitted_date = now()
      WHERE indicator_id = ${id}
    `);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Gallery DELETE failed", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
