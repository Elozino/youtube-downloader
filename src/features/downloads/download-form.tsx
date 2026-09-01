import type { FormEvent } from 'react';
import type { MediaInfo, MediaQuality, MediaType } from '@/types/download';
import { formatBytes, formatMediaDuration } from './formatters';

interface DownloadFormProps {
  active: boolean;
  authorized: boolean;
  info: MediaInfo | null;
  inspecting: boolean;
  mediaType: MediaType;
  quality: MediaQuality;
  submitting: boolean;
  url: string;
  onAuthorizationChange(value: boolean): void;
  onInspect(): void;
  onMediaTypeChange(value: MediaType): void;
  onQualityChange(value: MediaQuality): void;
  onStart(): void;
  onUrlChange(value: string): void;
}

export function DownloadForm(props: DownloadFormProps) {
  const disabled = props.active || props.submitting || props.inspecting;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    props.onStart();
  }

  return (
    <form className="download-card" onSubmit={submit}>
      <label className="field-label" htmlFor="youtube-url">
        YouTube video or playlist URL
      </label>
      <div className="url-field">
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M10.5 13.5a4 4 0 0 0 5.7.1l2.3-2.3a4 4 0 0 0-5.7-5.6l-1.3 1.2M13.5 10.5a4 4 0 0 0-5.7-.1l-2.3 2.3a4 4 0 0 0 5.7 5.6l1.3-1.2" />
        </svg>
        <input
          id="youtube-url"
          type="url"
          inputMode="url"
          enterKeyHint="go"
          autoComplete="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="https://www.youtube.com/watch?v=… or playlist?list=…"
          value={props.url}
          onChange={(event) => props.onUrlChange(event.target.value)}
          disabled={disabled}
          maxLength={2048}
          required
        />
      </div>

      <button
        className="inspect-button"
        type="button"
        onClick={props.onInspect}
        disabled={!props.url.trim() || disabled}
      >
        {props.inspecting ? 'Checking size…' : 'Check title & estimated size'}
      </button>

      {props.info && <MediaSummary info={props.info} />}

      <fieldset disabled={disabled}>
        <legend>Media type</legend>
        <div className="mode-grid">
          <MediaOption
            selected={props.mediaType === 'video'}
            value="video"
            title="Video"
            badge="Recommended"
            description="Video with its audio track, at your chosen resolution."
            onSelect={props.onMediaTypeChange}
          />
          <MediaOption
            selected={props.mediaType === 'audio'}
            value="audio"
            title="Audio only"
            description="Extracts an MP3—ideal for music, talks, and podcasts."
            onSelect={props.onMediaTypeChange}
          />
        </div>
      </fieldset>

      <label className="field-label" htmlFor="quality">
        {props.mediaType === 'video' ? 'Video quality' : 'Audio quality'}
      </label>
      <select
        id="quality"
        className="quality-select"
        value={props.quality}
        onChange={(event) => props.onQualityChange(event.target.value as MediaQuality)}
        disabled={disabled}
      >
        {props.mediaType === 'video' ? <VideoQualityOptions /> : <AudioQualityOptions />}
      </select>

      <label className="permission-check">
        <input
          type="checkbox"
          checked={props.authorized}
          onChange={(event) => props.onAuthorizationChange(event.target.checked)}
          disabled={props.active || props.submitting}
          required
        />
        <span className="checkmark" aria-hidden="true" />
        <span>I own this content or have permission to download it.</span>
      </label>

      <button className="primary-button" type="submit" disabled={disabled}>
        {props.submitting
          ? 'Starting…'
          : props.active
            ? 'Download in progress'
            : 'Prepare download'}
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </form>
  );
}

function MediaSummary({ info }: { info: MediaInfo }) {
  return (
    <div className="media-summary">
      <div>
        <small>
          {info.sourceKind === 'playlist' ? `${info.itemCount} item playlist` : 'Video'}
          {info.durationSeconds ? ` · ${formatMediaDuration(info.durationSeconds)}` : ''}
        </small>
        <strong>{info.title}</strong>
      </div>
      <div className="summary-size">
        <small>Estimated download</small>
        <strong>{formatBytes(info.estimatedSizeBytes)}</strong>
      </div>
    </div>
  );
}

function MediaOption({
  selected,
  value,
  title,
  badge,
  description,
  onSelect,
}: {
  selected: boolean;
  value: MediaType;
  title: string;
  badge?: string;
  description: string;
  onSelect(value: MediaType): void;
}) {
  return (
    <label className={`mode-option ${selected ? 'selected' : ''}`}>
      <input
        type="radio"
        name="mediaType"
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

function VideoQualityOptions() {
  return (
    <>
      <option value="best">Best available</option>
      <option value="2160">Up to 4K (2160p)</option>
      <option value="1440">Up to 1440p</option>
      <option value="1080">Up to 1080p</option>
      <option value="720">Up to 720p</option>
      <option value="480">Up to 480p</option>
      <option value="360">Up to 360p</option>
    </>
  );
}

function AudioQualityOptions() {
  return (
    <>
      <option value="best">Best available</option>
      <option value="256">High · 256 kbps</option>
      <option value="192">Standard · 192 kbps</option>
      <option value="128">Compact · 128 kbps</option>
    </>
  );
}
