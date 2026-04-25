/**
 * Documents Explorer - Server-Side Data Loading
 * @module documents-explorer/+page.server
 *
 * SSR: Loads documents + chat folders in parallel.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';
import { buildLoginUrl } from '$lib/utils/build-apex-url';

import type { PageServerLoad } from './$types';
import type { Document, ChatFolder } from './_lib/types';

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

/** Backend paginated response shape */
interface PaginatedDocumentsResponse {
  documents: RawDocument[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/** Backend chat-folders response shape */
interface ChatFoldersResponse {
  folders: ChatFolder[];
  total: number;
}

export const load: PageServerLoad = async ({ cookies, fetch, parent, url }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, buildLoginUrl('session-expired', undefined, url));
  }

  // Get user from parent layout
  const parentData = await parent();
  requireAddon(parentData.activeAddons, 'documents');

  // Parallel fetch: documents (permission-aware) + chat folders
  const [documentsResult, chatFoldersData] = await Promise.all([
    apiFetchWithPermission<PaginatedDocumentsResponse>('/documents', token, fetch),
    apiFetch<ChatFoldersResponse>('/documents/chat-folders', token, fetch),
  ]);

  // 403 → early return with empty data + permission flag
  if (documentsResult.permissionDenied) {
    return {
      permissionDenied: true as const,
      documents: [] as Document[],
      chatFolders: [] as ChatFolder[],
      currentUser: parentData.user,
    };
  }

  // Extract documents from paginated response
  const rawDocs: RawDocument[] = documentsResult.data?.documents ?? [];
  const documents: Document[] = rawDocs.map((doc) => ({
    ...doc,
    size: doc.fileSize ?? doc.size ?? 0,
    uploadedAt: doc.createdAt ?? doc.uploadedAt ?? new Date().toISOString(),
    uploadedBy: doc.createdBy ?? doc.uploadedBy ?? 0,
  })) as Document[];

  // Extract folders from chat-folders response
  const chatFolders: ChatFolder[] = chatFoldersData?.folders ?? [];

  return {
    permissionDenied: false as const,
    documents,
    chatFolders,
    currentUser: parentData.user,
  };
};
