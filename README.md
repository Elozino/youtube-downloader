# Authorized YouTube Downloader

A self-hosted Next.js application for downloading the highest available video and audio quality from YouTube **when you own the content or have permission to download it**. The browser starts and monitors a job; a server-side service invokes `yt-dlp` and `ffmpeg`, merges the streams, and removes temporary files after delivery or expiry.

> YouTube's terms and copyright law may restrict downloading. This project does not bypass DRM, authentication, geographic restrictions, or paywalls. The user must affirm authorization for every download.

## Features

- Strict URL allowlist for individual `youtube.com` and `youtu.be` video links
- Canonical URLs passed to the downloader, with playlist/query data discarded
- Absolute-best mode: `best video + best audio`, preserving the best source codecs
- MP4 mode: prefers H.264 MP4 video plus M4A audio, then other MP4-native streams
- Live percentage, byte count, speed, and ETA when reported by `yt-dlp`
- Cooperative cancellation with a forced process stop after a short grace period
- Sanitized, length-bounded filenames and one-time file delivery
- Automatic cleanup on success, failure, cancellation, timeout, and expiry
- Process invocation through `spawn(executable, args, { shell: false })`; no shell interpolation
- Global/per-client concurrency, hourly request, file-size, runtime, and job TTL controls
- A `DownloadService` interface that can be implemented by a queue/background worker later

## Architecture

```text
Browser UI
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
npm run test
npm run lint
npm run build
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
| `DOWNLOAD_COMPLETED_TTL_SECONDS` |             `900` | Time a completed file remains available     |
| `DOWNLOAD_TEMP_DIR`              | OS temp directory | Root for private per-job directories        |
| `TRUST_PROXY`                    |           `false` | Trust the proxy-provided client address     |

`--max-filesize` is a useful guard, but upstream media servers do not always report sizes before transfer. For strong isolation on a public deployment, also use OS/container disk quotas, CPU/memory limits, an authenticated frontend, and reverse-proxy request limits.

## Quality modes

**Absolute best** selects `bv*+ba/b`. YouTube often serves the highest resolutions as VP9 or AV1, so the merged output may be WebM or MKV rather than MP4.

**MP4 compatible** first asks for H.264 MP4 video and M4A audio, falling back to other MP4-native streams when necessary, and requests an MP4 merge. It does not transcode; avoiding a full re-encode keeps downloads fast and prevents quality loss. Consequently, very old devices may still reject an AV1-in-MP4 fallback.

## Tests and quality checks

```bash
npm test
npm run lint
npm run format:check
npm run build
```

Focused tests cover supported/rejected URL shapes, canonicalization of untrusted URL data, mode-specific `yt-dlp` argument construction, argument boundaries, and filename sanitation.

## Operational notes

- The app accepts only one video per request and always supplies `--no-playlist`.
- A completed file can be streamed once. Its private temporary directory is deleted when the stream closes. Unclaimed files expire automatically.
- Failed/cancelled job metadata is retained briefly so the UI can show its final state; media fragments are removed immediately by the service.
- Job IDs are random UUIDs, but this is not user authentication. Put the app behind access control before exposing it beyond a trusted group.
- Some videos require account cookies, proof-of-origin tokens, or other site-specific setup. This project deliberately does not accept browser cookies or arbitrary `yt-dlp` options from users.

## License

MIT
