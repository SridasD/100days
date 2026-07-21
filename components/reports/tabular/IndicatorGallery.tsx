'use client';

import { useEffect, useState } from 'react';
import { Download, FileText, ImageOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

type GalleryImage = {
  galleryId: number;
  imagePath: string | null;
  description: string | null;
  uploadedOn: string | null;
};

type GalleryVideo = {
  galleryId: number;
  embedSrc: string | null;
  description: string | null;
  uploadedOn: string | null;
};

type GalleryDocument = {
  documentId: number;
  filename: string;
  path: string | null;
  description: string | null;
  uploadedOn: string | null;
  size: number | null;
};

type GalleryResponse = {
  images: GalleryImage[];
  videos: GalleryVideo[];
  documents: GalleryDocument[];
};

function mediaSrc(value: string | null) {
  if (!value) return '';
  return value.startsWith('http') ? value : `/api/uploads/${value}`;
}

function formatSize(bytes: number | null) {
  if (bytes === null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type IndicatorGalleryProps = {
  indicatorId: number;
};

export function IndicatorGallery({ indicatorId }: IndicatorGalleryProps) {
  const [data, setData] = useState<GalleryResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(false);

    fetch(`/api/admin/indicators/${indicatorId}/gallery`, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((body: GalleryResponse) => {
        if (!cancelled) setData(body);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [indicatorId]);

  if (error) {
    return <p className="text-sm text-muted-foreground">Failed to load gallery.</p>;
  }

  if (!data) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="aspect-square rounded-md" />
        ))}
      </div>
    );
  }

  const { images, videos, documents } = data;
  const isEmpty = images.length === 0 && videos.length === 0 && documents.length === 0;

  if (isEmpty) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ImageOff className="h-4 w-4" />
        No media uploaded for this indicator.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {images.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Images ({images.length})
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.map((image) => (
              <a
                key={image.galleryId}
                href={mediaSrc(image.imagePath)}
                target="_blank"
                rel="noreferrer"
                className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mediaSrc(image.imagePath)}
                  alt={image.description ?? 'Indicator evidence photo'}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {videos.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Videos ({videos.length})
          </div>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {videos.map((video) => (
              <div key={video.galleryId} className="aspect-video overflow-hidden rounded-md border">
                <iframe
                  src={mediaSrc(video.embedSrc)}
                  title={video.description ?? 'Indicator evidence video'}
                  className="h-full w-full"
                  allowFullScreen
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {documents.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Documents ({documents.length})
          </div>
          <ul className="mt-2 space-y-1.5">
            {documents.map((doc) => (
              <li key={doc.documentId} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-foreground">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{doc.filename}</span>
                </span>
                <a
                  href={mediaSrc(doc.path)}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="flex shrink-0 items-center gap-1 text-xs text-kerala-blue hover:underline"
                >
                  <Download className="h-3.5 w-3.5" />
                  {formatSize(doc.size) ?? 'Download'}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
