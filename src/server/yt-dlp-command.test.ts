import { describe, expect, it } from 'vitest';
import type { DownloadServiceRequest } from './download-service';
import { buildYtDlpArguments } from './yt-dlp-command';

const baseRequest: DownloadServiceRequest = {
  canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  sourceId: 'dQw4w9WgXcQ',
  sourceKind: 'video',
  mediaType: 'video',
  quality: 'best',
};
const config = { ffmpegPath: '/opt/tools/ffmpeg', maxFileSize: '2G' };

describe('buildYtDlpArguments', () => {
  it('constructs absolute-best arguments with an explicit argument terminator', () => {
    const args = buildYtDlpArguments(baseRequest, config);
    expect(args[args.indexOf('--format') + 1]).toBe('bv*+ba/b');
    expect(args).toContain('--no-playlist');
    expect(args).toContain('--progress');
    expect(args).toContain('--newline');
    expect(args).toContain('--no-colors');
    expect(args).toContain('--max-filesize');
    expect(args).not.toContain('--merge-output-format');
    expect(args.at(-2)).toBe('--');
    expect(args.at(-1)).toBe(baseRequest.canonicalUrl);
  });

  it('caps video resolution at the selected quality', () => {
    const args = buildYtDlpArguments({ ...baseRequest, quality: '1080' }, config);
    const format = args[args.indexOf('--format') + 1];
    expect(format).toBe('bv*[height<=1080]+ba/b[height<=1080]');
  });

  it('extracts audio at the selected MP3 bitrate', () => {
    const args = buildYtDlpArguments(
      { ...baseRequest, mediaType: 'audio', quality: '192' },
      config,
    );
    expect(args[args.indexOf('--format') + 1]).toBe('ba/b');
    expect(args.slice(args.indexOf('--extract-audio'), -2)).toEqual([
      '--extract-audio',
      '--audio-format',
      'mp3',
      '--audio-quality',
      '192K',
    ]);
  });

  it('enables playlists with an item cap and numbered filenames', () => {
    const args = buildYtDlpArguments(
      { ...baseRequest, sourceKind: 'playlist', sourceId: 'PL1234567890abcdef' },
      config,
    );
    expect(args).toContain('--yes-playlist');
    expect(args).toContain('--playlist-end');
    expect(args[args.indexOf('--output') + 1]).toContain('%(playlist_index)03d');
    expect(args).not.toContain('--no-playlist');
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
