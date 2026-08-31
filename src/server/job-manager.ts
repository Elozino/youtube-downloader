import 'server-only';

import { randomUUID } from 'node:crypto';
import type {
  DownloadJobView,
  DownloadProgress,
  DownloadStatus,
  QualityMode,
} from '@/types/download';
import type { ValidYouTubeUrl } from '@/lib/youtube-url';
import type { DownloadConfig } from './config';
import type { DownloadService, DownloadServiceResult } from './download-service';

interface InternalJob {
  id: string;
  clientId: string;
  status: DownloadStatus;
  mode: QualityMode;
  videoId: string;
  canonicalUrl: string;
  progress: DownloadProgress;
  controller: AbortController;
  result?: DownloadServiceResult;
  fileClaimed: boolean;
  error?: string;
  createdAt: Date;
  expiresAt?: Date;
}

export class JobLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JobLimitError';
  }
}

export class DownloadJobManager {
  private readonly jobs = new Map<string, InternalJob>();
  private readonly requestHistory = new Map<string, number[]>();

  constructor(
    private readonly service: DownloadService,
    private readonly config: DownloadConfig,
  ) {}

  create(clientId: string, source: ValidYouTubeUrl, mode: QualityMode): DownloadJobView {
    this.enforceLimits(clientId);

    const job: InternalJob = {
      id: randomUUID(),
      clientId,
      status: 'queued',
      mode,
      videoId: source.videoId,
      canonicalUrl: source.canonicalUrl,
      progress: emptyProgress(),
      controller: new AbortController(),
      fileClaimed: false,
      createdAt: new Date(),
    };

    this.jobs.set(job.id, job);
    this.recordRequest(clientId);
    void this.execute(job);
    return this.toView(job);
  }

  get(id: string): DownloadJobView | undefined {
    const job = this.jobs.get(id);
    return job ? this.toView(job) : undefined;
  }

  cancel(id: string): DownloadJobView | undefined {
    const job = this.jobs.get(id);
    if (!job) return undefined;

    if (job.status === 'queued' || job.status === 'running') {
      job.status = 'cancelled';
      job.error = undefined;
      job.controller.abort();
      this.scheduleMetadataRemoval(job);
    }

    return this.toView(job);
  }

  claimFile(id: string): DownloadServiceResult | undefined {
    const job = this.jobs.get(id);
    if (job?.status !== 'completed' || !job.result || job.fileClaimed) return undefined;
    job.fileClaimed = true;
    return job.result;
  }

  async releaseFile(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job?.result) return;
    const { workDir } = job.result;
    job.result = undefined;
    await this.service.removeWorkDir(workDir);
  }

  private async execute(job: InternalJob): Promise<void> {
    job.status = 'running';
    let timedOut = false;
    const runtimeTimer = setTimeout(() => {
      timedOut = true;
      job.controller.abort();
    }, this.config.maxRuntimeMs);
    runtimeTimer.unref();

    try {
      const result = await this.service.download(
        {
          canonicalUrl: job.canonicalUrl,
          videoId: job.videoId,
          mode: job.mode,
        },
        {
          onProgress: (progress) => {
            if (job.status === 'running') job.progress = progress;
          },
        },
        job.controller.signal,
      );

      if (job.controller.signal.aborted) {
        await this.service.removeWorkDir(result.workDir);
        job.status = timedOut ? 'failed' : 'cancelled';
        if (timedOut) job.error = 'The download exceeded the configured time limit.';
      } else {
        job.result = result;
        job.status = 'completed';
        job.progress = { ...job.progress, percent: 100, downloadedBytes: result.sizeBytes };
        job.expiresAt = new Date(Date.now() + this.config.completedTtlMs);
      }
    } catch (error) {
      if (timedOut) {
        job.status = 'failed';
        job.error = 'The download exceeded the configured time limit.';
      } else if (job.controller.signal.aborted || isAbortError(error)) {
        job.status = 'cancelled';
      } else {
        job.status = 'failed';
        job.error = publicError(error);
      }
    } finally {
      clearTimeout(runtimeTimer);
      this.scheduleMetadataRemoval(job);
    }
  }

  private enforceLimits(clientId: string): void {
    const active = [...this.jobs.values()].filter(
      (job) => job.status === 'queued' || job.status === 'running',
    );

    if (active.length >= this.config.maxConcurrent) {
      throw new JobLimitError('The server is at its download limit. Try again shortly.');
    }

    if (active.filter((job) => job.clientId === clientId).length >= this.config.maxPerClient) {
      throw new JobLimitError('You already have a download in progress.');
    }

    const cutoff = Date.now() - 60 * 60 * 1_000;
    const recent = (this.requestHistory.get(clientId) ?? []).filter((time) => time >= cutoff);
    this.requestHistory.set(clientId, recent);
    if (recent.length >= this.config.maxRequestsPerHour) {
      throw new JobLimitError('The hourly download limit has been reached. Try again later.');
    }
  }

  private recordRequest(clientId: string): void {
    const history = this.requestHistory.get(clientId) ?? [];
    history.push(Date.now());
    this.requestHistory.set(clientId, history);
  }

  private scheduleMetadataRemoval(job: InternalJob): void {
    const delay = job.status === 'completed' ? this.config.completedTtlMs : 5 * 60 * 1_000;
    if (job.status === 'completed' && !job.expiresAt) {
      job.expiresAt = new Date(Date.now() + delay);
    }

    const timer = setTimeout(() => {
      const current = this.jobs.get(job.id);
      if (current !== job) return;
      if (current.fileClaimed) {
        this.scheduleMetadataRemoval(current);
        return;
      }
      if (current.result) void this.service.removeWorkDir(current.result.workDir);
      this.jobs.delete(job.id);
    }, delay);
    timer.unref();
  }

  private toView(job: InternalJob): DownloadJobView {
    return {
      id: job.id,
      status: job.status,
      mode: job.mode,
      videoId: job.videoId,
      progress: job.progress,
      filename: job.result?.filename,
      sizeBytes: job.result?.sizeBytes,
      error: job.error,
      createdAt: job.createdAt.toISOString(),
      expiresAt: job.expiresAt?.toISOString(),
      downloadUrl:
        job.status === 'completed' && job.result && !job.fileClaimed
          ? `/api/downloads/${job.id}/file`
          : undefined,
    };
  }
}

function emptyProgress(): DownloadProgress {
  return {
    percent: null,
    downloadedBytes: null,
    totalBytes: null,
    speedBytesPerSecond: null,
    etaSeconds: null,
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function publicError(error: unknown): string {
  if (!(error instanceof Error)) return 'The download failed unexpectedly.';
  return error.message.slice(0, 500) || 'The download failed unexpectedly.';
}
