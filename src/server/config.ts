import os from 'node:os';
import path from 'node:path';

export interface DownloadConfig {
  ytDlpPath: string;
  ffmpegPath: string;
  tempRoot: string;
  maxConcurrent: number;
  maxPerClient: number;
  maxRequestsPerHour: number;
  maxFileSize: string;
  maxRuntimeMs: number;
  completedTtlMs: number;
  trustProxy: boolean;
}

export function loadDownloadConfig(env: NodeJS.ProcessEnv = process.env): DownloadConfig {
  const maxFileSize = env.DOWNLOAD_MAX_FILESIZE ?? '2G';
  if (!/^\d+(?:\.\d+)?[KMGTP]?$/i.test(maxFileSize)) {
    throw new Error(
      'DOWNLOAD_MAX_FILESIZE must be a number with an optional K, M, G, T, or P suffix.',
    );
  }

  return {
    ytDlpPath: env.YTDLP_PATH ?? 'yt-dlp',
    ffmpegPath: env.FFMPEG_PATH ?? 'ffmpeg',
    tempRoot: env.DOWNLOAD_TEMP_DIR ?? path.join(os.tmpdir(), 'authorized-youtube-downloader'),
    maxConcurrent: integerInRange(env.DOWNLOAD_MAX_CONCURRENT, 2, 1, 20),
    maxPerClient: integerInRange(env.DOWNLOAD_MAX_PER_CLIENT, 1, 1, 5),
    maxRequestsPerHour: integerInRange(env.DOWNLOAD_MAX_REQUESTS_PER_HOUR, 10, 1, 1_000),
    maxFileSize,
    maxRuntimeMs: integerInRange(env.DOWNLOAD_MAX_RUNTIME_SECONDS, 1_800, 30, 86_400) * 1_000,
    completedTtlMs: integerInRange(env.DOWNLOAD_COMPLETED_TTL_SECONDS, 900, 30, 86_400) * 1_000,
    trustProxy: env.TRUST_PROXY?.toLowerCase() === 'true',
  };
}

function integerInRange(
  raw: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Expected an integer from ${minimum} to ${maximum}, received ${raw}.`);
  }
  return parsed;
}
