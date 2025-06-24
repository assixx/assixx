/**
 * KVP Page Script
 * Handles KVP suggestions with department-based visibility
 */

// API configuration
const KVP_API_BASE_URL = '/api';

interface User {
  id: number;
  role: 'root' | 'admin' | 'employee';
  tenant_id: number;
  department_id?: number;
}

interface KvpSuggestion {
  id: number;
  title: string;
  description: string;
  status: 'new' | 'in_review' | 'approved' | 'implemented' | 'rejected' | 'archived';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  org_level: 'company' | 'department' | 'team';
  org_id: number;
  department_id: number;
  department_name: string;
  submitted_by: number;
  submitted_by_name: string;
  submitted_by_lastname: string;
  category_id: number;
  category_name: string;
  category_icon: string;
  category_color: string;
  shared_by?: number;
  shared_by_name?: string;
  shared_at?: string;
  created_at: string;
  expected_benefit?: string;
  estimated_cost?: number;
  actual_savings?: number;
  attachment_count?: number;
}

interface KvpCategory {
  id: number;
  name: string;
  icon: string;
  color: string;
}

interface Department {
  id: number;
  name: string;
}

class KvpPage {
  private currentUser: User | null = null;
  private currentFilter: string = 'all';
  private suggestions: KvpSuggestion[] = [];
  private categories: KvpCategory[] = [];
  private departments: Department[] = [];

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    try {
      // Get current user
      this.currentUser = await this.getCurrentUser();

      // Setup UI based on role
      this.setupRoleBasedUI();

      // Load initial data
      await Promise.all([this.loadCategories(), this.loadDepartments(), this.loadSuggestions()]);

      // Setup event listeners
      this.setupEventListeners();

      // Load statistics if admin (but not in employee mode)
      const effectiveRole = this.getEffectiveRole();
      if (effectiveRole === 'admin' || effectiveRole === 'root') {
        this.loadStatistics();
      }
    } catch (error) {
      console.error('Error initializing KVP page:', error);
      this.showError('Fehler beim Laden der Seite');
    }
  }

  private async getCurrentUser(): Promise<User | null> {
    try {
      const response = await fetch(`${KVP_API_BASE_URL}/users/me`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to get user info');

      const data = await response.json();
      return data.user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  private getEffectiveRole(): string {
    if (!this.currentUser) return 'employee';

    // Check if admin or root has switched to employee role
    if (
      (this.currentUser.role === 'admin' || this.currentUser.role === 'root') &&
      sessionStorage.getItem('roleSwitch') === 'employee'
    ) {
      return 'employee';
    }

    // Check localStorage for activeRole (more reliable for root users)
    const activeRole = localStorage.getItem('activeRole');
    if (activeRole && activeRole !== this.currentUser.role) {
      return activeRole as string;
    }

    return this.currentUser.role;
  }

  private setupRoleBasedUI(): void {
    if (!this.currentUser) return;

    const effectiveRole = this.getEffectiveRole();

    // Show/hide admin elements
    const adminElements = document.querySelectorAll('.admin-only');
    const adminInfoBox = document.getElementById('adminInfoBox');
    const statsOverview = document.getElementById('statsOverview');
    const createBtn = document.getElementById('createNewBtn');

    // Check effective role instead of actual role
    if (effectiveRole === 'admin' || effectiveRole === 'root') {
      adminElements.forEach((el) => ((el as HTMLElement).style.display = ''));
      adminInfoBox!.style.display = '';
      statsOverview!.style.display = '';
    } else {
      adminElements.forEach((el) => ((el as HTMLElement).style.display = 'none'));
      adminInfoBox!.style.display = 'none';
      statsOverview!.style.display = 'none';
    }

    // Show create button for employees (including role-switched admins)
    if (effectiveRole === 'employee') {
      createBtn!.style.display = '';
    } else {
      createBtn!.style.display = 'none';
    }
  }

  private async loadCategories(): Promise<void> {
    try {
      const response = await fetch(`${KVP_API_BASE_URL}/kvp/categories`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to load categories');

      const data = await response.json();
      this.categories = data.categories || [];

      // Populate category dropdown
      const categoryDropdown = document.getElementById('categoryDropdown');
      if (categoryDropdown) {
        // Keep the first "Alle Kategorien" option
        const firstOption = categoryDropdown.querySelector('.dropdown-option');
        categoryDropdown.innerHTML = '';
        if (firstOption) categoryDropdown.appendChild(firstOption);

        // Add categories
        this.categories.forEach((category) => {
          const option = document.createElement('div');
          option.className = 'dropdown-option';
          option.onclick = () => (window as any).selectCategory(category.id.toString(), category.name);
          option.textContent = category.name;
          categoryDropdown.appendChild(option);
        });
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }

  private async loadDepartments(): Promise<void> {
    const effectiveRole = this.getEffectiveRole();
    if (effectiveRole === 'employee') return;

    try {
      const response = await fetch(`${KVP_API_BASE_URL}/departments`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to load departments');

      const data = await response.json();
      this.departments = data.departments || [];

      // Populate department dropdown
      const departmentDropdown = document.getElementById('departmentDropdown');
      if (departmentDropdown) {
        // Keep the first "Alle Abteilungen" option
        const firstOption = departmentDropdown.querySelector('.dropdown-option');
        departmentDropdown.innerHTML = '';
        if (firstOption) departmentDropdown.appendChild(firstOption);

        // Add departments
        this.departments.forEach((dept) => {
          const option = document.createElement('div');
          option.className = 'dropdown-option';
          option.onclick = () => (window as any).selectDepartment(dept.id.toString(), dept.name);
          option.textContent = dept.name;
          departmentDropdown.appendChild(option);
        });
      }
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  }

  private async loadSuggestions(): Promise<void> {
    try {
      const params = new URLSearchParams({
        filter: this.currentFilter,
      });

      // Add additional filters
      const statusFilter = (document.getElementById('statusFilterValue') as HTMLInputElement).value;
      const categoryFilter = (document.getElementById('categoryFilterValue') as HTMLInputElement).value;
      const departmentFilter = (document.getElementById('departmentFilterValue') as HTMLInputElement).value;
      const searchFilter = (document.getElementById('searchFilter') as HTMLInputElement).value;

      if (statusFilter) params.append('status', statusFilter);
      if (categoryFilter) params.append('category_id', categoryFilter);
      if (departmentFilter) params.append('department_id', departmentFilter);
      if (searchFilter) params.append('search', searchFilter);
      if (this.currentFilter === 'archived') params.append('include_archived', 'true');

      const response = await fetch(`${KVP_API_BASE_URL}/kvp?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to load suggestions');

      const data = await response.json();
      this.suggestions = data.suggestions || [];

      this.renderSuggestions();
      this.updateBadges();
    } catch (error) {
      console.error('Error loading suggestions:', error);
      this.showError('Fehler beim Laden der Vorschläge');
    }
  }

  private renderSuggestions(): void {
    const container = document.getElementById('suggestionsContainer')!;
    const emptyState = document.getElementById('emptyState')!;

    if (this.suggestions.length === 0) {
      container.innerHTML = '';
      emptyState.style.display = '';
      return;
    }

    emptyState.style.display = 'none';

    container.innerHTML = this.suggestions
      .map((suggestion) => {
        const statusClass = suggestion.status.replace('_', '');
        const visibilityIcon = suggestion.org_level === 'company' ? 'fa-globe' : 'fa-building';
        const visibilityText = suggestion.org_level === 'company' ? 'Firmenweit' : 'Abteilung';

        return `
        <div class="kvp-card" data-id="${suggestion.id}">
          <div class="status-badge ${statusClass}">${this.getStatusText(suggestion.status)}</div>
          
          <div class="suggestion-header">
            <h3 class="suggestion-title">${this.escapeHtml(suggestion.title)}</h3>
            <div class="suggestion-meta">
              <span><i class="fas fa-user"></i> ${suggestion.submitted_by_name} ${suggestion.submitted_by_lastname}</span>
              <span><i class="fas fa-calendar"></i> ${new Date(suggestion.created_at).toLocaleDateString('de-DE')}</span>
              ${
                suggestion.attachment_count && suggestion.attachment_count > 0
                  ? `<span><i class="fas fa-camera"></i> ${suggestion.attachment_count} Foto${suggestion.attachment_count > 1 ? 's' : ''}</span>`
                  : ''
              }
            </div>
            <div class="visibility-badge ${suggestion.org_level}">
              <i class="fas ${visibilityIcon}"></i> ${visibilityText}
              ${suggestion.shared_by_name ? `<span> - Geteilt von ${suggestion.shared_by_name}</span>` : ''}
            </div>
          </div>
          
          <div class="suggestion-description">
            ${this.escapeHtml(suggestion.description)}
          </div>
          
          <div class="suggestion-footer">
            <div class="category-tag" style="background: ${suggestion.category_color ? suggestion.category_color + '20' : '#66666620'}; color: ${suggestion.category_color || '#666'}; border: 1px solid ${suggestion.category_color || '#666'};">
              ${suggestion.category_icon || '💡'}
              ${suggestion.category_name || 'Sonstiges'}
            </div>
            
            <div class="action-buttons">
              ${this.renderActionButtons(suggestion)}
            </div>
          </div>
        </div>
      `;
      })
      .join('');

    // Add click handlers
    container.querySelectorAll('.kvp-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.action-btn')) {
          const id = card.getAttribute('data-id');
          if (id) this.viewSuggestion(parseInt(id));
        }
      });
    });

    // Add action button handlers
    container.querySelectorAll('.action-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        if (action && id) this.handleAction(action, parseInt(id));
      });
    });
  }

  private renderActionButtons(suggestion: KvpSuggestion): string {
    const buttons: string[] = [];

    if (!this.currentUser) return '';

    const effectiveRole = this.getEffectiveRole();

    // View button for all
    buttons.push(`
      <button class="action-btn" data-action="view" data-id="${suggestion.id}">
        <i class="fas fa-eye"></i> Ansehen
      </button>
    `);

    // Share button for admins (but not in employee mode)
    if ((effectiveRole === 'admin' || effectiveRole === 'root') && suggestion.org_level === 'department') {
      buttons.push(`
        <button class="action-btn share" data-action="share" data-id="${suggestion.id}">
          <i class="fas fa-share-alt"></i> Teilen
        </button>
      `);
    }

    // Unshare button for the original sharer (root can always unshare)
    if (
      suggestion.org_level === 'company' &&
      (effectiveRole === 'root' || suggestion.shared_by === this.currentUser.id)
    ) {
      buttons.push(`
        <button class="action-btn" data-action="unshare" data-id="${suggestion.id}">
          <i class="fas fa-undo"></i> Teilen rückgängig
        </button>
      `);
    }

    return buttons.join('');
  }

  private async handleAction(action: string, id: number): Promise<void> {
    switch (action) {
      case 'view':
        this.viewSuggestion(id);
        break;
      case 'share':
        await this.shareSuggestion(id);
        break;
      case 'unshare':
        await this.unshareSuggestion(id);
        break;
    }
  }

  private viewSuggestion(id: number): void {
    // Navigate to detail view
    window.location.href = `/pages/kvp-detail.html?id=${id}`;
  }

  private async shareSuggestion(id: number): Promise<void> {
    if (!confirm('Möchten Sie diesen Vorschlag wirklich firmenweit teilen?')) return;

    try {
      const response = await fetch(`${KVP_API_BASE_URL}/kvp/${id}/share`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to share suggestion');

      this.showSuccess('Vorschlag wurde firmenweit geteilt');
      await this.loadSuggestions();
    } catch (error) {
      console.error('Error sharing suggestion:', error);
      this.showError('Fehler beim Teilen des Vorschlags');
    }
  }

  private async unshareSuggestion(id: number): Promise<void> {
    if (!confirm('Möchten Sie das Teilen wirklich rückgängig machen?')) return;

    try {
      const response = await fetch(`${KVP_API_BASE_URL}/kvp/${id}/unshare`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to unshare suggestion');

      this.showSuccess('Teilen wurde rückgängig gemacht');
      await this.loadSuggestions();
    } catch (error) {
      console.error('Error unsharing suggestion:', error);
      this.showError('Fehler beim Rückgängigmachen');
    }
  }

  private async loadStatistics(): Promise<void> {
    try {
      const response = await fetch(`${KVP_API_BASE_URL}/kvp/stats`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to load statistics');

      const data = await response.json();

      // Update statistics display
      document.getElementById('totalSuggestions')!.textContent = data.company.total.toString();
      document.getElementById('openSuggestions')!.textContent = (
        (data.company.byStatus.new || 0) + (data.company.byStatus.in_review || 0)
      ).toString();
      document.getElementById('implementedSuggestions')!.textContent = (
        data.company.byStatus.implemented || 0
      ).toString();
      document.getElementById('totalSavings')!.textContent = new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
      }).format(data.company.totalSavings || 0);
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  }

  private updateBadges(): void {
    // Count suggestions by filter
    const counts = {
      all: this.suggestions.length,
      mine: this.suggestions.filter((s) => s.submitted_by === this.currentUser?.id).length,
      department: this.suggestions.filter((s) => s.org_level === 'department').length,
      company: this.suggestions.filter((s) => s.org_level === 'company').length,
      archived: this.suggestions.filter((s) => s.status === 'archived').length,
    };

    // Update badge counts
    document.getElementById('badgeAll')!.textContent = counts.all.toString();
    document.getElementById('badgeMine')!.textContent = counts.mine.toString();
    document.getElementById('badgeDepartment')!.textContent = counts.department.toString();
    document.getElementById('badgeCompany')!.textContent = counts.company.toString();
    document.getElementById('badgeArchived')!.textContent = counts.archived.toString();
  }

  private setupEventListeners(): void {
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.getAttribute('data-filter') || 'all';
        this.loadSuggestions();
      });
    });

    // Secondary filters - Listen to the hidden input value changes
    ['statusFilterValue', 'categoryFilterValue', 'departmentFilterValue'].forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('change', () => this.loadSuggestions());
      }
    });

    // Search filter with debounce
    let searchTimeout: number;
    const searchInput = document.getElementById('searchFilter') as HTMLInputElement;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = window.setTimeout(() => this.loadSuggestions(), 300);
    });

    // Create new button
    const createBtn = document.getElementById('createNewBtn');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        this.openCreateModal();
      });
    }

    // Create form submission
    const createForm = document.getElementById('createKvpForm') as HTMLFormElement;
    if (createForm) {
      createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.createSuggestion();
      });
    }
  }

  private getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      new: 'Neu',
      in_review: 'In Prüfung',
      approved: 'Genehmigt',
      implemented: 'Umgesetzt',
      rejected: 'Abgelehnt',
      archived: 'Archiviert',
    };
    return statusMap[status] || status;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private showSuccess(message: string): void {
    // TODO: Implement toast notification
    alert(message);
  }

  private showError(message: string): void {
    // TODO: Implement toast notification
    alert('Fehler: ' + message);
  }

  private openCreateModal(): void {
    // Reset form
    const form = document.getElementById('createKvpForm') as HTMLFormElement;
    form.reset();

    // Load categories into dropdown
    const categoryDropdown = document.getElementById('kvpCategoryDropdown');
    if (categoryDropdown && this.categories.length > 0) {
      categoryDropdown.innerHTML = this.categories
        .map(
          (category) => `
        <div class="dropdown-option" onclick="selectKvpCategory('${category.id}', '${this.escapeHtml(category.name)}')">
          ${category.icon || '💡'} ${this.escapeHtml(category.name)}
        </div>
      `,
        )
        .join('');
    }

    // Show modal
    (window as any).showCreateModal();
  }

  private async createSuggestion(): Promise<void> {
    try {
      const form = document.getElementById('createKvpForm') as HTMLFormElement;
      const formData = new FormData(form);

      // Validate required fields
      const title = formData.get('title') as string;
      const description = formData.get('description') as string;
      const categoryId = formData.get('category_id') as string;

      if (!title || !description || !categoryId) {
        this.showError('Bitte füllen Sie alle Pflichtfelder aus');
        return;
      }

      // Prepare data
      const data = {
        title: title.trim(),
        description: description.trim(),
        category_id: parseInt(categoryId),
        priority: formData.get('priority') || 'normal',
        expected_benefit: formData.get('expected_benefit') || null,
        estimated_cost: formData.get('estimated_cost') ? parseFloat(formData.get('estimated_cost') as string) : null,
      };

      // Submit to API
      const response = await fetch(`${KVP_API_BASE_URL}/kvp`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Fehler beim Erstellen des Vorschlags');
      }

      const result = await response.json();
      const suggestionId = result.suggestion.id;

      // Upload photos if any
      const selectedPhotos = (window as any).selectedPhotos;
      console.log('Check selectedPhotos:', selectedPhotos);
      console.log('Window.selectedPhotos type:', typeof (window as any).selectedPhotos);
      console.log('Photos count:', selectedPhotos ? selectedPhotos.length : 0);

      if (selectedPhotos && selectedPhotos.length > 0) {
        console.log('Uploading photos for suggestion:', suggestionId);
        await this.uploadPhotos(suggestionId, selectedPhotos);
      } else {
        console.log('No photos to upload');
      }

      // Success
      this.showSuccess('Ihr Vorschlag wurde erfolgreich eingereicht');
      (window as any).hideCreateModal();

      // Clear photo selection
      (window as any).selectedPhotos = [];
      const photoPreview = document.getElementById('photoPreview');
      if (photoPreview) photoPreview.innerHTML = '';

      // Reload suggestions
      await this.loadSuggestions();
    } catch (error) {
      console.error('Error creating suggestion:', error);
      this.showError(error instanceof Error ? error.message : 'Fehler beim Erstellen des Vorschlags');
    }
  }

  private async uploadPhotos(suggestionId: number, photos: File[]): Promise<void> {
    console.log('Uploading photos:', photos.length, 'photos for suggestion', suggestionId);

    const formData = new FormData();
    photos.forEach((photo, index) => {
      console.log(`Adding photo ${index}:`, photo.name, photo.size, photo.type);
      formData.append('photos', photo);
    });

    try {
      console.log('Sending photo upload request to:', `${KVP_API_BASE_URL}/kvp/${suggestionId}/attachments`);
      const response = await fetch(`${KVP_API_BASE_URL}/kvp/${suggestionId}/attachments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      console.log('Upload response status:', response.status);
      const responseData = await response.json();
      console.log('Upload response data:', responseData);

      if (!response.ok) {
        console.error('Fehler beim Hochladen der Fotos:', responseData);
        throw new Error(responseData.message || 'Upload fehlgeschlagen');
      }
    } catch (error) {
      console.error('Error uploading photos:', error);
      throw error;
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new KvpPage();
});
