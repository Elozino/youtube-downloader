export interface ValidYouTubeUrl {
  videoId: string;
  canonicalUrl: string;
}

export type YouTubeUrlResult = { ok: true; value: ValidYouTubeUrl } | { ok: false; error: string };

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
]);

export function validateYouTubeUrl(input: string): YouTubeUrlResult {
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 2_048) {
    return { ok: false, error: 'Enter a valid YouTube video URL.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: 'Enter a complete HTTPS YouTube URL.' };
  }

  if (
    parsed.protocol !== 'https:' ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.port !== ''
  ) {
    return { ok: false, error: 'Only standard HTTPS YouTube URLs are supported.' };
  }

  const host = parsed.hostname.toLowerCase();
  let candidate: string | null = null;

  if (host === 'youtu.be') {
    const parts = parsed.pathname.split('/').filter(Boolean);
    candidate = parts.length === 1 ? parts[0] : null;
  } else if (YOUTUBE_HOSTS.has(host)) {
    if (parsed.pathname === '/watch') {
      candidate = parsed.searchParams.get('v');
    } else {
      const match = parsed.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)\/?$/);
      candidate = match?.[1] ?? null;
    }
  } else {
    return { ok: false, error: 'This URL is not from a supported YouTube host.' };
  }

  if (!candidate || !VIDEO_ID.test(candidate)) {
    return { ok: false, error: 'This does not appear to be a supported YouTube video URL.' };
  }

  return {
    ok: true,
    value: {
      videoId: candidate,
      canonicalUrl: `https://www.youtube.com/watch?v=${candidate}`,
    },
  };
}
