import type { NextRequest } from 'next/server';
import { parseCreateDownloadRequest } from '@/lib/download-request';
import { validateYouTubeUrl } from '@/lib/youtube-url';
import { clientIdentityForCreate, isCrossSite, noStoreJson } from '@/server/http';
import { JobLimitError } from '@/server/job-manager';
import { downloadManager } from '@/server/singletons';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<Response> {
  if (isCrossSite(request))
    return noStoreJson({ error: 'Cross-site requests are not allowed.' }, { status: 403 });
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return noStoreJson({ error: 'Content-Type must be application/json.' }, { status: 415 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return noStoreJson({ error: 'The request body is not valid JSON.' }, { status: 400 });
  }

  const parsedBody = parseCreateDownloadRequest(body);
  if (!parsedBody.ok) return noStoreJson({ error: parsedBody.error }, { status: 400 });

  const source = validateYouTubeUrl(parsedBody.value.url);
  if (!source.ok) return noStoreJson({ error: source.error }, { status: 400 });

  try {
    const client = clientIdentityForCreate(request);
    const job = downloadManager.create(
      client.id,
      source.value,
      parsedBody.value.mediaType,
      parsedBody.value.quality,
    );
    return noStoreJson(
      { job },
      {
        status: 202,
        headers: client.setCookie ? { 'Set-Cookie': client.setCookie } : undefined,
      },
    );
  } catch (error) {
    if (error instanceof JobLimitError) {
      return noStoreJson(
        { error: error.message },
        { status: 429, headers: { 'Retry-After': '30' } },
      );
    }
    return noStoreJson({ error: 'Unable to start the download.' }, { status: 500 });
  }
}
