// Areas Management Module
import { apiClient } from '../utils/api-client.js';
import { isAdmin } from '../utils/auth-helpers';
import { showSuccessAlert, showErrorAlert } from './utils/alerts.js';
import { setHTML } from '../utils/dom-utils.js';

// Types
interface Area {
  id: number;
  name: string;
  description?: string | null;
  type: 'building' | 'warehouse' | 'office' | 'production' | 'outdoor' | 'other';
  capacity?: number | null;
  address?: string | null;
  parent_id?: number | null;
  parentName?: string;
  is_active: 0 | 1;
  employee_count?: number;
  created_at?: string;
  updated_at?: string;
  tenant_id?: number;
  created_by?: number;
}

// Global variables
let areas: Area[] = [];
let filteredAreas: Area[] = [];
let editingAreaId: number | null = null;

// DOM Elements
let addAreaBtn: HTMLButtonElement | null;
let areaModal: HTMLElement | null;
let deleteModal: HTMLElement | null;
let areaForm: HTMLFormElement | null;
let areasTableContent: HTMLElement | null;
let loadingDiv: HTMLElement | null;
let emptyDiv: HTMLElement | null;

// Initialize the page
async function initializePage(): Promise<void> {
  try {
    // Check authentication
    const token = localStorage.getItem('token');

    if (token === null || token === '' || !isAdmin()) {
      window.location.href = '/login';
      return;
    }

    // Navigation is initialized automatically
    // nav.setActive('areas');
    // Breadcrumb is initialized automatically via breadcrumb.js
    initializeDOMElements();
    attachEventListeners();
    await loadAreas();
  } catch (error) {
    console.error('Error initializing page:', error);
    showErrorAlert('Fehler beim Laden der Seite');
  }
}

// Initialize DOM elements
function initializeDOMElements(): void {
  addAreaBtn = document.querySelector<HTMLButtonElement>('#add-area-btn');
  areaModal = document.querySelector('#area-modal');
  deleteModal = document.querySelector('#delete-area-modal');
  areaForm = document.querySelector<HTMLFormElement>('#area-form');
  areasTableContent = document.querySelector('#areas-table-content');
  loadingDiv = document.querySelector('#areas-loading');
  emptyDiv = document.querySelector('#areas-empty');
}

// Attach event listeners
function attachEventListeners(): void {
  // Add area button
  addAreaBtn?.addEventListener('click', () => {
    openAreaModal();
  });

  // Form submit
  areaForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    void saveArea();
  });

  // Modal close buttons
  document.querySelector('#close-area-modal')?.addEventListener('click', closeAreaModal);
  document.querySelector('#cancel-area-modal')?.addEventListener('click', closeAreaModal);
  document.querySelector('#close-delete-modal')?.addEventListener('click', closeDeleteModal);
  document.querySelector('#cancel-delete-modal')?.addEventListener('click', closeDeleteModal);

  // Delete confirmation
  document.querySelector('#confirm-delete-area')?.addEventListener('click', () => {
    const deleteInput = document.querySelector<HTMLInputElement>('#delete-area-id');
    if (deleteInput !== null && deleteInput.value !== '') {
      void deleteArea(Number.parseInt(deleteInput.value, 10));
    }
  });

  // Event delegation for area action buttons
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Handle edit area
    const editBtn = target.closest<HTMLElement>('[data-action="edit-area"]');
    if (editBtn) {
      const areaId = editBtn.dataset.areaId;
      if (areaId !== undefined) {
        openAreaModal(Number.parseInt(areaId, 10));
      }
    }

    // Handle delete area
    const deleteBtn = target.closest<HTMLElement>('[data-action="delete-area"]');
    if (deleteBtn) {
      const areaId = deleteBtn.dataset.areaId;
      if (areaId !== undefined) {
        confirmDelete(Number.parseInt(areaId, 10));
      }
    }
  });

  // Note: Filter and search functionality removed to match departments.html structure
  // If needed, can be re-added as a separate control panel

  // Close modals on outside click
  areaModal?.addEventListener('click', (e) => {
    if (e.target === areaModal) {
      closeAreaModal();
    }
  });

  deleteModal?.addEventListener('click', (e) => {
    if (e.target === deleteModal) {
      closeDeleteModal();
    }
  });
}

// Load areas from API
async function loadAreas(): Promise<void> {
  try {
    showLoading(true);

    // API returns array directly or wrapped in {success, data} depending on endpoint
    const response = await apiClient.get<Area[] | { success: boolean; data: Area[]; message: string }>('/areas');

    // Handle both response formats
    if (Array.isArray(response)) {
      // Direct array response
      areas = response;
    } else if (typeof response === 'object' && 'data' in response) {
      // Wrapped response with data property
      const typedResponse = response as { success: boolean; data: Area[]; message: string };
      if (Array.isArray(typedResponse.data)) {
        areas = typedResponse.data;
      } else {
        areas = [];
      }
    } else {
      console.error('Invalid response structure:', response);
      areas = [];
    }

    // Apply current filter and search
    applyFiltersAndSearch();
  } catch (error) {
    console.error('Error loading areas:', error);
    showErrorAlert('Fehler beim Laden der Bereiche');
    areas = [];
    renderAreas();
  } finally {
    showLoading(false);
  }
}

// Note: Filter and search functionality removed to match departments.html
// These functions are kept for potential future use but are currently not called
// function filterAreas(type: string): void { ... }
// function performSearch(): void { ... }

// Apply filters and search (simplified - no filters applied to match departments.html)
function applyFiltersAndSearch(): void {
  // Ensure areas is an array
  if (!Array.isArray(areas)) {
    console.error('areas is not an array:', areas);
    filteredAreas = [];
    renderAreas();
    return;
  }

  // No filtering - show all areas
  filteredAreas = areas;
  renderAreas();
}

// Render areas table
function renderAreas(): void {
  if (!areasTableContent) return;

  if (filteredAreas.length === 0) {
    setHTML(areasTableContent, '');
    emptyDiv?.classList.remove('u-hidden');
    return;
  }

  emptyDiv?.classList.add('u-hidden');

  const tableHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Beschreibung</th>
          <th>Typ</th>
          <th>Kapazität</th>
          <th>Adresse</th>
          <th>Status</th>
          <th>Aktionen</th>
        </tr>
      </thead>
      <tbody>
        ${filteredAreas
          .map(
            (area) => `
              <tr>
                <td>
                  <strong>${area.name}</strong>
                  ${area.parent_id !== undefined && area.parent_id !== null ? `<br><small class="text-secondary">↳ Parent ID: ${area.parent_id}</small>` : ''}
                </td>
                <td>${area.description ?? '-'}</td>
                <td>
                  <span class="badge badge-info">${getTypeLabel(area.type)}</span>
                </td>
                <td>${area.capacity ?? '-'}</td>
                <td>${area.address ?? '-'}</td>
                <td>
                  <span class="badge ${getStatusBadgeClass(area.is_active === 1 ? 'active' : 'inactive')}">${getStatusLabel(area.is_active === 1 ? 'active' : 'inactive')}</span>
                </td>
                <td>
                  <button class="action-btn edit" data-action="edit-area" data-area-id="${area.id}">Bearbeiten</button>
                  <button class="action-btn delete" data-action="delete-area" data-area-id="${area.id}">Löschen</button>
                </td>
              </tr>
            `,
          )
          .join('')}
      </tbody>
    </table>
  `;

  // Use setHTML for safe innerHTML assignment with proper sanitization
  setHTML(areasTableContent, tableHTML);
}

// Get type label
function getTypeLabel(type: string): string {
  // Use switch statement to avoid object injection vulnerability
  switch (type) {
    case 'building':
      return 'Gebäude';
    case 'warehouse':
      return 'Lager';
    case 'office':
      return 'Büro';
    case 'production':
      return 'Produktion';
    case 'outdoor':
      return 'Außenbereich';
    case 'other':
      return 'Sonstiges';
    default:
      return type;
  }
}

// Get status label
function getStatusLabel(status: string): string {
  // Use switch statement to avoid object injection vulnerability
  switch (status) {
    case 'active':
      return 'Aktiv';
    case 'inactive':
      return 'Inaktiv';
    case 'maintenance':
      return 'Wartung';
    default:
      return status;
  }
}

// Get status badge class
function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'active':
      return 'badge-success';
    case 'maintenance':
      return 'badge-warning';
    default:
      return 'badge-secondary';
  }
}

// Get area form elements
interface AreaFormElements {
  areaId: HTMLInputElement | null;
  areaName: HTMLInputElement | null;
  areaDescription: HTMLTextAreaElement | null;
  areaType: HTMLSelectElement | null;
  areaCapacity: HTMLInputElement | null;
  areaAddress: HTMLInputElement | null;
  areaParent: HTMLSelectElement | null;
  areaStatus: HTMLSelectElement | null;
}

// Get all area form elements
function getAreaFormElements(): AreaFormElements {
  return {
    areaId: document.querySelector<HTMLInputElement>('#area-id'),
    areaName: document.querySelector<HTMLInputElement>('#area-name'),
    areaDescription: document.querySelector<HTMLTextAreaElement>('#area-description'),
    areaType: document.querySelector<HTMLSelectElement>('#area-type'),
    areaCapacity: document.querySelector<HTMLInputElement>('#area-capacity'),
    areaAddress: document.querySelector<HTMLInputElement>('#area-address'),
    areaParent: document.querySelector<HTMLSelectElement>('#area-parent'),
    areaStatus: document.querySelector<HTMLSelectElement>('#area-status'),
  };
}

// Populate form with area data
function populateAreaForm(area: Area): void {
  const elements = getAreaFormElements();

  if (elements.areaId) elements.areaId.value = area.id.toString();
  if (elements.areaName) elements.areaName.value = area.name;
  if (elements.areaDescription) elements.areaDescription.value = area.description ?? '';
  if (elements.areaType) elements.areaType.value = area.type;
  if (elements.areaCapacity) elements.areaCapacity.value = area.capacity?.toString() ?? '';
  if (elements.areaAddress) elements.areaAddress.value = area.address ?? '';
  if (elements.areaParent) elements.areaParent.value = area.parent_id?.toString() ?? '';
  if (elements.areaStatus) elements.areaStatus.value = area.is_active === 1 ? 'active' : 'inactive';
}

// Reset form for new area
function resetAreaForm(): void {
  areaForm?.reset();
  const areaIdInput = document.querySelector<HTMLInputElement>('#area-id');
  if (areaIdInput) areaIdInput.value = '';
}

// Update modal title
function updateModalTitle(isEdit: boolean): void {
  const modalTitle = document.querySelector('#area-modal-title');
  if (modalTitle) {
    modalTitle.textContent = isEdit ? 'Bereich bearbeiten' : 'Neuer Bereich';
  }
}

// Open area modal
function openAreaModal(areaId?: number): void {
  editingAreaId = areaId ?? null;
  const isEdit = areaId !== undefined;

  updateModalTitle(isEdit);
  loadParentAreas(areaId);

  if (isEdit) {
    const area = areas.find((a) => a.id === areaId);
    if (area) {
      populateAreaForm(area);
    }
  } else {
    resetAreaForm();
  }

  areaModal?.classList.add('active');
}

// Load parent areas for dropdown
function loadParentAreas(excludeId?: number): void {
  const parentSelect = document.querySelector<HTMLSelectElement>('#area-parent');
  if (parentSelect === null) return;

  // Keep first option
  const firstOption = parentSelect.options[0];
  parentSelect.innerHTML = '';
  parentSelect.append(firstOption);

  // Add all areas except the one being edited
  areas
    .filter((area) => area.id !== excludeId)
    .forEach((area) => {
      const option = document.createElement('option');
      option.value = area.id.toString();
      option.textContent = area.name;
      parentSelect.append(option);
    });
}

// Close area modal
function closeAreaModal(): void {
  areaModal?.classList.remove('active');
  areaForm?.reset();
  editingAreaId = null;
}

// Save area (create or update)
async function saveArea(): Promise<void> {
  if (!areaForm) {
    showErrorAlert('Formular nicht gefunden');
    return;
  }
  try {
    const formData = new FormData(areaForm);
    const descriptionValue = formData.get('description') as string;
    const addressValue = formData.get('address') as string;
    const capacityValue = formData.get('capacity') as string;
    const parentIdValue = formData.get('parent_id') as string;

    const areaData = {
      name: formData.get('name') as string,
      description: descriptionValue !== '' ? descriptionValue : undefined,
      type: formData.get('type') as Area['type'],
      capacity: capacityValue !== '' ? Number.parseInt(capacityValue, 10) : undefined,
      address: addressValue !== '' ? addressValue : undefined,
      parent_id: parentIdValue !== '' ? Number.parseInt(parentIdValue, 10) : undefined,
      is_active: (formData.get('status') as string) === 'active' ? 1 : 0,
    };

    if (editingAreaId !== null) {
      // Update existing area
      await apiClient.put(`/areas/${editingAreaId}`, areaData);
      showSuccessAlert('Bereich erfolgreich aktualisiert');
    } else {
      // Create new area
      await apiClient.post('/areas', areaData);
      showSuccessAlert('Bereich erfolgreich erstellt');
    }

    closeAreaModal();
    await loadAreas();
  } catch (error) {
    console.error('Error saving area:', error);
    showErrorAlert('Fehler beim Speichern des Bereichs');
  }
}

// Confirm delete
function confirmDelete(areaId: number): void {
  const area = areas.find((a) => a.id === areaId);
  if (!area) return;

  const deleteAreaIdInput = document.querySelector<HTMLInputElement>('#delete-area-id');
  if (deleteAreaIdInput) deleteAreaIdInput.value = areaId.toString();
  deleteModal?.classList.add('active');
}

// Close delete modal
function closeDeleteModal(): void {
  deleteModal?.classList.remove('active');
  const deleteAreaIdInput = document.querySelector<HTMLInputElement>('#delete-area-id');
  if (deleteAreaIdInput) deleteAreaIdInput.value = '';
}

// Delete area
async function deleteArea(areaId: number): Promise<void> {
  try {
    await apiClient.delete(`/areas/${areaId}`);
    showSuccessAlert('Bereich erfolgreich gelöscht');
    closeDeleteModal();
    await loadAreas();
  } catch (error) {
    console.error('Error deleting area:', error);
    showErrorAlert('Fehler beim Löschen des Bereichs');
  }
}

// Show/hide loading state
function showLoading(show: boolean): void {
  if (show) {
    loadingDiv?.classList.remove('u-hidden');
    if (areasTableContent) {
      setHTML(areasTableContent, '');
    }
    emptyDiv?.classList.add('u-hidden');
  } else {
    loadingDiv?.classList.add('u-hidden');
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  void initializePage();
});
