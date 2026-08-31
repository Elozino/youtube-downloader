export const QUALITY_MODES = ['best', 'mp4'] as const;

export type QualityMode = (typeof QUALITY_MODES)[number];

export type DownloadStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface DownloadProgress {
  percent: number | null;
  downloadedBytes: number | null;
  totalBytes: number | null;
  speedBytesPerSecond: number | null;
  etaSeconds: number | null;
}

export interface DownloadJobView {
  id: string;
  status: DownloadStatus;
  mode: QualityMode;
  videoId: string;
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
  mode: QualityMode;
  confirmAuthorization: true;
}
