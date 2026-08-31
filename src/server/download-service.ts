import type {
  DownloadPhase,
  DownloadProgress,
  MediaInfo,
  MediaQuality,
  MediaType,
} from '@/types/download';
import type { ValidYouTubeUrl } from '@/lib/youtube-url';

export interface DownloadServiceRequest {
  canonicalUrl: string;
  sourceId: string;
  sourceKind: ValidYouTubeUrl['kind'];
  mediaType: MediaType;
  quality: MediaQuality;
}

export interface DownloadServiceResult {
  filePath: string;
  filename: string;
  sizeBytes: number;
  workDir: string;
}

export interface DownloadCallbacks {
  onProgress(progress: DownloadProgress): void;
  onStage(phase: DownloadPhase): void;
}

export interface DownloadService {
  download(
    request: DownloadServiceRequest,
    callbacks: DownloadCallbacks,
    signal: AbortSignal,
  ): Promise<DownloadServiceResult>;
  inspect(request: DownloadServiceRequest, signal: AbortSignal): Promise<MediaInfo>;
  removeWorkDir(workDir: string): Promise<void>;
}
