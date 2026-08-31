import { describe, expect, it } from 'vitest';
import { sanitizeFilename } from './filename';

describe('sanitizeFilename', () => {
  it('removes traversal, control characters, and reserved filename characters', () => {
    expect(sanitizeFilename('../../bad\u0000:name?.mp4')).toBe('bad_name_.mp4');
  });

  it('replaces Windows device names', () => {
    expect(sanitizeFilename('CON.mp4', 'video.mp4')).toBe('video.mp4');
  });

  it('bounds long UTF-8 names while preserving the extension', () => {
    const result = sanitizeFilename(`${'映像'.repeat(100)}.webm`);
    expect(Buffer.byteLength(result, 'utf8')).toBeLessThanOrEqual(220);
    expect(result.endsWith('.webm')).toBe(true);
  });
});
