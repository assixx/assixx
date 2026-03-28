// =============================================================================
// DOCUMENTS EXPLORER - API FUNCTIONS
// =============================================================================

import { browser } from '$app/environment';

import { getApiClient } from '$lib/utils/api-client';
import { createLogger } from '$lib/utils/logger';
import { fetchCurrentUser as fetchSharedUser } from '$lib/utils/user-service';

import type {
  Document,
  ChatFolder,
  UploadFormData,
  UpdateDocumentData,
  ApiResponse,
  CurrentUser,
} from './types';

const log = createLogger('DocumentsExplorerApi');

const apiClient = getApiClient();

// =============================================================================
// DOCUMENT FETCHING
// =============================================================================

/**
 * Fetch all documents for the current user
 * Backend filters based on user permissions
 */
export async function fetchDocuments(): Promise<Document[]> {
  const result = await apiClient.get('/documents');

  // apiClient already extracts response.data, so result is: { documents, pagination }
  if (result !== null && typeof result === 'object' && 'documents' in result) {
    const rawDocs = Array.isArray(result.documents) ? result.documents : [];
    // Map API field names to our interface
    return rawDocs.map((doc: Record<string, unknown>) => ({
      ...doc,
      // Map fileSize -> size
      size: doc.fileSize ?? doc.size ?? 0,
      // Map createdAt -> uploadedAt
      uploadedAt: doc.createdAt ?? doc.uploadedAt ?? new Date().toISOString(),
      // Map createdBy -> uploadedBy
      uploadedBy: doc.createdBy ?? doc.uploadedBy ?? 0,
    })) as Document[];
  }

  // Direct array response (legacy)
  if (Array.isArray(result)) {
    return result as Document[];
  }

  return [];
}

/**
 * Mark a document as read
 */
export async function markDocumentAsRead(documentId: number): Promise<void> {
  await apiClient.post(`/documents/${documentId}/read`, {});
}

/**
 * Delete a document (soft delete)
 */
export async function deleteDocument(documentId: number): Promise<void> {
  await apiClient.delete(`/documents/${documentId}`);
}

/**
 * Update a document (name, category, tags)
 * Backend uses PUT and expects 'filename' field
 */
export async function updateDocument(
  documentId: number,
  data: UpdateDocumentData,
): Promise<Document> {
  // Map frontend field names to backend field names
  const backendData: Record<string, unknown> = {};
  if (data.documentName !== undefined) {
    backendData.filename = data.documentName;
  }
  if (data.category !== undefined) {
    backendData.category = data.category;
  }
  if (data.tags !== undefined) {
    backendData.tags = data.tags;
  }

  const result = await apiClient.put(`/documents/${documentId}`, backendData);

  // Handle different response formats from API
  if (result !== null && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    if ('id' in obj) {
      return obj as unknown as Document;
    }
    if ('data' in obj && obj.data !== null && typeof obj.data === 'object') {
      return obj.data as unknown as Document;
    }
  }

  throw new Error('Invalid response format from updateDocument API');
}

// =============================================================================
// CHAT FOLDERS
// =============================================================================

/**
 * Fetch chat folders (conversations with attachments)
 * Uses documents endpoint, not chat endpoint!
 */
export async function fetchChatFolders(): Promise<ChatFolder[]> {
  try {
    const result = await apiClient.get('/documents/chat-folders');

    // Handle different response formats
    if (Array.isArray(result)) {
      return result as ChatFolder[];
    }
    if (result !== null && typeof result === 'object') {
      const obj = result as Record<string, unknown>;
      if ('folders' in obj && Array.isArray(obj.folders)) {
        return obj.folders as ChatFolder[];
      }
      if ('data' in obj && Array.isArray(obj.data)) {
        return obj.data as ChatFolder[];
      }
    }
    return [];
  } catch (err: unknown) {
    log.error({ err }, 'Failed to fetch chat folders');
    return [];
  }
}

/**
 * Fetch chat attachments for a specific conversation
 */
/** Map raw API document to frontend Document type */
function mapApiDocument(doc: Record<string, unknown>): Document {
  // Extract values with proper null checks before type casting
  const fileSize = doc.fileSize as number | undefined;
  const size = doc.size as number | undefined;
  const createdAt = doc.createdAt as string | undefined;
  const uploadedAt = doc.uploadedAt as string | undefined;
  const createdBy = doc.createdBy as number | undefined;
  const uploadedBy = doc.uploadedBy as number | undefined;

  return {
    ...doc,
    size: fileSize ?? size ?? 0,
    uploadedAt: createdAt ?? uploadedAt ?? new Date().toISOString(),
    uploadedBy: createdBy ?? uploadedBy ?? 0,
  } as Document;
}

/** Type guard: check if value is a non-null object */
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Extract documents array from object with 'documents' key */
function extractFromDocumentsKey(obj: Record<string, unknown>): Record<string, unknown>[] | null {
  if ('documents' in obj && Array.isArray(obj.documents)) {
    return obj.documents as Record<string, unknown>[];
  }
  return null;
}

/** Extract documents array from object with 'data' key */
function extractFromDataKey(obj: Record<string, unknown>): Record<string, unknown>[] | null {
  if (!('data' in obj)) return null;

  // { data: [...] }
  if (Array.isArray(obj.data)) {
    return obj.data as Record<string, unknown>[];
  }

  // { data: { documents: [...] } }
  if (isObject(obj.data)) {
    return extractFromDocumentsKey(obj.data);
  }

  return null;
}

/**
 * Extract documents array from various API response structures
 * Handles: [...], { documents: [...] }, { data: { documents: [...] } }, { data: [...] }
 */
function extractDocumentsFromResponse(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) {
    return result as Record<string, unknown>[];
  }

  if (!isObject(result)) {
    return [];
  }

  return extractFromDocumentsKey(result) ?? extractFromDataKey(result) ?? [];
}

export async function fetchChatAttachments(conversationId: number): Promise<Document[]> {
  try {
    const result = await apiClient.get(`/chat/conversations/${conversationId}/attachments`);
    const rawDocs = extractDocumentsFromResponse(result);
    return rawDocs.map(mapApiDocument);
  } catch (err: unknown) {
    log.error({ err }, 'Failed to fetch chat attachments');
    return [];
  }
}

// =============================================================================
// DOCUMENT UPLOAD
// =============================================================================

/**
 * Build FormData for document upload
 * Backend expects 'document' field name (upload.single('document'))
 */
function buildUploadFormData(formData: UploadFormData): FormData {
  const data = new FormData();
  data.append('document', formData.file);
  data.append('accessScope', formData.accessScope);
  data.append('category', formData.category);

  // Optional fields - append if defined
  const optionalFields: [string, string | number | undefined | null][] = [
    ['documentName', formData.documentName],
    ['description', formData.description],
    ['ownerUserId', formData.ownerUserId],
    ['targetTeamId', formData.targetTeamId],
    ['targetDepartmentId', formData.targetDepartmentId],
    ['salaryYear', formData.salaryYear],
    ['salaryMonth', formData.salaryMonth],
  ];

  for (const [key, value] of optionalFields) {
    if (value !== null && value !== undefined) {
      data.append(key, String(value));
    }
  }

  // Tags need JSON serialization
  if (formData.tags !== undefined && formData.tags.length > 0) {
    data.append('tags', JSON.stringify(formData.tags));
  }

  return data;
}

/** Upload a document */
export async function uploadDocument(
  formData: UploadFormData,
  onProgress?: (progress: number) => void,
): Promise<Document> {
  const data = buildUploadFormData(formData);
  const token = browser ? localStorage.getItem('accessToken') : null;
  const xhr = new XMLHttpRequest();

  return await new Promise((resolve, reject) => {
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress !== undefined) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText) as ApiResponse<Document>;
          resolve(response.data ?? (response as unknown as Document));
        } catch {
          reject(new Error('Invalid response format'));
        }
      } else {
        reject(new Error(`HTTP ${xhr.status}: Upload fehlgeschlagen`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Netzwerkfehler beim Upload'));
    });

    xhr.open('POST', '/api/v2/documents');

    if (token !== null) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.send(data);
  });
}

// =============================================================================
// USER INFO
// =============================================================================

/**
 * Get current user info
 * DELEGATES to shared user service (prevents duplicate /users/me calls)
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const result = await fetchSharedUser();
  return result.user as CurrentUser | null;
}
