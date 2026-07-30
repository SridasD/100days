/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  isVerifierSession,
  requireVerifierSession,
} from "@/lib/auth/verifier-session";
import { db } from "@/lib/db/client";
import { resolveIndicatorId } from "@/lib/db/public-id";
import { listDocuments, listGallery } from "@/lib/db/queries/officer";
import { verifierOwnsIndicator } from "@/lib/db/queries/verifier";
import { writeAudit } from "@/lib/audit/writeAudit";
import { AUDIT_ACTIONS } from "@/lib/db/schema/audit";

// Verifier-side gallery endpoint â€” mirrors the officer one but auth-gates
// on the Verifier role. The verifier needs full media review power:
// view what nodal uploaded, delete bad evidence, and add corrected files
// of their own. Every change is audited with the indicator id so the
// history tab can replay who-did-what.
//
// File layout mirrors the officer endpoint:
//   <UPLOAD_DIR>/<year>/<indicatorId>/<uuid>.<ext>

export const runtime = "nodejs";

const UPLOAD_ROOT = path.resolve(
  process.cwd(),
  process.env.UPLOAD_DIR ?? "./uploads",
);
const MAX_SIZE_BYTES = (Number(process.env.MAX_UPLOAD_MB) || 5) * 1024 * 1024;

const IMG_EXTS = new Set(["jpg", "jpeg", "png"]);
const DOC_EXTS = new Set(["pdf"]);

// ---------------------------------------------------------------------------
// GET â€” list gallery items
// ---------------------------------------------------------------------------
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ indicatorId: string }> },
) {
  const sessionOrResponse = await requireVerifierSession();
  if (!isVerifierSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse;

  const { indicatorId } = await params;
  const id = await resolveIndicatorId(indicatorId);
  if (!id) {
    return NextResponse.json({ error: "Invalid indicatorId" }, { status: 400 });
  }

  const owns = await verifierOwnsIndicator(id, session.secId);
  if (!owns) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const typeParam = req.nextUrl.searchParams.get("type");
  const galleryType = typeParam === "1" ? 1 : typeParam === "2" ? 2 : undefined;

  const [rows, documents] = await Promise.all([
    listGallery(id, galleryType),
    listDocuments(id),
  ]);
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
    documents: await Promise.all(
      documents.map(async (doc) => {
        const relPath = doc.document_path;
        const filename = relPath
          ? path.posix.basename(relPath)
          : "document.pdf";
        let size: number | null = null;
        if (relPath) {
          try {
            size = (await stat(path.join(UPLOAD_ROOT, relPath))).size;
          } catch {
            size = null;
          }
        }
        return {
          documentId: doc.document_id,
          indicatorId: doc.indicator_id,
          filename,
          path: relPath,
          description: doc.description,
          uploadedOn: doc.uploaded_on,
          verifiedBy: doc.verified_by,
          verifiedDate: doc.verified_date,
          size,
        };
      }),
    ),
  });
}

// ---------------------------------------------------------------------------
// POST â€” verifier-side upload (image / PDF) OR video embed
// ---------------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ indicatorId: string }> },
) {
  const sessionOrResponse = await requireVerifierSession();
  if (!isVerifierSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse;

  const { indicatorId } = await params;
  const id = await resolveIndicatorId(indicatorId);
  if (!id) {
    return NextResponse.json({ error: "Invalid indicatorId" }, { status: 400 });
  }

  const owns = await verifierOwnsIndicator(id, session.secId);
  if (!owns) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ct = req.headers.get("content-type") ?? "";
  if (ct.startsWith("multipart/form-data")) {
    return handleVerifierFileUpload(req, id, session.userId, session.secId);
  }
  return handleVerifierVideoEmbed(req, id, session.userId, session.secId);
}

async function handleVerifierFileUpload(
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

  const year = new Date().getFullYear();
  const dir = path.join(UPLOAD_ROOT, String(year), String(indicatorId));
  await mkdir(dir, { recursive: true });
  const safeName = `${randomUUID()}.${ext}`;
  const absPath = path.join(dir, safeName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absPath, buffer);

  const relPath = path.posix.join(String(year), String(indicatorId), safeName);

  try {
    if (isImage) {
      // Verifier uploads are flagged as_verified=true so the queue UI can
      // distinguish nodal evidence from verifier-corrected evidence.
      const inserted = await db.execute(sql`
        INSERT INTO hdp.gallery
          (indicator_id, gallery_type, image_path, description,
           uploaded_by, uploaded_on, is_verified)
        VALUES
          (${indicatorId}, 1, ${relPath}, ${description || null},
           ${userId}, now(), true)
        RETURNING gallery_id, indicator_id, gallery_type, image_path,
                  description, uploaded_on, is_verified
      `);
      const row = inserted.rows[0] as any;

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
          source: "verifier",
          filename: file.name,
          size: file.size,
        },
      });

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

    const inserted = await db.execute(sql`
      INSERT INTO hdp.documents
        (indicator_id, document_path, description, uploaded_by, uploaded_on)
      VALUES
        (${indicatorId}, ${relPath}, ${description || null}, ${userId}, now())
      RETURNING document_id, indicator_id, document_path, description, uploaded_on
    `);
    const row = inserted.rows[0] as any;

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
        source: "verifier",
        filename: file.name,
        size: file.size,
      },
    });

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
    try {
      await unlink(absPath);
    } catch {
      /* swallow */
    }
    console.error("Verifier gallery upload failed", err);
    return NextResponse.json(
      { error: "Failed to save upload" },
      { status: 500 },
    );
  }
}

const YT_PATTERNS = [
  /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
];
const FB_PATTERN =
  /(?:facebook\.com\/(?:reel\/\d+|[A-Za-z0-9.\-_]+\/videos\/\d+|watch\/?\?v=\d+|share\/v\/[A-Za-z0-9_-]+)|fb\.watch\/[A-Za-z0-9_-]+)/i;

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

async function handleVerifierVideoEmbed(
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
         ${userId}, now(), true)
      RETURNING gallery_id, indicator_id, gallery_type, image_path,
                description, uploaded_on, is_verified
    `);
    const row = inserted.rows[0] as any;

    await writeAudit({
      userId,
      action: AUDIT_ACTIONS.VIDEO_EMBEDDED,
      entity: "gallery",
      entityId: row.gallery_id,
      request: req,
      secId,
      meta: {
        indicatorId,
        source: "verifier",
        platform: parsed.platform,
        originalUrl: url,
      },
    });

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
    console.error("Verifier video embed failed", err);
    return NextResponse.json(
      { error: "Failed to save video" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ indicatorId: string }> },
) {
  const sessionOrResponse = await requireVerifierSession();
  if (!isVerifierSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse;

  const { indicatorId } = await params;
  const id = await resolveIndicatorId(indicatorId);
  const parseOptionalId = (value: string | null): number | null => {
    if (value == null || value.trim() === "") return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  };

  const galleryId = parseOptionalId(req.nextUrl.searchParams.get("galleryId"));
  const documentId = parseOptionalId(
    req.nextUrl.searchParams.get("documentId"),
  );
  if (
    !id ||
    (galleryId == null && documentId == null) ||
    (galleryId != null && documentId != null)
  ) {
    return NextResponse.json(
      { error: "Invalid indicatorId or delete target" },
      { status: 400 },
    );
  }

  const owns = await verifierOwnsIndicator(id, session.secId);
  if (!owns) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    if (documentId != null) {
      const found = await db.execute(sql`
        SELECT document_path FROM hdp.documents
        WHERE document_id = ${documentId} AND indicator_id = ${id}
        LIMIT 1
      `);
      const row = found.rows[0] as { document_path: string | null } | undefined;
      if (!row) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      await db.execute(
        sql`DELETE FROM hdp.documents WHERE document_id = ${documentId}`,
      );

      if (row.document_path) {
        try {
          await unlink(path.join(UPLOAD_ROOT, row.document_path));
        } catch {
          /* swallow */
        }
      }

      try {
        await writeAudit({
          userId: session.userId,
          action: AUDIT_ACTIONS.MEDIA_DELETED,
          entity: "documents",
          entityId: documentId,
          request: req,
          secId: session.secId,
          meta: {
            indicatorId: id,
            kind: "document",
            source: "verifier",
          },
        });
      } catch (auditErr) {
        console.error("Verifier document delete audit failed", auditErr);
      }

      return NextResponse.json({ ok: true });
    }

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

    if (row.gallery_type === 1 && row.image_path) {
      try {
        await unlink(path.join(UPLOAD_ROOT, row.image_path));
      } catch {
        /* swallow */
      }
    }

    try {
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
          source: "verifier",
        },
      });
    } catch (auditErr) {
      console.error("Verifier gallery delete audit failed", auditErr);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Verifier gallery DELETE failed", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
