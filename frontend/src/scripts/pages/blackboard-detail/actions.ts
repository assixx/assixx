/**
 * Blackboard Detail Actions Module
 * Handles all button/action handlers for blackboard detail page
 */

import type { BlackboardEntry, User } from './ui';
import type { BlackboardDetailDataLoader } from './data-loader';
import type { BlackboardDetailRenderer } from './renderer';

type SuccessCallback = (message: string) => void;
type ErrorCallback = (message: string) => void;

/**
 * Action handler for blackboard detail page
 */
export class BlackboardDetailActions {
  private dataLoader: BlackboardDetailDataLoader;
  private entry: BlackboardEntry | null = null;
  private currentUser: User | null = null;

  constructor(
    dataLoader: BlackboardDetailDataLoader,
    _renderer: BlackboardDetailRenderer, // Keep parameter for API compatibility
  ) {
    this.dataLoader = dataLoader;
  }

  setEntry(entry: BlackboardEntry | null): void {
    this.entry = entry;
  }

  setCurrentUser(user: User | null): void {
    this.currentUser = user;
  }

  /**
   * Confirm entry as read
   */
  async confirmEntry(onSuccess: SuccessCallback, onError: ErrorCallback): Promise<void> {
    try {
      await this.dataLoader.confirmEntry();
      onSuccess('Eintrag als gelesen markiert');
    } catch (error) {
      console.error('[Blackboard Detail] Error confirming entry:', error);
      onError('Fehler beim Bestätigen');
    }
  }

  /**
   * Add a comment to the entry
   */
  async addComment(
    comment: string,
    onSuccess: () => Promise<void>,
    onError: ErrorCallback,
    isInternal: boolean = false,
  ): Promise<void> {
    if (comment.trim() === '') {
      onError('Bitte geben Sie einen Kommentar ein');
      return;
    }

    try {
      await this.dataLoader.addComment(comment, isInternal);
      await onSuccess();
    } catch (error) {
      console.error('[Blackboard Detail] Error adding comment:', error);
      onError('Fehler beim Hinzufügen des Kommentars');
    }
  }

  /**
   * Delete a comment (admin only)
   */
  async deleteComment(commentId: number, onSuccess: () => Promise<void>, onError: ErrorCallback): Promise<void> {
    if (this.currentUser === null || (this.currentUser.role !== 'admin' && this.currentUser.role !== 'root')) {
      onError('Keine Berechtigung');
      return;
    }

    try {
      await this.dataLoader.deleteComment(commentId);
      await onSuccess();
    } catch (error) {
      console.error('[Blackboard Detail] Error deleting comment:', error);
      onError('Fehler beim Löschen des Kommentars');
    }
  }

  /**
   * Archive entry (admin only)
   */
  async archiveEntry(onSuccess: SuccessCallback, onError: ErrorCallback): Promise<void> {
    if (this.currentUser === null || (this.currentUser.role !== 'admin' && this.currentUser.role !== 'root')) {
      onError('Keine Berechtigung');
      return;
    }

    try {
      await this.dataLoader.archiveEntry();
      onSuccess('Eintrag wurde archiviert');
    } catch (error) {
      console.error('[Blackboard Detail] Error archiving entry:', error);
      onError('Fehler beim Archivieren');
    }
  }

  /**
   * Navigate to edit page
   */
  navigateToEdit(): void {
    if (this.entry === null) return;

    // Navigate back to blackboard with edit modal open
    // (or later: dedicated edit page)
    window.location.href = `/blackboard?edit=${this.entry.uuid}`;
  }

  /**
   * Download attachment
   */
  downloadAttachment(attachmentUuid: string, onError: ErrorCallback): void {
    this.dataLoader.downloadAttachment(attachmentUuid, onError);
  }

  /**
   * Get attachment download URL
   */
  getAttachmentUrl(attachmentUuid: string): string {
    return this.dataLoader.getAttachmentDownloadUrl(attachmentUuid);
  }
}
