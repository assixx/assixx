/**
 * KVP Forms Module
 * Handles form submission, validation, and modal management
 */

import { $$, setHTML } from '../../utils/dom-utils';
import notificationService from '../services/notification.service';
import { KvpApiService } from './api';
import { kvpUIHelpers } from './ui';
import type { User, KvpCategory, UserMeResponse, TeamResponse, ValidationError } from './types';

export class KvpFormsManager {
  private apiService: KvpApiService;
  private currentUser: User | null;
  private categories: KvpCategory[];
  private currentTeamId: number | null = null;

  constructor(apiService: KvpApiService, currentUser: User | null, categories: KvpCategory[]) {
    this.apiService = apiService;
    this.currentUser = currentUser;
    this.categories = categories;
  }

  /**
   * Open create modal with validation
   */
  async openCreateModal(getEffectiveRole: () => string): Promise<void> {
    const effectiveRole = getEffectiveRole();

    if (effectiveRole === 'employee') {
      const hasTeam = await this.validateEmployeeTeam();
      if (!hasTeam) return;
    }

    this.showModalAfterValidation();
  }

  /**
   * Validate that employee has a team assigned
   */
  private async validateEmployeeTeam(): Promise<boolean> {
    try {
      const userInfo = await this.fetchUserInfo();
      const teamId = this.extractTeamId(userInfo);

      if (teamId !== undefined && teamId > 0) {
        this.currentTeamId = teamId;
        return true;
      }

      return await this.checkTeamLeadStatus(userInfo);
    } catch (error) {
      console.error('Could not get employee team info:', error);
      this.showNoTeamError();
      return false;
    }
  }

  /**
   * Fetch user info from API
   */
  private async fetchUserInfo(): Promise<UserMeResponse> {
    return await this.apiService.fetchUserInfo();
  }

  /**
   * Extract team ID from user info response
   */
  private extractTeamId(userInfo: UserMeResponse): number | undefined {
    console.log('User /me response:', userInfo);

    return (
      userInfo.teamId ??
      userInfo.team_id ??
      userInfo.team?.id ??
      userInfo.teams?.[0]?.id ??
      userInfo.teams?.[0]?.team_id
    );
  }

  /**
   * Check if user is a team lead
   */
  private async checkTeamLeadStatus(userInfo: UserMeResponse): Promise<boolean> {
    const originalRole = localStorage.getItem('userRole');

    if (originalRole !== 'admin' && originalRole !== 'root') {
      this.showNoTeamError();
      return false;
    }

    try {
      const userTeam = await this.findUserTeamAsLead(userInfo.id);

      if (userTeam) {
        console.log('User is team lead of team:', userTeam.id);
        this.currentTeamId = userTeam.id;
        return true;
      }

      this.showNoTeamError();
      return false;
    } catch (error) {
      console.error('Could not check team lead status:', error);
      this.showNoTeamError();
      return false;
    }
  }

  /**
   * Find team where user is lead
   */
  private async findUserTeamAsLead(userId?: number): Promise<TeamResponse | undefined> {
    if (userId === undefined || userId === 0) return undefined;

    const teamsResponse = await this.apiService.fetchTeams();
    console.log('Checking if user is team lead. User ID:', userId);
    console.log('Teams response:', teamsResponse);

    return teamsResponse.find(
      (team) => team.team_lead_id === userId || team.teamLeadId === userId || team.leaderId === userId,
    );
  }

  /**
   * Show error when employee has no team
   */
  private showNoTeamError(): void {
    notificationService.error(
      'Kein Team zugeordnet',
      'Sie wurden keinem Team zugeordnet. Bitte wenden Sie sich an Ihren Administrator.',
      5000,
    );
  }

  /**
   * Show modal after validation passed
   */
  private showModalAfterValidation(): void {
    // Reset form
    const form = $$('#createKvpForm');
    if (form instanceof HTMLFormElement) form.reset();

    // Load categories into dropdown
    const categoryDropdown = $$('#kvpCategoryDropdown');
    if (categoryDropdown && this.categories.length > 0) {
      const categoryOptions = this.categories
        .map(
          (category) => `
        <div class="dropdown__option" data-action="select-kvp-category" data-value="${category.id}" data-text="${this.escapeHtml(category.name)}">
          ${category.icon ?? '💡'} ${this.escapeHtml(category.name)}
        </div>
      `,
        )
        .join('');
      setHTML(categoryDropdown, categoryOptions);
    }

    // Show modal using UI helper
    kvpUIHelpers.showCreateModal();
  }

  /**
   * Create suggestion from form
   */
  async createSuggestion(getEffectiveRole: () => string, onSuccess: () => Promise<void>): Promise<void> {
    try {
      const formData = this.getFormData();
      if (!formData) return;

      const validatedData = this.validateFormData(formData);
      if (!validatedData) return;

      const suggestionData = this.prepareSuggestionData(formData, validatedData, getEffectiveRole);
      const suggestionId = await this.submitSuggestion(suggestionData);

      await this.handlePhotoUpload(suggestionId);
      await this.handleSuggestionSuccess(onSuccess);
    } catch (error) {
      this.handleSuggestionError(error);
    }
  }

  /**
   * Get form data
   */
  private getFormData(): FormData | null {
    const form = $$('#createKvpForm');
    if (!(form instanceof HTMLFormElement)) {
      this.showError('Form nicht gefunden');
      return null;
    }
    return new FormData(form);
  }

  /**
   * Validate form data
   */
  private validateFormData(formData: FormData): { title: string; description: string } | null {
    const title = formData.get('title');
    const description = formData.get('description');

    if (title === null || title === '' || description === null || description === '') {
      this.showError('Bitte füllen Sie Titel und Beschreibung aus');
      return null;
    }

    return { title: title as string, description: description as string };
  }

  /**
   * Prepare suggestion data for API
   */
  private prepareSuggestionData(
    formData: FormData,
    validatedData: { title: string; description: string },
    getEffectiveRole: () => string,
  ): Record<string, unknown> {
    const categoryId = formData.get('category_id');
    const priorityValue = formData.get('priority');
    const benefitValue = formData.get('expected_benefit');

    const { orgLevel, orgId } = this.determineOrgLevel(getEffectiveRole);

    const data = {
      title: validatedData.title.trim(),
      description: validatedData.description.trim(),
      categoryId: categoryId !== null && categoryId !== '' ? Number.parseInt(categoryId as string, 10) : null,
      priority: priorityValue !== null && priorityValue !== '' ? (priorityValue as string) : 'normal',
      expectedBenefit: benefitValue !== null && benefitValue !== '' ? (benefitValue as string) : undefined,
      orgLevel: orgLevel,
      orgId: orgId,
      departmentId: this.currentUser?.departmentId ?? null,
    };

    this.logSuggestionData(data);
    return data;
  }

  /**
   * Determine organization level for suggestion
   */
  private determineOrgLevel(getEffectiveRole: () => string): { orgLevel: string; orgId: number } {
    const effectiveRole = getEffectiveRole();

    if (effectiveRole === 'employee' && this.currentTeamId !== null && this.currentTeamId > 0) {
      return { orgLevel: 'team', orgId: this.currentTeamId };
    }

    if (effectiveRole === 'admin' || effectiveRole === 'root') {
      return { orgLevel: 'company', orgId: this.currentUser?.tenantId ?? 0 };
    }

    return { orgLevel: 'team', orgId: 0 };
  }

  /**
   * Log suggestion data for debugging
   */
  private logSuggestionData(data: Record<string, unknown>): void {
    console.log('Current user object:', this.currentUser);
    console.log('Current user departmentId:', this.currentUser?.departmentId);
    console.log('Sending KVP data to API:', data);
    console.log('Data.departmentId being sent:', data.departmentId);
  }

  /**
   * Submit suggestion to API
   */
  private async submitSuggestion(data: Record<string, unknown>): Promise<number> {
    return await this.apiService.submitSuggestion(data);
  }

  /**
   * Handle photo upload after suggestion created
   * IMPORTANT: Does NOT throw on failure - suggestion was already created successfully
   */
  private async handlePhotoUpload(suggestionId: number): Promise<void> {
    const selectedPhotos = kvpUIHelpers.getSelectedPhotos();

    console.info('Check selectedPhotos:', selectedPhotos);
    console.info('Photos count:', selectedPhotos.length);

    if (selectedPhotos.length > 0) {
      console.info('Uploading photos for suggestion:', suggestionId);
      try {
        await this.uploadPhotos(suggestionId, selectedPhotos);
      } catch (error) {
        // CRITICAL: Suggestion was already created! Don't fail the whole operation.
        console.error('Photo upload failed, but suggestion was created:', error);
        this.showWarning(
          'Vorschlag wurde erfolgreich erstellt, aber Fotos konnten nicht hochgeladen werden. ' +
            'Sie können die Fotos später in den Vorschlagsdetails hinzufügen.',
        );
        // DO NOT re-throw - partial success is acceptable
      }
    } else {
      console.info('No photos to upload');
    }
  }

  /**
   * Handle successful suggestion creation
   */
  private async handleSuggestionSuccess(onSuccess: () => Promise<void>): Promise<void> {
    this.showSuccess('Ihr Vorschlag wurde erfolgreich eingereicht');
    kvpUIHelpers.hideCreateModal();

    // Photos are automatically cleared when modal is hidden
    await onSuccess();
  }

  /**
   * Handle suggestion creation error
   */
  private handleSuggestionError(error: unknown): void {
    console.error('Error creating suggestion:', error);

    if (this.isValidationError(error)) {
      this.handleValidationError(error as Error);
    } else {
      this.showError(error instanceof Error ? error.message : 'Fehler beim Erstellen des Vorschlags');
    }
  }

  /**
   * Check if error is validation error
   */
  private isValidationError(error: unknown): boolean {
    return error instanceof Error && error.message === 'Validation failed';
  }

  /**
   * Handle validation error
   */
  private handleValidationError(error: Error): void {
    const apiError = error as ValidationError;
    if (apiError.details !== undefined && Array.isArray(apiError.details)) {
      const errorMessages = apiError.details.map((detail) => this.formatValidationMessage(detail));
      this.showError('Bitte korrigieren Sie folgende Eingaben:\n' + errorMessages.join('\n'));
    } else {
      this.showError('Validierungsfehler: Bitte überprüfen Sie Ihre Eingaben');
    }
  }

  /**
   * Format validation message
   */
  private formatValidationMessage(detail: { field: string; message: string }): string {
    if (detail.field === 'title') {
      return 'Titel: Muss zwischen 3 und 255 Zeichen lang sein';
    }
    if (detail.field === 'description') {
      return 'Beschreibung: Muss zwischen 10 und 5000 Zeichen lang sein';
    }
    return detail.message;
  }

  /**
   * Upload photos for suggestion
   */
  private async uploadPhotos(suggestionId: number, photos: File[]): Promise<void> {
    await this.apiService.uploadPhotos(suggestionId, photos);
  }

  /**
   * Show success message
   */
  private showSuccess(message: string): void {
    notificationService.success('Erfolg', message, 3000);
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    notificationService.error('Fehler', message, 4000);
  }

  /**
   * Show warning message
   */
  private showWarning(message: string): void {
    notificationService.warning('Warnung', message, 5000);
  }

  /**
   * Escape HTML for safe rendering
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
