/**
 * Employee Profile Management - Main Orchestrator
 * Coordinates profile operations and event handling
 */

import { showErrorAlert } from '../../utils/alerts';
import type { EmployeeProfile } from './types';
import { handleLoadProfile } from './data';
import { fillFormFields, handleProfilePicture, setInitialPlaceholder, displayProfilePicture } from './ui';
import { setupPasswordForm, setupProfilePictureUpload, setupProfilePictureRemove } from './forms';

/**
 * Employee Profile Manager Class
 * Orchestrates all profile-related functionality
 */
class EmployeeProfileManager {
  private profile: EmployeeProfile | null = null;

  constructor() {
    console.info('[EmployeeProfileManager] Initializing...');

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
    console.info('[EmployeeProfileManager] Setting up event listeners...');

    this.initPasswordForm();
    this.initProfilePictureUpload();
    this.initProfilePictureRemove();
  }

  /**
   * Load initial data (profile only)
   */
  private async loadInitialData(): Promise<void> {
    console.info('[EmployeeProfileManager] Loading initial data...');

    await this.loadProfile();

    console.info('[EmployeeProfileManager] Initial data loaded');
  }

  /**
   * Load profile data
   */
  private async loadProfile(): Promise<void> {
    try {
      console.info('[EmployeeProfileManager] Loading profile...');
      this.profile = await handleLoadProfile();

      // Fill form fields (readonly for employees)
      fillFormFields(this.profile);

      // Handle profile picture display - API v2 returns camelCase
      const profilePicture = this.profile.profilePicture ?? '';
      const firstName = this.profile.firstName ?? '';
      const lastName = this.profile.lastName ?? '';

      handleProfilePicture(profilePicture, firstName, lastName);

      console.info('[EmployeeProfileManager] Profile loaded successfully');
    } catch (error) {
      console.error('[EmployeeProfileManager] Error loading profile:', error);
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
  // Check if we're on the employee profile page
  if (window.location.pathname === '/employee-profile') {
    console.info('[EmployeeProfileManager] Initializing employee profile page...');
    new EmployeeProfileManager();
  }
});

export { EmployeeProfileManager };
