import {
  AUDIO_QUALITIES,
  MEDIA_TYPES,
  VIDEO_QUALITIES,
  type CreateDownloadRequest,
  type MediaQuality,
  type MediaType,
} from '@/types/download';

export interface MediaSelectionRequest {
  url: string;
  mediaType: MediaType;
  quality: MediaQuality;
}

type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseMediaSelection(input: unknown): ValidationResult<MediaSelectionRequest> {
  if (!isRecord(input) || typeof input.url !== 'string') {
    return { ok: false, error: 'A YouTube URL is required.' };
  }
  if (!isMediaType(input.mediaType)) {
    return { ok: false, error: 'Choose audio or video.' };
  }
  if (!isQualityFor(input.mediaType, input.quality)) {
    return { ok: false, error: 'Choose a supported media quality.' };
  }
  return {
    ok: true,
    value: { url: input.url, mediaType: input.mediaType, quality: input.quality },
  };
}

export function parseCreateDownloadRequest(
  input: unknown,
): ValidationResult<CreateDownloadRequest> {
  if (!isRecord(input) || input.confirmAuthorization !== true) {
    return {
      ok: false,
      error: 'Confirm that you own this content or have permission to download it.',
    };
  }
  const selection = parseMediaSelection(input);
  if (!selection.ok) return selection;
  return { ok: true, value: { ...selection.value, confirmAuthorization: true } };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function isMediaType(input: unknown): input is MediaType {
  return typeof input === 'string' && MEDIA_TYPES.some((value) => value === input);
}

function isQualityFor(mediaType: MediaType, input: unknown): input is MediaQuality {
  if (typeof input !== 'string') return false;
  return mediaType === 'audio'
    ? AUDIO_QUALITIES.some((value) => value === input)
    : VIDEO_QUALITIES.some((value) => value === input);
}
