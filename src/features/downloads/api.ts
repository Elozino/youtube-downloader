import type { DownloadJobView, MediaInfo, MediaQuality, MediaType } from '@/types/download';

interface ApiResponse<T> {
  error?: string;
  job?: DownloadJobView;
  info?: MediaInfo;
  value?: T;
}

export interface DownloadSelection {
  url: string;
  mediaType: MediaType;
  quality: MediaQuality;
}

export async function createDownload(
  selection: DownloadSelection,
  confirmAuthorization: boolean,
): Promise<DownloadJobView> {
  const response = await request<DownloadJobView>('/api/downloads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...selection, confirmAuthorization }),
  });
  if (!response.job) throw new Error('The server did not return a download job.');
  return response.job;
}

export async function inspectMedia(selection: DownloadSelection): Promise<MediaInfo> {
  const response = await request<MediaInfo>('/api/media-info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(selection),
  });
  if (!response.info) throw new Error('The server did not return media information.');
  return response.info;
}

export async function readDownload(id: string, signal?: AbortSignal): Promise<DownloadJobView> {
  const response = await request<DownloadJobView>(`/api/downloads/${id}`, {
    cache: 'no-store',
    signal,
  });
  if (!response.job) throw new Error('The server did not return download progress.');
  return response.job;
}

export async function cancelDownload(id: string): Promise<DownloadJobView> {
  const response = await request<DownloadJobView>(`/api/downloads/${id}`, { method: 'DELETE' });
  if (!response.job) throw new Error('The server did not return the cancelled job.');
  return response.job;
}

async function request<T>(url: string, init: RequestInit): Promise<ApiResponse<T>> {
  const response = await fetch(url, init);
  const data = (await response.json()) as ApiResponse<T>;
  if (!response.ok) throw new Error(data.error || `Request failed with status ${response.status}.`);
  return data;
}
