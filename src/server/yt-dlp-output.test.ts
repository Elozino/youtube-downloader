import { describe, expect, it } from 'vitest';
import type { DownloadServiceRequest } from './download-service';
import { friendlyYtDlpError, mediaInfoFromJson, parseProgress } from './yt-dlp-output';

const videoRequest: DownloadServiceRequest = {
  canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  sourceId: 'dQw4w9WgXcQ',
  sourceKind: 'video',
  mediaType: 'video',
  quality: '1080',
};

describe('yt-dlp output parsing', () => {
  it('parses download progress and unavailable values', () => {
    expect(parseProgress('42.5%|1024|2048|512|2|NA|None')).toEqual({
      phase: 'downloading',
      percent: 42.5,
      downloadedBytes: 1_024,
      totalBytes: 2_048,
      speedBytesPerSecond: 512,
      etaSeconds: 2,
      itemIndex: null,
      itemCount: null,
    });
  });

  it('sums selected video and audio stream estimates', () => {
    expect(
      mediaInfoFromJson(
        {
          title: 'Example',
          duration: 60,
          requested_formats: [{ filesize: 2_000 }, { filesize_approx: 1_000 }],
        },
        videoRequest,
      ),
    ).toMatchObject({ title: 'Example', itemCount: 1, estimatedSizeBytes: 3_000 });
  });

  it('estimates transcoded audio from duration and selected bitrate', () => {
    expect(
      mediaInfoFromJson(
        { title: 'Audio', duration: 100, filesize: 9_999 },
        { ...videoRequest, mediaType: 'audio', quality: '128' },
      ).estimatedSizeBytes,
    ).toBe(1_600_000);
  });

  it('removes the yt-dlp error prefix from public errors', () => {
    expect(friendlyYtDlpError('warning\nERROR: Video unavailable', 1)).toBe('Video unavailable');
  });
});
