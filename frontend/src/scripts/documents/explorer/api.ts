/**
 * Documents Explorer - API Module
 *
 * Wrapper for backend API v2 document endpoints
 * Uses centralized ApiClient for authentication and token management
 *
 * @module explorer/api
 */

import { ApiClient } from '../../../utils/api-client';
import { tokenManager } from '../../../utils/token-manager';
import type { Document, ApiResponse, UploadFormData, UploadProgressCallback } from './types';

/**
 * API Base URL
 */
const API_BASE = '/api/v2';

/**
 * Map backend response to frontend Document type
 * Backend uses camelCase (fileSize), frontend uses shorter names (size)
 */
function mapBackendDocument(backendDoc: Record<string, unknown>): Document {
  return {
    ...backendDoc,
    // Map fileSize to size (fileSize comes from backend mapping)
    size: typeof backendDoc['fileSize'] === 'number' ? backendDoc['fileSize'] : 0,
  } as Document;
}

/**
 * API Module
 * Handles all document-related API calls using centralized ApiClient
 */
class DocumentAPI {
  private apiClient: ApiClient;

  constructor() {
    this.apiClient = ApiClient.getInstance();
  }

  /**
   * Fetch all documents for current user
   * Uses centralized ApiClient for authentication
   * @returns Promise<Document[]>
   */
  public async fetchDocuments(): Promise<Document[]> {
    try {
      const result = await this.apiClient.request<{
        data?: Record<string, unknown>[];
        documents?: Record<string, unknown>[];
      }>('/documents', {
        method: 'GET',
      });

      // Backend may return data in different formats - map to frontend types
      const rawDocuments = result.data ?? result.documents ?? [];
      return rawDocuments.map(mapBackendDocument);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      throw new Error(error instanceof Error ? error.message : 'Netzwerkfehler beim Laden der Dokumente');
    }
  }

  /**
   * Append optional number field to FormData
   */
  private appendOptionalNumber(fd: FormData, key: string, value: number | null | undefined): void {
    if (value !== null && value !== undefined) {
      fd.append(key, value.toString());
    }
  }

  /**
   * Append optional string field to FormData
   */
  private appendOptionalString(fd: FormData, key: string, value: string | null | undefined): void {
    if (value !== null && value !== undefined && value !== '') {
      fd.append(key, value);
    }
  }

  /**
   * Build FormData from upload form data
   * @param formData - Upload form data
   * @returns FormData - Ready for upload
   */
  private buildUploadFormData(formData: UploadFormData): FormData {
    const fd = new FormData();
    fd.append('document', formData.file); // Backend expects 'document' field name (upload.single('document'))
    fd.append('accessScope', formData.accessScope);
    fd.append('category', formData.category);

    // Optional IDs
    this.appendOptionalNumber(fd, 'ownerUserId', formData.ownerUserId);
    this.appendOptionalNumber(fd, 'targetTeamId', formData.targetTeamId);
    this.appendOptionalNumber(fd, 'targetDepartmentId', formData.targetDepartmentId);

    // Document name and description (optional)
    this.appendOptionalString(fd, 'documentName', formData.documentName);
    this.appendOptionalString(fd, 'description', formData.description);

    // Payroll fields
    this.appendOptionalNumber(fd, 'salaryYear', formData.salaryYear);
    this.appendOptionalNumber(fd, 'salaryMonth', formData.salaryMonth);

    console.log('[DocumentAPI] FormData being sent:', {
      accessScope: formData.accessScope,
      category: formData.category,
      documentName: formData.documentName ?? '(not set)',
      description: formData.description ?? '(not set)',
      fileSize: formData.file.size,
      fileName: formData.file.name,
    });

    return fd;
  }

  /**
   * Upload a document (NEW: clean structure, refactored 2025-01-10)
   * @param formData - Upload form data
   * @param onProgress - Progress callback (0-100)
   * @returns Promise<Document> - Newly created document
   */
  public async uploadDocument(formData: UploadFormData, onProgress?: UploadProgressCallback): Promise<Document> {
    try {
      const fd = this.buildUploadFormData(formData);

      // Create XMLHttpRequest for progress tracking
      // eslint-disable-next-line @typescript-eslint/return-await -- XMLHttpRequest doesn't return a Promise directly
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Track upload progress
        if (onProgress) {
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const percentComplete = Math.round((e.loaded / e.total) * 100);
              onProgress(percentComplete);
            }
          });
        }

        // Handle completion
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- JSON.parse returns any, but we validate the structure
              const data: ApiResponse<Document> = JSON.parse(xhr.responseText);
              if (data.success && data.data) {
                resolve(data.data);
              } else {
                reject(new Error(data.error ?? 'Upload fehlgeschlagen'));
              }
            } catch {
              // Error parameter unused - we just need to catch parse errors
              reject(new Error('Ungültige Server-Antwort'));
            }
          } else {
            reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
          }
        });

        // Handle errors
        xhr.addEventListener('error', () => {
          reject(new Error('Netzwerkfehler beim Hochladen'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload abgebrochen'));
        });

        // Send request
        xhr.open('POST', `${API_BASE}/documents`);

        // Add Authorization header with JWT token
        const token = tokenManager.getAccessToken();
        // eslint-disable-next-line security/detect-possible-timing-attacks -- Checking for null/undefined is safe
        if (token !== null) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }

        xhr.send(fd);
      });
    } catch (error) {
      console.error('Failed to upload document:', error);
      throw new Error(error instanceof Error ? error.message : 'Fehler beim Hochladen');
    }
  }

  /**
   * Delete a document (admin only)
   * Uses centralized ApiClient for authentication
   * @param documentId - Document UUID
   * @returns Promise<void>
   */
  public async deleteDocument(documentId: string): Promise<void> {
    try {
      await this.apiClient.request<{ success: boolean }>(`/documents/${documentId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Failed to delete document:', error);
      throw new Error(error instanceof Error ? error.message : 'Fehler beim Löschen');
    }
  }

  /**
   * Mark document as read
   * Uses centralized ApiClient for authentication
   * @param documentId - Document UUID
   * @returns Promise<void>
   */
  public async markAsRead(documentId: string): Promise<void> {
    try {
      await this.apiClient.request<{ success: boolean }>(`/documents/${documentId}/read`, {
        method: 'POST',
      });
    } catch (error) {
      console.error('Failed to mark document as read:', error);
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Fetch available users for upload recipient selection
   * Uses centralized ApiClient for authentication
   * @returns Promise<{id: number, name: string, email: string}[]>
   */
  public async fetchUsers(): Promise<{ id: number; name: string; email: string }[]> {
    try {
      const result = await this.apiClient.request<{ data?: { id: number; name: string; email: string }[] }>('/users', {
        method: 'GET',
      });

      return result.data ?? [];
    } catch (error) {
      console.error('Failed to fetch users:', error);
      return []; // Return empty array on error
    }
  }

  /**
   * Fetch available teams for upload recipient selection
   * Uses centralized ApiClient for authentication
   * @returns Promise<{id: number, name: string}[]>
   */
  public async fetchTeams(): Promise<{ id: number; name: string }[]> {
    try {
      const result = await this.apiClient.request<{ data?: { id: number; name: string }[] }>('/teams', {
        method: 'GET',
      });

      return result.data ?? [];
    } catch (error) {
      console.error('Failed to fetch teams:', error);
      return []; // Return empty array on error
    }
  }

  /**
   * Fetch available departments for upload recipient selection
   * Uses centralized ApiClient for authentication
   * @returns Promise<{id: number, name: string}[]>
   */
  public async fetchDepartments(): Promise<{ id: number; name: string }[]> {
    try {
      const result = await this.apiClient.request<{ data?: { id: number; name: string }[] }>('/departments', {
        method: 'GET',
      });

      return result.data ?? [];
    } catch (error) {
      console.error('Failed to fetch departments:', error);
      return []; // Return empty array on error
    }
  }
}

// Singleton instance
export const documentAPI = new DocumentAPI();

// Export type for testing/mocking
export type { DocumentAPI };
