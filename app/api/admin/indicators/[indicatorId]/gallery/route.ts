import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { stat } from 'node:fs/promises';
import { requireAdminSession, isAdminSession } from '@/lib/auth/admin-session';
import { listDocuments, listGallery } from '@/lib/db/queries/officer';

export const runtime = 'nodejs';

const UPLOAD_ROOT = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? './uploads');

// Read-only gallery viewer for admin/OSD report screens — no upload/delete
// here on purpose, unlike the officer/verifier gallery routes this mirrors.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ indicatorId: string }> },
) {
  const sessionOrResponse = await requireAdminSession();
  if (!isAdminSession(sessionOrResponse)) return sessionOrResponse;

  const { indicatorId } = await params;
  const id = Number(indicatorId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid indicatorId' }, { status: 400 });
  }

  const [galleryRows, documentRows] = await Promise.all([listGallery(id), listDocuments(id)]);

  const images = galleryRows
    .filter((row) => row.gallery_type === 1 && row.is_verified)
    .map((row) => ({
      galleryId: row.gallery_id,
      imagePath: row.image_path,
      description: row.description,
      uploadedOn: row.uploaded_on,
    }));

  const videos = galleryRows
    .filter((row) => row.gallery_type === 2 && row.is_verified)
    .map((row) => ({
      galleryId: row.gallery_id,
      embedSrc: row.image_path,
      description: row.description,
      uploadedOn: row.uploaded_on,
    }));

  const documents = await Promise.all(
    documentRows.map(async (doc) => {
      const relPath = doc.document_path;
      const filename = relPath ? path.posix.basename(relPath) : 'document';
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
        filename,
        path: relPath,
        description: doc.description,
        uploadedOn: doc.uploaded_on,
        size,
      };
    }),
  );

  return NextResponse.json({ images, videos, documents });
}
