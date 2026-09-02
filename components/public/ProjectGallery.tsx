'use client';

/**
 * Project media gallery — thumbnail grids grouped by indicator, plus a
 * scoped lightbox for images. Extracted out of ProjectDetailPage.tsx so it
 * can be reused inside DepartmentDrawer.tsx's in-place project overlay,
 * not just the standalone project detail page's Gallery tab.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Expand,
  ExternalLink,
  Facebook,
  FileText,
  ImageIcon,
  PlayCircle,
  Video,
  X,
  Youtube,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { VerifiedDataBadge } from './VerifiedDataBadge';
import { FacebookVideoEmbed } from '@/components/media/FacebookVideoEmbed';

export interface PublicProjectImage {
  galleryId: number;
  imagePath: string;
  description: string;
  uploadedOn: string | null;
  indicatorId: number;
  indicatorName: string;
}

export interface PublicProjectVideo {
  galleryId: number;
  embedSrc: string;
  description: string;
  uploadedOn: string | null;
  indicatorId: number;
  indicatorName: string;
}

export interface PublicProjectDocument {
  documentId: number;
  path: string;
  description: string;
  uploadedOn: string | null;
  indicatorId: number;
  indicatorName: string;
}

// ===========================================================================
// GALLERY
// ===========================================================================
interface IndicatorMediaGroup {
  indicatorId: number;
  indicatorName: string;
  images: PublicProjectImage[];
  videos: PublicProjectVideo[];
  documents: PublicProjectDocument[];
}

function groupMediaByIndicator(
  images: PublicProjectImage[],
  videos: PublicProjectVideo[],
  documents: PublicProjectDocument[],
): IndicatorMediaGroup[] {
  const map = new Map<number, IndicatorMediaGroup>();
  const upsert = (id: number, name: string) => {
    if (!map.has(id))
      map.set(id, {
        indicatorId: id,
        indicatorName: name,
        images: [],
        videos: [],
        documents: [],
      });
    return map.get(id)!;
  };
  for (const img of images) upsert(img.indicatorId, img.indicatorName).images.push(img);
  for (const v of videos) upsert(v.indicatorId, v.indicatorName).videos.push(v);
  for (const d of documents) upsert(d.indicatorId, d.indicatorName).documents.push(d);
  return Array.from(map.values()).sort((a, b) => a.indicatorId - b.indicatorId);
}

export function ProjectGallery({
  images,
  videos,
  documents,
}: {
  images: PublicProjectImage[];
  videos: PublicProjectVideo[];
  documents: PublicProjectDocument[];
}) {
  // Lightbox state — { groupId, imageIndex } so ← / → navigation stays
  // scoped to the same indicator group, matching the brief.
  const [lightbox, setLightbox] = useState<{
    groupId: number;
    index: number;
  } | null>(null);

  const groups = useMemo(
    () => groupMediaByIndicator(images, videos, documents),
    [images, videos, documents],
  );

  // Filter out indicators with neither images nor videos — per the brief
  // they simply shouldn't appear in this tab.
  const groupsWithMedia = groups.filter(
    (g) => g.images.length > 0 || g.videos.length > 0 || g.documents.length > 0,
  );

  if (groupsWithMedia.length === 0) {
    return (
      <EmptyCard
        titleMal="സ്ഥിരീകരിച്ച മീഡിയ ലഭ്യമല്ല"
        descMal="Verified data not yet available"
      />
    );
  }

  const totalImages = groupsWithMedia.reduce((sum, g) => sum + g.images.length, 0);
  const totalVideos = groupsWithMedia.reduce((sum, g) => sum + g.videos.length, 0);
  const totalDocuments = groupsWithMedia.reduce(
    (sum, g) => sum + g.documents.length,
    0,
  );
  const totalItems = totalImages + totalVideos + totalDocuments;

  const currentGroup = lightbox
    ? groupsWithMedia.find((g) => g.indicatorId === lightbox.groupId) ?? null
    : null;

  return (
    <>
      <section className="mb-5 rounded-2xl border bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          <Badge className="bg-hdp-green text-white">
            <span className="font-mono font-semibold">{totalItems}</span>
            <span className="font-malayalam ml-1">ആകെ മീഡിയ</span>
          </Badge>
          <Badge variant="outline" className="bg-hdp-green/5 text-hdp-green">
            <ImageIcon className="h-3 w-3" />
            <span className="ml-1 font-mono font-semibold">{totalImages}</span>
            <span className="font-malayalam ml-1">ചിത്രങ്ങൾ</span>
            <VerifiedDataBadge className="ml-1" />
          </Badge>
          <Badge variant="outline" className="bg-[#7C3AED]/5 text-[#7C3AED]">
            <Video className="h-3 w-3" />
            <span className="ml-1 font-mono font-semibold">{totalVideos}</span>
            <span className="font-malayalam ml-1">വീഡിയോകൾ</span>
            <VerifiedDataBadge className="ml-1" />
          </Badge>
          <Badge variant="outline" className="bg-[#E8F5E9] text-[#1B5E20]">
            <FileText className="h-3 w-3" />
            <span className="ml-1 font-mono font-semibold">{totalDocuments}</span>
            <span className="font-malayalam ml-1">രേഖകൾ</span>
            <VerifiedDataBadge className="ml-1" />
          </Badge>
        </div>
      </section>

      <div className="space-y-6 sm:space-y-7">
        {groupsWithMedia.map((group) => (
          <IndicatorMediaGroupCard
            key={group.indicatorId}
            group={group}
            onOpenImage={(index) =>
              setLightbox({ groupId: group.indicatorId, index })
            }
          />
        ))}
      </div>

      <Lightbox
        open={!!lightbox && !!currentGroup}
        group={currentGroup}
        index={lightbox?.index ?? 0}
        onClose={() => setLightbox(null)}
        onNavigate={(nextIndex) =>
          setLightbox((cur) =>
            cur ? { groupId: cur.groupId, index: nextIndex } : cur,
          )
        }
      />
    </>
  );
}

function IndicatorMediaGroupCard({
  group,
  onOpenImage,
}: {
  group: IndicatorMediaGroup;
  onOpenImage: (index: number) => void;
}) {
  const totalCount = group.images.length + group.videos.length + group.documents.length;
  const latestUploadOn = latestGroupUploadOn(group);
  return (
    <section
      aria-label={group.indicatorName}
      className="overflow-hidden rounded-2xl border border-l-4 border-l-hdp-green bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      {/* Group header — strong hierarchy with title first and stats second. */}
      <header className="space-y-3 border-b bg-gradient-to-r from-hdp-bg/70 via-white to-white px-3 py-3.5 sm:px-5 sm:py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              <span className="font-malayalam">ഇൻഡിക്കേറ്റർ</span>
            </p>
            <h3 className="font-malayalam mt-1 line-clamp-2 text-lg font-bold leading-snug text-foreground">
              {group.indicatorName || 'ഇൻഡിക്കേറ്റർ'}
            </h3>
          </div>
          <div className="w-fit rounded-xl border bg-white px-3 py-1.5 text-right sm:py-2">
            <p className="font-mono text-sm font-bold text-foreground">{totalCount}</p>
            <p className="font-malayalam text-[10px] text-muted-foreground">ആകെ ഇനങ്ങൾ</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            {group.images.length > 0 && (
              <Badge variant="outline" className="bg-hdp-green/5 text-hdp-green">
                <ImageIcon className="h-3 w-3" />
                <span className="ml-1 font-mono font-semibold">{group.images.length}</span>
                <span className="font-malayalam ml-1">ചിത്രങ്ങൾ</span>
                <VerifiedDataBadge className="ml-1" />
              </Badge>
            )}
            {group.videos.length > 0 && (
              <Badge variant="outline" className="bg-[#7C3AED]/5 text-[#7C3AED]">
                <Video className="h-3 w-3" />
                <span className="ml-1 font-mono font-semibold">{group.videos.length}</span>
                <span className="font-malayalam ml-1">വീഡിയോ</span>
                <VerifiedDataBadge className="ml-1" />
              </Badge>
            )}
            {group.documents.length > 0 && (
              <Badge variant="outline" className="bg-[#E8F5E9] text-[#1B5E20]">
                <FileText className="h-3 w-3" />
                <span className="ml-1 font-mono font-semibold">{group.documents.length}</span>
                <span className="font-malayalam ml-1">രേഖകൾ</span>
                <VerifiedDataBadge className="ml-1" />
              </Badge>
            )}
          </div>
          {latestUploadOn && (
            <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span className="font-malayalam">അവസാനം അപ്ഡേറ്റ് ചെയ്തത്</span>
              <span className="font-mono">{new Date(latestUploadOn).toLocaleString('en-IN')}</span>
            </p>
          )}
        </div>
      </header>

      <div className="space-y-3.5 p-2.5 sm:space-y-5 sm:p-5">
        {/* Image grid: 2 cols on mobile, 3 from sm, 4 from xl */}
        {group.images.length > 0 && (
          <section className="rounded-xl border bg-hdp-bg/20 p-2.5 sm:p-3">
            <p className="font-malayalam mb-2 text-xs font-semibold text-muted-foreground">ചിത്രങ്ങൾ</p>
            <ul className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
              {group.images.map((img, idx) => (
                <li key={img.galleryId}>
                  <ImageThumb img={img} onOpen={() => onOpenImage(idx)} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Videos: 1 col mobile, 2 cols >= md */}
        {group.videos.length > 0 && (
          <section className="rounded-xl border bg-hdp-bg/20 p-2.5 sm:p-3">
            <p className="font-malayalam mb-2 text-xs font-semibold text-muted-foreground">വീഡിയോകൾ</p>
            <ul className="grid gap-3 md:grid-cols-2">
              {group.videos.map((v) => (
                <li key={v.galleryId}>
                  <VideoThumb video={v} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Documents */}
        {group.documents.length > 0 && (
          <section className="rounded-xl border bg-hdp-bg/20 p-2.5 sm:p-3">
            <p className="font-malayalam mb-2 text-xs font-semibold text-muted-foreground">രേഖകൾ</p>
            <ul className="grid gap-3 md:grid-cols-2">
              {group.documents.map((doc) => (
                <li key={doc.documentId}>
                  <DocumentThumb document={doc} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </section>
  );
}

function DocumentThumb({ document }: { document: PublicProjectDocument }) {
  const href = document.path ? `/api/uploads/${document.path}` : '';
  const filename = document.path
    ? document.path.split('/').pop() ?? 'document.pdf'
    : 'document.pdf';
  const decodedFilename = decodeURIComponent(filename);
  const stableSeed = `${document.documentId}|${document.path ?? ''}|${decodedFilename}`;
  let hash = 0;
  for (let i = 0; i < stableSeed.length; i += 1) {
    hash = (hash * 31 + stableSeed.charCodeAt(i)) % 100000000;
  }
  const randomLike8Digit = String(Math.abs(hash)).padStart(8, '0');

  const titleText =
    typeof document.description === 'string' && document.description.trim().length > 0
      ? document.description.trim()
      : `DOC-${randomLike8Digit}`;
  return (
    <article className="group rounded-xl border bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E8F5E9] text-[#1B5E20]">
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <VerifiedDataBadge />
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-foreground" title={titleText}>
            {titleText}
          </p>
          {document.description && document.description.trim() !== titleText && (
            <p className="font-malayalam mt-1 line-clamp-2 text-xs text-muted-foreground">
              {document.description}
            </p>
          )}
          {document.uploadedOn && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {new Date(document.uploadedOn).toLocaleString('en-IN')}
            </p>
          )}
        </div>
      </div>
      {href && (
        <div className="mt-3 border-t pt-2">
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-8 items-center gap-1 rounded-full border border-hdp-green/40 bg-hdp-green/5 px-3 py-1.5 text-[11px] font-semibold text-hdp-green transition-colors duration-150 hover:bg-hdp-green hover:text-white"
          >
            <ExternalLink className="h-3 w-3" />
            Open
          </a>
        </div>
      )}
    </article>
  );
}

function latestGroupUploadOn(group: IndicatorMediaGroup): string | null {
  const timestamps = [
    ...group.images.map((item) => item.uploadedOn),
    ...group.videos.map((item) => item.uploadedOn),
    ...group.documents.map((item) => item.uploadedOn),
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps)).toISOString();
}

function ImageThumb({
  img,
  onOpen,
}: {
  img: PublicProjectImage;
  onOpen: () => void;
}) {
  const src = imageSrc(img.imagePath);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  return (
    <figure className="group overflow-hidden rounded-xl border bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <button
        type="button"
        onClick={state === 'ready' ? onOpen : undefined}
        disabled={state !== 'ready'}
        aria-label={img.description || 'View image'}
        className="relative block aspect-[4/3] min-h-36 w-full cursor-pointer overflow-hidden bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-hdp-green disabled:cursor-default"
      >
        {/* Skeleton — visible until the image either loads or errors */}
        {state === 'loading' && (
          <div
            aria-hidden
            className="absolute inset-0 animate-pulse bg-gradient-to-br from-hdp-bg via-muted to-hdp-bg"
          />
        )}

        {/* Broken-image placeholder */}
        {state === 'error' && (
          <div
            aria-hidden
            className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-hdp-bg text-muted-foreground"
          >
            <ImageIcon className="h-7 w-7 opacity-50" />
            <p className="font-malayalam text-[10px]">ചിത്രം ലഭ്യമല്ല</p>
          </div>
        )}

        <img
          src={src ?? ''}
          alt={img.description || 'Project image'}
          onLoad={() => setState('ready')}
          onError={() => setState('error')}
          className={`h-full w-full object-cover transition-all duration-500 group-hover:scale-105 ${state === 'ready' ? 'opacity-100' : 'opacity-0'
            }`}
          loading="lazy"
          decoding="async"
        />

        {/* Hover overlay (only when image is actually loaded) */}
        {state === 'ready' && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-hdp-green shadow">
              <Expand className="h-3.5 w-3.5" />
              <span className="font-malayalam">വലുതാക്കുക</span>
            </span>
          </span>
        )}
      </button>

      {/* Caption — only render when a non-empty caption exists */}
      {img.description && img.description.trim() !== '' && (
        <figcaption className="border-t bg-white px-3 py-2">
          <p className="font-malayalam line-clamp-2 text-xs text-muted-foreground">
            {img.description}
          </p>
        </figcaption>
      )}
    </figure>
  );
}

function VideoThumb({ video }: { video: PublicProjectVideo }) {
  const [playing, setPlaying] = useState(false);
  const isYouTube = /youtube|youtu\.be/i.test(video.embedSrc ?? '');
  const ytId = isYouTube ? extractYouTubeId(video.embedSrc) : null;
  const thumbCandidates = ytId
    ? [
      `https://i.ytimg.com/vi_webp/${ytId}/maxresdefault.webp`,
      `https://i.ytimg.com/vi_webp/${ytId}/hqdefault.webp`,
      `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
      `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
    ]
    : [];
  const [thumbIndex, setThumbIndex] = useState(0);
  const currentThumb = thumbCandidates[thumbIndex] ?? null;

  return (
    <figure className="overflow-hidden rounded-xl border bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-video bg-black">
        {isYouTube ? (
          playing ? (
            // Only mount the iframe after the user clicks play — saves
            // bandwidth + avoids autoplay surprises.
            <iframe
              src={`${video.embedSrc}${video.embedSrc.includes('?') ? '&' : '?'
                }autoplay=1`}
              title={video.description || 'Project video'}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              loading="lazy"
              allowFullScreen
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label={video.description || 'Play video'}
              className="group absolute inset-0 cursor-pointer"
            >
              {currentThumb ? (
                <img
                  src={currentThumb ?? ''}
                  alt=""
                  aria-hidden
                  className="h-full w-full object-cover opacity-90 transition-opacity duration-200 group-hover:opacity-100"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() => {
                    setThumbIndex((prev) => {
                      if (prev < thumbCandidates.length - 1) return prev + 1;
                      return prev;
                    });
                  }}
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-black via-[#161616] to-[#1f1f1f]" />
              )}
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-hdp-green shadow-lg transition-transform duration-200 group-hover:scale-110">
                  <PlayCircle className="h-8 w-8" />
                </span>
              </span>
            </button>
          )
        ) : (
          <FacebookVideoEmbed
            sourceUrl={video.embedSrc}
            title={video.description || 'Facebook project video'}
          />
        )}
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t bg-white p-3">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${isYouTube ? 'bg-[#FF0000]' : 'bg-[#1877F2]'
            }`}
        >
          {isYouTube ? (
            <Youtube className="h-3 w-3" />
          ) : (
            <Facebook className="h-3 w-3" />
          )}
          {isYouTube ? 'YouTube' : 'Facebook'}
        </span>
        {video.description && (
          <span className="font-malayalam line-clamp-1 text-[11px] text-muted-foreground">
            {video.description}
          </span>
        )}
      </figcaption>
    </figure>
  );
}

// ===========================================================================
// LIGHTBOX — ShadCN Dialog, scoped to one indicator group
// ===========================================================================
function Lightbox({
  open,
  group,
  index,
  onClose,
  onNavigate,
}: {
  open: boolean;
  group: IndicatorMediaGroup | null;
  index: number;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
}) {
  const total = group?.images.length ?? 0;
  const safeIndex = Math.max(0, Math.min(total - 1, index));
  const img = group?.images[safeIndex] ?? null;

  // Keyboard nav: ← / → cycles within the group. Escape is handled by
  // the Dialog primitive itself.
  useEffect(() => {
    if (!open || !group) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onNavigate(safeIndex > 0 ? safeIndex - 1 : total - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNavigate(safeIndex < total - 1 ? safeIndex + 1 : 0);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, group, safeIndex, total, onNavigate]);

  if (!group || !img) return null;

  const src = imageSrc(img.imagePath);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-h-[95vh] max-w-5xl gap-0 overflow-hidden border-0 bg-black p-0 text-white"
      // The Dialog primitive supplies its own close button; this lightbox
      // adds clearer navigation controls below.
      >
        {/* Header — indicator name + position */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-white/60">
              <span className="font-malayalam">ഇൻഡിക്കേറ്റർ</span>
            </p>
            <p className="font-malayalam line-clamp-1 text-sm font-semibold">
              {group.indicatorName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-white/70">
              {safeIndex + 1} / {total}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="cursor-pointer rounded-full p-1.5 text-white/80 transition-colors duration-150 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Image */}
        <div className="relative flex flex-1 items-center justify-center bg-black px-2 py-4 sm:px-6 sm:py-6">
          <LightboxImage
            key={img.galleryId}
            src={src}
            alt={img.description || 'Project image'}
          />

          {/* Prev / Next */}
          {total > 1 && (
            <>
              <button
                type="button"
                onClick={() =>
                  onNavigate(safeIndex > 0 ? safeIndex - 1 : total - 1)
                }
                aria-label="Previous image"
                className="absolute left-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-white/10 p-2 text-white backdrop-blur transition-colors duration-150 hover:bg-white/25"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  onNavigate(safeIndex < total - 1 ? safeIndex + 1 : 0)
                }
                aria-label="Next image"
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-white/10 p-2 text-white backdrop-blur transition-colors duration-150 hover:bg-white/25"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        {/* Caption */}
        {img.description && img.description.trim() !== '' && (
          <div className="border-t border-white/10 px-4 py-3">
            <p className="font-malayalam text-sm text-white/85">
              {img.description}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Lightbox-internal image with skeleton + error fallback. Reset by `key`
 * when the user navigates between images so each new image re-renders its
 * loading state cleanly.
 */
function LightboxImage({ src, alt }: { src: string; alt: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  return (
    <div className="relative flex max-h-[70vh] w-full items-center justify-center sm:max-h-[75vh]">
      {state === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      )}
      {state === 'error' && (
        <div className="flex flex-col items-center gap-2 text-white/80">
          <ImageIcon className="h-9 w-9 opacity-60" />
          <p className="font-malayalam text-xs">ചിത്രം ലോഡ് ചെയ്യാൻ കഴിഞ്ഞില്ല</p>
        </div>
      )}
      <img
        src={src ?? ''}
        alt={alt}
        onLoad={() => setState('ready')}
        onError={() => setState('error')}
        className={`max-h-[70vh] max-w-full rounded-lg object-contain shadow-2xl transition-opacity duration-300 sm:max-h-[75vh] ${state === 'ready' ? 'opacity-100' : 'opacity-0'
          }`}
        decoding="async"
      />
    </div>
  );
}

// --- Helpers ---------------------------------------------------------------
function imageSrc(path: string) {
  if (!path) return '';
  return path.startsWith('http') ? path : `/api/uploads/${path}`;
}

/** Extract a YouTube video id from any reasonable URL shape. */
function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const m =
    url.match(/[?&]v=([A-Za-z0-9_-]{11})/) ||
    url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) ||
    url.match(/embed\/([A-Za-z0-9_-]{11})/) ||
    url.match(/shorts\/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function EmptyCard({
  titleMal,
  descMal,
}: {
  titleMal: string;
  descMal: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed bg-white p-12 text-center">
      <CheckCircle2 className="mx-auto h-7 w-7 text-muted-foreground" />
      <p className="font-malayalam mt-3 text-sm font-semibold text-foreground">
        {titleMal}
      </p>
      <p className="font-malayalam mt-1 text-xs text-muted-foreground">
        {descMal}
      </p>
    </div>
  );
}
