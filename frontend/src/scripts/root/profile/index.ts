/**
 * Root Profile Management - Main Orchestrator
 * Coordinates profile operations, approvals, and event handling
 */

import { showSuccessAlert, showErrorAlert, showConfirmDanger, showPrompt } from '../../utils/alerts';
import type { RootProfile, DeletionApproval } from './types';
import { handleLoadProfile, handleLoadPendingApprovals, handleApproveDeletion, handleRejectDeletion } from './data';
import {
  fillFormFields,
  handleProfilePicture,
  setInitialPlaceholder,
  renderApprovalsList,
  displayProfilePicture,
} from './ui';
import { setupProfileForm, setupPasswordForm, setupProfilePictureUpload, setupProfilePictureRemove } from './forms';

/**
 * Root Profile Manager Class
 * Orchestrates all profile-related functionality
 */
class RootProfileManager {
  private profile: RootProfile | null = null;
  private approvals: DeletionApproval[] = [];

  constructor() {
    console.info('[RootProfileManager] Initializing...');

    // Set initial placeholder before loading
    setInitialPlaceholder();

    // Initialize event listeners
    this.initializeEventListeners();

    // Load initial data
    void this.loadInitialData();
  }

  /**
   * Initialize all event listeners
   */
  private initializeEventListeners(): void {
    console.info('[RootProfileManager] Setting up event listeners...');

    this.initProfileForm();
    this.initPasswordForm();
    this.initProfilePictureUpload();
    this.initProfilePictureRemove();
    this.initApprovalActions();
  }

  /**
   * Load initial data (profile + approvals)
   */
  private async loadInitialData(): Promise<void> {
    console.info('[RootProfileManager] Loading initial data...');

    await this.loadProfile();
    await this.loadPendingApprovals();

    console.info('[RootProfileManager] Initial data loaded');
  }

  /**
   * Load profile data
   */
  private async loadProfile(): Promise<void> {
    try {
      console.info('[RootProfileManager] Loading profile...');
      this.profile = await handleLoadProfile();

      // Fill form fields
      fillFormFields(this.profile);

      // Handle profile picture display - API v2 returns camelCase
      const profilePicture = this.profile.profilePicture ?? '';
      const firstName = this.profile.firstName ?? '';
      const lastName = this.profile.lastName ?? '';

      handleProfilePicture(profilePicture, firstName, lastName);

      console.info('[RootProfileManager] Profile loaded successfully');
    } catch (error) {
      console.error('[RootProfileManager] Error loading profile:', error);
      showErrorAlert('Fehler beim Laden des Profils');
    }
  }

  /**
   * Load pending approvals
   */
  private async loadPendingApprovals(): Promise<void> {
    try {
      console.info('[RootProfileManager] Loading pending approvals...');
      this.approvals = await handleLoadPendingApprovals();

      // Render approvals list
      renderApprovalsList(this.approvals);

      console.info('[RootProfileManager] Approvals loaded:', this.approvals.length);
    } catch (error) {
      console.error('[RootProfileManager] Error loading approvals:', error);
      // Don't show error to user - approvals are optional
    }
  }

  /**
   * Initialize profile form
   */
  private initProfileForm(): void {
    setupProfileForm();
  }

  /**
   * Initialize password form
   */
  private initPasswordForm(): void {
    setupPasswordForm();
  }

  /**
   * Initialize profile picture upload
   */
  private initProfilePictureUpload(): void {
    setupProfilePictureUpload((url: string) => {
      displayProfilePicture(url);
    });
  }

  /**
   * Initialize profile picture remove
   */
  private initProfilePictureRemove(): void {
    setupProfilePictureRemove();
  }

  /**
   * Initialize approval actions (approve/reject)
   */
  private initApprovalActions(): void {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest<HTMLElement>('[data-action]');

      if (btn === null) {
        return;
      }

      const action = btn.dataset['action'];
      const queueIdStr = btn.dataset['queueId'];

      if (queueIdStr === undefined) {
        return;
      }

      const queueId = Number.parseInt(queueIdStr, 10);

      if (action === 'approve-deletion') {
        void this.approveDeletion(queueId);
      } else if (action === 'reject-deletion') {
        void this.rejectDeletion(queueId);
      }
    });
  }

  /**
   * Approve deletion request
   */
  private async approveDeletion(queueId: number): Promise<void> {
    // Use Design System danger modal instead of native confirm
    const confirmed = await showConfirmDanger(
      'Der Tenant wird nach der 30-tägigen Grace Period endgültig gelöscht.',
      'Löschung genehmigen',
    );

    if (!confirmed) {
      return;
    }

    try {
      await handleApproveDeletion(queueId);
      showSuccessAlert('Löschung erfolgreich genehmigt');
      await this.loadPendingApprovals();
    } catch (error) {
      console.error('[RootProfileManager] Error approving deletion:', error);
      const errorObj = error as { message?: string };
      showErrorAlert(errorObj.message ?? 'Fehler bei der Genehmigung');
    }
  }

  /**
   * Reject deletion request
   */
  private async rejectDeletion(queueId: number): Promise<void> {
    // Use Design System prompt modal instead of native prompt
    const reason = await showPrompt(
      'Bitte geben Sie einen Grund für die Ablehnung an:',
      'Löschung ablehnen',
      'Grund für Ablehnung...',
    );

    if (reason === null || reason === '') {
      return;
    }

    try {
      await handleRejectDeletion(queueId, reason);
      showSuccessAlert('Löschung erfolgreich abgelehnt');
      await this.loadPendingApprovals();
    } catch (error) {
      console.error('[RootProfileManager] Error rejecting deletion:', error);
      const errorObj = error as { message?: string };
      showErrorAlert(errorObj.message ?? 'Fehler bei der Ablehnung');
    }
  }
}

// ===== INITIALIZATION =====

/**
 * Initialize on DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', () => {
  // Check if we're on the root profile page
  if (window.location.pathname === '/root-profile') {
    console.info('[RootProfileManager] Initializing root profile page...');
    new RootProfileManager();
  }
});

export { RootProfileManager };
