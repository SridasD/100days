'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  Download,
  FileText,
  ImageIcon,
  Images,
  Loader2,
  Trash2,
  X,
  ZoomIn,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Constants + types
// ---------------------------------------------------------------------------
const ACCEPTED_EXTS = ['jpg', 'jpeg', 'png', 'pdf'] as const;
const ACCEPT_ATTR = '.jpg,.jpeg,.png,.pdf';
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

type UploadState = 'idle' | 'uploading' | 'success';

export interface GalleryItem {
  galleryId: number;
  imagePath: string;
  description: string | null;
  uploadedOn: string;
}

export interface DocumentItem {
  documentId: number;
  filename: string;
  size: number;
  uploadedOn: string;
  href?: string;
}

interface Props {
  projectId: number;
  indicatorId: number;
  initialGallery?: GalleryItem[];
  initialDocuments?: DocumentItem[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function extOf(filename: string) {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

function validateFile(f: File): string | null {
  const ext = extOf(f.name);
  if (!ACCEPTED_EXTS.includes(ext as (typeof ACCEPTED_EXTS)[number])) {
    return `Only ${ACCEPTED_EXTS.join(', ')} files are allowed.`;
  }
  if (f.size > MAX_SIZE_BYTES) {
    return 'File size exceeds 5MB limit. Please choose a smaller file.';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------
type StepState = 'pending' | 'active' | 'done';

function StepCircle({
  n,
  state,
  label,
}: {
  n: number;
  state: StepState;
  label: string;
}) {
  const colors = {
    pending: 'border-muted-foreground/30 bg-background text-muted-foreground',
    active: 'border-[#2E7D32] bg-[#2E7D32] text-white shadow-md',
    done: 'border-success-green bg-success-green text-white',
  }[state];

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all duration-200',
          colors,
        )}
        aria-current={state === 'active' ? 'step' : undefined}
      >
        {state === 'done' ? <Check className="h-4 w-4" aria-hidden /> : n}
      </span>
      <span
        className={cn(
          'text-[11px] font-medium uppercase tracking-wide',
          state === 'pending' ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {label}
      </span>
    </div>
  );
}

function StepBar({ done }: { done: boolean }) {
  return (
    <div
      className={cn(
        'mt-4 h-px flex-1 transition-colors duration-200',
        done ? 'bg-success-green' : 'bg-muted-foreground/20',
      )}
      aria-hidden
    />
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------
function SectionHeader({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 bg-[#2E7D32] px-6 py-3 text-white">
      <span aria-hidden className="opacity-90">
        {icon}
      </span>
      <h3 className="text-sm font-semibold uppercase tracking-wide">{title}</h3>
    </div>
  );
}

function WarningBanner({ text, hint }: { text: string; hint: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-warning-amber/30 bg-warning-amber/10 p-4">
      <AlertTriangle
        className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning-amber"
        aria-hidden
      />
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-warning-amber">{text}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function UploadForm({
  projectId,
  indicatorId,
  initialGallery = [],
  initialDocuments = [],
}: Props) {
  void projectId;
  void indicatorId;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);

  const [gallery, setGallery] = useState<GalleryItem[]>(initialGallery);
  const [documents, setDocuments] = useState<DocumentItem[]>(initialDocuments);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Local preview URL for image files
  const previewUrl = useMemo(() => {
    if (!file || !file.type.startsWith('image/')) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  // ESC closes the lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowLeft')
        setLightboxIndex((i) => (i === null ? null : Math.max(0, i - 1)));
      if (e.key === 'ArrowRight')
        setLightboxIndex((i) =>
          i === null ? null : Math.min(gallery.length - 1, i + 1),
        );
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, gallery.length]);

  // -----------------------------------------------------------------------
  // File handling
  // -----------------------------------------------------------------------
  const handleFile = useCallback((f: File) => {
    const validationError = validateFile(f);
    if (validationError) {
      setError(validationError);
      setFile(null);
      return;
    }
    setError(null);
    setFile(f);
  }, []);

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    // allow same-file re-selection
    e.target.value = '';
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(true);
  };
  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
  };
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const removeFile = () => {
    setFile(null);
    setDescription('');
    setError(null);
  };

  // -----------------------------------------------------------------------
  // Submit (mock — simulates progress, then appends to gallery/documents)
  // -----------------------------------------------------------------------
  const startUpload = () => {
    if (!file) return;
    setUploadState('uploading');
    setProgress(0);

    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setUploadState('success');

          // After a short delay, push into the right list and reset
          window.setTimeout(() => {
            const stamp = new Date().toLocaleString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
            if (file.type.startsWith('image/')) {
              setGallery((g) => [
                {
                  galleryId: Date.now(),
                  imagePath: URL.createObjectURL(file),
                  description: description.trim() || file.name,
                  uploadedOn: stamp,
                },
                ...g,
              ]);
            } else {
              setDocuments((d) => [
                {
                  documentId: Date.now(),
                  filename: file.name,
                  size: file.size,
                  uploadedOn: stamp,
                },
                ...d,
              ]);
            }
            setFile(null);
            setDescription('');
            setProgress(0);
            setUploadState('idle');
          }, 900);
          return 100;
        }
        return Math.min(100, p + 8);
      });
    }, 100);
  };

  // -----------------------------------------------------------------------
  // Derived step states
  // -----------------------------------------------------------------------
  const fileStep: StepState = file
    ? 'done'
    : uploadState === 'idle'
      ? 'active'
      : 'pending';
  const descStep: StepState = !file
    ? 'pending'
    : description.trim().length > 0
      ? 'done'
      : 'active';
  const uploadStep: StepState =
    uploadState === 'uploading' || uploadState === 'success'
      ? uploadState === 'success'
        ? 'done'
        : 'active'
      : file
        ? 'active'
        : 'pending';

  const isImage = file?.type.startsWith('image/') ?? false;
  const isPdf = extOf(file?.name ?? '') === 'pdf';

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* ================== SECTION 1 — UPLOAD ================== */}
      <Card className="overflow-hidden shadow-sm">
        <SectionHeader
          icon={<CloudUpload className="h-4 w-4" />}
          title="Upload Image / Document"
        />
        <CardContent className="space-y-6 p-6">
          {/* Step indicator */}
          <div className="flex items-start justify-between gap-2 px-2 sm:px-8">
            <StepCircle n={1} state={fileStep} label="Choose File" />
            <StepBar done={fileStep === 'done'} />
            <StepCircle n={2} state={descStep} label="Add Description" />
            <StepBar done={descStep === 'done'} />
            <StepCircle n={3} state={uploadStep} label="Upload" />
          </div>

          {/* Drag-drop OR file preview */}
          {!file ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ')
                  fileInputRef.current?.click();
              }}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              aria-label="Drag a file here or click to browse"
              className={cn(
                'group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-muted/20 px-6 py-12 text-center transition-all duration-200 hover:border-[#2E7D32] hover:bg-[#2E7D32]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D32]',
                dragActive
                  ? 'border-[#2E7D32] bg-[#2E7D32]/10 scale-[1.01]'
                  : 'border-muted-foreground/30',
              )}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2E7D32]/10 text-[#2E7D32] transition-transform duration-200 group-hover:scale-110">
                <CloudUpload className="h-7 w-7" aria-hidden />
              </span>
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">
                  Drag and drop your file here
                </p>
                <p className="text-sm text-muted-foreground">
                  or click to browse
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                {ACCEPTED_EXTS.map((e) => (
                  <Badge key={e} variant="neutral" className="font-mono">
                    .{e}
                  </Badge>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Maximum file size: 5 MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_ATTR}
                onChange={onFileInputChange}
                className="hidden"
                aria-hidden
              />
            </div>
          ) : (
            <div className="relative rounded-xl border bg-muted/20 p-4">
              <button
                type="button"
                onClick={removeFile}
                aria-label="Remove selected file"
                className="absolute right-3 top-3 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm ring-1 ring-border transition-colors duration-200 hover:bg-error-red hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-4">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Selected file preview"
                    className="h-20 w-20 flex-shrink-0 rounded-lg object-cover ring-1 ring-border"
                  />
                ) : (
                  <span className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg bg-[#2E7D32]/10 text-[#2E7D32] ring-1 ring-[#2E7D32]/20">
                    {isPdf ? (
                      <FileText className="h-9 w-9" aria-hidden />
                    ) : (
                      <ImageIcon className="h-9 w-9" aria-hidden />
                    )}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-semibold text-foreground"
                    title={file.name}
                  >
                    {file.name}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                    <span className="px-1.5 opacity-60">·</span>
                    {isImage ? 'Image' : isPdf ? 'PDF Document' : 'File'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Validation error */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-error-red/30 bg-error-red/5 p-3 text-sm text-error-red"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="upload-description">
              Description{' '}
              <span className="text-xs font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id="upload-description"
              rows={3}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter a brief description of this image / document…"
              disabled={!file || uploadState !== 'idle'}
              className="resize-y"
            />
          </div>

          {/* Upload button + progress */}
          <div className="space-y-2">
            {uploadState === 'uploading' && (
              <div
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Upload progress"
                className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-success-green transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
            <Button
              type="button"
              onClick={startUpload}
              disabled={!file || uploadState !== 'idle'}
              size="lg"
              className={cn(
                'h-12 w-full cursor-pointer text-sm font-semibold uppercase tracking-wide shadow-md transition-all duration-200 hover:shadow-lg',
                uploadState === 'success'
                  ? 'bg-success-green hover:bg-success-green/90'
                  : 'bg-[#2E7D32] hover:bg-[#256328]',
              )}
            >
              {uploadState === 'uploading' ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Uploading… {progress}%
                </>
              ) : uploadState === 'success' ? (
                <>
                  <Check className="h-5 w-5" />
                  File uploaded successfully
                </>
              ) : (
                <>
                  <CloudUpload className="h-5 w-5" />
                  Upload
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ================== SECTION 2 — IMAGE GALLERY ================== */}
      <Card className="overflow-hidden shadow-sm">
        <SectionHeader
          icon={<Images className="h-4 w-4" />}
          title="Image Gallery"
        />
        <CardContent className="space-y-4 p-6">
          {gallery.length === 0 ? (
            <WarningBanner
              text="Images not uploaded!"
              hint="Upload images above to document project progress."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {gallery.map((img, idx) => (
                <GalleryCard
                  key={img.galleryId}
                  img={img}
                  onView={() => setLightboxIndex(idx)}
                  onDelete={() =>
                    setGallery((g) =>
                      g.filter((x) => x.galleryId !== img.galleryId),
                    )
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================== SECTION 3 — DOCUMENTS ================== */}
      <Card className="overflow-hidden shadow-sm">
        <SectionHeader
          icon={<FileText className="h-4 w-4" />}
          title="Document Details"
        />
        <CardContent className="space-y-4 p-6">
          {documents.length === 0 ? (
            <WarningBanner
              text="Documents not uploaded!"
              hint="PDF supporting documents will be listed here once uploaded."
            />
          ) : (
            <ul className="divide-y rounded-lg border">
              {documents.map((d) => (
                <li
                  key={d.documentId}
                  className="flex items-center gap-3 p-4 transition-colors duration-150 hover:bg-muted/40"
                >
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#2E7D32]/10 text-[#2E7D32]">
                    <FileText className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-semibold text-foreground"
                      title={d.filename}
                    >
                      {d.filename}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {formatBytes(d.size)}
                      <span className="px-1.5 opacity-60">·</span>
                      Uploaded {d.uploadedOn}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      asChild={!!d.href}
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                    >
                      {d.href ? (
                        <a href={d.href} download>
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </a>
                      ) : (
                        <span>
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </span>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setDocuments((docs) =>
                          docs.filter((x) => x.documentId !== d.documentId),
                        )
                      }
                      className="cursor-pointer text-error-red hover:bg-error-red/10 hover:text-error-red"
                      aria-label={`Delete ${d.filename}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ================== LIGHTBOX ================== */}
      {lightboxIndex !== null && gallery[lightboxIndex] && (
        <Lightbox
          gallery={gallery}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => Math.max(0, (i ?? 0) - 1))}
          onNext={() =>
            setLightboxIndex((i) =>
              Math.min(gallery.length - 1, (i ?? 0) + 1),
            )
          }
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function GalleryCard({
  img,
  onView,
  onDelete,
}: {
  img: GalleryItem;
  onView: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative overflow-hidden rounded-lg border bg-card shadow-sm transition-all duration-200 hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <img
          src={img.imagePath}
          alt={img.description ?? 'Indicator evidence image'}
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onView}
            className="cursor-pointer bg-white text-foreground hover:bg-white/90"
            aria-label="View image"
          >
            <ZoomIn className="h-3.5 w-3.5" />
            View
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onDelete}
            className="cursor-pointer"
            aria-label="Delete image"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>
      <div className="space-y-1 p-3">
        <p
          className="truncate text-sm font-medium text-foreground"
          title={img.description ?? ''}
        >
          {img.description || 'Untitled image'}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Uploaded {img.uploadedOn}
        </p>
      </div>
    </div>
  );
}

function Lightbox({
  gallery,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  gallery: GalleryItem[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const img = gallery[index];
  const hasPrev = index > 0;
  const hasNext = index < gallery.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 transition-colors duration-200 hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>

      {gallery.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (hasPrev) onPrev();
            }}
            disabled={!hasPrev}
            aria-label="Previous image"
            className="absolute left-4 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 transition-colors duration-200 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (hasNext) onNext();
            }}
            disabled={!hasNext}
            aria-label="Next image"
            className="absolute right-4 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 transition-colors duration-200 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] max-w-[90vw] flex-col items-center gap-3"
      >
        <img
          src={img.imagePath}
          alt={img.description ?? 'Indicator evidence image'}
          className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
        />
        <div className="max-w-2xl space-y-1 text-center text-white">
          {img.description && (
            <p className="text-sm font-medium">{img.description}</p>
          )}
          <p className="text-xs text-white/70">
            Uploaded {img.uploadedOn}
            {gallery.length > 1 && (
              <>
                <span className="px-1.5">·</span>
                {index + 1} of {gallery.length}
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
