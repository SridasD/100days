export type FacebookVideoValidationError =
  | "empty"
  | "invalid_url"
  | "unsupported_protocol"
  | "unsupported_host"
  | "not_video_url";

export interface FacebookVideoValidationResult {
  ok: boolean;
  originalUrl: string | null;
  embedUrl: string | null;
  error: FacebookVideoValidationError | null;
}

const FB_HOSTS = new Set([
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "fb.watch",
  "www.fb.watch",
]);

const FB_VIDEO_PATH_RE =
  /\/(?:watch|reel\/\d+|share\/v\/[A-Za-z0-9_-]+|[^/]+\/videos\/\d+)/i;
const FB_WATCH_QUERY_ID_RE = /^\d+$/;

function normalizeInput(input: string): string {
  return input.trim();
}

function parseUrl(input: string): URL | null {
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

function isHttps(url: URL): boolean {
  return url.protocol === "https:";
}

function isFacebookHost(url: URL): boolean {
  return FB_HOSTS.has(url.hostname.toLowerCase());
}

function isFacebookVideoUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  if (host.includes("fb.watch")) {
    const slug = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return slug.length > 0;
  }

  const path = url.pathname;
  const watchId = url.searchParams.get("v");
  const hasWatchId = watchId ? FB_WATCH_QUERY_ID_RE.test(watchId) : false;
  return FB_VIDEO_PATH_RE.test(path) || hasWatchId;
}

export function buildFacebookEmbedUrl(originalUrl: string): string {
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
    originalUrl,
  )}&show_text=false&width=560`;
}

export function extractFacebookOriginalUrlFromEmbed(
  maybeEmbedUrl: string,
): string | null {
  const parsed = parseUrl(normalizeInput(maybeEmbedUrl));
  if (!parsed) return null;
  const host = parsed.hostname.toLowerCase();
  const isPluginHost = host === "www.facebook.com" || host === "facebook.com";
  if (!isPluginHost || parsed.pathname !== "/plugins/video.php") return null;
  const href = parsed.searchParams.get("href");
  if (!href) return null;
  return href;
}

export function validateFacebookVideoSource(
  source: string,
): FacebookVideoValidationResult {
  const raw = normalizeInput(source);
  if (!raw) {
    return {
      ok: false,
      originalUrl: null,
      embedUrl: null,
      error: "empty",
    };
  }

  const sourceOriginal = extractFacebookOriginalUrlFromEmbed(raw) ?? raw;
  const parsed = parseUrl(sourceOriginal);
  if (!parsed) {
    return {
      ok: false,
      originalUrl: null,
      embedUrl: null,
      error: "invalid_url",
    };
  }

  if (!isHttps(parsed)) {
    return {
      ok: false,
      originalUrl: null,
      embedUrl: null,
      error: "unsupported_protocol",
    };
  }

  if (!isFacebookHost(parsed)) {
    return {
      ok: false,
      originalUrl: null,
      embedUrl: null,
      error: "unsupported_host",
    };
  }

  if (!isFacebookVideoUrl(parsed)) {
    return {
      ok: false,
      originalUrl: null,
      embedUrl: null,
      error: "not_video_url",
    };
  }

  const originalUrl = parsed.toString();
  return {
    ok: true,
    originalUrl,
    embedUrl: buildFacebookEmbedUrl(originalUrl),
    error: null,
  };
}
