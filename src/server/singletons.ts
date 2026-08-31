import 'server-only';

import { loadDownloadConfig } from './config';
import { DownloadJobManager } from './job-manager';
import { YtDlpDownloadService } from './yt-dlp-service';

declare global {
  var __youtubeDownloadManager: DownloadJobManager | undefined;
}

export const downloadConfig = loadDownloadConfig();

export const downloadService = new YtDlpDownloadService(downloadConfig);

export const downloadManager =
  globalThis.__youtubeDownloadManager ?? new DownloadJobManager(downloadService, downloadConfig);

globalThis.__youtubeDownloadManager = downloadManager;
