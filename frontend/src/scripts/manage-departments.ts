// Departments Management Module
import { apiClient } from '../utils/api-client.js';
import { showSuccessAlert, showErrorAlert } from './utils/alerts.js';
import { setHTML } from '../utils/dom-utils.js';

// Types
interface Department {
  id: number;
  name: string;
  description?: string | null;
  manager_id?: number | null;
  managerName?: string;
  area_id?: number | null;
  areaName?: string;
  parent_id?: number | null;
  parentName?: string;
  status: 'active' | 'inactive' | 'restructuring';
  visibility?: 'public' | 'private';
  employee_count?: number;
  team_count?: number;
  machine_count?: number;
  budget?: number;
  cost_center?: string;
  founded_date?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  tenant_id?: number;
  created_by?: number;
}

interface Area {
  id: number;
  name: string;
  type?: string;
  description?: string;
}

// Global variables
let departments: Department[] = [];
let filteredDepartments: Department[] = [];
let editingDepartmentId: number | null = null;

// DOM Elements
let addDepartmentBtn: HTMLButtonElement | null;
let departmentModal: HTMLElement | null;
let deleteModal: HTMLElement | null;
let departmentForm: HTMLFormElement | null;
let departmentTableContent: HTMLElement | null;

// Initialize the page
async function initializePage(): Promise<void> {
  try {
    // Check authentication
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('userRole');

    if (token === null || token === '' || (role !== 'admin' && role !== 'root')) {
      window.location.href = '/login';
      return;
    }

    initializeDOMElements();
    attachEventListeners();
    await loadDepartments();
  } catch (error) {
    console.error('Error initializing page:', error);
    showErrorAlert('Fehler beim Laden der Seite');
  }
}

// Initialize DOM elements
function initializeDOMElements(): void {
  addDepartmentBtn = document.querySelector('#add-department-btn');
  departmentModal = document.querySelector('#department-modal');
  deleteModal = document.querySelector('#delete-department-modal');
  departmentForm = document.querySelector('#department-form');
  departmentTableContent = document.querySelector('#departmentTableContent');
}

// Attach event listeners
function attachEventListeners(): void {
  // Add department button
  addDepartmentBtn?.addEventListener('click', () => {
    openDepartmentModal();
  });

  // Form submit
  departmentForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    void saveDepartment();
  });

  // Modal close buttons
  document.querySelector('#close-delete-modal')?.addEventListener('click', closeDeleteModal);
  document.querySelector('#cancel-delete-modal')?.addEventListener('click', closeDeleteModal);

  // Delete confirmation
  document.querySelector('#confirm-delete-department')?.addEventListener('click', () => {
    const deleteInput = document.querySelector<HTMLInputElement>('#delete-department-id');
    if (deleteInput !== null && deleteInput.value !== '') {
      void deleteDepartment(Number.parseInt(deleteInput.value, 10));
    }
  });

  // Close buttons for department modal
  document.querySelector('#close-department-modal')?.addEventListener('click', closeDepartmentModal);
  document.querySelector('#cancel-department-modal')?.addEventListener('click', closeDepartmentModal);

  // Close modals on outside click
  departmentModal?.addEventListener('click', (e) => {
    if (e.target === departmentModal) {
      closeDepartmentModal();
    }
  });

  deleteModal?.addEventListener('click', (e) => {
    if (e.target === deleteModal) {
      closeDeleteModal();
    }
  });

  // Event delegation for department actions
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Handle toggle status
    const toggleBtn = target.closest<HTMLElement>('[data-action="toggle-status"]');
    if (toggleBtn) {
      const deptId = toggleBtn.dataset.deptId;
      const status = toggleBtn.dataset.status;
      if (deptId !== undefined && status !== undefined) {
        void toggleDepartmentStatus(Number.parseInt(deptId, 10), status);
      }
    }

    // Handle edit department
    const editBtn = target.closest<HTMLElement>('[data-action="edit-department"]');
    if (editBtn) {
      const deptId = editBtn.dataset.deptId;
      if (deptId !== undefined) {
        openDepartmentModal(Number.parseInt(deptId, 10));
      }
    }

    // Handle delete department
    const deleteBtn = target.closest<HTMLElement>('[data-action="delete-department"]');
    if (deleteBtn) {
      const deptId = deleteBtn.dataset.deptId;
      if (deptId !== undefined) {
        confirmDelete(Number.parseInt(deptId, 10));
      }
    }
  });
}

// Load departments from API
async function loadDepartments(): Promise<void> {
  try {
    // API v2 endpoint - apiClient already adds /api/v2 prefix
    const response = await apiClient.get<Department[] | { success: boolean; data: Department[]; message: string }>(
      '/departments',
    );

    // Handle both response formats
    if (Array.isArray(response)) {
      departments = response;
    } else if (typeof response === 'object' && 'data' in response) {
      const typedResponse = response as { success: boolean; data: Department[]; message: string };
      if (Array.isArray(typedResponse.data)) {
        departments = typedResponse.data;
      } else {
        departments = [];
      }
    } else {
      console.error('Invalid response structure:', response);
      departments = [];
    }

    // Apply current filter and search (for now just show all)
    filteredDepartments = departments;
    renderDepartments();
  } catch (error) {
    console.error('Error loading departments:', error);
    showErrorAlert('Fehler beim Laden der Abteilungen');
    departments = [];
    renderDepartments();
  }
}

// Render departments table
function renderDepartments(): void {
  if (!departmentTableContent) return;

  if (filteredDepartments.length === 0) {
    setHTML(
      departmentTableContent,
      `
      <div class="empty-state">
        <div class="empty-state-icon">🏢</div>
        <div class="empty-state-text">Keine Abteilungen gefunden</div>
        <div class="empty-state-subtext">Fügen Sie Ihre erste Abteilung hinzu</div>
      </div>
    `,
    );
    return;
  }

  const tableHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Beschreibung</th>
          <th>Status</th>
          <th>Sichtbarkeit</th>
          <th>Manager</th>
          <th>Mitarbeiter</th>
          <th>Teams</th>
          <th>Aktionen</th>
        </tr>
      </thead>
      <tbody>
        ${filteredDepartments.map((dept) => createDepartmentRow(dept)).join('')}
      </tbody>
    </table>
  `;

  setHTML(departmentTableContent, tableHTML);
}

// Get status badge class
function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'active':
      return 'badge-success';
    case 'inactive':
      return 'badge-secondary';
    case 'restructuring':
      return 'badge-warning';
    default:
      return 'badge-secondary';
  }
}

// Format department description
function formatDescription(description: unknown): string {
  if (description === null || description === undefined) {
    return '-';
  }

  if (typeof description === 'string') {
    return description;
  }

  if (typeof description === 'object') {
    const bufferObj = description as { type?: string; data?: number[] };
    if (bufferObj.type === 'Buffer' && Array.isArray(bufferObj.data)) {
      return String.fromCharCode(...bufferObj.data);
    }
  }

  return '-';
}

// Get visibility badge classes and label
function getVisibilityBadge(visibility: string | undefined): { class: string; label: string } {
  return visibility === 'public'
    ? { class: 'badge-primary', label: 'Öffentlich' }
    : { class: 'badge-secondary', label: 'Privat' };
}

// Get toggle button info
function getToggleButtonInfo(status: string): { class: string; label: string } {
  return status === 'active'
    ? { class: 'deactivate', label: 'Deaktivieren' }
    : { class: 'activate', label: 'Aktivieren' };
}

// Create department table row
function createDepartmentRow(dept: Department): string {
  const description = formatDescription(dept.description);
  const visibilityBadge = getVisibilityBadge(dept.visibility);
  const toggleButton = getToggleButtonInfo(dept.status);

  return `
    <tr>
      <td>${dept.name !== '' ? dept.name : '-'}</td>
      <td>${description}</td>
      <td>
        <span class="badge ${getStatusBadgeClass(dept.status)}">
          ${getStatusLabel(dept.status)}
        </span>
      </td>
      <td>
        <span class="badge ${visibilityBadge.class}">
          ${visibilityBadge.label}
        </span>
      </td>
      <td>${dept.managerName ?? '-'}</td>
      <td>${dept.employee_count ?? 0}</td>
      <td>${dept.team_count ?? 0}</td>
      <td>
        <button class="action-btn ${toggleButton.class}" data-action="toggle-status" data-dept-id="${dept.id}" data-status="${dept.status}">
          ${toggleButton.label}
        </button>
        <button class="action-btn edit" data-action="edit-department" data-dept-id="${dept.id}">Bearbeiten</button>
        <button class="action-btn delete" data-action="delete-department" data-dept-id="${dept.id}">Löschen</button>
      </td>
    </tr>
  `;
}

// Get status label
function getStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'Aktiv';
    case 'inactive':
      return 'Inaktiv';
    case 'restructuring':
      return 'Umstrukturierung';
    default:
      return status;
  }
}

// Open department modal
function openDepartmentModal(departmentId?: number): void {
  editingDepartmentId = departmentId ?? null;

  const modalTitle = document.querySelector('#modalTitle');
  if (modalTitle) {
    modalTitle.textContent = departmentId !== undefined ? 'Abteilung bearbeiten' : 'Neue Abteilung';
  }

  // Load areas for dropdown
  void loadAreasForDropdown();

  if (departmentId !== undefined) {
    // Load department data for editing
    const department = departments.find((d) => d.id === departmentId);
    if (department && departmentForm) {
      const form = departmentForm as HTMLFormElement & {
        name: HTMLInputElement;
        description: HTMLTextAreaElement;
        area_id: HTMLSelectElement;
        status: HTMLSelectElement;
        visibility: HTMLSelectElement;
      };

      form.name.value = department.name;
      form.description.value = department.description ?? '';
      form.area_id.value = department.area_id?.toString() ?? '';
      form.status.value = department.status;
      form.visibility.value = department.visibility ?? 'public';
    }
  } else {
    // Reset form for new department
    departmentForm?.reset();
  }

  departmentModal?.classList.add('active');
}

// Load areas for dropdown
async function loadAreasForDropdown(): Promise<void> {
  try {
    const response = await apiClient.get<Area[]>('/areas');
    const areaSelect = document.querySelector<HTMLSelectElement>('#department-area-select');

    if (areaSelect && Array.isArray(response)) {
      setHTML(areaSelect, '<option value="">Kein Bereich</option>');
      response.forEach((area) => {
        const option = document.createElement('option');
        option.value = area.id.toString();
        option.textContent = `${area.name} (${area.type ?? 'other'})`;
        areaSelect.append(option);
      });
    }
  } catch (error) {
    console.error('Error loading areas:', error);
  }
}

// Close department modal
function closeDepartmentModal(): void {
  departmentModal?.classList.remove('active');
  departmentForm?.reset();
  editingDepartmentId = null;
}

// Save department (create or update)
async function saveDepartment(): Promise<void> {
  if (!departmentForm) {
    showErrorAlert('Formular nicht gefunden');
    return;
  }

  try {
    const formData = new FormData(departmentForm);
    const descriptionValue = formData.get('description') as string;
    const areaIdValue = formData.get('area_id') as string;

    const departmentData = {
      name: formData.get('name') as string,
      description: descriptionValue !== '' ? descriptionValue : undefined,
      areaId: areaIdValue !== '' ? Number.parseInt(areaIdValue, 10) : undefined, // camelCase for v2 API
      status: formData.get('status') as Department['status'],
      visibility: formData.get('visibility') as 'public' | 'private',
    };

    if (editingDepartmentId !== null) {
      // Update existing department
      await apiClient.put(`/departments/${editingDepartmentId}`, departmentData);
      showSuccessAlert('Abteilung erfolgreich aktualisiert');
    } else {
      // Create new department
      await apiClient.post('/departments', departmentData);
      showSuccessAlert('Abteilung erfolgreich erstellt');
    }

    closeDepartmentModal();
    await loadDepartments();
  } catch (error) {
    console.error('Error saving department:', error);
    showErrorAlert('Fehler beim Speichern der Abteilung');
  }
}

// Toggle department status
async function toggleDepartmentStatus(departmentId: number, currentStatus: string): Promise<void> {
  try {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

    await apiClient.put(`/departments/${departmentId}`, { status: newStatus });
    showSuccessAlert(`Abteilung wurde ${newStatus === 'active' ? 'aktiviert' : 'deaktiviert'}`);
    await loadDepartments();
  } catch (error) {
    console.error('Error toggling department status:', error);
    showErrorAlert('Fehler beim Ändern des Status');
  }
}

// Confirm delete
function confirmDelete(departmentId: number): void {
  const department = departments.find((d) => d.id === departmentId);
  if (!department) return;

  const deleteInput = document.querySelector<HTMLInputElement>('#delete-department-id');
  if (deleteInput) {
    deleteInput.value = departmentId.toString();
  }
  deleteModal?.classList.add('active');
}

// Close delete modal
function closeDeleteModal(): void {
  deleteModal?.classList.remove('active');
  const deleteInput = document.querySelector<HTMLInputElement>('#delete-department-id');
  if (deleteInput) {
    deleteInput.value = '';
  }
}

// Delete department
async function deleteDepartment(departmentId: number): Promise<void> {
  try {
    await apiClient.delete(`/departments/${departmentId}`);
    showSuccessAlert('Abteilung erfolgreich gelöscht');
    closeDeleteModal();
    await loadDepartments();
  } catch (error) {
    console.error('Error deleting department:', error);
    showErrorAlert('Fehler beim Löschen der Abteilung');
  }
}

// Export functions for global access (for event delegation)
declare global {
  interface Window {
    manageDepartments: {
      editDepartment: (id: number) => void;
      confirmDelete: (id: number) => void;
      toggleStatus: (id: number, status: string) => void;
    };
  }
}

window.manageDepartments = {
  editDepartment: (id: number) => {
    openDepartmentModal(id);
  },
  confirmDelete,
  toggleStatus: (id: number, status: string) => {
    void toggleDepartmentStatus(id, status);
  },
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  void initializePage();
});
