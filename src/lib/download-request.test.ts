import { describe, expect, it } from 'vitest';
import { parseCreateDownloadRequest, parseMediaSelection } from './download-request';

describe('download request validation', () => {
  it('accepts matching media and quality values', () => {
    expect(
      parseMediaSelection({
        url: 'https://youtube.test/video',
        mediaType: 'video',
        quality: '1080',
      }),
    ).toEqual({
      ok: true,
      value: {
        url: 'https://youtube.test/video',
        mediaType: 'video',
        quality: '1080',
      },
    });
  });

  it('rejects a quality from the wrong media type', () => {
    expect(
      parseMediaSelection({
        url: 'https://youtube.test/video',
        mediaType: 'audio',
        quality: '1080',
      }),
    ).toEqual({ ok: false, error: 'Choose a supported media quality.' });
  });

  it('requires an explicit authorization confirmation', () => {
    expect(
      parseCreateDownloadRequest({
        url: 'https://youtube.test/video',
        mediaType: 'video',
        quality: 'best',
      }),
    ).toEqual({
      ok: false,
      error: 'Confirm that you own this content or have permission to download it.',
    });
  });
});
