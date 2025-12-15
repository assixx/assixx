/**
 * KVP Detail Data Loader Module
 * Handles all data fetching operations for KVP detail page
 */

import { ApiClient } from '../../../utils/api-client';
import { getAuthToken } from '../../auth';
import type { KvpSuggestion, Comment, Attachment } from './ui';

interface User {
  id: number;
  role: 'root' | 'admin' | 'employee';
  tenantId: number;
}

/**
 * Data loading handler for KVP detail page
 */
export class KvpDetailDataLoader {
  private apiClient: ApiClient;
  private suggestionId: string | number; // NEW: Support both UUID and numeric ID

  constructor(suggestionId: string | number) {
    this.apiClient = ApiClient.getInstance();
    this.suggestionId = suggestionId;
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      return await this.apiClient.get<User>('/users/me');
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  /**
   * Load suggestion details
   */
  async loadSuggestion(): Promise<KvpSuggestion> {
    try {
      return await this.apiClient.get<KvpSuggestion>(`/kvp/${this.suggestionId}`);
    } catch (error) {
      console.error('Error loading suggestion:', error);
      throw error;
    }
  }

  /**
   * Load comments for the suggestion
   */
  async loadComments(): Promise<Comment[]> {
    try {
      return await this.apiClient.get<Comment[]>(`/kvp/${this.suggestionId}/comments`);
    } catch (error) {
      console.error('Error loading comments:', error);
      return [];
    }
  }

  /**
   * Load attachments for the suggestion
   */
  async loadAttachments(): Promise<Attachment[]> {
    try {
      return await this.apiClient.get<Attachment[]>(`/kvp/${this.suggestionId}/attachments`);
    } catch (error) {
      console.error('Error loading attachments:', error);
      return [];
    }
  }

  /**
   * Trigger download of an attachment
   * @param fileUuid - The secure UUID of the attachment to download
   */
  downloadAttachment(fileUuid: string, onError: (message: string) => void): void {
    try {
      const token = getAuthToken();
      if (token === null || token === '') {
        onError('Nicht authentifiziert');
        return;
      }
      // Add token as query parameter for authentication
      window.open(`/api/v2/kvp/attachments/${fileUuid}/download?token=${encodeURIComponent(token)}`, '_blank');
    } catch (error) {
      console.error('Error downloading attachment:', error);
      onError('Fehler beim Download');
    }
  }

  /**
   * Load teams for organization selector
   */
  async loadTeams(): Promise<{ id: number; name: string }[]> {
    try {
      const teams = await this.apiClient.get<{ id: number; name: string }[]>('/teams');
      return Array.isArray(teams) ? teams : [];
    } catch (error) {
      console.error('Error loading teams:', error);
      return [];
    }
  }

  /**
   * Load departments for organization selector
   */
  async loadDepartments(): Promise<{ id: number; name: string }[]> {
    try {
      const departments = await this.apiClient.get<{ id: number; name: string }[]>('/departments');
      return Array.isArray(departments) ? departments : [];
    } catch (error) {
      console.error('Error loading departments:', error);
      return [];
    }
  }

  /**
   * Load areas for organization selector
   */
  async loadAreas(): Promise<{ id: number; name: string }[]> {
    try {
      const areas = await this.apiClient.get<{ id: number; name: string }[]>('/areas');
      return Array.isArray(areas) ? areas : [];
    } catch (error) {
      console.error('Error loading areas:', error);
      return [];
    }
  }
}
