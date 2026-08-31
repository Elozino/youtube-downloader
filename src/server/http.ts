import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import type { DownloadConfig } from './config';

const CLIENT_COOKIE = 'ayd_client';
const CLIENT_TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ClientIdentity {
  id: string;
  setCookie?: string;
}

export function clientIdFor(
  request: NextRequest,
  config: Pick<DownloadConfig, 'trustProxy'>,
): string {
  const cookieId = request.cookies.get(CLIENT_COOKIE)?.value;
  if (cookieId && CLIENT_TOKEN.test(cookieId)) return `session:${cookieId}`;

  if (config.trustProxy) {
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (forwarded) return `ip:${forwarded.slice(0, 64)}`;
  }

  const userAgent = request.headers.get('user-agent') ?? 'unknown';
  return `direct:${userAgent.slice(0, 120)}`;
}

export function clientIdentityForCreate(request: NextRequest): ClientIdentity {
  const existingId = request.cookies.get(CLIENT_COOKIE)?.value;
  if (existingId && CLIENT_TOKEN.test(existingId)) return { id: `session:${existingId}` };

  const token = randomUUID();
  const secure = request.nextUrl.protocol === 'https:' ? '; Secure' : '';
  return {
    id: `session:${token}`,
    setCookie: `${CLIENT_COOKIE}=${token}; Path=/api/downloads; HttpOnly; SameSite=Strict; Max-Age=31536000${secure}`,
  };
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
