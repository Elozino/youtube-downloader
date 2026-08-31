import type { DownloadConfig } from './config';
import type { DownloadServiceRequest } from './download-service';

export const MAX_PLAYLIST_ITEMS = 50;

export function formatSelector(
  request: Pick<DownloadServiceRequest, 'mediaType' | 'quality'>,
): string {
  if (request.mediaType === 'audio') return 'ba/b';
  if (request.quality === 'best') return 'bv*+ba/b';
  return `bv*[height<=${request.quality}]+ba/b[height<=${request.quality}]`;
}

export function buildYtDlpArguments(
  request: DownloadServiceRequest,
  config: Pick<DownloadConfig, 'ffmpegPath' | 'maxFileSize'>,
): string[] {
  const playlistArgs =
    request.sourceKind === 'playlist'
      ? ['--yes-playlist', '--playlist-end', String(MAX_PLAYLIST_ITEMS)]
      : ['--no-playlist'];
  const output =
    request.sourceKind === 'playlist'
      ? '%(playlist_index)03d - %(title).160B [%(id)s].%(ext)s'
      : '%(title).180B [%(id)s].%(ext)s';

  const args = [
    ...playlistArgs,
    '--progress',
    '--newline',
    '--no-colors',
    '--no-overwrites',
    '--restrict-filenames',
    '--socket-timeout',
    '30',
    '--retries',
    '3',
    '--fragment-retries',
    '3',
    '--max-filesize',
    config.maxFileSize,
    '--ffmpeg-location',
    config.ffmpegPath,
    '--format',
    formatSelector(request),
    '--output',
    output,
    '--progress-template',
    'download:__PROGRESS__%(progress._percent_str)s|%(progress.downloaded_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s|%(info.playlist_index)s|%(info.playlist_count)s',
    '--print',
    'after_move:__FILE__%(filepath)s',
  ];

  if (request.mediaType === 'audio') {
    args.push(
      '--extract-audio',
      '--audio-format',
      'mp3',
      '--audio-quality',
      audioQuality(request.quality),
    );
  }

  args.push('--', request.canonicalUrl);
  return args;
}

export function buildInspectionArguments(request: DownloadServiceRequest): string[] {
  return [
    request.sourceKind === 'playlist' ? '--yes-playlist' : '--no-playlist',
    ...(request.sourceKind === 'playlist' ? ['--playlist-end', String(MAX_PLAYLIST_ITEMS)] : []),
    '--dump-single-json',
    '--skip-download',
    '--no-warnings',
    '--format',
    formatSelector(request),
    '--',
    request.canonicalUrl,
  ];
}

function audioQuality(quality: DownloadServiceRequest['quality']): string {
  return quality === 'best' ? '0' : `${quality}K`;
}
