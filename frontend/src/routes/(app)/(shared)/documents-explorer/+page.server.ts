/**
 * Documents Explorer - Server-Side Data Loading
 * @module documents-explorer/+page.server
 *
 * SSR: Loads documents + chat folders in parallel.
 */
import { redirect } from '@sveltejs/kit';

import { requireAddon } from '$lib/utils/addon-guard';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type { Document, ChatFolder } from './_lib/types';

const log = createLogger('DocumentsExplorer');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface ApiResponse<T> {
  success?: boolean;
  data?: T | { documents?: T; folders?: T };
  documents?: T;
  folders?: T;
}

interface DataContainer<T> {
  documents?: T;
  folders?: T;
  [key: string]: unknown;
}

/**
 * Extract documents or folders from a data container
 */
function extractFromContainer<T>(container: DataContainer<T>): T | null {
  if ('documents' in container) return (container.documents as T) ?? null;
  if ('folders' in container) return (container.folders as T) ?? null;
  return null;
}

/**
 * Extract data from nested API response structure
 */
function unwrapApiResponse<T>(json: ApiResponse<T>): T | null {
  // Handle wrapped: { success: true, data: ... }
  if ('success' in json && json.success === true && json.data !== undefined) {
    const nested = extractFromContainer(json.data as DataContainer<T>);
    return nested ?? (json.data as T);
  }

  // Handle direct: { documents/folders: [...] }
  const direct = extractFromContainer(json as DataContainer<T>);
  if (direct !== null) return direct;

  // Handle: { data: T }
  if ('data' in json && json.data !== undefined) return json.data as T;

  return json as unknown as T;
}

/**
 * Generic API fetch with token auth
 */
async function apiFetch<T>(
  endpoint: string,
  token: string,
  fetchFn: typeof fetch,
): Promise<T | null> {
  try {
    const response = await fetchFn(`${API_BASE}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      log.error({ status: response.status, endpoint }, 'API error');
      return null;
    }

    const json = (await response.json()) as ApiResponse<T>;
    return unwrapApiResponse(json);
  } catch (err: unknown) {
    log.error({ err, endpoint }, 'Fetch error');
    return null;
  }
}

interface RawDocument {
  id: number;
  fileSize?: number;
  size?: number;
  createdAt?: string;
  uploadedAt?: string;
  createdBy?: number;
  uploadedBy?: number;
  [key: string]: unknown;
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Parallel fetch: documents + chat folders
  const [documentsData, chatFoldersData] = await Promise.all([
    apiFetch<RawDocument[]>('/documents', token, fetch),
    apiFetch<ChatFolder[]>('/documents/chat-folders', token, fetch),
  ]);

  // Get user from parent layout
  const parentData = await parent();
  requireAddon(parentData.activeAddons, 'documents');

  // Process documents with field mapping
  const rawDocs = Array.isArray(documentsData) ? documentsData : [];
  const documents: Document[] = rawDocs.map((doc) => ({
    ...doc,
    size: doc.fileSize ?? doc.size ?? 0,
    uploadedAt: doc.createdAt ?? doc.uploadedAt ?? new Date().toISOString(),
    uploadedBy: doc.createdBy ?? doc.uploadedBy ?? 0,
  })) as Document[];

  const chatFolders = Array.isArray(chatFoldersData) ? chatFoldersData : [];

  return {
    documents,
    chatFolders,
    currentUser: parentData.user,
  };
};
