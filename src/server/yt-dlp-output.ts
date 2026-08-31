import type { DownloadProgress, MediaInfo } from '@/types/download';
import type { DownloadServiceRequest } from './download-service';

export interface YtDlpInfo {
  title?: unknown;
  duration?: unknown;
  filesize?: unknown;
  filesize_approx?: unknown;
  requested_downloads?: YtDlpInfo[];
  requested_formats?: YtDlpInfo[];
  entries?: Array<YtDlpInfo | null>;
}

export function parseProgress(value: string): DownloadProgress {
  const [percent, downloaded, total, speed, eta, itemIndex, itemCount] = value
    .split('|')
    .map((part) => part.trim());
  return {
    phase: 'downloading',
    percent: finiteNumber(percent?.replace('%', '')),
    downloadedBytes: finiteNumber(downloaded),
    totalBytes: finiteNumber(total),
    speedBytesPerSecond: finiteNumber(speed),
    etaSeconds: finiteNumber(eta),
    itemIndex: finiteNumber(itemIndex),
    itemCount: finiteNumber(itemCount),
  };
}

export function mediaInfoFromJson(info: YtDlpInfo, request: DownloadServiceRequest): MediaInfo {
  const entries = request.sourceKind === 'playlist' ? (info.entries ?? []).filter(Boolean) : [info];
  const durationSeconds = sumKnown(entries.map((entry) => numeric(entry?.duration)));
  let estimatedSizeBytes = sumKnown(entries.map((entry) => selectedSize(entry!)));

  if (request.mediaType === 'audio' && request.quality !== 'best' && durationSeconds !== null) {
    estimatedSizeBytes = Math.round((durationSeconds * Number(request.quality) * 1_000) / 8);
  }

  return {
    title:
      typeof info.title === 'string'
        ? info.title
        : request.sourceKind === 'playlist'
          ? 'Playlist'
          : 'Video',
    sourceKind: request.sourceKind,
    itemCount: Math.max(1, entries.length),
    durationSeconds,
    estimatedSizeBytes,
  };
}

export function friendlyYtDlpError(stderr: string, code: number | null): string {
  const lastLine = stderr
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);

  if (lastLine?.startsWith('ERROR:')) return lastLine.slice('ERROR:'.length).trim();
  return lastLine || `yt-dlp exited with code ${code ?? 'unknown'}.`;
}

function selectedSize(info: YtDlpInfo): number | null {
  const selected = info.requested_downloads ?? info.requested_formats;
  if (selected?.length) return sumKnown(selected.map(selectedSize));
  return numeric(info.filesize) ?? numeric(info.filesize_approx);
}

function numeric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function sumKnown(values: Array<number | null>): number | null {
  const known = values.filter((value): value is number => value !== null);
  return known.length === values.length && known.length > 0
    ? known.reduce((total, value) => total + value, 0)
    : null;
}

function finiteNumber(value: string | undefined): number | null {
  if (!value || value === 'NA' || value === 'None') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
