# Architecture

## Context

This application is a permission-first, self-hosted media utility. It accepts only canonicalized
YouTube video and playlist URLs, runs `yt-dlp` and `ffmpeg` without a shell, and provides a bounded,
observable job lifecycle to the browser.

The current deployment model is one long-running Node.js process with private writable temporary
storage. It is deliberately not a serverless design.

## Module boundaries

```text
src/app                  Next.js routes and composition entry points
src/features/downloads   Browser workflow, API client, and presentation
src/lib                  Pure validation and filename policies
src/server               Job lifecycle, process adapters, configuration, logging, and archives
src/types                Contracts shared across the browser/server boundary
```

Dependencies flow inward toward shared contracts and pure policies. Browser modules do not import
server modules. API routes translate HTTP requests into validated domain inputs and delegate work;
they do not execute downloads themselves.

## Download lifecycle

```text
validate request
      ↓
create bounded in-memory job
      ↓
spawn yt-dlp → parse progress → merge/extract with ffmpeg
      ↓                              ↓
single file                    package playlist ZIP
      └──────────────┬───────────────┘
                     ↓
         expose time-limited file URL
                     ↓
       browser starts an automatic save
                     ↓
            remove temporary files
```

Jobs have explicit queued, running, completed, failed, and cancelled states. Running jobs also
report connecting, downloading, processing, and packaging phases. A hard runtime limit bounds the
entire operation, while an inactivity timer detects a child process that stops producing output.

## Security and resource invariants

- URLs must use HTTPS and an allowlisted YouTube hostname.
- User-controlled query parameters are discarded during canonicalization.
- Child processes use argument arrays with `shell: false`.
- Every job uses a private temporary directory and a sanitized output filename.
- Per-client concurrency and hourly limits are enforced before process creation.
- Job status, cancellation, and file delivery are restricted to the client identity that created the job.
- Playlist length, file size, runtime, and inactivity are bounded.
- Media files are removed after delivery or expiry.
- Browser requests must be same-site and use the expected content type.

## Observability

The server emits structured JSON lifecycle events containing job identifiers, phases, durations,
sizes, and failure summaries. It never logs submitted URLs. `/api/health` provides a lightweight
liveness endpoint for an orchestrator or reverse proxy.

Recommended production dashboards should track request rate, job completion/failure/cancellation
counts, duration percentiles, output size, and inactivity timeouts. Structured logs are the current
source for deriving these measures.

## Testing strategy

- Small tests cover URL policy, request validation, filename sanitation, command construction, and
  ZIP output.
- Job-manager integration tests exercise completion, cancellation, and limit enforcement through a
  fake service boundary.
- CI runs formatting, linting, all tests, and a production Next.js build.

The next testing tier should exercise API routes and the browser's critical download journey against
a controlled fake downloader executable. Tests must not rely on live YouTube availability.

## Scaling path

The `DownloadService` boundary permits a future durable worker implementation. Before running more
than one application replica, replace the in-memory manager and request history with shared durable
storage, put media artifacts in object storage, and move execution to a bounded worker queue. Job
leases and idempotency keys should prevent duplicate execution after worker failure.
