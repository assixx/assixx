/**
 * KVP Detail Actions Module
 * Handles user actions: comment, share, archive, status updates
 */

import { ApiClient } from '../../../utils/api-client';
import { showConfirm } from '../../utils/alerts';
import { getStatusText, getShareLevelText, type KvpSuggestion } from './ui';
import { KvpDetailRenderer } from './renderer';

interface User {
  id: number;
  role: 'root' | 'admin' | 'employee';
  tenantId: number;
}

/**
 * Actions handler for KVP detail page
 */
export class KvpDetailActions {
  private apiClient: ApiClient;
  private renderer: KvpDetailRenderer;
  private suggestionId: string | number; // NEW: Support both UUID and numeric ID
  private currentUser: User | null = null;
  private suggestion: KvpSuggestion | null = null;

  constructor(suggestionId: string | number, renderer: KvpDetailRenderer) {
    this.apiClient = ApiClient.getInstance();
    this.renderer = renderer;
    this.suggestionId = suggestionId;
  }

  setCurrentUser(user: User | null): void {
    this.currentUser = user;
  }

  setSuggestion(suggestion: KvpSuggestion | null): void {
    this.suggestion = suggestion;
  }

  /**
   * Add a comment to the suggestion
   */
  async addComment(comment: string, onSuccess: () => Promise<void>, onError: (message: string) => void): Promise<void> {
    if (comment.trim() === '') return;

    try {
      await this.apiClient.post(`/kvp/${this.suggestionId}/comments`, {
        comment,
      });

      await onSuccess();
    } catch (error) {
      console.error('Error adding comment:', error);
      onError('Fehler beim Hinzufügen des Kommentars');
    }
  }

  /**
   * Share suggestion at specified organization level
   */
  async shareSuggestion(
    orgLevel: 'company' | 'department' | 'team',
    orgId: number | null,
    onSuccess: (message: string) => Promise<void>,
    onError: (message: string) => void,
  ): Promise<void> {
    try {
      const finalOrgId = this.determineFinalOrgId(orgLevel, orgId);

      if (finalOrgId === null) {
        onError('Ungültige Organisation ausgewählt');
        return;
      }

      // Use v2 API with PUT method
      const result = await this.apiClient.put(`/kvp/${this.suggestionId}/share`, {
        orgLevel,
        orgId: finalOrgId,
      });

      if (result !== null && result !== undefined) {
        await onSuccess(`Vorschlag wurde auf ${getShareLevelText(orgLevel)} geteilt`);
      }
    } catch (error) {
      console.error('Error sharing suggestion:', error);
      onError('Fehler beim Teilen des Vorschlags');
    }
  }

  /**
   * Determine final org ID based on level
   */
  private determineFinalOrgId(orgLevel: string, orgId: number | null): number | null {
    if (orgLevel === 'company' && this.currentUser !== null) {
      return this.currentUser.tenantId;
    }
    return orgId;
  }

  /**
   * Unshare the suggestion (revert to original org level)
   */
  async unshareSuggestion(
    onSuccess: (message: string) => Promise<void>,
    onError: (message: string) => void,
  ): Promise<void> {
    const confirmed = await showConfirm('Möchten Sie das Teilen wirklich rückgängig machen?');
    if (!confirmed) return;

    try {
      await this.apiClient.post(`/kvp/${this.suggestionId}/unshare`, {});

      await onSuccess('Teilen wurde rückgängig gemacht');
    } catch (error) {
      console.error('Error unsharing suggestion:', error);
      onError('Fehler beim Rückgängigmachen');
    }
  }

  /**
   * Archive the suggestion
   */
  async archiveSuggestion(onSuccess: () => void, onError: (message: string) => void): Promise<void> {
    const confirmed = await showConfirm('Möchten Sie diesen Vorschlag wirklich archivieren?');
    if (!confirmed) return;

    try {
      await this.apiClient.delete(`/kvp/${this.suggestionId}`);

      onSuccess();
    } catch (error) {
      console.error('Error archiving suggestion:', error);
      onError('Fehler beim Archivieren');
    }
  }

  /**
   * Update suggestion status
   */
  async updateStatus(
    newStatus: string,
    onSuccess: (message: string) => void,
    onError: (message: string) => void,
  ): Promise<void> {
    try {
      if (!this.hasStatusUpdatePermission()) {
        onError('Keine Berechtigung zum Ändern des Status');
        return;
      }

      const updateData = await this.buildStatusUpdateData(newStatus, onError);
      if (!updateData) {
        this.renderer.resetStatusDropdown();
        return;
      }

      await this.performStatusUpdate(updateData);
      this.updateStatusUI(newStatus, updateData.rejectionReason);
      onSuccess(`Status geändert zu: ${getStatusText(newStatus)}`);
    } catch (error) {
      this.handleStatusUpdateError(error, onError);
    }
  }

  /**
   * Check if user has permission to update status
   */
  private hasStatusUpdatePermission(): boolean {
    return !!(this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.role === 'root'));
  }

  /**
   * Build status update data (with rejection reason if needed)
   */
  private async buildStatusUpdateData(
    newStatus: string,
    onError: (message: string) => void,
  ): Promise<{ status: string; rejectionReason?: string } | null> {
    const updateData: { status: string; rejectionReason?: string } = {
      status: newStatus,
    };

    if (newStatus === 'rejected') {
      const rejectionReason = await this.getRejectionReason(onError);
      if (rejectionReason === null) return null;
      updateData.rejectionReason = rejectionReason;
    }

    return updateData;
  }

  /**
   * Get rejection reason from user via modal dialog
   */
  private async getRejectionReason(onError: (message: string) => void): Promise<string | null> {
    console.log('[getRejectionReason] Called');

    return await new Promise((resolve) => {
      const modal = document.getElementById('rejectionReasonModal');
      const input = document.getElementById('rejectionReasonInput');
      const confirmBtn = document.querySelector('[data-action="confirm-rejection"]');
      const cancelBtn = document.querySelector('[data-action="close-rejection-modal"]');
      const closeBtn = modal?.querySelector('.ds-modal__close');

      console.log('[getRejectionReason] Elements:', { modal, input, confirmBtn, cancelBtn, closeBtn });

      if (modal === null || input === null || confirmBtn === null || !(input instanceof HTMLTextAreaElement)) {
        console.error('[getRejectionReason] Missing elements!');
        onError('Modal konnte nicht geladen werden');
        resolve(null);
        return;
      }

      // Type guard ensures input is HTMLTextAreaElement from here on

      // Clear previous input
      input.value = '';

      // Show modal (Design System pattern: remove hidden + add active class)
      console.log('[getRejectionReason] Showing modal...');
      modal.removeAttribute('hidden');
      modal.classList.add('modal-overlay--active');
      console.log('[getRejectionReason] Modal active class:', modal.classList.contains('modal-overlay--active'));

      const cleanup = () => {
        modal.classList.remove('modal-overlay--active');
        modal.setAttribute('hidden', '');
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn?.removeEventListener('click', handleCancel);
        closeBtn?.removeEventListener('click', handleCancel);
      };

      const handleConfirm = () => {
        const reason = input.value.trim();
        if (reason === '') {
          onError('Ein Ablehnungsgrund ist erforderlich');
          input.focus();
          return;
        }
        cleanup();
        resolve(reason);
      };

      const handleCancel = () => {
        cleanup();
        resolve(null);
      };

      confirmBtn.addEventListener('click', handleConfirm);
      cancelBtn?.addEventListener('click', handleCancel);
      closeBtn?.addEventListener('click', handleCancel);

      // Focus input
      setTimeout(() => {
        input.focus();
      }, 100);
    });
  }

  /**
   * Perform the status update API call
   */
  private async performStatusUpdate(updateData: { status: string; rejectionReason?: string }): Promise<void> {
    try {
      // API client returns the suggestion directly (already unwrapped from { success, data } envelope)
      const suggestion = await this.apiClient.put<KvpSuggestion>(`/kvp/${this.suggestionId}`, updateData);
      this.suggestion = suggestion;
      this.renderer.setSuggestion(this.suggestion);
    } catch (error: unknown) {
      this.throwStatusUpdateError(error);
    }
  }

  /**
   * Throw appropriate error based on response
   */
  private throwStatusUpdateError(error: unknown): never {
    if (error instanceof Error && error.message.includes('403')) {
      const isCompanyLevel = this.suggestion?.orgLevel === 'company';
      const isNotAuthor = this.suggestion?.submittedBy !== this.currentUser?.id;

      if (isCompanyLevel && isNotAuthor) {
        throw new Error('Nur der Verfasser dieses Vorschlags kann den Status ändern');
      } else {
        throw new Error('Sie haben keine Berechtigung, diesen Vorschlag zu bearbeiten');
      }
    }
    throw error;
  }

  /**
   * Update UI after status change
   */
  private updateStatusUI(newStatus: string, rejectionReason?: string): void {
    this.renderer.updateStatusBadge(newStatus);
    this.renderer.updateRejectionReasonDisplay(newStatus, rejectionReason);
  }

  /**
   * Handle errors during status update
   */
  private handleStatusUpdateError(error: unknown, onError: (message: string) => void): void {
    console.error('Error updating status:', error);

    if (error instanceof Error) {
      onError(error.message);
    } else {
      onError('Fehler beim Aktualisieren des Status');
    }

    this.renderer.resetStatusDropdown();
  }
}
