import type { DownloadProgress, QualityMode } from '@/types/download';

export interface DownloadServiceRequest {
  canonicalUrl: string;
  videoId: string;
  mode: QualityMode;
}

export interface DownloadServiceResult {
  filePath: string;
  filename: string;
  sizeBytes: number;
  workDir: string;
}

export interface DownloadCallbacks {
  onProgress(progress: DownloadProgress): void;
}

export interface DownloadService {
  download(
    request: DownloadServiceRequest,
    callbacks: DownloadCallbacks,
    signal: AbortSignal,
  ): Promise<DownloadServiceResult>;
  removeWorkDir(workDir: string): Promise<void>;
}
