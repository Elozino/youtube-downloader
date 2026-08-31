import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { clientIdentityForCreate, clientIdFor } from './http';

const config = { trustProxy: false };

describe('download client identity', () => {
  it('issues a private same-site cookie for a new client', () => {
    const identity = clientIdentityForCreate(new NextRequest('http://localhost/api/downloads'));

    expect(identity.id).toMatch(/^session:[0-9a-f-]{36}$/);
    expect(identity.setCookie).toContain('Path=/api/downloads');
    expect(identity.setCookie).toContain('HttpOnly');
    expect(identity.setCookie).toContain('SameSite=Strict');
  });

  it('reuses a valid client cookie for later job operations', () => {
    const token = 'd69c8712-214d-4257-9399-9e2624b027c5';
    const request = new NextRequest('http://localhost/api/downloads/job', {
      headers: { cookie: `ayd_client=${token}` },
    });

    expect(clientIdFor(request, config)).toBe(`session:${token}`);
    expect(clientIdentityForCreate(request)).toEqual({ id: `session:${token}` });
  });
});
