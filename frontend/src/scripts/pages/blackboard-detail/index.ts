/**
 * Blackboard Detail Page Script (Main Orchestrator)
 * Coordinates all modules for blackboard entry detail view
 *
 * Pattern: Similar to KVP Detail, but simpler:
 * - NO status management
 * - NO share modal
 * - YES comments (new feature)
 * - YES photo gallery + lightbox
 * - YES PDF/image preview modal
 * - YES read confirmation
 */

import { showSuccessAlert, showErrorAlert } from '../../utils/alerts';
import { BlackboardDetailDataLoader } from './data-loader';
import { BlackboardDetailRenderer } from './renderer';
import { BlackboardDetailActions } from './actions';
import { openLightbox, openPreviewModal, getAttachmentByUuid, type BlackboardEntry, type User } from './ui';

/**
 * Main page controller for blackboard detail view
 */
class BlackboardDetailPage {
  // Using definite assignment (!) because these are initialized after early return check
  // If early return happens, page redirects so these are never accessed uninitialized
  private dataLoader!: BlackboardDetailDataLoader;
  private renderer!: BlackboardDetailRenderer;
  private actions!: BlackboardDetailActions;

  private currentUser: User | null = null;
  private entryId: string | number = '';
  private entry: BlackboardEntry | null = null;

  constructor() {
    // Get entry UUID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const uuid = urlParams.get('uuid');
    const legacyId = urlParams.get('id'); // Backwards compatibility

    const idOrUuid = uuid ?? legacyId;

    if (idOrUuid === null || idOrUuid === '') {
      this.showError('Ungültige Eintrags-ID');
      setTimeout(() => (window.location.href = '/blackboard'), 2000);
      return;
    }

    // Parse ID: Check UUID pattern FIRST to avoid parseInt truncating "019a..." to 19
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(idOrUuid)) {
      this.entryId = idOrUuid; // Keep as UUID string
    } else {
      const numericId = Number.parseInt(idOrUuid, 10);
      if (!Number.isNaN(numericId) && idOrUuid === String(numericId)) {
        this.entryId = numericId;
      } else {
        this.entryId = idOrUuid; // Pass through, let backend validate
      }
    }

    // Initialize modules
    this.dataLoader = new BlackboardDetailDataLoader(this.entryId);
    this.renderer = new BlackboardDetailRenderer();
    this.actions = new BlackboardDetailActions(this.dataLoader, this.renderer);

    void this.init();
  }

  /**
   * Initialize the page
   */
  private async init(): Promise<void> {
    try {
      // Get current user (uses cached loadUserInfo - fast)
      this.currentUser = await this.dataLoader.getCurrentUser();
      this.updateModulesWithUser();

      // Setup UI based on role (before data loads - shows loading state)
      this.renderer.setupAdminUI();

      // OPTIMIZATION: Load ALL data in ONE request (3 roundtrips → 1)
      const { entry, comments, attachments } = await this.dataLoader.loadFullEntry();

      // Update entry data and render
      this.entry = entry;
      this.updateModulesWithEntry();
      this.renderer.renderEntry();
      this.renderer.updatePageTitle();

      // Render comments
      this.renderer.renderComments(comments);

      // Render attachments
      this.renderer.renderAttachments(
        attachments,
        (uuid) => {
          this.actions.downloadAttachment(uuid, (error) => {
            this.showError(error);
          });
        },
        (uuid) => {
          const attachment = getAttachmentByUuid(uuid);
          if (attachment !== undefined) {
            openPreviewModal(attachment);
          }
        },
      );

      // Render confirmation status (sync - uses entry data from above)
      this.loadConfirmationStatus();

      // Setup event listeners
      this.setupEventListeners();

      console.info('[Blackboard Detail] Page initialized');
    } catch (error) {
      console.error('[Blackboard Detail] Initialization error:', error);
      this.showError('Fehler beim Laden der Seite');
    }
  }

  /**
   * Update all modules with current user
   */
  private updateModulesWithUser(): void {
    this.renderer.setCurrentUser(this.currentUser);
    this.actions.setCurrentUser(this.currentUser);
  }

  /**
   * Update all modules with entry data
   */
  private updateModulesWithEntry(): void {
    this.renderer.setEntry(this.entry);
    this.actions.setEntry(this.entry);
  }

  /**
   * Load and render comments (after mutation, bypasses cache)
   */
  private async loadComments(): Promise<void> {
    // Invalidate cache since we're reloading after a mutation
    this.dataLoader.invalidateCache();
    const comments = await this.dataLoader.loadComments();
    this.renderer.renderComments(comments);
  }

  /**
   * Load and render confirmation status
   * Uses entry data directly (isConfirmed + confirmedAt from backend JOIN)
   */
  private loadConfirmationStatus(): void {
    const status = this.dataLoader.getConfirmationStatus(this.entry);
    this.renderer.renderConfirmationStatus(status.confirmed, status.confirmedAt);
  }

  /**
   * Setup all event listeners
   */
  private setupEventListeners(): void {
    this.setupCommentFormListener();
    this.setupLightboxListener();
    this.setupActionButtons();
    this.setupConfirmButton();
  }

  /**
   * Setup comment form submission
   */
  private setupCommentFormListener(): void {
    const commentForm = document.querySelector('#commentForm');
    if (commentForm !== null) {
      commentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        void this.handleCommentSubmit();
      });
    }
  }

  /**
   * Handle comment form submission
   */
  private async handleCommentSubmit(): Promise<void> {
    const input = document.querySelector('#commentInput');
    if (!(input instanceof HTMLTextAreaElement)) return;

    const comment = input.value.trim();

    await this.actions.addComment(
      comment,
      async () => {
        input.value = '';
        await this.loadComments();
        this.showSuccess('Kommentar hinzugefügt');
      },
      (error) => {
        this.showError(error);
      },
    );
  }

  /**
   * Setup lightbox click listener (for photo gallery)
   */
  private setupLightboxListener(): void {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const thumbnail = target.closest('[data-action="open-lightbox"]');

      if (thumbnail instanceof HTMLElement) {
        const url = thumbnail.dataset['url'];
        if (url !== undefined && url !== '') {
          openLightbox(url);
        }
      }
    });
  }

  /**
   * Setup action button listeners (edit, archive)
   */
  private setupActionButtons(): void {
    // Edit button
    document.querySelector('#editBtn')?.addEventListener('click', () => {
      this.actions.navigateToEdit();
    });

    // Archive button
    document.querySelector('#archiveBtn')?.addEventListener('click', () => {
      void this.handleArchive();
    });
  }

  /**
   * Setup confirm/unconfirm buttons (read confirmation)
   */
  private setupConfirmButton(): void {
    // Use event delegation since buttons may be re-rendered
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-action="confirm-entry"]') !== null) {
        void this.handleConfirm();
      }
      if (target.closest('[data-action="unconfirm-entry"]') !== null) {
        void this.handleUnconfirm();
      }
    });
  }

  /**
   * Handle confirm entry action
   */
  private async handleConfirm(): Promise<void> {
    await this.actions.confirmEntry(
      (message) => {
        this.showSuccess(message);
        if (this.entry !== null) {
          this.entry.isConfirmed = true;
          this.entry.confirmedAt = new Date().toISOString();
        }
        this.loadConfirmationStatus();
      },
      (error) => {
        this.showError(error);
      },
    );
  }

  /**
   * Handle unconfirm entry action (mark as unread)
   */
  private async handleUnconfirm(): Promise<void> {
    await this.actions.unconfirmEntry(
      (message) => {
        this.showSuccess(message);
        if (this.entry !== null) {
          this.entry.isConfirmed = false;
          this.entry.confirmedAt = null;
        }
        this.loadConfirmationStatus();
      },
      (error) => {
        this.showError(error);
      },
    );
  }

  /**
   * Handle archive entry action
   */
  private async handleArchive(): Promise<void> {
    await this.actions.archiveEntry(
      (message) => {
        this.showSuccess(message);
        setTimeout(() => (window.location.href = '/blackboard'), 1500);
      },
      (error) => {
        this.showError(error);
      },
    );
  }

  /**
   * Show success message
   */
  private showSuccess(message: string): void {
    showSuccessAlert(message);
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    showErrorAlert(message);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new BlackboardDetailPage();
});
