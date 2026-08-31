'use client';

import { useEffect, useState } from 'react';
import type { DownloadJobView } from '@/types/download';
import { formatBytes, formatDuration, formatElapsed } from './formatters';

interface JobStatusProps {
  autoSaveStarted: boolean;
  job: DownloadJobView;
  onCancel(): void;
}

export function JobStatus({ autoSaveStarted, job, onCancel }: JobStatusProps) {
  const createdAt = new Date(job.createdAt).getTime();
  const [currentTime, setCurrentTime] = useState(createdAt);
  const percent = Math.max(0, Math.min(100, job.progress.percent ?? 0));
  const running = job.status === 'queued' || job.status === 'running';
  const elapsed = formatElapsed(currentTime - createdAt);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [running, job.id]);

  if (job.status === 'failed') {
    return <div className="notice error-notice">{job.error || 'The download failed.'}</div>;
  }
  if (job.status === 'cancelled') {
    return (
      <div className="notice neutral-notice">Download cancelled. Temporary files were removed.</div>
    );
  }
  if (job.status === 'completed') {
    return (
      <div className="status-card complete-card">
        <div className="complete-icon" aria-hidden="true">
          ✓
        </div>
        <div className="status-copy">
          <strong>{autoSaveStarted ? 'Saving automatically' : 'File ready'}</strong>
          <span>
            {job.filename} · {formatBytes(job.sizeBytes)}
          </span>
        </div>
        {!autoSaveStarted && job.downloadUrl ? (
          <a className="download-link" href={job.downloadUrl} download>
            Save file
          </a>
        ) : (
          <span className="downloaded-label">Check your Downloads folder</span>
        )}
      </div>
    );
  }

  return (
    <div className="status-card">
      <div className="progress-head">
        <div>
          <strong>{job.status === 'queued' ? 'Queued' : phaseLabel(job)}</strong>
          <span>
            {job.progress.phase === 'downloading' ? (
              <>
                {job.progress.downloadedBytes
                  ? formatBytes(job.progress.downloadedBytes)
                  : 'Starting transfer'}
                {job.progress.totalBytes ? ` of ${formatBytes(job.progress.totalBytes)}` : ''}
                {job.progress.speedBytesPerSecond
                  ? ` · ${formatBytes(job.progress.speedBytesPerSecond)}/s`
                  : ''}
                {job.progress.etaSeconds
                  ? ` · ${formatDuration(job.progress.etaSeconds)} left`
                  : ''}
              </>
            ) : (
              `${phaseDescription(job.progress.phase)} · ${elapsed} elapsed`
            )}
          </span>
        </div>
        <b>{job.progress.percent === null ? '—' : `${percent.toFixed(1)}%`}</b>
      </div>
      <div
        className="progress-track"
        aria-label="Download progress"
        aria-valuenow={job.progress.percent === null ? undefined : percent}
        aria-valuemin={0}
        aria-valuemax={100}
        role="progressbar"
      >
        <div style={{ width: `${percent}%` }} />
      </div>
      {running && (
        <button className="cancel-button" type="button" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  );
}

function phaseLabel(job: DownloadJobView): string {
  switch (job.progress.phase) {
    case 'processing':
      return job.mediaType === 'audio' ? 'Creating your MP3' : 'Merging video and audio';
    case 'packaging':
      return 'Packaging your playlist';
    case 'downloading':
      return job.sourceKind === 'playlist'
        ? `Downloading playlist${job.progress.itemIndex ? ` · item ${job.progress.itemIndex}${job.progress.itemCount ? ` of ${job.progress.itemCount}` : ''}` : ''}`
        : 'Downloading your file';
    default:
      return 'Reading YouTube details';
  }
}

function phaseDescription(phase: DownloadJobView['progress']['phase']): string {
  if (phase === 'processing') return 'The media download is complete';
  if (phase === 'packaging') return 'Creating one ZIP file';
  return 'Waiting for YouTube to respond';
}
