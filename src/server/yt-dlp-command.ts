import type { DownloadConfig } from './config';
import type { DownloadServiceRequest } from './download-service';

const ABSOLUTE_BEST = 'bv*+ba/b';
const MP4_COMPATIBLE =
  'bv*[ext=mp4][vcodec^=avc1]+ba[ext=m4a]/b[ext=mp4][vcodec^=avc1]/bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]';

export function buildYtDlpArguments(
  request: DownloadServiceRequest,
  config: Pick<DownloadConfig, 'ffmpegPath' | 'maxFileSize'>,
): string[] {
  const args = [
    '--no-playlist',
    '--newline',
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
    request.mode === 'mp4' ? MP4_COMPATIBLE : ABSOLUTE_BEST,
    '--output',
    '%(title).180B [%(id)s].%(ext)s',
    '--progress-template',
    'download:__PROGRESS__%(progress._percent_str)s|%(progress.downloaded_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s',
    '--print',
    'after_move:__FILE__%(filepath)s',
  ];

  if (request.mode === 'mp4') {
    args.push('--merge-output-format', 'mp4');
  }

  args.push('--', request.canonicalUrl);
  return args;
}
