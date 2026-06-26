'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, Facebook, Loader2, RefreshCw } from 'lucide-react';
import {
    validateFacebookVideoSource,
    type FacebookVideoValidationResult,
} from '@/lib/media/facebook';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';
type ErrorReason =
    | 'invalid_url'
    | 'load_error'
    | 'timeout'
    | 'restricted_or_unavailable';

interface FacebookVideoEmbedProps {
    sourceUrl: string;
    title?: string;
    className?: string;
    timeoutMs?: number;
}

function errorMessage(reason: ErrorReason): string {
    switch (reason) {
        case 'invalid_url':
            return 'Invalid Facebook video URL. Please verify the link.';
        case 'load_error':
            return 'We could not load this Facebook video. Please try again.';
        case 'timeout':
            return 'Video loading timed out. Check your connection and retry.';
        case 'restricted_or_unavailable':
            return 'This video may be deleted, private, restricted, or embedding is disabled.';
        default:
            return 'Unable to load Facebook video.';
    }
}

function openInNewTab(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer');
}

export function FacebookVideoEmbed({
    sourceUrl,
    title = 'Facebook video',
    className,
    timeoutMs = 12000,
}: FacebookVideoEmbedProps) {
    const validation: FacebookVideoValidationResult = useMemo(
        () => validateFacebookVideoSource(sourceUrl),
        [sourceUrl],
    );

    const [loadState, setLoadState] = useState<LoadState>('idle');
    const [errorReason, setErrorReason] = useState<ErrorReason | null>(null);
    const [retryToken, setRetryToken] = useState(0);

    const hasPlayableSource = validation.ok && !!validation.embedUrl;

    useEffect(() => {
        setLoadState('idle');
        setErrorReason(null);
        setRetryToken(0);
    }, [sourceUrl]);

    useEffect(() => {
        if (!hasPlayableSource || loadState !== 'loading') return;
        const timer = window.setTimeout(() => {
            setLoadState('error');
            setErrorReason('timeout');
        }, timeoutMs);
        return () => window.clearTimeout(timer);
    }, [hasPlayableSource, loadState, timeoutMs, retryToken]);

    const fallbackReason: ErrorReason | null = !validation.ok
        ? 'invalid_url'
        : errorReason;

    const showFallback = fallbackReason !== null;
    const originalUrl = validation.originalUrl;

    return (
        <div className={className}>
            <div className="relative aspect-video overflow-hidden rounded-xl border bg-black">
                {loadState === 'idle' && hasPlayableSource && (
                    <button
                        type="button"
                        onClick={() => {
                            setLoadState('loading');
                            setErrorReason(null);
                        }}
                        className="group absolute inset-0 flex cursor-pointer items-center justify-center bg-gradient-to-br from-[#0e0e0e] via-[#1a1a1a] to-[#0f0f0f]"
                        aria-label="Load Facebook video"
                    >
                        <span className="inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-[#1877F2] shadow-lg transition-transform duration-200 group-hover:scale-105">
                            <Facebook className="h-4 w-4" />
                            Play Facebook video
                        </span>
                    </button>
                )}

                {loadState === 'loading' && hasPlayableSource && (
                    <>
                        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#121212] via-[#1f1f1f] to-[#121212]" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading video...
                            </div>
                        </div>
                    </>
                )}

                {(loadState === 'loading' || loadState === 'ready') && hasPlayableSource && !showFallback && (
                    <iframe
                        key={`${validation.embedUrl}-${retryToken}`}
                        src={`${validation.embedUrl}${validation.embedUrl.includes('?') ? '&' : '?'}autoplay=1`}
                        title={title}
                        loading="lazy"
                        className={`absolute inset-0 h-full w-full ${loadState === 'ready' ? 'opacity-100' : 'opacity-0'}`}
                        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                        onLoad={() => {
                            // Facebook can return plugin frames that indicate unavailable content.
                            // We mark as ready here and keep timeout/error fallback for failures.
                            setLoadState('ready');
                        }}
                        onError={() => {
                            setLoadState('error');
                            setErrorReason('load_error');
                        }}
                    />
                )}

                {showFallback && (
                    <div
                        role="status"
                        aria-live="polite"
                        className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#1a1a1a] via-[#121212] to-[#1a1a1a] p-4 text-center"
                    >
                        <AlertTriangle className="h-7 w-7 text-[#F59E0B]" />
                        <p className="max-w-sm text-xs text-white/90">{errorMessage(fallbackReason)}</p>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            {originalUrl && (
                                <button
                                    type="button"
                                    onClick={() => openInNewTab(originalUrl)}
                                    className="inline-flex items-center gap-1.5 rounded-full bg-[#1877F2] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1668D1]"
                                    aria-label="Watch on Facebook"
                                >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    Watch on Facebook
                                </button>
                            )}
                            {hasPlayableSource && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setRetryToken((x) => x + 1);
                                        setErrorReason(null);
                                        setLoadState('loading');
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-white"
                                    aria-label="Retry loading video"
                                >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    Retry
                                </button>
                            )}
                        </div>
                        {hasPlayableSource && (
                            <p className="max-w-md text-[11px] text-white/60">
                                If retry fails, the video may be deleted, private, restricted, or embedding may be disabled by Facebook.
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
