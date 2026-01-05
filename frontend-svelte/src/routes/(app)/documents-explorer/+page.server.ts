/**
 * Documents Explorer - Server-Side Data Loading
 * @module documents-explorer/+page.server
 *
 * SSR: Loads documents + chat folders in parallel.
 */
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Document, ChatFolder } from './_lib/types';

const API_BASE = process.env['API_URL'] ?? 'http://localhost:3000/api/v2';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  documents?: T;
  folders?: T;
}

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
      console.error(`[SSR] API error ${response.status} for ${endpoint}`);
      return null;
    }

    const json = (await response.json()) as ApiResponse<T>;
    if ('success' in json && json.success === true) {
      // Handle wrapped response: { success: true, data: { documents: [...] } }
      const innerData = json.data as unknown as { documents?: T; folders?: T };
      if (innerData && 'documents' in innerData) {
        return innerData.documents ?? null;
      }
      if (innerData && 'folders' in innerData) {
        return innerData.folders ?? null;
      }
      return json.data ?? null;
    }
    // Handle direct object response with documents/folders
    if ('documents' in json) {
      return json.documents ?? null;
    }
    if ('folders' in json) {
      return json.folders ?? null;
    }
    if ('data' in json && json.data !== undefined) {
      return json.data;
    }
    return json as unknown as T;
  } catch (error) {
    console.error(`[SSR] Fetch error for ${endpoint}:`, error);
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
  const startTime = performance.now();

  const token = cookies.get('accessToken');
  if (!token) {
    redirect(302, '/login');
  }

  // Parallel fetch: documents + chat folders
  const [documentsData, chatFoldersData] = await Promise.all([
    apiFetch<RawDocument[]>('/documents', token, fetch),
    apiFetch<ChatFolder[]>('/documents/chat-folders', token, fetch),
  ]);

  // Get user from parent layout
  const parentData = await parent();

  // Process documents with field mapping
  const rawDocs = Array.isArray(documentsData) ? documentsData : [];
  const documents: Document[] = rawDocs.map((doc) => ({
    ...doc,
    size: doc.fileSize ?? doc.size ?? 0,
    uploadedAt: doc.createdAt ?? doc.uploadedAt ?? new Date().toISOString(),
    uploadedBy: doc.createdBy ?? doc.uploadedBy ?? 0,
  })) as Document[];

  const chatFolders = Array.isArray(chatFoldersData) ? chatFoldersData : [];

  const duration = (performance.now() - startTime).toFixed(1);
  console.info(`[SSR] documents-explorer loaded in ${duration}ms (2 parallel API calls)`);

  return {
    documents,
    chatFolders,
    currentUser: parentData.user,
  };
};
