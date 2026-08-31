'use client';

import { DownloadForm } from './download-form';
import { JobStatus } from './job-status';
import { useDownloadWorkflow } from './use-download-workflow';

export function DownloadPage() {
  const workflow = useDownloadWorkflow();

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
          <h1>Your media, your choice.</h1>
          <p className="lede">
            Download a video or a playlist in the quality you choose. Check the estimated size
            first, then receive one clean file.
          </p>
        </header>

        <DownloadForm
          active={workflow.active}
          authorized={workflow.authorized}
          info={workflow.info}
          inspecting={workflow.inspecting}
          mediaType={workflow.mediaType}
          quality={workflow.quality}
          submitting={workflow.submitting}
          url={workflow.url}
          onAuthorizationChange={workflow.setAuthorized}
          onInspect={() => void workflow.inspect()}
          onMediaTypeChange={workflow.setMediaType}
          onQualityChange={workflow.setQuality}
          onStart={() => void workflow.start()}
          onUrlChange={workflow.setUrl}
        />

        <div aria-live="polite" aria-atomic="true">
          {workflow.error && <div className="notice error-notice">{workflow.error}</div>}
          {workflow.job && (
            <JobStatus
              autoSaveStarted={workflow.autoSaveStarted}
              job={workflow.job}
              onCancel={() => void workflow.cancel()}
            />
          )}
        </div>

        <footer>
          <div>
            <span className="status-dot" /> Processing happens on your server
          </div>
          <p>Playlists up to 50 items · Audio or video · Files save automatically</p>
        </footer>
      </section>
    </main>
  );
}
