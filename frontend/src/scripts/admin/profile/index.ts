/**
 * Admin Profile Management - Main Orchestrator
 * Coordinates profile operations and event handling
 */

import { showErrorAlert } from '../../utils/alerts';
import type { AdminProfile } from './types';
import { handleLoadProfile } from './data';
import { fillFormFields, handleProfilePicture, setInitialPlaceholder, displayProfilePicture } from './ui';
import { setupPasswordForm, setupProfilePictureUpload, setupProfilePictureRemove } from './forms';

/**
 * Admin Profile Manager Class
 * Orchestrates all profile-related functionality
 */
class AdminProfileManager {
  private profile: AdminProfile | null = null;

  constructor() {
    console.info('[AdminProfileManager] Initializing...');

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
    console.info('[AdminProfileManager] Setting up event listeners...');

    this.initPasswordForm();
    this.initProfilePictureUpload();
    this.initProfilePictureRemove();
  }

  /**
   * Load initial data (profile only)
   */
  private async loadInitialData(): Promise<void> {
    console.info('[AdminProfileManager] Loading initial data...');

    await this.loadProfile();

    console.info('[AdminProfileManager] Initial data loaded');
  }

  /**
   * Load profile data
   */
  private async loadProfile(): Promise<void> {
    try {
      console.info('[AdminProfileManager] Loading profile...');
      this.profile = await handleLoadProfile();

      // Fill form fields (readonly for admins)
      fillFormFields(this.profile);

      // Handle profile picture display - API v2 returns camelCase
      const profilePicture = this.profile.profilePicture ?? '';
      const firstName = this.profile.firstName ?? '';
      const lastName = this.profile.lastName ?? '';

      handleProfilePicture(profilePicture, firstName, lastName);

      console.info('[AdminProfileManager] Profile loaded successfully');
    } catch (error) {
      console.error('[AdminProfileManager] Error loading profile:', error);
      showErrorAlert('Fehler beim Laden des Profils');
    }
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
}

// ===== INITIALIZATION =====

/**
 * Initialize on DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', () => {
  // Check if we're on the admin profile page
  if (window.location.pathname === '/admin-profile') {
    console.info('[AdminProfileManager] Initializing admin profile page...');
    new AdminProfileManager();
  }
});

export { AdminProfileManager };
