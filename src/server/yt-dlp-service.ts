import 'server-only';

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdir, mkdtemp, readdir, realpath, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import type { DownloadProgress } from '@/types/download';
import { sanitizeFilename } from '@/lib/filename';
import type { DownloadConfig } from './config';
import type {
  DownloadCallbacks,
  DownloadService,
  DownloadServiceRequest,
  DownloadServiceResult,
} from './download-service';
import { buildYtDlpArguments } from './yt-dlp-command';

const MAX_ERROR_OUTPUT = 8_000;

export class YtDlpDownloadService implements DownloadService {
  constructor(private readonly config: DownloadConfig) {}

  async download(
    request: DownloadServiceRequest,
    callbacks: DownloadCallbacks,
    signal: AbortSignal,
  ): Promise<DownloadServiceResult> {
    await mkdir(this.config.tempRoot, { recursive: true, mode: 0o700 });
    const workDir = await mkdtemp(path.join(this.config.tempRoot, 'job-'));

    try {
      const reportedPath = await this.runProcess(request, workDir, callbacks, signal);
      const filePath = await this.resolveOutputPath(workDir, reportedPath);
      const originalName = path.basename(filePath);
      const filename = sanitizeFilename(originalName, `${request.videoId}.mp4`);
      const sanitizedPath = path.join(workDir, filename);

      if (sanitizedPath !== filePath) await rename(filePath, sanitizedPath);
      const fileStat = await stat(sanitizedPath);

      if (!fileStat.isFile() || fileStat.size === 0) {
        throw new Error('The downloader did not produce a valid media file.');
      }

      return { filePath: sanitizedPath, filename, sizeBytes: fileStat.size, workDir };
    } catch (error) {
      await this.removeWorkDir(workDir);
      throw error;
    }
  }

  async removeWorkDir(workDir: string): Promise<void> {
    await rm(workDir, { recursive: true, force: true });
  }

  private runProcess(
    request: DownloadServiceRequest,
    workDir: string,
    callbacks: DownloadCallbacks,
    signal: AbortSignal,
  ): Promise<string | undefined> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(abortError());
        return;
      }

      const args = buildYtDlpArguments(request, this.config);
      const child = spawn(this.config.ytDlpPath, args, {
        cwd: workDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true,
      });

      let reportedPath: string | undefined;
      let stderr = '';
      let settled = false;
      let killTimer: NodeJS.Timeout | undefined;

      const finish = (action: () => void) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', onAbort);
        if (killTimer) clearTimeout(killTimer);
        action();
      };

      const onAbort = () => {
        child.kill('SIGTERM');
        killTimer = setTimeout(() => child.kill('SIGKILL'), 5_000);
        killTimer.unref();
      };

      signal.addEventListener('abort', onAbort, { once: true });

      const stdoutLines = createInterface({ input: child.stdout });
      stdoutLines.on('line', (line) => {
        if (line.startsWith('__PROGRESS__')) {
          callbacks.onProgress(parseProgress(line.slice('__PROGRESS__'.length)));
        } else if (line.startsWith('__FILE__')) {
          reportedPath = line.slice('__FILE__'.length).trim();
        }
      });

      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk: string) => {
        stderr = `${stderr}${chunk}`.slice(-MAX_ERROR_OUTPUT);
      });

      child.on('error', (error) => {
        finish(() => {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            reject(
              new Error(
                `Could not start yt-dlp at "${this.config.ytDlpPath}". Install it or set YTDLP_PATH.`,
              ),
            );
          } else {
            reject(error);
          }
        });
      });

      child.on('close', (code) => {
        finish(() => {
          if (signal.aborted) {
            reject(abortError());
          } else if (code === 0) {
            resolve(reportedPath);
          } else {
            reject(new Error(friendlyYtDlpError(stderr, code)));
          }
        });
      });
    });
  }

  private async resolveOutputPath(
    workDir: string,
    reportedPath: string | undefined,
  ): Promise<string> {
    const workDirReal = await realpath(workDir);
    const candidates = reportedPath
      ? [path.isAbsolute(reportedPath) ? reportedPath : path.join(workDir, reportedPath)]
      : (await readdir(workDir)).map((name) => path.join(workDir, name));

    for (const candidate of candidates) {
      if (candidate.endsWith('.part') || candidate.endsWith('.ytdl')) continue;
      try {
        const candidateReal = await realpath(candidate);
        const insideWorkDir =
          candidateReal.startsWith(`${workDirReal}${path.sep}`) && candidateReal !== workDirReal;
        if (insideWorkDir && (await stat(candidateReal)).isFile()) return candidateReal;
      } catch {
        // Ignore stale print paths and continue looking for the final media file.
      }
    }

    if (reportedPath) return this.resolveOutputPath(workDir, undefined);
    throw new Error('yt-dlp completed without producing a media file.');
  }
}

function parseProgress(value: string): DownloadProgress {
  const [percent, downloaded, total, speed, eta] = value.split('|').map((part) => part.trim());
  return {
    percent: finiteNumber(percent?.replace('%', '')),
    downloadedBytes: finiteNumber(downloaded),
    totalBytes: finiteNumber(total),
    speedBytesPerSecond: finiteNumber(speed),
    etaSeconds: finiteNumber(eta),
  };
}

function finiteNumber(value: string | undefined): number | null {
  if (!value || value === 'NA' || value === 'None') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function abortError(): Error {
  const error = new Error('Download cancelled.');
  error.name = 'AbortError';
  return error;
}

function friendlyYtDlpError(stderr: string, code: number | null): string {
  const lastLine = stderr
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);

  if (lastLine?.startsWith('ERROR:')) return lastLine.slice('ERROR:'.length).trim();
  return lastLine || `yt-dlp exited with code ${code ?? 'unknown'}.`;
}
