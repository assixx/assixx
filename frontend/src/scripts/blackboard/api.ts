/**
 * Blackboard API Layer
 * Handles all API communication for blackboard entries
 * Following MANAGE pattern (like manage/areas/api.ts)
 */

import type { ApiClient } from '../../utils/api-client';
import { tokenManager } from '../../utils/token-manager';
import { showSuccess, showError } from '../auth';
import type {
  BlackboardEntry,
  BlackboardAttachment,
  CreateEntryData,
  UpdateEntryData,
  EntryQueryOptions,
  PaginatedResponse,
  ConfirmationUser,
} from './types';

/**
 * API wrapper for blackboard operations
 */
export class BlackboardAPI {
  constructor(private readonly apiClient: ApiClient) {}

  // ============================================================================
  // Entry Operations
  // ============================================================================

  /**
   * Build URL query parameters from options
   * Extracted to reduce cognitive complexity of fetchAll()
   */
  private buildQueryParams(options: EntryQueryOptions): URLSearchParams {
    const params = new URLSearchParams();

    if (options.status !== undefined) params.append('status', options.status);
    if (options.filter !== undefined) params.append('filter', options.filter);
    if (options.search !== undefined && options.search !== '') params.append('search', options.search);
    if (options.page !== undefined) params.append('page', options.page.toString());
    if (options.limit !== undefined) params.append('limit', options.limit.toString());
    if (options.sortBy !== undefined) params.append('sortBy', options.sortBy);
    if (options.sortDir !== undefined) params.append('sortDir', options.sortDir);
    if (options.priority !== undefined) params.append('priority', options.priority);

    return params;
  }

  /**
   * Fetch all entries with filters and pagination
   */
  async fetchAll(options: EntryQueryOptions = {}): Promise<PaginatedResponse<BlackboardEntry>> {
    try {
      const params = this.buildQueryParams(options);
      const queryString = params.toString();
      const url = `/api/v2/blackboard/entries${queryString !== '' ? `?${queryString}` : ''}`;

      // Direct fetch to get full response with meta.pagination
      // apiClient.request() only returns data, not meta
      const token = tokenManager.getAccessToken();
      const response = await fetch(`${window.location.origin}${url}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token ?? ''}`,
          'Content-Type': 'application/json',
        },
        credentials: 'omit',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Parse JSON response (unknown type for safety)
      const jsonData: unknown = await response.json();

      // Type guard to validate response structure
      if (
        typeof jsonData !== 'object' ||
        jsonData === null ||
        !('success' in jsonData) ||
        !('data' in jsonData) ||
        !('meta' in jsonData)
      ) {
        throw new Error('Invalid API response structure');
      }

      const fullResponse = jsonData as {
        success: boolean;
        data: BlackboardEntry[];
        meta: {
          pagination: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
          };
        };
      };

      if (!fullResponse.success) {
        throw new Error('API returned success=false');
      }

      // Transform API v2 response format to PaginatedResponse format
      return {
        entries: fullResponse.data,
        pagination: fullResponse.meta.pagination,
      };
    } catch (error) {
      console.error('[BlackboardAPI] Error fetching entries:', error);
      showError('Fehler beim Laden der Einträge');
      return {
        entries: [],
        pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
      };
    }
  }

  /**
   * Get entry by ID
   */
  async getById(id: number): Promise<BlackboardEntry | null> {
    try {
      return await this.apiClient.get<BlackboardEntry>(`/blackboard/entries/${id}`);
    } catch (error) {
      console.error('[BlackboardAPI] Error fetching entry:', error);
      showError('Fehler beim Laden des Eintrags');
      return null;
    }
  }

  /**
   * Create new entry
   */
  async create(data: CreateEntryData): Promise<BlackboardEntry> {
    const response = await this.apiClient.post<BlackboardEntry>('/blackboard/entries', data);
    showSuccess('Eintrag erfolgreich erstellt');
    return response;
  }

  /**
   * Update existing entry
   */
  async update(id: number, data: UpdateEntryData): Promise<BlackboardEntry> {
    try {
      const response = await this.apiClient.put<BlackboardEntry>(`/blackboard/entries/${id}`, data);
      showSuccess('Eintrag erfolgreich aktualisiert');
      return response;
    } catch (error) {
      console.error('[BlackboardAPI] Error updating entry:', error);
      showError('Fehler beim Aktualisieren des Eintrags');
      throw error;
    }
  }

  /**
   * Delete entry
   */
  async delete(id: number): Promise<void> {
    try {
      await this.apiClient.delete(`/blackboard/entries/${id}`);
      showSuccess('Eintrag erfolgreich gelöscht');
    } catch (error) {
      console.error('[BlackboardAPI] Error deleting entry:', error);
      showError('Fehler beim Löschen des Eintrags');
      throw error;
    }
  }

  // ============================================================================
  // Confirmation Operations
  // ============================================================================

  /**
   * Confirm entry as read
   */
  async confirm(id: number): Promise<void> {
    try {
      await this.apiClient.post(`/blackboard/entries/${id}/confirm`, {});
      showSuccess('Eintrag als gelesen markiert');
    } catch (error) {
      console.error('[BlackboardAPI] Error confirming entry:', error);
      showError('Fehler beim Bestätigen des Eintrags');
      throw error;
    }
  }

  /**
   * Get confirmation status for entry
   */
  async getConfirmationStatus(id: number): Promise<ConfirmationUser[]> {
    try {
      return await this.apiClient.get<ConfirmationUser[]>(`/blackboard/entries/${id}/confirmations`);
    } catch (error) {
      console.error('[BlackboardAPI] Error fetching confirmation status:', error);
      return [];
    }
  }

  // ============================================================================
  // Dashboard Operations
  // ============================================================================

  /**
   * Get dashboard entries (for widget)
   */
  async getDashboardEntries(limit: number = 3): Promise<BlackboardEntry[]> {
    try {
      return await this.apiClient.get<BlackboardEntry[]>(`/blackboard/dashboard?limit=${limit}`);
    } catch (error) {
      console.error('[BlackboardAPI] Error fetching dashboard entries:', error);
      return [];
    }
  }

  // ============================================================================
  // Attachment Operations
  // ============================================================================

  /**
   * Upload attachment to entry
   */
  async uploadAttachment(entryId: number, file: File): Promise<BlackboardAttachment> {
    try {
      const formData = new FormData();
      formData.append('attachment', file); // Backend expects 'attachment' field name

      const response = await this.apiClient.post<BlackboardAttachment>(
        `/blackboard/entries/${entryId}/attachments`,
        formData,
      );

      showSuccess('Anhang erfolgreich hochgeladen');
      return response;
    } catch (error) {
      console.error('[BlackboardAPI] Error uploading attachment:', error);
      showError('Fehler beim Hochladen des Anhangs');
      throw error;
    }
  }

  /**
   * Delete attachment
   */
  async deleteAttachment(attachmentId: number): Promise<void> {
    try {
      await this.apiClient.delete(`/blackboard/attachments/${attachmentId}`);
      showSuccess('Anhang erfolgreich gelöscht');
    } catch (error) {
      console.error('[BlackboardAPI] Error deleting attachment:', error);
      showError('Fehler beim Löschen des Anhangs');
      throw error;
    }
  }

  /**
   * Get attachment preview URL
   */
  getAttachmentPreviewUrl(attachmentId: number): string {
    return `/api/blackboard/attachments/${attachmentId}/preview`;
  }

  /**
   * Get attachment download URL
   */
  getAttachmentDownloadUrl(attachmentId: number): string {
    return `/api/blackboard/attachments/${attachmentId}/download`;
  }
}
