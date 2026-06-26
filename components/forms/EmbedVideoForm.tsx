'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  ExternalLink,
  Facebook,
  Info,
  Link2,
  Loader2,
  PlayCircle,
  Trash2,
  Video,
  Youtube,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types + URL parsing
// ---------------------------------------------------------------------------
type Platform = 'youtube' | 'facebook';

export interface EmbedVideoItem {
  galleryId: number;
  platform: Platform;
  originalUrl: string;
  embedSrc: string;
  addedOn: string;
}

interface Props {
  projectId: number;
  indicatorId: number;
  initialVideos?: EmbedVideoItem[];
}

const YT_PATTERNS = [
  /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
];
const FB_PATTERN =
  /(?:facebook\.com\/(?:reel\/\d+|[A-Za-z0-9.\-_]+\/videos\/\d+|watch\/?\?v=\d+|share\/v\/[A-Za-z0-9_-]+)|fb\.watch\/[A-Za-z0-9_-]+)/i;

function parseYouTubeId(url: string): string | null {
  for (const p of YT_PATTERNS) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function buildEmbedSrc(platform: Platform, url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (platform === 'youtube') {
    const id = parseYouTubeId(trimmed);
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (FB_PATTERN.test(trimmed)) {
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
      trimmed,
    )}&show_text=false&width=560`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Section header (reuses pattern from progress / upload forms)
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

// ---------------------------------------------------------------------------
// How-to modal
// ---------------------------------------------------------------------------
function HowToEmbedDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer border-kerala-blue text-kerala-blue transition-colors duration-200 hover:bg-kerala-blue hover:text-white"
        >
          <Info className="h-4 w-4" />
          How to embed video
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>How to embed a video</DialogTitle>
          <DialogDescription>
            Follow the three steps for either platform — there&apos;s no file
            upload, only a shareable link.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* YouTube */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FF0000]/10 text-[#FF0000]">
                <Youtube className="h-4 w-4" aria-hidden />
              </span>
              <p className="text-sm font-semibold">YouTube</p>
            </div>
            <ol className="space-y-2 pl-1 text-sm text-muted-foreground">
              <Step n={1} icon={<PlayCircle className="h-3.5 w-3.5" />}>
                Open the uploaded video on YouTube (web or mobile).
              </Step>
              <Step n={2} icon={<Copy className="h-3.5 w-3.5" />}>
                Tap <span className="font-medium text-foreground">Share</span>{' '}
                → <span className="font-medium text-foreground">Copy link</span>
                .
              </Step>
              <Step n={3} icon={<Link2 className="h-3.5 w-3.5" />}>
                Paste the link in the field below and click{' '}
                <span className="font-medium text-foreground">Embed Video</span>
                .
              </Step>
            </ol>
          </div>

          {/* Facebook */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1877F2]/10 text-[#1877F2]">
                <Facebook className="h-4 w-4" aria-hidden />
              </span>
              <p className="text-sm font-semibold">Facebook</p>
            </div>
            <ol className="space-y-2 pl-1 text-sm text-muted-foreground">
              <Step n={1} icon={<PlayCircle className="h-3.5 w-3.5" />}>
                Open the post containing the video on Facebook.
              </Step>
              <Step n={2} icon={<Copy className="h-3.5 w-3.5" />}>
                Click <span className="font-medium text-foreground">Share</span>{' '}
                →{' '}
                <span className="font-medium text-foreground">
                  Copy link
                </span>
                . Make sure the post is set to{' '}
                <span className="font-medium text-foreground">Public</span>.
              </Step>
              <Step n={3} icon={<Link2 className="h-3.5 w-3.5" />}>
                Paste the link in the field below.
              </Step>
            </ol>
          </div>

          <div className="rounded-lg border border-warning-amber/30 bg-warning-amber/5 p-3 text-xs text-warning-amber">
            <p className="font-medium">Tip</p>
            <p className="mt-0.5 leading-relaxed text-warning-amber/90">
              Private or unlisted videos won&apos;t play for the public
              dashboard — make sure the post is publicly visible before sharing
              its link.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Step({
  n,
  icon,
  children,
}: {
  n: number;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground">
        {n}
      </span>
      <span className="flex items-baseline gap-1.5 text-sm leading-relaxed">
        <span aria-hidden className="text-muted-foreground">
          {icon}
        </span>
        <span>{children}</span>
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function EmbedVideoForm({
  projectId,
  indicatorId,
  initialVideos = [],
}: Props) {
  void indicatorId;

  const router = useRouter();
  const [platform, setPlatform] = useState<Platform>('youtube');
  const [url, setUrl] = useState('');
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [videos, setVideos] = useState<EmbedVideoItem[]>(initialVideos);

  // Live derived
  const embedSrc = useMemo(
    () => buildEmbedSrc(platform, url),
    [platform, url],
  );
  const isValid = !!embedSrc;
  const showError = url.trim().length > 0 && !isValid;

  const placeholder =
    platform === 'youtube'
      ? 'https://www.youtube.com/watch?v=...'
      : 'https://www.facebook.com/.../videos/...';

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!embedSrc) return;
    startTransition(async () => {
      // TODO: replace with POST /api/indicators/[id]/embed-video
      await new Promise((r) => setTimeout(r, 700));
      const stamp = new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      setVideos((v) => [
        {
          galleryId: Date.now(),
          platform,
          originalUrl: url.trim(),
          embedSrc,
          addedOn: stamp,
        },
        ...v,
      ]);
      setSaved(true);
      setUrl('');
      setTimeout(() => {
        router.push(
          `/officer/projects/${projectId}/indicators?updated=1`,
        );
      }, 1200);
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6" aria-label="Embed video">
      {/* ================= SECTION 1 — EMBED ================= */}
      <Card className="overflow-hidden shadow-sm">
        <SectionHeader
          icon={<Video className="h-4 w-4" />}
          title="Embed Video Link"
        />
        <CardContent className="space-y-6 p-6">
          {/* Instruction card */}
          <div className="rounded-lg border border-warning-amber/30 bg-warning-amber/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex flex-1 items-start gap-3">
                <Info
                  className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning-amber"
                  aria-hidden
                />
                <div className="space-y-1.5">
                  <p className="font-malayalam text-sm leading-relaxed text-foreground">
                    നിങ്ങൾ സോഷ്യൽ മീഡിയയിൽ (Facebook / Youtube) അപ്‌ലോഡ് ചെയ്ത
                    വീഡിയോയുടെ ലിങ്ക് കോപ്പി ചെയ്ത ശേഷം ലിങ്ക് ഇവിടെ
                    നൽകേണ്ടതാണ്.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Copy the link of the video you uploaded to Facebook or
                    YouTube and paste it here.
                  </p>
                </div>
              </div>
              <HowToEmbedDialog />
            </div>
          </div>

          {/* Platform selector */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Source platform
            </Label>
            <div
              role="radiogroup"
              aria-label="Source platform"
              className="grid grid-cols-2 gap-3"
            >
              <PlatformToggle
                value="youtube"
                current={platform}
                onSelect={setPlatform}
                colour="#FF0000"
                icon={<Youtube className="h-4 w-4" />}
                label="YouTube"
              />
              <PlatformToggle
                value="facebook"
                current={platform}
                onSelect={setPlatform}
                colour="#1877F2"
                icon={<Facebook className="h-4 w-4" />}
                label="Facebook"
              />
            </div>
          </div>

          {/* URL input */}
          <div className="space-y-1.5">
            <Label htmlFor="video-url">Paste Video Link</Label>
            <Textarea
              id="video-url"
              rows={3}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={placeholder}
              aria-invalid={showError}
              className={cn(
                'resize-y font-mono text-sm',
                showError && 'border-error-red focus-visible:ring-error-red',
              )}
            />
            {showError && (
              <p
                role="alert"
                className="flex items-center gap-1.5 text-xs font-medium text-error-red"
              >
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                Please enter a valid {platform === 'youtube'
                  ? 'YouTube'
                  : 'Facebook'}{' '}
                URL.
              </p>
            )}
            {isValid && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-success-green">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                URL recognised — see preview below.
              </p>
            )}
          </div>

          {/* Live preview */}
          {isValid && embedSrc && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Preview
                </Label>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-xs font-medium text-kerala-blue hover:underline"
                >
                  Open original
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              </div>
              <div className="overflow-hidden rounded-lg border-2 border-success-green/40 bg-black shadow-sm">
                <div className="relative aspect-video">
                  <iframe
                    key={embedSrc}
                    src={embedSrc}
                    title="Video preview"
                    className="absolute inset-0 h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            size="lg"
            disabled={!isValid || pending || saved}
            className={cn(
              'h-12 w-full cursor-pointer text-sm font-semibold uppercase tracking-wide shadow-md transition-all duration-200 hover:shadow-lg',
              saved
                ? 'bg-success-green hover:bg-success-green/90'
                : 'bg-[#2E7D32] hover:bg-[#256328]',
            )}
          >
            {pending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Saving…
              </>
            ) : saved ? (
              <>
                <Check className="h-5 w-5" />
                Video embedded successfully
              </>
            ) : (
              <>
                <Video className="h-5 w-5" />
                Embed Video
                <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* ================= SECTION 2 — VIDEO GALLERY ================= */}
      <Card className="overflow-hidden shadow-sm">
        <SectionHeader
          icon={<PlayCircle className="h-4 w-4" />}
          title="Video Gallery"
        />
        <CardContent className="space-y-4 p-6">
          {videos.length === 0 ? (
            <div className="flex items-start gap-3 rounded-lg border border-warning-amber/30 bg-warning-amber/10 p-4">
              <AlertTriangle
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning-amber"
                aria-hidden
              />
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-warning-amber">
                  Video not uploaded!
                </p>
                <p className="text-xs text-muted-foreground">
                  Embed a video using the form above to add it to this gallery.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {videos.map((v) => (
                <VideoCard
                  key={v.galleryId}
                  video={v}
                  onRemove={() =>
                    setVideos((list) =>
                      list.filter((x) => x.galleryId !== v.galleryId),
                    )
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function PlatformToggle({
  value,
  current,
  onSelect,
  colour,
  icon,
  label,
}: {
  value: Platform;
  current: Platform;
  onSelect: (v: Platform) => void;
  colour: string;
  icon: React.ReactNode;
  label: string;
}) {
  const selected = value === current;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(value)}
      style={selected ? { backgroundColor: colour, borderColor: colour } : { borderColor: colour }}
      className={cn(
        'flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md border-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'text-white shadow-sm'
          : 'bg-background text-foreground hover:bg-muted',
      )}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </button>
  );
}

function VideoCard({
  video,
  onRemove,
}: {
  video: EmbedVideoItem;
  onRemove: () => void;
}) {
  const isYt = video.platform === 'youtube';
  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm transition-all duration-200 hover:shadow-md">
      <div className="relative aspect-video bg-black">
        <iframe
          src={video.embedSrc}
          title={`Embedded ${video.platform} video`}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <span
            style={{
              backgroundColor: isYt ? '#FF0000' : '#1877F2',
            }}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
          >
            {isYt ? (
              <Youtube className="h-3 w-3" aria-hidden />
            ) : (
              <Facebook className="h-3 w-3" aria-hidden />
            )}
            {isYt ? 'YouTube' : 'Facebook'}
          </span>
          <a
            href={video.originalUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-xs font-medium text-kerala-blue hover:underline"
          >
            Open
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Added on{' '}
          <span className="font-medium text-foreground">{video.addedOn}</span>
        </p>
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRemove}
            className="cursor-pointer border-error-red/50 text-error-red transition-colors duration-200 hover:bg-error-red hover:text-white"
            aria-label="Remove this embedded video"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}
