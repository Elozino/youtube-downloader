import { describe, expect, it } from 'vitest';
import type { DownloadServiceRequest } from './download-service';
import { buildYtDlpArguments } from './yt-dlp-command';

const baseRequest: DownloadServiceRequest = {
  canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  videoId: 'dQw4w9WgXcQ',
  mode: 'best',
};
const config = { ffmpegPath: '/opt/tools/ffmpeg', maxFileSize: '2G' };

describe('buildYtDlpArguments', () => {
  it('constructs absolute-best arguments with an explicit argument terminator', () => {
    const args = buildYtDlpArguments(baseRequest, config);
    expect(args[args.indexOf('--format') + 1]).toBe('bv*+ba/b');
    expect(args).toContain('--no-playlist');
    expect(args).toContain('--max-filesize');
    expect(args).not.toContain('--merge-output-format');
    expect(args.at(-2)).toBe('--');
    expect(args.at(-1)).toBe(baseRequest.canonicalUrl);
  });

  it('uses MP4-native streams and requests an MP4 merge in compatible mode', () => {
    const args = buildYtDlpArguments({ ...baseRequest, mode: 'mp4' }, config);
    const format = args[args.indexOf('--format') + 1];
    expect(format).toContain('ext=mp4');
    expect(format).toContain('ext=m4a');
    expect(args.slice(args.indexOf('--merge-output-format'), -2)).toEqual([
      '--merge-output-format',
      'mp4',
    ]);
  });

  it('keeps executable paths and limits as individual arguments', () => {
    const unusualConfig = {
      ffmpegPath: '/path with spaces/ffmpeg; echo unsafe',
      maxFileSize: '750M',
    };
    const args = buildYtDlpArguments(baseRequest, unusualConfig);
    expect(args[args.indexOf('--ffmpeg-location') + 1]).toBe(unusualConfig.ffmpegPath);
    expect(args[args.indexOf('--max-filesize') + 1]).toBe('750M');
  });
});
