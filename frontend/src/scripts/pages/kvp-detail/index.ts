/**
 * KVP Detail Page Script (Main Orchestrator)
 * Coordinates all modules for KVP suggestion detail view
 */

import { showSuccessAlert, showErrorAlert } from '../../utils/alerts';
import { openLightbox } from './ui';
import type { KvpSuggestion } from './ui';
import { KvpDetailRenderer } from './renderer';
import { KvpDetailPermissions } from './permissions';
import { KvpDetailDataLoader } from './data-loader';
import { KvpDetailActions } from './actions';
import { KvpDetailShareModal } from './share-modal';

interface User {
  id: number;
  role: 'root' | 'admin' | 'employee';
  tenantId: number;
}

interface ShareKvpDetail {
  orgLevel: 'company' | 'department' | 'team';
  orgId: number | null;
}

interface StatusChangeDetail {
  status: string;
}

/**
 * Main page controller for KVP detail view
 */
class KvpDetailPage {
  private renderer: KvpDetailRenderer;
  private permissions: KvpDetailPermissions;
  private dataLoader: KvpDetailDataLoader;
  private actions: KvpDetailActions;
  private shareModal: KvpDetailShareModal;

  private currentUser: User | null = null;
  private suggestionId: string | number = 0; // NEW: Support both UUID and numeric ID
  private suggestion: KvpSuggestion | null = null;

  constructor() {
    // Get suggestion ID or UUID from URL (Dual-ID support for transition period)
    const urlParams = new URLSearchParams(window.location.search);
    const uuid = urlParams.get('uuid'); // NEW: Try UUID first (secure, recommended)
    const legacyId = urlParams.get('id'); // LEGACY: Numeric ID for backwards compatibility

    // Prefer UUID over legacy numeric ID
    const idOrUuid = uuid ?? legacyId;

    if (idOrUuid === null || idOrUuid === '') {
      this.showError('Ungültige Vorschlags-ID');
      setTimeout(() => (window.location.href = '/kvp'), 2000);
      return;
    }

    // Store as-is (UUID string or numeric ID)
    // IMPORTANT: Check UUID pattern FIRST before parseInt to avoid truncating UUIDs like "019a..."
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(idOrUuid)) {
      // It's a UUID - keep as string
      this.suggestionId = idOrUuid;
    } else {
      // Try numeric ID
      const numericId = Number.parseInt(idOrUuid, 10);
      if (!Number.isNaN(numericId) && idOrUuid === String(numericId)) {
        this.suggestionId = numericId;
      } else {
        this.suggestionId = idOrUuid; // Pass through and let backend validate
      }
    }

    // Initialize modules
    this.renderer = new KvpDetailRenderer();
    this.permissions = new KvpDetailPermissions();
    this.dataLoader = new KvpDetailDataLoader(this.suggestionId);
    this.actions = new KvpDetailActions(this.suggestionId, this.renderer);
    this.shareModal = new KvpDetailShareModal(this.dataLoader);

    void this.init();
  }

  /**
   * Initialize the page
   */
  private async init(): Promise<void> {
    try {
      // Get current user
      this.currentUser = await this.dataLoader.getCurrentUser();
      this.updateModulesWithUser();

      // Load suggestion details
      await this.loadSuggestion();

      // Setup UI based on role
      this.permissions.setupRoleBasedUI();

      // Load related data
      await Promise.all([this.loadComments(), this.loadAttachments()]);

      // Setup event listeners
      this.setupEventListeners();
    } catch (error) {
      console.error('Error initializing KVP detail page:', error);
      this.showError('Fehler beim Laden der Seite');
    }
  }

  /**
   * Update all modules with current user
   */
  private updateModulesWithUser(): void {
    this.renderer.setCurrentUser(this.currentUser);
    this.permissions.setCurrentUser(this.currentUser);
    this.actions.setCurrentUser(this.currentUser);
  }

  /**
   * Update all modules with suggestion data
   */
  private updateModulesWithSuggestion(): void {
    this.renderer.setSuggestion(this.suggestion);
    this.permissions.setSuggestion(this.suggestion);
    this.actions.setSuggestion(this.suggestion);
    this.shareModal.setSuggestion(this.suggestion);
  }

  /**
   * Load suggestion and update UI
   */
  private async loadSuggestion(): Promise<void> {
    try {
      this.suggestion = await this.dataLoader.loadSuggestion();
      this.updateModulesWithSuggestion();
      this.renderer.renderSuggestion();
    } catch (error) {
      console.error('Error loading suggestion:', error);
      this.showError(error instanceof Error ? error.message : 'Fehler beim Laden des Vorschlags');
      setTimeout(() => (window.location.href = '/kvp'), 2000);
    }
  }

  /**
   * Load and render comments
   */
  private async loadComments(): Promise<void> {
    const comments = await this.dataLoader.loadComments();
    this.renderer.renderCommentsWrapper(comments);
  }

  /**
   * Load and render attachments
   */
  private async loadAttachments(): Promise<void> {
    const attachments = await this.dataLoader.loadAttachments();
    this.renderer.renderAttachments(attachments, (id) => {
      this.dataLoader.downloadAttachment(id, (error) => {
        this.showError(error);
      });
    });
  }

  /**
   * Setup all event listeners
   */
  private setupEventListeners(): void {
    this.setupCommentFormListener();
    this.setupLightboxListener();
    this.setupActionButtons();
    this.setupCustomEventListeners();
  }

  /**
   * Setup comment form submission
   */
  private setupCommentFormListener(): void {
    const commentForm = document.querySelector('#commentForm');
    if (commentForm) {
      commentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        void (async () => {
          await this.handleCommentSubmit();
        })();
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
   * Setup lightbox click listener
   */
  private setupLightboxListener(): void {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const thumbnail = target.closest('[data-action="open-lightbox"]');

      if (thumbnail instanceof HTMLElement) {
        const url = thumbnail.dataset.url;
        if (url !== undefined && url !== '') {
          openLightbox(url);
        }
      }
    });
  }

  /**
   * Setup action button listeners
   */
  private setupActionButtons(): void {
    document.querySelector('#editBtn')?.addEventListener('click', () => {
      console.warn('Bearbeiten-Funktion noch nicht implementiert');
      this.showError('Bearbeiten-Funktion noch nicht implementiert');
    });

    document.querySelector('#shareBtn')?.addEventListener('click', () => {
      void this.shareModal.openModal();
    });

    document.querySelector('#unshareBtn')?.addEventListener('click', () => {
      void (async () => {
        await this.actions.unshareSuggestion(
          async (message) => {
            this.showSuccess(message);
            await this.loadSuggestion();
            this.permissions.setupRoleBasedUI();
          },
          (error) => {
            this.showError(error);
          },
        );
      })();
    });

    document.querySelector('#archiveBtn')?.addEventListener('click', () => {
      void (async () => {
        await this.actions.archiveSuggestion(
          () => {
            this.showSuccess('Vorschlag wurde archiviert');
            setTimeout(() => (window.location.href = '/kvp'), 1500);
          },
          (error) => {
            this.showError(error);
          },
        );
      })();
    });
  }

  /**
   * Setup custom event listeners (for modals and components)
   */
  private setupCustomEventListeners(): void {
    // Listen for share event from modal
    window.addEventListener('shareKvp', (event: Event) => {
      const customEvent = event as CustomEvent<ShareKvpDetail>;
      const detail = customEvent.detail;
      void this.handleShareSuggestion(detail.orgLevel, detail.orgId);
    });

    // NOTE: loadOrgData event listener removed - caused infinite loop
    // Organization data is now pre-loaded by shareModal.openModal() directly

    // Status change listener for custom dropdown
    document.addEventListener('statusChange', (e: Event) => {
      void (async () => {
        const customEvent = e as CustomEvent<StatusChangeDetail>;
        const detail = customEvent.detail;
        if (detail.status !== '') {
          await this.handleStatusChange(detail.status);
        }
      })();
    });
  }

  /**
   * Handle share suggestion action
   */
  private async handleShareSuggestion(
    orgLevel: 'company' | 'department' | 'team',
    orgId: number | null,
  ): Promise<void> {
    await this.actions.shareSuggestion(
      orgLevel,
      orgId,
      async (message) => {
        this.showSuccess(message);
        await this.loadSuggestion();
        this.permissions.setupRoleBasedUI();
      },
      (error) => {
        this.showError(error);
      },
    );
  }

  /**
   * Handle status change action
   */
  private async handleStatusChange(newStatus: string): Promise<void> {
    await this.actions.updateStatus(
      newStatus,
      (message) => {
        this.showSuccess(message);
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
  new KvpDetailPage();
});
