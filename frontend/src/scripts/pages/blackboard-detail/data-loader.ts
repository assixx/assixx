/**
 * Blackboard Detail Data Loader Module
 * Handles all data fetching operations for blackboard detail page
 */

import { ApiClient } from '../../../utils/api-client';
import { getAuthToken, loadUserInfo } from '../../auth';
import type { BlackboardEntry, BlackboardComment, BlackboardAttachment, User } from './ui';

/** Combined response from /full endpoint */
export interface FullEntryResponse {
  entry: BlackboardEntry;
  comments: BlackboardComment[];
  attachments: BlackboardAttachment[];
}

/**
 * Data loading handler for blackboard detail page
 */
export class BlackboardDetailDataLoader {
  private apiClient: ApiClient;
  private entryId: string | number; // Support both UUID and numeric ID

  // Cache for full entry data (reduces 3 API calls to 1)
  private cachedFullData: FullEntryResponse | null = null;

  constructor(entryId: string | number) {
    this.apiClient = ApiClient.getInstance();
    this.entryId = entryId;
  }

  /**
   * Get current user information
   * Uses cached loadUserInfo() from auth module to prevent duplicate API calls
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      // Use cached auth function instead of direct API call
      return (await loadUserInfo()) as User;
    } catch (error) {
      console.error('[Blackboard Detail] Error getting current user:', error);
      return null;
    }
  }

  /**
   * Load full entry data in one request (entry + comments + attachments)
   * OPTIMIZATION: Reduces 3 HTTP roundtrips to 1
   */
  async loadFullEntry(): Promise<FullEntryResponse> {
    try {
      const response = await this.apiClient.get<FullEntryResponse>(`/blackboard/entries/${this.entryId}/full`);
      this.cachedFullData = response;
      return response;
    } catch (error) {
      console.error('[Blackboard Detail] Error loading full entry:', error);
      throw error;
    }
  }

  /**
   * Load entry details
   * Uses cached data if available from loadFullEntry()
   */
  async loadEntry(): Promise<BlackboardEntry> {
    if (this.cachedFullData !== null) {
      return this.cachedFullData.entry;
    }
    try {
      return await this.apiClient.get<BlackboardEntry>(`/blackboard/entries/${this.entryId}`);
    } catch (error) {
      console.error('[Blackboard Detail] Error loading entry:', error);
      throw error;
    }
  }

  /**
   * Load comments for the entry
   * Uses cached data if available from loadFullEntry()
   */
  async loadComments(): Promise<BlackboardComment[]> {
    if (this.cachedFullData !== null) {
      return this.cachedFullData.comments;
    }
    try {
      return await this.apiClient.get<BlackboardComment[]>(`/blackboard/entries/${this.entryId}/comments`);
    } catch (error) {
      console.error('[Blackboard Detail] Error loading comments:', error);
      return [];
    }
  }

  /**
   * Load attachments for the entry
   * Uses cached data if available from loadFullEntry()
   */
  async loadAttachments(): Promise<BlackboardAttachment[]> {
    if (this.cachedFullData !== null) {
      return this.cachedFullData.attachments;
    }
    try {
      return await this.apiClient.get<BlackboardAttachment[]>(`/blackboard/entries/${this.entryId}/attachments`);
    } catch (error) {
      console.error('[Blackboard Detail] Error loading attachments:', error);
      return [];
    }
  }

  /**
   * Invalidate cache (call after mutations like adding comments)
   */
  invalidateCache(): void {
    this.cachedFullData = null;
  }

  /**
   * Get confirmation status from entry data
   * The entry already contains isConfirmed + confirmedAt from backend JOIN
   * No separate API call needed (and the old endpoint is admin-only anyway)
   */
  getConfirmationStatus(entry: BlackboardEntry | null): { confirmed: boolean; confirmedAt: string | null } {
    if (entry === null) {
      return { confirmed: false, confirmedAt: null };
    }

    return {
      confirmed: entry.isConfirmed === true,
      confirmedAt: entry.confirmedAt ?? null,
    };
  }

  /**
   * Confirm entry as read
   */
  async confirmEntry(): Promise<boolean> {
    try {
      await this.apiClient.post(`/blackboard/entries/${this.entryId}/confirm`, {});
      return true;
    } catch (error) {
      console.error('[Blackboard Detail] Error confirming entry:', error);
      throw error;
    }
  }

  /**
   * Remove confirmation (mark as unread)
   */
  async unconfirmEntry(): Promise<boolean> {
    try {
      await this.apiClient.delete(`/blackboard/entries/${this.entryId}/confirm`);
      return true;
    } catch (error) {
      console.error('[Blackboard Detail] Error unconfirming entry:', error);
      throw error;
    }
  }

  /**
   * Add comment to entry
   */
  async addComment(comment: string, isInternal: boolean = false): Promise<{ id: number }> {
    try {
      return await this.apiClient.post<{ id: number }>(`/blackboard/entries/${this.entryId}/comments`, {
        comment,
        isInternal,
      });
    } catch (error) {
      console.error('[Blackboard Detail] Error adding comment:', error);
      throw error;
    }
  }

  /**
   * Delete comment (admin only)
   */
  async deleteComment(commentId: number): Promise<void> {
    try {
      await this.apiClient.delete(`/blackboard/comments/${commentId}`);
    } catch (error) {
      console.error('[Blackboard Detail] Error deleting comment:', error);
      throw error;
    }
  }

  /**
   * Archive entry (admin only)
   */
  async archiveEntry(): Promise<void> {
    try {
      await this.apiClient.patch(`/blackboard/entries/${this.entryId}/archive`, {});
    } catch (error) {
      console.error('[Blackboard Detail] Error archiving entry:', error);
      throw error;
    }
  }

  /**
   * Get attachment download URL with auth token
   */
  getAttachmentDownloadUrl(attachmentUuid: string): string {
    const token = getAuthToken();
    const tokenParam = token !== null && token !== '' ? `?token=${encodeURIComponent(token)}` : '';
    return `/api/v2/blackboard/attachments/${attachmentUuid}/download${tokenParam}`;
  }

  /**
   * Download attachment (opens in new tab)
   */
  downloadAttachment(attachmentUuid: string, onError: (message: string) => void): void {
    try {
      const token = getAuthToken();
      if (token === null || token === '') {
        onError('Nicht authentifiziert');
        return;
      }
      window.open(this.getAttachmentDownloadUrl(attachmentUuid), '_blank');
    } catch (error) {
      console.error('[Blackboard Detail] Error downloading attachment:', error);
      onError('Fehler beim Download');
    }
  }
}
