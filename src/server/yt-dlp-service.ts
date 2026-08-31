import 'server-only';

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdir, mkdtemp, readdir, realpath, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import type { MediaInfo } from '@/types/download';
import { sanitizeFilename } from '@/lib/filename';
import type { DownloadConfig } from './config';
import type {
  DownloadCallbacks,
  DownloadService,
  DownloadServiceRequest,
  DownloadServiceResult,
} from './download-service';
import { createZipArchive } from './zip';
import { buildInspectionArguments, buildYtDlpArguments } from './yt-dlp-command';
import {
  friendlyYtDlpError,
  mediaInfoFromJson,
  parseProgress,
  type YtDlpInfo,
} from './yt-dlp-output';

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
      const reportedPaths = await this.runProcess(request, workDir, callbacks, signal);
      const filePaths = await this.resolveOutputPaths(workDir, reportedPaths);

      if (request.sourceKind === 'playlist') {
        callbacks.onStage('packaging');
        const filename = sanitizeFilename(`playlist-${request.sourceId}.zip`, 'playlist.zip');
        const filePath = path.join(workDir, filename);
        await createZipArchive(
          filePath,
          filePaths.map((entryPath) => ({ filePath: entryPath, name: path.basename(entryPath) })),
        );
        await Promise.all(filePaths.map((entryPath) => rm(entryPath, { force: true })));
        const fileStat = await stat(filePath);
        return { filePath, filename, sizeBytes: fileStat.size, workDir };
      }

      const filePath = filePaths[0];
      if (!filePath) throw new Error('yt-dlp completed without producing a media file.');
      const originalName = path.basename(filePath);
      const fallbackExtension = request.mediaType === 'audio' ? 'mp3' : 'mp4';
      const filename = sanitizeFilename(originalName, `${request.sourceId}.${fallbackExtension}`);
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

  inspect(request: DownloadServiceRequest, signal: AbortSignal): Promise<MediaInfo> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) return reject(abortError());

      const child = spawn(this.config.ytDlpPath, buildInspectionArguments(request), {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true,
      });
      let stdout = '';
      let stderr = '';
      let settled = false;

      const finish = (action: () => void) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', onAbort);
        action();
      };
      const onAbort = () => child.kill('SIGTERM');
      signal.addEventListener('abort', onAbort, { once: true });

      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        stdout += chunk;
        if (stdout.length > 20_000_000) child.kill('SIGTERM');
      });
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk: string) => {
        stderr = `${stderr}${chunk}`.slice(-MAX_ERROR_OUTPUT);
      });
      child.on('error', (error) =>
        finish(() => {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            reject(new Error(`Could not start yt-dlp at "${this.config.ytDlpPath}".`));
          } else reject(error);
        }),
      );
      child.on('close', (code) =>
        finish(() => {
          if (signal.aborted) return reject(abortError());
          if (code !== 0) return reject(new Error(friendlyYtDlpError(stderr, code)));
          try {
            resolve(mediaInfoFromJson(JSON.parse(stdout) as YtDlpInfo, request));
          } catch {
            reject(new Error('YouTube returned media details in an unexpected format.'));
          }
        }),
      );
    });
  }

  private runProcess(
    request: DownloadServiceRequest,
    workDir: string,
    callbacks: DownloadCallbacks,
    signal: AbortSignal,
  ): Promise<string[]> {
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

      const reportedPaths: string[] = [];
      let stderr = '';
      let settled = false;
      let killTimer: NodeJS.Timeout | undefined;
      let inactivityTimer: NodeJS.Timeout | undefined;
      let inactivityTimedOut = false;

      const finish = (action: () => void) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', onAbort);
        if (killTimer) clearTimeout(killTimer);
        if (inactivityTimer) clearTimeout(inactivityTimer);
        action();
      };

      const stopChild = () => {
        child.kill('SIGTERM');
        if (killTimer) clearTimeout(killTimer);
        killTimer = setTimeout(() => child.kill('SIGKILL'), 5_000);
        killTimer.unref();
      };

      const onAbort = () => {
        stopChild();
      };

      const resetInactivityTimer = () => {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
          inactivityTimedOut = true;
          stopChild();
        }, this.config.inactivityTimeoutMs);
        inactivityTimer.unref();
      };

      signal.addEventListener('abort', onAbort, { once: true });
      resetInactivityTimer();

      const handleOutputLine = (line: string) => {
        if (line.startsWith('__PROGRESS__')) {
          callbacks.onProgress(parseProgress(line.slice('__PROGRESS__'.length)));
        } else if (line.startsWith('__FILE__')) {
          reportedPaths.push(line.slice('__FILE__'.length).trim());
        } else if (
          /\[(?:Merger|ExtractAudio|VideoRemuxer|VideoConvertor|Fixup|Metadata)\]/.test(line)
        ) {
          callbacks.onStage('processing');
        }
      };

      child.stdout.on('data', resetInactivityTimer);
      const stdoutLines = createInterface({ input: child.stdout });
      stdoutLines.on('line', handleOutputLine);

      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk: string) => {
        resetInactivityTimer();
        stderr = `${stderr}${chunk}`.slice(-MAX_ERROR_OUTPUT);
      });
      const stderrLines = createInterface({ input: child.stderr });
      stderrLines.on('line', handleOutputLine);

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
          } else if (inactivityTimedOut) {
            reject(
              new Error(
                `YouTube stopped responding for ${Math.round(this.config.inactivityTimeoutMs / 1_000)} seconds. Check the link, then try again.`,
              ),
            );
          } else if (code === 0) {
            resolve(reportedPaths);
          } else {
            reject(new Error(friendlyYtDlpError(stderr, code)));
          }
        });
      });
    });
  }

  private async resolveOutputPaths(workDir: string, reportedPaths: string[]): Promise<string[]> {
    const workDirReal = await realpath(workDir);
    const candidates = reportedPaths.length
      ? reportedPaths.map((reportedPath) =>
          path.isAbsolute(reportedPath) ? reportedPath : path.join(workDir, reportedPath),
        )
      : (await readdir(workDir)).map((name) => path.join(workDir, name));

    const resolved: string[] = [];

    for (const candidate of candidates) {
      if (candidate.endsWith('.part') || candidate.endsWith('.ytdl')) continue;
      try {
        const candidateReal = await realpath(candidate);
        const insideWorkDir =
          candidateReal.startsWith(`${workDirReal}${path.sep}`) && candidateReal !== workDirReal;
        if (insideWorkDir && (await stat(candidateReal)).isFile()) resolved.push(candidateReal);
      } catch {
        // Ignore stale print paths and continue looking for the final media file.
      }
    }

    if (resolved.length > 0) return [...new Set(resolved)];
    if (reportedPaths.length) return this.resolveOutputPaths(workDir, []);
    throw new Error('yt-dlp completed without producing a media file.');
  }
}

function abortError(): Error {
  const error = new Error('Download cancelled.');
  error.name = 'AbortError';
  return error;
}
