/**
 * Admin Areas Management
 * Handles area/location CRUD operations for admin dashboard
 */

import { ApiClient } from '../utils/api-client';

import { showSuccess, showError } from './auth';

interface Area {
  id: number;
  name: string;
  description?: string;
  type: 'building' | 'warehouse' | 'office' | 'production' | 'outdoor' | 'other';
  capacity?: number;
  parentId?: number;
  parentName?: string;
  address?: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
  tenantId?: number;
  createdBy?: number;
}

// ApiResponse interface removed - not used in this file

interface WindowWithAreaHandlers extends Window {
  editArea?: (id: number) => Promise<void>;
  viewAreaDetails?: (id: number) => Promise<void>;
  deleteArea?: (id: number) => Promise<void>;
  showAreaModal?: () => void;
  closeAreaModal?: () => void;
  saveArea?: () => Promise<void>;
}

class AreasManager {
  private apiClient: ApiClient;
  private areas: Area[] = [];
  private currentFilter: 'all' | 'production' | 'warehouse' | 'office' = 'all';
  private searchTerm = '';

  constructor() {
    this.apiClient = ApiClient.getInstance();
    this.initializeEventListeners();
  }

  private initializeEventListeners() {
    // Filter buttons
    document.querySelector('#show-all-areas')?.addEventListener('click', () => {
      this.currentFilter = 'all';
      void this.loadAreas();
    });

    document.querySelector('#filter-areas-production')?.addEventListener('click', () => {
      this.currentFilter = 'production';
      void this.loadAreas();
    });

    document.querySelector('#filter-areas-warehouse')?.addEventListener('click', () => {
      this.currentFilter = 'warehouse';
      void this.loadAreas();
    });

    document.querySelector('#filter-areas-office')?.addEventListener('click', () => {
      this.currentFilter = 'office';
      void this.loadAreas();
    });

    // Search
    document.querySelector('#area-search-btn')?.addEventListener('click', () => {
      const searchInput = document.querySelector('#area-search');
      this.searchTerm = searchInput ? searchInput.value : '';
      void this.loadAreas();
    });

    // Enter key on search
    document.querySelector('#area-search')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const searchInput = e.target as HTMLInputElement;
        this.searchTerm = searchInput.value;
        void this.loadAreas();
      }
    });
  }

  async loadAreas(): Promise<void> {
    try {
      const params: Record<string, string> = {};

      if (this.currentFilter !== 'all') {
        params.type = this.currentFilter;
      }

      if (this.searchTerm.length > 0) {
        params.search = this.searchTerm;
      }

      const response = await this.apiClient.request<Area[]>('/areas', {
        method: 'GET',
      });

      // v2 API: apiClient.request already extracts the data array
      this.areas = response;
      this.renderAreasTable();
    } catch (error) {
      console.error('Error loading areas:', error);
      showError('Fehler beim Laden der Bereiche');
    }
  }

  private renderAreasTable(): void {
    const tbody = document.querySelector('#areas-table-body');
    if (!tbody) return;

    if (this.areas.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center text-muted">Keine Bereiche gefunden</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.areas
      .map(
        (area) => `
      <tr>
        <td>
          <strong>${area.name}</strong>
        </td>
        <td>${area.description ?? '-'}</td>
        <td>${this.getTypeLabel(area.type)}</td>
        <td>${area.capacity != null ? `${area.capacity} Plätze` : '-'}</td>
        <td>${area.address ?? '-'}</td>
        <td>
          <span class="badge ${area.isActive !== false ? 'badge-success' : 'badge-secondary'}">
            ${area.isActive !== false ? 'Aktiv' : 'Inaktiv'}
          </span>
        </td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="window.editArea(${area.id})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-secondary" onclick="window.viewAreaDetails(${area.id})">
            <i class="fas fa-eye"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="window.deleteArea(${area.id})">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `,
      )
      .join('');
  }

  private getTypeLabel(type: string): string {
    switch (type) {
      case 'production':
        return 'Produktion';
      case 'warehouse':
        return 'Lager';
      case 'office':
        return 'Büro';
      case 'building':
        return 'Gebäude';
      case 'outdoor':
        return 'Außenbereich';
      case 'other':
        return 'Sonstiges';
      default:
        return type;
    }
  }

  async createArea(areaData: Partial<Area>): Promise<Area> {
    try {
      const response = await this.apiClient.request<Area>('/areas', {
        method: 'POST',
        body: JSON.stringify(areaData),
      });

      showSuccess('Bereich erfolgreich erstellt');
      await this.loadAreas();
      return response;
    } catch (error) {
      console.error('Error creating area:', error);
      showError('Fehler beim Erstellen des Bereichs');
      throw error;
    }
  }

  async updateArea(id: number, areaData: Partial<Area>): Promise<Area> {
    try {
      const response = await this.apiClient.request<Area>(`/areas/${id}`, {
        method: 'PUT',
        body: JSON.stringify(areaData),
      });

      showSuccess('Bereich erfolgreich aktualisiert');
      await this.loadAreas();
      return response;
    } catch (error) {
      console.error('Error updating area:', error);
      showError('Fehler beim Aktualisieren des Bereichs');
      throw error;
    }
  }

  async deleteArea(_id: number): Promise<void> {
    // TODO: Implement proper confirmation modal
    // For now, show error message to indicate feature is pending
    showError('Löschbestätigung: Feature noch nicht implementiert - Bereich kann nicht gelöscht werden');

    // Code below will be activated once confirmation modal is implemented
    /*
    try {
      await this.apiClient.request(`/areas/${_id}`, {
        method: 'DELETE',
      });

      showSuccess('Bereich erfolgreich gelöscht');
      await this.loadAreas();
    } catch (error) {
      console.error('Error deleting area:', error);
      showError('Fehler beim Löschen des Bereichs');
    }
    */

    // Temporary await to satisfy async requirement
    await Promise.resolve();
  }

  async getAreaDetails(id: number): Promise<Area | null> {
    try {
      return await this.apiClient.request<Area>(`/areas/${id}`, {
        method: 'GET',
      });
    } catch (error) {
      console.error('Error getting area details:', error);
      showError('Fehler beim Laden der Bereichsdetails');
      return null;
    }
  }
}

// Initialize when DOM is ready
let areasManager: AreasManager | null = null;

document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if we're on the admin dashboard
  if (window.location.pathname === '/admin-dashboard') {
    areasManager = new AreasManager();

    // Export loadAreasTable function to window for show-section.ts
    (window as WindowWithAreaHandlers & { loadAreasTable?: () => void }).loadAreasTable = () => {
      console.info('[AreasManager] loadAreasTable called');
      void areasManager?.loadAreas();
    };

    // Expose functions globally for HTML onclick handlers
    const w = window as unknown as WindowWithAreaHandlers;
    w.editArea = async (id: number) => {
      const area = await areasManager?.getAreaDetails(id);
      if (area !== null && area !== undefined) {
        // TODO: Open edit modal with area data
        console.info('Edit area:', area);
        showError('Bearbeitungsmodal noch nicht implementiert');
      }
    };

    w.viewAreaDetails = async (id: number) => {
      const area = await areasManager?.getAreaDetails(id);
      if (area !== null && area !== undefined) {
        // TODO: Open details modal
        console.info('View area:', area);
        showError('Detailansicht noch nicht implementiert');
      }
    };

    w.deleteArea = async (id: number) => {
      await areasManager?.deleteArea(id);
    };

    // Handler for floating add button
    w.showAreaModal = () => {
      const modal = document.querySelector('#areaModal');
      if (modal !== null) {
        modal.classList.add('active');

        // Reset form
        const form = document.querySelector('#areaForm');
        if (form) form.reset();
      }
    };

    // Close modal handler
    w.closeAreaModal = (): void => {
      const modal = document.querySelector('#areaModal');
      if (modal) {
        modal.classList.remove('active');
      }
    };

    // Save area handler
    w.saveArea = async (): Promise<void> => {
      const form = document.querySelector('#areaForm');
      if (!form) return;

      const formData = new FormData(form);
      const areaData: Record<string, string | number> = {};

      // Convert FormData to object
      formData.forEach((value, key) => {
        if (typeof value === 'string' && value.length > 0) {
          if (key === 'capacity' || key === 'parentId') {
            const numValue = Number.parseInt(value, 10);
            if (!isNaN(numValue)) {
              areaData[key] = numValue;
            }
          } else {
            areaData[key] = value;
          }
        }
      });

      // Validate required fields
      if (typeof areaData.name !== 'string' || areaData.name.length === 0) {
        showError('Bitte geben Sie einen Bereichsnamen ein');
        return;
      }

      try {
        await areasManager?.createArea(areaData as Partial<Area>);
        w.closeAreaModal?.();
        showSuccess('Bereich erfolgreich hinzugefügt');
      } catch (error) {
        console.error('Error creating area:', error);
        showError('Fehler beim Hinzufügen des Bereichs');
      }
    };

    // Function to check if areas section is visible
    const checkAreasVisibility = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const section = urlParams.get('section');
      if (section === 'areas') {
        void areasManager?.loadAreas();
      }
    };

    // Check on initial load
    checkAreasVisibility();

    // Listen for URL changes
    window.addEventListener('popstate', checkAreasVisibility);

    // Also check when section parameter changes
    const originalPushState = window.history.pushState.bind(window.history);
    window.history.pushState = (...args): void => {
      originalPushState(...args);
      setTimeout(checkAreasVisibility, 100);
    };

    const originalReplaceState = window.history.replaceState.bind(window.history);
    window.history.replaceState = (...args): void => {
      originalReplaceState(...args);
      setTimeout(checkAreasVisibility, 100);
    };
  }
});

export { AreasManager };
