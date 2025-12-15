/**
 * Documents Shared API
 * API calls for document operations
 */

import { ApiClient } from '../../../utils/api-client';
import type { Document, DocumentScope } from './types';

/**
 * Load documents from API
 * @param scope - Optional scope filter (company, department, team, personal, payroll)
 * @returns Array of documents
 */
export async function loadDocuments(scope?: DocumentScope): Promise<Document[]> {
  try {
    const apiClient = ApiClient.getInstance();
    const result = await apiClient.request<{ data?: Document[]; documents?: Document[] }>('/documents', {
      method: 'GET',
    });

    // Backend returns {data: Document[], pagination: {...}}
    const allDocuments = result.data ?? result.documents ?? [];

    // Filter by scope if provided
    if (scope !== undefined && scope !== 'all') {
      return allDocuments.filter((doc) => doc.scope === scope || doc.category === scope);
    }

    return allDocuments;
  } catch (error) {
    console.error('Error loading documents:', error);
    throw error;
  }
}

/**
 * Toggle document favorite status
 * @param documentId - Document ID
 * @param isFavorite - New favorite status
 */
export async function toggleFavorite(documentId: number, isFavorite: boolean): Promise<void> {
  try {
    const apiClient = ApiClient.getInstance();
    await apiClient.request(`/documents/${documentId}/favorite`, {
      method: 'POST',
      body: JSON.stringify({ is_favorite: isFavorite }),
    });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    throw error;
  }
}
