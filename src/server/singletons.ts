import 'server-only';

import { loadDownloadConfig } from './config';
import { DownloadJobManager } from './job-manager';
import { YtDlpDownloadService } from './yt-dlp-service';

declare global {
  var __youtubeDownloadManager: DownloadJobManager | undefined;
}

export const downloadConfig = loadDownloadConfig();

export const downloadManager =
  globalThis.__youtubeDownloadManager ??
  new DownloadJobManager(new YtDlpDownloadService(downloadConfig), downloadConfig);

globalThis.__youtubeDownloadManager = downloadManager;
