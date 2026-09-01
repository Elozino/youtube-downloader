'use client';

import { useEffect, useRef, useState } from 'react';
import type { DownloadJobView, MediaInfo, MediaQuality, MediaType } from '@/types/download';
import {
  cancelDownload,
  createDownload,
  inspectMedia,
  readDownload,
  type DownloadSelection,
} from './api';

export function useDownloadWorkflow() {
  const [url, setUrlState] = useState('');
  const [mediaType, setMediaTypeState] = useState<MediaType>('video');
  const [quality, setQualityState] = useState<MediaQuality>('best');
  const [authorized, setAuthorized] = useState(false);
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [job, setJob] = useState<DownloadJobView | null>(null);
  const [error, setError] = useState('');
  const [inspecting, setInspecting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [autoSaveStarted, setAutoSaveStarted] = useState(false);
  const savedJobId = useRef<string | null>(null);

  const active = job?.status === 'queued' || job?.status === 'running';
  const activeJobId = active ? job.id : undefined;
  const selection: DownloadSelection = { url, mediaType, quality };

  useEffect(() => {
    if (!activeJobId) return;
    let disposed = false;
    let timer: number | undefined;
    const controller = new AbortController();

    const poll = async () => {
      try {
        const nextJob = await readDownload(activeJobId, controller.signal);
        if (!disposed) {
          setError('');
          setJob(nextJob);
        }
      } catch (pollError) {
        if (!disposed) setError(messageFrom(pollError));
      } finally {
        if (!disposed) timer = window.setTimeout(() => void poll(), 750);
      }
    };

    void poll();
    return () => {
      disposed = true;
      controller.abort();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [activeJobId]);

  useEffect(() => {
    if (job?.status !== 'completed' || !job.downloadUrl || savedJobId.current === job.id) return;

    // Mobile browsers commonly block downloads initiated after asynchronous polling.
    // Leave the visible "Save file" link in place so the user can start it with a tap.
    if (window.matchMedia('(pointer: coarse)').matches) return;

    savedJobId.current = job.id;
    const link = document.createElement('a');
    link.href = job.downloadUrl;
    link.download = job.filename ?? '';
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    const timer = window.setTimeout(() => setAutoSaveStarted(true), 0);
    return () => window.clearTimeout(timer);
  }, [job]);

  function setUrl(value: string) {
    setUrlState(value);
    setInfo(null);
  }

  function setMediaType(value: MediaType) {
    setMediaTypeState(value);
    setQualityState('best');
    setInfo(null);
  }

  function setQuality(value: MediaQuality) {
    setQualityState(value);
    setInfo(null);
  }

  async function inspect() {
    if (!url.trim()) return;
    setError('');
    setInspecting(true);
    setInfo(null);
    try {
      setInfo(await inspectMedia(selection));
    } catch (inspectError) {
      setError(messageFrom(inspectError));
    } finally {
      setInspecting(false);
    }
  }

  async function start() {
    setError('');
    setSubmitting(true);
    setJob(null);
    setAutoSaveStarted(false);
    try {
      setJob(await createDownload(selection, authorized));
    } catch (submitError) {
      setError(messageFrom(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel() {
    if (!job) return;
    try {
      setJob(await cancelDownload(job.id));
    } catch (cancelError) {
      setError(messageFrom(cancelError));
    }
  }

  return {
    active,
    authorized,
    autoSaveStarted,
    error,
    info,
    inspecting,
    job,
    mediaType,
    quality,
    submitting,
    url,
    cancel,
    inspect,
    setAuthorized,
    setMediaType,
    setQuality,
    setUrl,
    start,
  };
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}
