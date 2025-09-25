/**
 * KVP Detail Page Script
 * Handles detailed view of KVP suggestions
 */

import { ApiClient } from '../../utils/api-client';
import { getAuthToken } from '../auth';
import { showSuccessAlert, showErrorAlert, showConfirm } from '../utils/alerts';
import {
  type KvpSuggestion,
  type Comment,
  type Attachment,
  convertSuggestionToCamelCase,
  getStatusText,
  getShareLevelText,
} from './kvp-detail-ui';
import { KvpDetailRenderer } from './kvp-detail-renderer';

// Extend Window interface for openLightbox function
declare global {
  interface Window {
    openLightbox?: (url: string) => void;
  }
}

interface User {
  id: number;
  role: 'root' | 'admin' | 'employee';
  tenantId: number;
}

class KvpDetailPage {
  private apiClient: ApiClient;
  private renderer: KvpDetailRenderer;
  private currentUser: User | null = null;
  private suggestionId = 0;
  private suggestion: KvpSuggestion | null = null;
  private useV2API = true;

  constructor() {
    this.apiClient = ApiClient.getInstance();
    this.renderer = new KvpDetailRenderer();
    // Check feature flag for v2 API
    const w = window as Window & { FEATURE_FLAGS?: { USE_API_V2_KVP?: boolean } };
    this.useV2API = w.FEATURE_FLAGS?.USE_API_V2_KVP !== false;
    // Get suggestion ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    if (id === null || id === '' || Number.isNaN(Number.parseInt(id, 10))) {
      this.showError('Ungültige Vorschlags-ID');
      setTimeout(() => (window.location.href = '/kvp'), 2000);
      return;
    }

    this.suggestionId = Number.parseInt(id, 10);
    void this.init();
  }

  private async init(): Promise<void> {
    try {
      // Get current user
      this.currentUser = await this.getCurrentUser();
      this.renderer.setCurrentUser(this.currentUser);

      // Load suggestion details
      await this.loadSuggestion();

      // Setup UI based on role
      this.setupRoleBasedUI();

      // Load related data
      await Promise.all([this.loadComments(), this.loadAttachments()]);

      // Setup event listeners
      this.setupEventListeners();
    } catch (error) {
      console.error('Error initializing KVP detail page:', error);
      this.showError('Fehler beim Laden der Seite');
    }
  }

  private async getCurrentUser(): Promise<User | null> {
    try {
      if (this.useV2API) {
        return await this.apiClient.get<User>('/users/me');
      } else {
        // v1 fallback
        const token = getAuthToken();
        const response = await fetch('/api/users/me', {
          headers: {
            Authorization: `Bearer ${token ?? ''}`,
          },
        });

        if (!response.ok) throw new Error('Failed to get user info');

        interface V1UserResponse {
          user: User & { tenant_id?: number };
        }
        const data = (await response.json()) as V1UserResponse;
        // Convert snake_case to camelCase for v1
        return {
          ...data.user,
          tenantId: data.user.tenant_id ?? data.user.tenantId,
        };
      }
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  private async loadSuggestion(): Promise<void> {
    try {
      if (this.useV2API) {
        this.suggestion = await this.apiClient.get<KvpSuggestion>(`/kvp/${this.suggestionId}`);
      } else {
        // v1 fallback
        const token = getAuthToken();
        const response = await fetch(`/api/kvp/${this.suggestionId}`, {
          headers: {
            Authorization: `Bearer ${token ?? ''}`,
          },
        });

        if (!response.ok) {
          if (response.status === 403) {
            throw new Error('Keine Berechtigung');
          }
          throw new Error('Failed to load suggestion');
        }

        const v1Suggestion = (await response.json()) as Record<string, unknown>;
        // Convert snake_case to camelCase
        this.suggestion = convertSuggestionToCamelCase(v1Suggestion);
      }
      this.renderer.setSuggestion(this.suggestion);
      this.renderer.renderSuggestion();
    } catch (error) {
      console.error('Error loading suggestion:', error);
      this.showError(error instanceof Error ? error.message : 'Fehler beim Laden des Vorschlags');
      setTimeout(() => (window.location.href = '/kvp'), 2000);
    }
  }

  private setupRoleBasedUI(): void {
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

  private isUserAdminOrRoot(): boolean {
    return this.currentUser?.role === 'admin' || this.currentUser?.role === 'root';
  }

  private isUserAuthor(): boolean {
    return this.currentUser?.id === this.suggestion?.submittedBy;
  }

  private configureCommentForm(canComment: boolean): void {
    const commentForm = document.querySelector('#commentForm');
    if (!(commentForm instanceof HTMLElement)) return;

    if (canComment) {
      commentForm.classList.remove('hidden');
      commentForm.style.display = '';
    } else {
      commentForm.classList.add('hidden');
      commentForm.style.display = 'none';
    }
  }

  private configureAdminElements(isAdminOrRoot: boolean): void {
    const adminElements = document.querySelectorAll('.admin-only');
    const actionsCard = document.querySelector('#actionsCard');

    if (isAdminOrRoot) {
      adminElements.forEach((el) => ((el as HTMLElement).style.display = ''));
      if (actionsCard instanceof HTMLElement) actionsCard.style.display = '';
    } else {
      adminElements.forEach((el) => ((el as HTMLElement).style.display = 'none'));
      if (actionsCard instanceof HTMLElement) actionsCard.style.display = 'none';
    }
  }

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

  private configureShareButtons(): void {
    if (!this.suggestion) return;

    const shareBtn = document.querySelector('#shareBtn');
    const unshareBtn = document.querySelector('#unshareBtn');

    switch (this.suggestion.orgLevel) {
      case 'team':
        this.configureTeamLevelButtons(shareBtn, unshareBtn);
        break;
      case 'department':
        this.configureDepartmentLevelButtons(shareBtn, unshareBtn);
        break;
      default:
        this.configureCompanyLevelButtons(shareBtn, unshareBtn);
        break;
    }
  }

  private configureTeamLevelButtons(shareBtn: Element | null, unshareBtn: Element | null): void {
    if (shareBtn instanceof HTMLElement) shareBtn.style.display = '';
    if (unshareBtn instanceof HTMLElement) unshareBtn.style.display = 'none';
  }

  private configureDepartmentLevelButtons(shareBtn: Element | null, unshareBtn: Element | null): void {
    if (shareBtn instanceof HTMLElement) shareBtn.style.display = '';

    const canUnshare = this.canUserUnshare();
    if (unshareBtn instanceof HTMLElement) {
      unshareBtn.style.display = canUnshare ? '' : 'none';
    }
  }

  private configureCompanyLevelButtons(shareBtn: Element | null, unshareBtn: Element | null): void {
    if (shareBtn instanceof HTMLElement) shareBtn.style.display = 'none';

    const canUnshare = this.canUserUnshare();
    if (unshareBtn instanceof HTMLElement) {
      unshareBtn.style.display = canUnshare ? '' : 'none';
    }
  }

  private canUserUnshare(): boolean {
    return !!(
      this.currentUser &&
      this.suggestion &&
      (this.currentUser.role === 'root' || this.suggestion.sharedBy === this.currentUser.id)
    );
  }

  private async loadComments(): Promise<void> {
    try {
      const comments = await this.apiClient.get<Comment[]>(`/kvp/${this.suggestionId}/comments`);
      this.renderer.renderCommentsWrapper(comments);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  }

  private async loadAttachments(): Promise<void> {
    try {
      const attachments = await this.apiClient.get<Attachment[]>(`/kvp/${this.suggestionId}/attachments`);
      this.renderer.renderAttachments(attachments, (id) => {
        this.downloadAttachment(id);
      });
    } catch (error) {
      console.error('Error loading attachments:', error);
    }
  }

  private downloadAttachment(attachmentId: number): void {
    try {
      const token = getAuthToken();
      if (token === null || token === '') {
        this.showError('Nicht authentifiziert');
        return;
      }
      // Add token as query parameter for authentication
      window.open(`/api/v2/kvp/attachments/${attachmentId}/download?token=${encodeURIComponent(token)}`, '_blank');
    } catch (error) {
      console.error('Error downloading attachment:', error);
      this.showError('Fehler beim Download');
    }
  }

  private setupCommentFormListener(): void {
    const commentForm = document.querySelector('#commentForm');
    if (commentForm) {
      commentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        void (async () => {
          await this.addComment();
        })();
      });
    }
  }

  private setupLightboxListener(): void {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const thumbnail = target.closest('[data-action="open-lightbox"]');

      if (thumbnail instanceof HTMLElement) {
        const url = thumbnail.dataset.url;
        if (url !== undefined && url !== '' && typeof window.openLightbox === 'function') {
          window.openLightbox(url);
        }
      }
    });
  }

  private setupActionButtons(): void {
    document.querySelector('#editBtn')?.addEventListener('click', () => {
      // TODO: Navigate to edit page
      console.warn('Bearbeiten-Funktion noch nicht implementiert');
      this.showError('Bearbeiten-Funktion noch nicht implementiert');
    });

    document.querySelector('#shareBtn')?.addEventListener('click', () => {
      this.openShareModal();
    });

    document.querySelector('#unshareBtn')?.addEventListener('click', () => {
      void (async () => {
        await this.unshareSuggestion();
      })();
    });

    document.querySelector('#archiveBtn')?.addEventListener('click', () => {
      void (async () => {
        await this.archiveSuggestion();
      })();
    });
  }

  private setupCustomEventListeners(): void {
    // Listen for share event from modal
    window.addEventListener('shareKvp', (event: Event) => {
      const customEvent = event as CustomEvent;
      interface ShareDetail {
        orgLevel: 'company' | 'department' | 'team';
        orgId: number | null;
      }
      const detail = customEvent.detail as ShareDetail;
      void this.shareSuggestion(detail.orgLevel, detail.orgId);
    });

    // Listen for load organization data event
    window.addEventListener('loadOrgData', () => {
      void this.loadOrganizations();
    });

    // Status change listener for custom dropdown
    document.addEventListener('statusChange', (e: Event) => {
      void (async () => {
        const customEvent = e as CustomEvent;
        interface StatusChangeDetail {
          status: string;
        }

        const detail = customEvent.detail as StatusChangeDetail | null;
        if (detail?.status !== undefined && detail.status !== '') {
          await this.updateStatus(detail.status);
        }
      })();
    });
  }

  private setupEventListeners(): void {
    this.setupCommentFormListener();
    this.setupLightboxListener();
    this.setupActionButtons();
    this.setupCustomEventListeners();
  }

  private async addComment(): Promise<void> {
    const input = document.querySelector('#commentInput');

    if (!(input instanceof HTMLTextAreaElement)) return;
    const comment = input.value.trim();
    if (comment === '') return;

    try {
      await this.apiClient.post(`/kvp/${this.suggestionId}/comments`, {
        comment,
      });

      // Clear form
      input.value = '';

      // Reload comments
      await this.loadComments();

      this.showSuccess('Kommentar hinzugefügt');
    } catch (error) {
      console.error('Error adding comment:', error);
      this.showError('Fehler beim Hinzufügen des Kommentars');
    }
  }

  private openShareModal(): void {
    void this.loadOrganizations();
    this.preselectOrganization();
    this.triggerModalOpen();
  }

  private preselectOrganization(): void {
    if (this.suggestion === null) return;

    const { orgLevel, departmentId, teamId } = this.suggestion;
    const radioBtn = document.querySelector<HTMLInputElement>(
      `#share${orgLevel.charAt(0).toUpperCase() + orgLevel.slice(1)}`,
    );

    if (radioBtn === null) return;

    radioBtn.checked = true;
    this.preselectOrgLevel(orgLevel, teamId, departmentId);
  }

  private preselectOrgLevel(orgLevel: string, teamId?: number, departmentId?: number): void {
    if (orgLevel === 'team') {
      this.preselectTeam(teamId);
    } else if (orgLevel === 'department') {
      this.preselectDepartment(departmentId);
    }
  }

  private preselectTeam(teamId?: number): void {
    if (teamId === undefined) return;

    const teamSelect = document.querySelector<HTMLSelectElement>('#teamSelect');
    if (teamSelect === null) return;

    teamSelect.style.display = 'block';
    teamSelect.dataset.preselect = String(teamId);
  }

  private preselectDepartment(departmentId?: number): void {
    if (departmentId === undefined) return;

    const deptSelect = document.querySelector<HTMLSelectElement>('#departmentSelect');
    if (deptSelect === null) return;

    deptSelect.style.display = 'block';
    deptSelect.dataset.preselect = String(departmentId);
  }

  private triggerModalOpen(): void {
    const w = window as Window & { openShareModal?: () => void };
    if (w.openShareModal !== undefined) {
      w.openShareModal();
    }
  }

  private async loadOrganizations(): Promise<void> {
    try {
      // Load teams
      const teams = await this.apiClient.get<{ id: number; name: string }[]>('/teams');
      const teamSelect = document.querySelector<HTMLSelectElement>('#teamSelect');
      if (teamSelect !== null && Array.isArray(teams)) {
        teamSelect.innerHTML = '<option value="">Team auswählen...</option>';
        teams.forEach((team) => {
          const option = document.createElement('option');
          option.value = String(team.id);
          option.textContent = team.name;
          teamSelect.append(option);
        });

        // Pre-select if needed
        const preselect = teamSelect.dataset.preselect;
        if (preselect !== undefined) {
          teamSelect.value = preselect;
          delete teamSelect.dataset.preselect;
        }
      }

      // Load departments
      const departments = await this.apiClient.get<{ id: number; name: string }[]>('/departments');
      const deptSelect = document.querySelector<HTMLSelectElement>('#departmentSelect');
      if (deptSelect !== null && Array.isArray(departments)) {
        deptSelect.innerHTML = '<option value="">Abteilung auswählen...</option>';
        departments.forEach((dept) => {
          const option = document.createElement('option');
          option.value = String(dept.id);
          option.textContent = dept.name;
          deptSelect.append(option);
        });

        // Pre-select if needed

        const preselect = deptSelect.dataset.preselect;
        // eslint-disable-next-line max-lines
        if (preselect !== undefined) {
          deptSelect.value = preselect;
          delete deptSelect.dataset.preselect;
        }
      }
    } catch (error) {
      console.error('Error loading organizations:', error);
    }
  }

  private determineFinalOrgId(orgLevel: string, orgId: number | null): number | null {
    if (orgLevel === 'company' && this.currentUser !== null) {
      return this.currentUser.tenantId;
    }
    return orgId;
  }

  private async shareSuggestion(orgLevel: 'company' | 'department' | 'team', orgId: number | null): Promise<void> {
    try {
      const finalOrgId = this.determineFinalOrgId(orgLevel, orgId);

      if (finalOrgId === null) {
        this.showError('Ungültige Organisation ausgewählt');
        return;
      }

      // Use v2 API with PUT method
      const result = await this.apiClient.put(`/kvp/${this.suggestionId}/share`, {
        orgLevel,
        orgId: finalOrgId,
      });

      if (result !== null && result !== undefined) {
        this.showSuccess(`Vorschlag wurde auf ${getShareLevelText(orgLevel)} geteilt`);
        // Reload page to update UI
        await this.loadSuggestion();
        this.setupRoleBasedUI();
      }
    } catch (error) {
      console.error('Error sharing suggestion:', error);
      this.showError('Fehler beim Teilen des Vorschlags');
    }
  }

  private async unshareSuggestion(): Promise<void> {
    const confirmed = await this.showConfirmDialog('Möchten Sie das Teilen wirklich rückgängig machen?');
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/kvp/${this.suggestionId}/unshare`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to unshare suggestion');

      this.showSuccess('Teilen wurde rückgängig gemacht');

      // Reload page to update UI
      await this.loadSuggestion();
      this.setupRoleBasedUI();
    } catch (error) {
      console.error('Error unsharing suggestion:', error);
      this.showError('Fehler beim Rückgängigmachen');
    }
  }

  private async archiveSuggestion(): Promise<void> {
    const confirmed = await this.showConfirmDialog('Möchten Sie diesen Vorschlag wirklich archivieren?');
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/kvp/${this.suggestionId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
        },
      });

      if (!response.ok) throw new Error('Failed to archive suggestion');

      this.showSuccess('Vorschlag wurde archiviert');

      // Navigate back to list
      setTimeout(() => (window.location.href = '/kvp'), 1500);
    } catch (error) {
      console.error('Error archiving suggestion:', error);
      this.showError('Fehler beim Archivieren');
    }
  }

  private async updateStatus(newStatus: string): Promise<void> {
    try {
      if (!this.hasStatusUpdatePermission()) {
        this.showError('Keine Berechtigung zum Ändern des Status');
        return;
      }

      const updateData = await this.buildStatusUpdateData(newStatus);
      if (!updateData) {
        this.renderer.resetStatusDropdown();
        return;
      }

      await this.performStatusUpdate(updateData);
      this.updateStatusUI(newStatus, updateData.rejectionReason);
      this.showSuccess(`Status geändert zu: ${getStatusText(newStatus)}`);
    } catch (error) {
      this.handleStatusUpdateError(error);
    }
  }

  private hasStatusUpdatePermission(): boolean {
    return !!(this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.role === 'root'));
  }

  private async buildStatusUpdateData(newStatus: string): Promise<{ status: string; rejectionReason?: string } | null> {
    const updateData: { status: string; rejectionReason?: string } = {
      status: newStatus,
    };

    if (newStatus === 'rejected') {
      const rejectionReason = await this.getRejectionReason();
      if (rejectionReason === null) return null;
      updateData.rejectionReason = rejectionReason;
    }

    return updateData;
  }

  private async getRejectionReason(): Promise<string | null> {
    const reason = await this.showPromptDialog('Bitte geben Sie einen Ablehnungsgrund an:');
    if (reason === null || reason.trim() === '') {
      this.showError('Ein Ablehnungsgrund ist erforderlich');
      return null;
    }
    return reason.trim();
  }

  private async performStatusUpdate(updateData: { status: string; rejectionReason?: string }): Promise<void> {
    try {
      const data = await this.apiClient.put<{ suggestion: KvpSuggestion }>(`/kvp/${this.suggestionId}`, updateData);
      this.suggestion = data.suggestion;
      this.renderer.setSuggestion(this.suggestion);
    } catch (error: unknown) {
      this.throwStatusUpdateError(error);
    }
  }

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

  private updateStatusUI(newStatus: string, rejectionReason?: string): void {
    this.renderer.updateStatusBadge(newStatus);
    this.renderer.updateRejectionReasonDisplay(newStatus, rejectionReason);
  }

  private handleStatusUpdateError(error: unknown): void {
    console.error('Error updating status:', error);

    if (error instanceof Error) {
      this.showError(error.message);
    } else {
      this.showError('Fehler beim Aktualisieren des Status');
    }

    this.renderer.resetStatusDropdown();
  }

  private showSuccess(message: string): void {
    showSuccessAlert(message);
  }

  private showError(message: string): void {
    showErrorAlert(message);
  }

  private async showConfirmDialog(message: string): Promise<boolean> {
    // Use the consistent confirm dialog from alerts.ts
    return await showConfirm(message);
  }

  private async showPromptDialog(message: string): Promise<string | null> {
    // TODO: Implement custom prompt dialog
    // For now, return empty string to avoid using native prompt
    console.warn('Prompt dialog not implemented:', message);
    return await Promise.resolve(''); // Return empty string as default
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new KvpDetailPage();
});
