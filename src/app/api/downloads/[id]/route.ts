import type { NextRequest } from 'next/server';
import { clientIdFor, isCrossSite, noStoreJson } from '@/server/http';
import { downloadConfig, downloadManager } from '@/server/singletons';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const job = downloadManager.get(id, clientIdFor(request, downloadConfig));
  return job
    ? noStoreJson({ job })
    : noStoreJson({ error: 'Download job not found or expired.' }, { status: 404 });
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  if (isCrossSite(request))
    return noStoreJson({ error: 'Cross-site requests are not allowed.' }, { status: 403 });
  const { id } = await context.params;
  const job = downloadManager.cancel(id, clientIdFor(request, downloadConfig));
  return job
    ? noStoreJson({ job })
    : noStoreJson({ error: 'Download job not found or expired.' }, { status: 404 });
}
