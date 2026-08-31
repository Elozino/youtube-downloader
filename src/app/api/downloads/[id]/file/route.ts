import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import type { NextRequest } from 'next/server';
import { clientIdFor } from '@/server/http';
import { downloadConfig, downloadManager } from '@/server/singletons';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const file = downloadManager.claimFile(id, clientIdFor(request, downloadConfig));
  if (!file) {
    return Response.json(
      { error: 'This file is unavailable, expired, or has already been downloaded.' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const nodeStream = createReadStream(file.filePath);
  nodeStream.once('close', () => void downloadManager.releaseFile(id));
  const asciiName = file.filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');

  return new Response(Readable.toWeb(nodeStream) as ReadableStream, {
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Type': contentTypeFor(file.filename),
      'Content-Length': String(file.sizeBytes),
      'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function contentTypeFor(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.zip')) return 'application/zip';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  return 'application/octet-stream';
}
