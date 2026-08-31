'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { DownloadJobView, QualityMode } from '@/types/download';

interface ApiResponse {
  job?: DownloadJobView;
  error?: string;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState<QualityMode>('best');
  const [authorized, setAuthorized] = useState(false);
  const [job, setJob] = useState<DownloadJobView | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const active = job?.status === 'queued' || job?.status === 'running';
  const activeJobId = active ? job.id : undefined;

  useEffect(() => {
    if (!activeJobId) return;

    const poll = async () => {
      try {
        const response = await fetch(`/api/downloads/${activeJobId}`, { cache: 'no-store' });
        const data = (await response.json()) as ApiResponse;
        if (!response.ok || !data.job) throw new Error(data.error || 'Could not read progress.');
        setJob(data.job);
      } catch (pollError) {
        setError(messageFrom(pollError));
      }
    };

    const timer = window.setInterval(() => void poll(), 750);
    void poll();
    return () => window.clearInterval(timer);
  }, [activeJobId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    setJob(null);

    try {
      const response = await fetch('/api/downloads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, mode, confirmAuthorization: authorized }),
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data.job) throw new Error(data.error || 'Could not start download.');
      setJob(data.job);
    } catch (submitError) {
      setError(messageFrom(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel() {
    if (!job) return;
    try {
      const response = await fetch(`/api/downloads/${job.id}`, { method: 'DELETE' });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data.job) throw new Error(data.error || 'Could not cancel download.');
      setJob(data.job);
    } catch (cancelError) {
      setError(messageFrom(cancelError));
    }
  }

  return (
    <main>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <section className="shell">
        <header className="hero">
          <div className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="img">
              <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 18.5h14" />
            </svg>
          </div>
          <p className="eyebrow">Self-hosted media utility</p>
          <h1>Download at the source&apos;s best.</h1>
          <p className="lede">
            Paste a YouTube video link. The server pairs the best video and audio streams, merges
            them, and gives you one clean file.
          </p>
        </header>

        <form className="download-card" onSubmit={submit}>
          <label className="field-label" htmlFor="youtube-url">
            YouTube video URL
          </label>
          <div className="url-field">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M10.5 13.5a4 4 0 0 0 5.7.1l2.3-2.3a4 4 0 0 0-5.7-5.6l-1.3 1.2M13.5 10.5a4 4 0 0 0-5.7-.1l-2.3 2.3a4 4 0 0 0 5.7 5.6l1.3-1.2" />
            </svg>
            <input
              id="youtube-url"
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder="https://www.youtube.com/watch?v=…"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              disabled={active || submitting}
              maxLength={2048}
              required
            />
          </div>

          <fieldset disabled={active || submitting}>
            <legend>Output preference</legend>
            <div className="mode-grid">
              <ModeOption
                selected={mode === 'best'}
                value="best"
                title="Absolute best"
                badge="Recommended"
                description="Keeps YouTube’s highest-quality source codecs. The file may be WebM or MKV."
                onSelect={setMode}
              />
              <ModeOption
                selected={mode === 'mp4'}
                value="mp4"
                title="MP4 compatible"
                description="Prefers H.264 video with M4A audio, then other MP4-native streams."
                onSelect={setMode}
              />
            </div>
          </fieldset>

          <label className="permission-check">
            <input
              type="checkbox"
              checked={authorized}
              onChange={(event) => setAuthorized(event.target.checked)}
              disabled={active || submitting}
              required
            />
            <span className="checkmark" aria-hidden="true" />
            <span>I own this content or have permission to download it.</span>
          </label>

          <button className="primary-button" type="submit" disabled={active || submitting}>
            {submitting ? 'Starting…' : active ? 'Download in progress' : 'Prepare download'}
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </form>

        <div aria-live="polite" aria-atomic="true">
          {error && <div className="notice error-notice">{error}</div>}
          {job && <JobStatus job={job} onCancel={() => void cancel()} />}
        </div>

        <footer>
          <div>
            <span className="status-dot" /> Processing happens on your server
          </div>
          <p>One video per link · No playlists · Temporary files auto-delete</p>
        </footer>
      </section>
    </main>
  );
}

function ModeOption({
  selected,
  value,
  title,
  badge,
  description,
  onSelect,
}: {
  selected: boolean;
  value: QualityMode;
  title: string;
  badge?: string;
  description: string;
  onSelect(mode: QualityMode): void;
}) {
  return (
    <label className={`mode-option ${selected ? 'selected' : ''}`}>
      <input
        type="radio"
        name="mode"
        value={value}
        checked={selected}
        onChange={() => onSelect(value)}
      />
      <span className="radio-mark" aria-hidden="true" />
      <span className="mode-copy">
        <strong>
          {title} {badge && <em>{badge}</em>}
        </strong>
        <small>{description}</small>
      </span>
    </label>
  );
}

function JobStatus({ job, onCancel }: { job: DownloadJobView; onCancel(): void }) {
  const percent = Math.max(0, Math.min(100, job.progress.percent ?? 0));
  const running = job.status === 'queued' || job.status === 'running';

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
          <strong>File ready</strong>
          <span>
            {job.filename} · {formatBytes(job.sizeBytes)}
          </span>
        </div>
        {job.downloadUrl ? (
          <a className="download-link" href={job.downloadUrl}>
            Download file
          </a>
        ) : (
          <span className="downloaded-label">Downloaded</span>
        )}
      </div>
    );
  }

  return (
    <div className="status-card">
      <div className="progress-head">
        <div>
          <strong>{job.status === 'queued' ? 'Queued' : 'Preparing your file'}</strong>
          <span>
            {job.progress.downloadedBytes
              ? formatBytes(job.progress.downloadedBytes)
              : 'Connecting'}
            {job.progress.speedBytesPerSecond
              ? ` · ${formatBytes(job.progress.speedBytesPerSecond)}/s`
              : ''}
            {job.progress.etaSeconds ? ` · ${formatDuration(job.progress.etaSeconds)} left` : ''}
          </span>
        </div>
        <b>{job.progress.percent === null ? '—' : `${percent.toFixed(1)}%`}</b>
      </div>
      <div
        className="progress-track"
        aria-label="Download progress"
        aria-valuenow={percent}
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

function formatBytes(value?: number | null): string {
  if (!value) return 'Size unavailable';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  return `${Math.ceil(seconds / 60)}m`;
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}
