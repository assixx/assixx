/**
 * Documents Explorer - Server-Side Data Loading
 * @module documents-explorer/+page.server
 *
 * SSR: Loads documents + chat folders in parallel.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch, apiFetchWithPermission } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';

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

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  // Get user from parent layout
  const parentData = await parent();
  requireAddon(parentData.activeAddons, 'documents');

  // Parallel fetch: documents (permission-aware) + chat folders
  const [documentsResult, chatFoldersData] = await Promise.all([
    apiFetchWithPermission<RawDocument[]>('/documents', token, fetch),
    apiFetch<ChatFolder[]>('/documents/chat-folders', token, fetch),
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

  // Process documents with field mapping
  const rawDocs = Array.isArray(documentsResult.data) ? documentsResult.data : [];
  const documents: Document[] = rawDocs.map((doc) => ({
    ...doc,
    size: doc.fileSize ?? doc.size ?? 0,
    uploadedAt: doc.createdAt ?? doc.uploadedAt ?? new Date().toISOString(),
    uploadedBy: doc.createdBy ?? doc.uploadedBy ?? 0,
  })) as Document[];

  const chatFolders = Array.isArray(chatFoldersData) ? chatFoldersData : [];

  return {
    permissionDenied: false as const,
    documents,
    chatFolders,
    currentUser: parentData.user,
  };
};
