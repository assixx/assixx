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
  if (result && typeof result === 'object' && 'documents' in result) {
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
    return result;
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
    backendData['filename'] = data.documentName;
  }
  if (data.category !== undefined) {
    backendData['category'] = data.category;
  }
  if (data.tags !== undefined) {
    backendData['tags'] = data.tags;
  }

  const result = (await apiClient.put(`/documents/${documentId}`, backendData)) as
    | Document
    | ApiResponse<Document>;
  if ('id' in result) {
    return result;
  }
  return result.data as Document;
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
    const result = (await apiClient.get('/documents/chat-folders')) as
      | { folders: ChatFolder[]; total: number }
      | ChatFolder[]
      | ApiResponse<ChatFolder[]>;

    // Handle different response formats
    if ('folders' in result) {
      return result.folders;
    }
    return Array.isArray(result) ? result : (result.data ?? []);
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
    const result = (await apiClient.get(`/chat/conversations/${conversationId}/attachments`)) as
      | Document[]
      | ApiResponse<Document[]>;
    return Array.isArray(result) ? result : (result.data ?? []);
  } catch (error) {
    console.error('[API] Failed to fetch chat attachments:', error);
    return [];
  }
}

// =============================================================================
// DOCUMENT UPLOAD
// =============================================================================

/**
 * Upload a document
 * @param formData - Upload form data
 * @param onProgress - Optional progress callback
 */
export async function uploadDocument(
  formData: UploadFormData,
  onProgress?: (progress: number) => void,
): Promise<Document> {
  // Build FormData for multipart upload
  // Backend expects 'document' field name (upload.single('document'))
  const data = new FormData();
  data.append('document', formData.file);
  data.append('accessScope', formData.accessScope);
  data.append('category', formData.category);

  if (formData.documentName !== null && formData.documentName !== undefined) {
    data.append('documentName', formData.documentName);
  }
  if (formData.description !== null && formData.description !== undefined) {
    data.append('description', formData.description);
  }
  if (formData.tags !== undefined && formData.tags.length > 0) {
    data.append('tags', JSON.stringify(formData.tags));
  }
  if (formData.ownerUserId !== undefined) {
    data.append('ownerUserId', String(formData.ownerUserId));
  }
  if (formData.targetTeamId !== undefined) {
    data.append('targetTeamId', String(formData.targetTeamId));
  }
  if (formData.targetDepartmentId !== undefined) {
    data.append('targetDepartmentId', String(formData.targetDepartmentId));
  }
  if (formData.salaryYear !== undefined) {
    data.append('salaryYear', String(formData.salaryYear));
  }
  if (formData.salaryMonth !== undefined) {
    data.append('salaryMonth', String(formData.salaryMonth));
  }

  // Use fetch with progress tracking
  const token = browser ? localStorage.getItem('accessToken') : null;
  const xhr = new XMLHttpRequest();

  return new Promise((resolve, reject) => {
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
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
