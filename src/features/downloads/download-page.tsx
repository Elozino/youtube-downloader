'use client';

import { useEffect, useState } from 'react';
import { DownloadForm } from './download-form';
import { JobStatus } from './job-status';
import { useDownloadWorkflow } from './use-download-workflow';

export function DownloadPage() {
  const workflow = useDownloadWorkflow();
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [mobileNoticeDismissed, setMobileNoticeDismissed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsMobileDevice(detectMobileDevice()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main>
      {isMobileDevice && !mobileNoticeDismissed && (
        <div className="mobile-device-notice">
          <section
            className="mobile-device-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-device-title"
            aria-describedby="mobile-device-description"
          >
            <div className="mobile-device-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="12" rx="2" />
                <path d="M8 20h8M12 16v4" />
              </svg>
            </div>
            <p className="eyebrow">Desktop recommended</p>
            <h2 id="mobile-device-title">Please use this app on a computer</h2>
            <p id="mobile-device-description">
              For reliable downloads and file saving, open this page on a desktop or laptop PC.
              Mobile browsers are not currently supported.
            </p>
            <button
              className="primary-button mobile-device-dismiss"
              type="button"
              autoFocus
              onClick={() => setMobileNoticeDismissed(true)}
            >
              I understand
            </button>
          </section>
        </div>
      )}
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

function detectMobileDevice(): boolean {
  const navigatorWithHints = navigator as Navigator & {
    userAgentData?: { mobile?: boolean };
  };

  if (typeof navigatorWithHints.userAgentData?.mobile === 'boolean') {
    return navigatorWithHints.userAgentData.mobile;
  }

  const isDesktopModeIPad =
    navigatorWithHints.platform === 'MacIntel' && navigatorWithHints.maxTouchPoints > 1;

  return (
    isDesktopModeIPad ||
    /Android|iPhone|iPad|iPod|IEMobile|Mobile|Opera Mini/i.test(navigatorWithHints.userAgent)
  );
}
