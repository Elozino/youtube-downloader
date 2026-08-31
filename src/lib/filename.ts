import path from 'node:path';

const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

export function sanitizeFilename(input: string, fallback = 'youtube-video.mp4'): string {
  const base = path.basename(input).normalize('NFKC');
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim();

  const safe = cleaned && !WINDOWS_RESERVED.test(cleaned) ? cleaned : fallback;
  return truncateUtf8(safe, 220) || fallback;
}

function truncateUtf8(value: string, maxBytes: number): string {
  if (Buffer.byteLength(value, 'utf8') <= maxBytes) return value;

  const extension = path.extname(value).slice(0, 16);
  const stem = extension ? value.slice(0, -extension.length) : value;
  const budget = maxBytes - Buffer.byteLength(extension, 'utf8');
  let output = '';

  for (const character of stem) {
    if (Buffer.byteLength(output + character, 'utf8') > budget) break;
    output += character;
  }

  return `${output.trim()}${extension}`;
}
