export const MEDIA_TYPES = ['video', 'audio'] as const;
export const VIDEO_QUALITIES = ['best', '2160', '1440', '1080', '720', '480', '360'] as const;
export const AUDIO_QUALITIES = ['best', '256', '192', '128'] as const;

export type MediaType = (typeof MEDIA_TYPES)[number];
export type VideoQuality = (typeof VIDEO_QUALITIES)[number];
export type AudioQuality = (typeof AUDIO_QUALITIES)[number];
export type MediaQuality = VideoQuality | AudioQuality;

export type DownloadStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type DownloadPhase = 'connecting' | 'downloading' | 'processing' | 'packaging';

export interface DownloadProgress {
  phase: DownloadPhase;
  percent: number | null;
  downloadedBytes: number | null;
  totalBytes: number | null;
  speedBytesPerSecond: number | null;
  etaSeconds: number | null;
  itemIndex: number | null;
  itemCount: number | null;
}

export interface DownloadJobView {
  id: string;
  status: DownloadStatus;
  mediaType: MediaType;
  quality: MediaQuality;
  sourceId: string;
  sourceKind: 'video' | 'playlist';
  progress: DownloadProgress;
  filename?: string;
  sizeBytes?: number;
  error?: string;
  createdAt: string;
  expiresAt?: string;
  downloadUrl?: string;
}

export interface CreateDownloadRequest {
  url: string;
  mediaType: MediaType;
  quality: MediaQuality;
  confirmAuthorization: true;
}

export interface MediaInfo {
  title: string;
  sourceKind: 'video' | 'playlist';
  itemCount: number;
  durationSeconds: number | null;
  estimatedSizeBytes: number | null;
}
