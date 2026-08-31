import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ValidYouTubeUrl } from '@/lib/youtube-url';
import type { MediaInfo } from '@/types/download';
import type { DownloadConfig } from './config';
import type {
  DownloadCallbacks,
  DownloadService,
  DownloadServiceRequest,
  DownloadServiceResult,
} from './download-service';
import { DownloadJobManager, JobLimitError } from './job-manager';

const source: ValidYouTubeUrl = {
  sourceId: 'dQw4w9WgXcQ',
  kind: 'video',
  canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
};

const config: DownloadConfig = {
  ytDlpPath: 'yt-dlp',
  ffmpegPath: 'ffmpeg',
  tempRoot: '/tmp/download-manager-test',
  maxConcurrent: 2,
  maxPerClient: 1,
  maxRequestsPerHour: 10,
  maxFileSize: '2G',
  maxRuntimeMs: 30_000,
  inactivityTimeoutMs: 5_000,
  completedTtlMs: 30_000,
  trustProxy: false,
};

describe('DownloadJobManager', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('moves a job through progress to a downloadable result', async () => {
    const manager = new DownloadJobManager(new CompletingService(), config);
    const created = manager.create('client-a', source, 'video', '720');
    const completed = await waitForJob(manager, created.id, 'client-a', 'completed');

    expect(completed.progress).toMatchObject({ phase: 'downloading', percent: 100 });
    expect(completed.sizeBytes).toBe(1_024);
    expect(completed.downloadUrl).toBe(`/api/downloads/${created.id}/file`);

    expect(manager.get(created.id, 'client-b')).toBeUndefined();
    expect(manager.claimFile(created.id, 'client-b')).toBeUndefined();
    expect(manager.claimFile(created.id, 'client-a')?.filename).toBe('video.mp4');
    await manager.releaseFile(created.id);
    expect(manager.get(created.id, 'client-a')).toBeUndefined();
  });

  it('propagates cancellation to the running service', async () => {
    const manager = new DownloadJobManager(new BlockingService(), config);
    const created = manager.create('client-a', source, 'audio', '192');

    expect(manager.cancel(created.id, 'client-b')).toBeUndefined();
    expect(manager.cancel(created.id, 'client-a')?.status).toBe('cancelled');
    expect(
      (await waitForJob(manager, created.id, 'client-a', 'cancelled')).downloadUrl,
    ).toBeUndefined();
  });

  it('enforces the per-client active-job limit', () => {
    const manager = new DownloadJobManager(new BlockingService(), config);
    manager.create('client-a', source, 'video', 'best');

    expect(() => manager.create('client-a', source, 'video', '720')).toThrow(JobLimitError);
  });
});

class CompletingService implements DownloadService {
  async download(
    _request: DownloadServiceRequest,
    callbacks: DownloadCallbacks,
  ): Promise<DownloadServiceResult> {
    callbacks.onProgress({
      phase: 'downloading',
      percent: 50,
      downloadedBytes: 512,
      totalBytes: 1_024,
      speedBytesPerSecond: 256,
      etaSeconds: 2,
      itemIndex: null,
      itemCount: null,
    });
    return {
      filePath: '/tmp/download-manager-test/video.mp4',
      filename: 'video.mp4',
      sizeBytes: 1_024,
      workDir: '/tmp/download-manager-test',
    };
  }

  async inspect(): Promise<MediaInfo> {
    throw new Error('Not used in this test.');
  }

  async removeWorkDir(): Promise<void> {}
}

class BlockingService implements DownloadService {
  download(
    _request: DownloadServiceRequest,
    _callbacks: DownloadCallbacks,
    signal: AbortSignal,
  ): Promise<DownloadServiceResult> {
    return new Promise((_resolve, reject) => {
      signal.addEventListener(
        'abort',
        () => {
          const error = new Error('Cancelled');
          error.name = 'AbortError';
          reject(error);
        },
        { once: true },
      );
    });
  }

  async inspect(): Promise<MediaInfo> {
    throw new Error('Not used in this test.');
  }

  async removeWorkDir(): Promise<void> {}
}

async function waitForJob(
  manager: DownloadJobManager,
  id: string,
  clientId: string,
  status: 'completed' | 'cancelled',
) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const job = manager.get(id, clientId);
    if (job?.status === status) return job;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`Job ${id} did not reach ${status}.`);
}
