# Contributing

## Development workflow

1. Use the Node.js version declared in `.nvmrc`.
2. Install dependencies with `npm ci`.
3. Keep changes focused and add tests at the lowest useful level.
4. Run `npm run check` before opening a pull request.

## Design rules

- Keep HTTP parsing in API routes and domain decisions in pure or server modules.
- Do not pass user-controlled strings to a shell.
- Never weaken URL canonicalization, authorization confirmation, resource limits, or cleanup.
- Do not log submitted URLs, media titles, client identifiers, or signed upstream URLs.
- Prefer a fake `DownloadService` over network access in automated tests.
- Document new environment variables and operational failure modes.

## Pull request expectations

A change should explain its user impact, operational impact, test evidence, and rollback approach.
Changes to the job lifecycle should cover success, failure, cancellation, and timeout behavior.
