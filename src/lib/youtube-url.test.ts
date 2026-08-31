import { describe, expect, it } from 'vitest';
import { validateYouTubeUrl } from './youtube-url';

const ID = 'dQw4w9WgXcQ';

describe('validateYouTubeUrl', () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}?si=ignored`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/live/${ID}?feature=share`,
    `https://www.youtube.com/embed/${ID}`,
  ])('accepts and canonicalizes %s', (input) => {
    expect(validateYouTubeUrl(input)).toEqual({
      ok: true,
      value: {
        sourceId: ID,
        kind: 'video',
        canonicalUrl: `https://www.youtube.com/watch?v=${ID}`,
      },
    });
  });

  it.each([
    `http://youtube.com/watch?v=${ID}`,
    `https://youtube.com.evil.test/watch?v=${ID}`,
    `https://evil.test/?next=https://youtube.com/watch?v=${ID}`,
    `https://user:password@youtube.com/watch?v=${ID}`,
    `https://youtube.com:444/watch?v=${ID}`,
    `https://youtu.be/${ID}/extra`,
    'https://youtube.com/playlist?list=short',
    'https://youtube.com/watch?v=too-short',
    'not a url',
  ])('rejects unsupported or suspicious input %s', (input) => {
    expect(validateYouTubeUrl(input).ok).toBe(false);
  });

  it('does not preserve user-controlled query parameters', () => {
    const result = validateYouTubeUrl(
      `https://youtube.com/watch?v=${ID}&output=$(touch%20/tmp/nope)`,
    );
    expect(result.ok && result.value.canonicalUrl).toBe(`https://www.youtube.com/watch?v=${ID}`);
  });

  it.each([
    'https://www.youtube.com/playlist?list=PL1234567890abcdef',
    `https://www.youtube.com/watch?v=${ID}&list=PL1234567890abcdef&index=2`,
    `https://youtu.be/${ID}?list=PL1234567890abcdef`,
  ])('accepts and canonicalizes playlist URLs %s', (input) => {
    expect(validateYouTubeUrl(input)).toEqual({
      ok: true,
      value: {
        sourceId: 'PL1234567890abcdef',
        kind: 'playlist',
        canonicalUrl: 'https://www.youtube.com/playlist?list=PL1234567890abcdef',
      },
    });
  });
});
