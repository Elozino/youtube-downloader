import type { NextRequest } from 'next/server';
import { parseMediaSelection } from '@/lib/download-request';
import { validateYouTubeUrl } from '@/lib/youtube-url';
import { isCrossSite, noStoreJson } from '@/server/http';
import { downloadService } from '@/server/singletons';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<Response> {
  if (isCrossSite(request)) {
    return noStoreJson({ error: 'Cross-site requests are not allowed.' }, { status: 403 });
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return noStoreJson({ error: 'Content-Type must be application/json.' }, { status: 415 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return noStoreJson({ error: 'The request body is not valid JSON.' }, { status: 400 });
  }

  const parsedBody = parseMediaSelection(body);
  if (!parsedBody.ok) return noStoreJson({ error: parsedBody.error }, { status: 400 });

  const source = validateYouTubeUrl(parsedBody.value.url);
  if (!source.ok) return noStoreJson({ error: source.error }, { status: 400 });

  try {
    const info = await downloadService.inspect(
      {
        canonicalUrl: source.value.canonicalUrl,
        sourceId: source.value.sourceId,
        sourceKind: source.value.kind,
        mediaType: parsedBody.value.mediaType,
        quality: parsedBody.value.quality,
      },
      AbortSignal.timeout(45_000),
    );
    return noStoreJson({ info });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not inspect this media.';
    return noStoreJson({ error: message.slice(0, 500) }, { status: 422 });
  }
}
