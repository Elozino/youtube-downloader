import type { NextRequest } from 'next/server';
import type { DownloadConfig } from './config';

export function clientIdFor(request: NextRequest, config: DownloadConfig): string {
  if (config.trustProxy) {
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (forwarded) return `ip:${forwarded.slice(0, 64)}`;
  }

  const userAgent = request.headers.get('user-agent') ?? 'unknown';
  return `direct:${userAgent.slice(0, 120)}`;
}

export function isCrossSite(request: NextRequest): boolean {
  return request.headers.get('sec-fetch-site') === 'cross-site';
}

export function noStoreJson(body: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), { ...init, headers });
}
