/**
 * KVP Detail Permissions Module
 * Handles role-based permissions and UI configuration
 */

import type { KvpSuggestion } from './ui';

interface User {
  id: number;
  role: 'root' | 'admin' | 'employee';
  tenantId: number;
}

/**
 * Permissions and UI configuration handler for KVP detail page
 */
export class KvpDetailPermissions {
  private currentUser: User | null = null;
  private suggestion: KvpSuggestion | null = null;

  setCurrentUser(user: User | null): void {
    this.currentUser = user;
  }

  setSuggestion(suggestion: KvpSuggestion | null): void {
    this.suggestion = suggestion;
  }

  /**
   * Check if current user is admin or root
   */
  isUserAdminOrRoot(): boolean {
    return this.currentUser?.role === 'admin' || this.currentUser?.role === 'root';
  }

  /**
   * Check if current user is the suggestion author
   */
  isUserAuthor(): boolean {
    return this.currentUser?.id === this.suggestion?.submittedBy;
  }

  /**
   * Check if user has permission to update status
   */
  hasStatusUpdatePermission(): boolean {
    return !!(this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.role === 'root'));
  }

  /**
   * Check if user can unshare the suggestion
   */
  canUserUnshare(): boolean {
    return !!(
      this.currentUser &&
      this.suggestion &&
      (this.currentUser.role === 'root' || this.suggestion.sharedBy === this.currentUser.id)
    );
  }

  /**
   * Configure role-based UI elements
   */
  setupRoleBasedUI(): void {
    if (!this.currentUser || !this.suggestion) return;

    const isAdminOrRoot = this.isUserAdminOrRoot();
    const isAuthor = this.isUserAuthor();
    const canComment = isAdminOrRoot || isAuthor;

    this.configureCommentForm(canComment);
    this.configureAdminElements(isAdminOrRoot);

    if (isAdminOrRoot) {
      this.configureLimitedPermissionsMessage();
      this.configureShareButtons();
    }
  }

  /**
   * Configure comment form visibility based on permissions
   */
  private configureCommentForm(canComment: boolean): void {
    const commentForm = document.querySelector('#commentForm');
    if (!(commentForm instanceof HTMLElement)) return;

    if (canComment) {
      commentForm.removeAttribute('hidden');
    } else {
      commentForm.setAttribute('hidden', '');
    }
  }

  /**
   * Configure admin-only UI elements
   */
  private configureAdminElements(isAdminOrRoot: boolean): void {
    const adminElements = document.querySelectorAll('.admin-only');
    const actionsCard = document.querySelector('#actionsCard');

    if (isAdminOrRoot) {
      adminElements.forEach((el) => {
        (el as HTMLElement).removeAttribute('hidden');
      });
      if (actionsCard instanceof HTMLElement) actionsCard.removeAttribute('hidden');
    } else {
      adminElements.forEach((el) => {
        (el as HTMLElement).setAttribute('hidden', '');
      });
      if (actionsCard instanceof HTMLElement) actionsCard.setAttribute('hidden', '');
    }
  }

  /**
   * Show limited permissions message for company-level suggestions
   */
  private configureLimitedPermissionsMessage(): void {
    if (!this.currentUser || !this.suggestion) return;

    const shouldShowMessage =
      this.suggestion.orgLevel === 'company' &&
      this.currentUser.role === 'admin' &&
      this.suggestion.submittedBy !== this.currentUser.id;

    if (!shouldShowMessage) return;

    const statusDropdown = document.querySelector('#statusDropdown');
    if (!statusDropdown) return;

    const infoDiv = document.createElement('div');
    infoDiv.className = 'alert alert-info mt-2';
    infoDiv.innerHTML =
      '<i class="fas fa-info-circle"></i> Nur der Verfasser dieses Vorschlags kann Änderungen vornehmen.';
    statusDropdown.parentElement?.append(infoDiv);
  }

  /**
   * Configure share/unshare buttons based on isShared status and org level
   */
  private configureShareButtons(): void {
    if (!this.suggestion) return;

    const shareBtn = document.querySelector('#shareBtn');
    const unshareBtn = document.querySelector('#unshareBtn');

    // Private KVP (isShared = 0): Only show share button
    if (this.suggestion.isShared === 0) {
      if (shareBtn instanceof HTMLElement) shareBtn.removeAttribute('hidden');
      if (unshareBtn instanceof HTMLElement) unshareBtn.setAttribute('hidden', '');
      return;
    }

    // Shared KVP (isShared = 1): Configure based on org level
    switch (this.suggestion.orgLevel) {
      case 'team':
      case 'area':
      case 'department':
        this.configureSharedButtons(shareBtn, unshareBtn, true);
        break;
      case 'company':
        this.configureSharedButtons(shareBtn, unshareBtn, false);
        break;
    }
  }

  /**
   * Configure buttons for shared suggestions
   * @param shareBtn - Share button element
   * @param unshareBtn - Unshare button element
   * @param showShareBtn - Whether to show the share button (false for company-level)
   */
  private configureSharedButtons(shareBtn: Element | null, unshareBtn: Element | null, showShareBtn: boolean): void {
    // Share button visibility depends on org level
    if (shareBtn instanceof HTMLElement) {
      if (showShareBtn) {
        shareBtn.removeAttribute('hidden');
      } else {
        shareBtn.setAttribute('hidden', '');
      }
    }

    // Unshare button only visible if user has permission
    const canUnshare = this.canUserUnshare();
    if (unshareBtn instanceof HTMLElement) {
      if (canUnshare) {
        unshareBtn.removeAttribute('hidden');
      } else {
        unshareBtn.setAttribute('hidden', '');
      }
    }
  }
}
