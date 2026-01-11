// =============================================================================
// DOCUMENTS EXPLORER - API FUNCTIONS
// =============================================================================

import { browser } from '$app/environment';

import { getApiClient } from '$lib/utils/api-client';
import { fetchCurrentUser as fetchSharedUser } from '$lib/utils/user-service';

import type {
  Document,
  ChatFolder,
  UploadFormData,
  UpdateDocumentData,
  ApiResponse,
  CurrentUser,
} from './types';

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
  } catch (error) {
    console.error('[API] Failed to fetch chat folders:', error);
    return [];
  }
}

/**
 * Fetch chat attachments for a specific conversation
 */
export async function fetchChatAttachments(conversationId: number): Promise<Document[]> {
  try {
    const result = await apiClient.get(`/chat/conversations/${conversationId}/attachments`);

    if (Array.isArray(result)) {
      return result as Document[];
    }
    if (result !== null && typeof result === 'object') {
      const obj = result as Record<string, unknown>;
      if ('data' in obj && Array.isArray(obj.data)) {
        return obj.data as Document[];
      }
    }
    return [];
  } catch (error) {
    console.error('[API] Failed to fetch chat attachments:', error);
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

/**
 * Upload a document
 * @param formData - Upload form data
 * @param onProgress - Optional progress callback
 */
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

// =============================================================================
// ERROR HANDLING
// =============================================================================

/**
 * Check if error has SESSION_EXPIRED code
 */
export function isSessionExpiredError(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: string }).code === 'SESSION_EXPIRED'
  );
}
