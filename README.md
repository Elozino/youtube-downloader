# Authorized YouTube Downloader

A self-hosted Next.js application for downloading videos, audio, and playlists from YouTube **when you own the content or have permission to download it**. The browser can inspect an estimated size before starting, monitors a server-side `yt-dlp` and `ffmpeg` job, and automatically starts saving the completed file.

> YouTube's terms and copyright law may restrict downloading. This project does not bypass DRM, authentication, geographic restrictions, or paywalls. The user must affirm authorization for every download.

## Features

- Strict URL allowlist for `youtube.com` and `youtu.be` video and playlist links
- Canonical URLs passed to the downloader, with unrelated query data discarded
- Selectable video resolutions from 360p through 4K, plus best available
- Selectable MP3 audio quality from 128–256 kbps, plus best available
- Pre-download title, playlist item count, duration, and size inspection when YouTube reports the required metadata
- Playlist downloads packaged as one ZIP, with a 50-item safety cap
- Live percentage, byte count, speed, and ETA when reported by `yt-dlp`
- Automatic browser save when processing completes
- Cooperative cancellation with a forced process stop after a short grace period
- Sanitized, length-bounded filenames and one-time file delivery
- Automatic cleanup on success, failure, cancellation, timeout, and expiry
- Process invocation through `spawn(executable, args, { shell: false })`; no shell interpolation
- Global/per-client concurrency, hourly request, file-size, runtime, and job TTL controls
- Job status, cancellation, and file delivery bound to the creating client identity
- A `DownloadService` interface that can be implemented by a queue/background worker later

## Architecture

```text
Browser UI
   ├── GET  /api/health                liveness check
   ├── POST /api/media-info            inspect title and estimated size
   ├── POST /api/downloads             create a job
   ├── GET  /api/downloads/:id         poll status/progress
   ├── DELETE /api/downloads/:id       cancel
   └── GET  /api/downloads/:id/file    stream once, then clean up
                 │
          DownloadJobManager
          (limits + lifecycle)
                 │
          DownloadService interface
                 │
          YtDlpDownloadService
          (yt-dlp + ffmpeg process)
```

See [docs/architecture.md](docs/architecture.md) for module boundaries, lifecycle guarantees,
security invariants, observability, testing strategy, and the scaling path.

Jobs are intentionally process-local. This is simple and dependable for one long-running Node.js server. The service boundary in `src/server/download-service.ts` is the seam for moving execution and progress events to a durable queue/worker. Before running multiple application replicas, replace both the job manager and rate limiter with shared storage/coordination.

This app is **not suitable for a serverless function platform**: downloads require long-running child processes and writable temporary storage.

## Prerequisites

- Node.js 20.9 or newer (Node.js 22 LTS recommended)
- `yt-dlp` on the server
- `ffmpeg` and `ffprobe` on the server

### macOS

With [Homebrew](https://brew.sh/):

```bash
brew install yt-dlp ffmpeg
```

### Linux

Install ffmpeg with your distribution package manager. For Debian/Ubuntu:

```bash
sudo apt update
sudo apt install ffmpeg pipx
pipx install yt-dlp
pipx ensurepath
```

Distribution-packaged `yt-dlp` releases can lag behind YouTube changes. `pipx upgrade yt-dlp` keeps the isolated installation current. Follow the official [yt-dlp installation instructions](https://github.com/yt-dlp/yt-dlp/wiki/Installation) for other distributions.

Confirm both tools are available to the same user that will run the app:

```bash
yt-dlp --version
ffmpeg -version
```

## Local setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

If the executables are not on the service user's `PATH`, set absolute paths in `.env.local`:

```dotenv
YTDLP_PATH=/absolute/path/to/yt-dlp
FFMPEG_PATH=/absolute/path/to/ffmpeg
```

## Production run

```bash
npm ci
npm run check
npm start
```

Run the app as an unprivileged operating-system user behind an HTTPS reverse proxy. Give that user write access only to the selected temporary directory. Keep the server and `yt-dlp` patched.

If a trusted reverse proxy **replaces** `X-Forwarded-For`, set `TRUST_PROXY=true` so per-client limits use its first forwarded address. Do not enable this on a directly exposed server or behind a proxy that appends untrusted input.

## Configuration

| Variable                         |           Default | Purpose                                     |
| -------------------------------- | ----------------: | ------------------------------------------- |
| `YTDLP_PATH`                     |          `yt-dlp` | Downloader executable name or absolute path |
| `FFMPEG_PATH`                    |          `ffmpeg` | ffmpeg executable name or absolute path     |
| `DOWNLOAD_MAX_CONCURRENT`        |               `2` | Active jobs in this Node.js process         |
| `DOWNLOAD_MAX_PER_CLIENT`        |               `1` | Active jobs for one client identity         |
| `DOWNLOAD_MAX_REQUESTS_PER_HOUR` |              `10` | Starts allowed per client per rolling hour  |
| `DOWNLOAD_MAX_FILESIZE`          |              `2G` | Value passed to yt-dlp's `--max-filesize`   |
| `DOWNLOAD_MAX_RUNTIME_SECONDS`   |            `1800` | Hard runtime before cancellation            |
| `DOWNLOAD_INACTIVITY_SECONDS`    |             `120` | Stop a downloader that produces no output   |
| `DOWNLOAD_COMPLETED_TTL_SECONDS` |             `900` | Time a completed file remains available     |
| `DOWNLOAD_TEMP_DIR`              | OS temp directory | Root for private per-job directories        |
| `TRUST_PROXY`                    |           `false` | Trust the proxy-provided client address     |

`--max-filesize` is a useful guard, but upstream media servers do not always report sizes before transfer. For strong isolation on a public deployment, also use OS/container disk quotas, CPU/memory limits, an authenticated frontend, and reverse-proxy request limits.

## Quality modes

**Video** selects the best video and audio streams at or below the chosen resolution and merges them without transcoding. The best-available choice uses `bv*+ba/b`. The resulting container depends on the source codecs and may be MP4, WebM, or MKV.

**Audio** selects the best available audio stream and extracts an MP3. A specific bitrate can be selected, or the best VBR encoder quality can be used.

Reported sizes are estimates until processing completes. Stream size metadata is not available for every video, and extracted audio or merged video can differ slightly from the estimate. The completed job always displays the exact final file size.

## Tests and quality checks

```bash
npm test
npm run lint
npm run format:check
npm run build
```

Tests cover request and URL validation, canonicalization of untrusted input, mode-specific `yt-dlp` commands, progress parsing, job completion and cancellation, limit enforcement, filename sanitation, and ZIP integrity. CI runs the complete check suite for pull requests and changes to `main`.

## Operational notes

- Playlists are limited to their first 50 items and are returned as an uncompressed ZIP. The configured `--max-filesize` limit applies to each playlist item.
- A completed file automatically starts saving through the browser. Its private temporary directory is deleted when the stream closes. Unclaimed files expire automatically.
- Failed/cancelled job metadata is retained briefly so the UI can show its final state; media fragments are removed immediately by the service.
- Job IDs are random UUIDs and operations are bound to the creating client identity, but this is not user authentication. Put the app behind access control before exposing it beyond a trusted group.
- Some videos require account cookies, proof-of-origin tokens, or other site-specific setup. This project deliberately does not accept browser cookies or arbitrary `yt-dlp` options from users.

## License

MIT
