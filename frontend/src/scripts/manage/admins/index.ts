// Admin Management Main Controller
import { $$, $all, setHTML } from '../../../utils/dom-utils';
import { showSuccessAlert, showErrorAlert } from '../../utils/alerts';
// Import from data layer
import { type Admin, admins, loadAdmins, loadTenants, deleteAdmin as deleteAdminAPI } from './data';
// Import from forms layer
import {
  SELECTORS,
  getPositionDisplay,
  getDepartmentsBadge,
  updateTenantDropdown,
  loadAndPopulateDepartments,
  editAdminHandler,
  showAddAdminModal,
  closeAdminModal,
  closePermissionsModal,
  showPermissionsModal,
  savePermissionsHandler,
  handleFormSubmit,
} from './forms';

// Interface for global window functions
interface ManageAdminsWindow extends Window {
  editAdmin: typeof editAdminHandler | null;
  deleteAdmin: typeof deleteAdminHandler | null;
  showPermissionsModal: typeof showPermissionsModal | null;
  showAddAdminModal: (() => void) | null;
  closeAdminModal: (() => void) | null;
  closePermissionsModal: (() => void) | null;
  savePermissionsHandler: (() => Promise<void>) | null;
}

// DOM Elements
let addAdminBtn: HTMLButtonElement | null;
let deleteModal: HTMLElement | null;
let adminForm: HTMLFormElement | null;
let adminsTableContent: HTMLElement | null;
let loadingDiv: HTMLElement | null;
let emptyDiv: HTMLElement | null;

// Generate HTML for a single admin table row
function generateAdminRow(admin: Admin): string {
  console.info(`Rendering admin row - ID: ${String(admin.id)}, isActive: ${String(admin.isActive)}`);

  const lastLogin =
    admin.lastLogin !== undefined && admin.lastLogin !== ''
      ? new Date(admin.lastLogin).toLocaleString('de-DE')
      : 'Noch nie';
  const deptBadge = getDepartmentsBadge(admin);

  const statusClass = !admin.isActive ? 'table-warning' : '';
  const statusBadge = !admin.isActive ? ' <span class="badge badge-warning">Inaktiv</span>' : '';

  console.info(`Admin ${admin.username} - statusClass: ${statusClass}, statusBadge: ${statusBadge}`);

  return `
    <tr class="${statusClass}">
      <td>${String(admin.id)}</td>
      <td>${admin.firstName} ${admin.lastName}${statusBadge}</td>
      <td>${admin.email}</td>
      <td>${getPositionDisplay(admin.position ?? '')}</td>
      <td>${lastLogin}</td>
      <td>${deptBadge}</td>
      <td>
        <button class="action-btn edit" data-action="edit-admin" data-admin-id="${String(admin.id)}">
          Bearbeiten
        </button>
        <button class="action-btn permissions" data-action="show-permissions" data-admin-id="${String(admin.id)}">
          Berechtigungen
        </button>
        <button class="action-btn delete" data-action="delete-admin" data-admin-id="${String(admin.id)}">
          Löschen
        </button>
      </td>
    </tr>
  `;
}

// Render admin table
function renderAdminTable() {
  console.info('renderAdminTable called');
  if (adminsTableContent === null) {
    console.error('adminsTableContent not found');
    return;
  }

  // Hide loading, show content
  loadingDiv?.classList.add('u-hidden');

  if (admins.length === 0) {
    setHTML(adminsTableContent, '');
    emptyDiv?.classList.remove('u-hidden');
    return;
  }

  // Hide empty state
  emptyDiv?.classList.add('u-hidden');

  console.info('Admins to render:', admins);

  const tableHTML = `
    <table class="admin-table" id="admins-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>E-Mail</th>
          <th>Position</th>
          <th>Letzter Login</th>
          <th>Abteilungen</th>
          <th>Aktionen</th>
        </tr>
      </thead>
      <tbody>
        ${admins.map((admin) => generateAdminRow(admin)).join('')}
      </tbody>
    </table>
  `;

  setHTML(adminsTableContent, tableHTML);
}

// Load admins and render table
async function loadAdminsAndRender() {
  console.info('loadAdminsAndRender called');

  // Show loading state
  loadingDiv?.classList.remove('u-hidden');
  emptyDiv?.classList.add('u-hidden');

  try {
    await loadAdmins();
    renderAdminTable();
  } catch (error) {
    console.error('Fehler:', error);
    showErrorAlert('Netzwerkfehler beim Laden der Admins');
    // Hide loading on error
    loadingDiv?.classList.add('u-hidden');
  }
}

// Load tenants and update dropdown
async function loadTenantsAndUpdate() {
  try {
    await loadTenants();
    updateTenantDropdown();
  } catch (error) {
    console.error('Fehler beim Laden der Tenants:', error);
  }
}

// Delete handlers

async function showDeleteConfirmationModal(admin: Admin): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    const modalHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">Administrator löschen</h3>
          </div>
          <div class="modal-body">
            <p>Möchten Sie den Administrator "${admin.username}" wirklich löschen?</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" id="confirm-delete">Löschen</button>
            <button class="btn btn-secondary" id="cancel-delete">Abbrechen</button>
          </div>
        </div>
      `;
    setHTML(modal, modalHTML);
    document.body.appendChild(modal);

    const confirmBtn = modal.querySelector('#confirm-delete');
    const cancelBtn = modal.querySelector('#cancel-delete-modal');

    const cleanup = () => {
      modal.remove();
    };

    confirmBtn?.addEventListener('click', () => {
      cleanup();
      resolve(true);
    });

    cancelBtn?.addEventListener('click', () => {
      cleanup();
      resolve(false);
    });
  });
}

async function deleteAdminHandler(adminId: number) {
  console.info('deleteAdminHandler called with ID:', adminId);
  console.info('Current admins array:', admins);
  // Convert to string for comparison since API returns string IDs
  const admin = admins.find((a) => String(a.id) === String(adminId));

  if (!admin) {
    console.error('Admin not found for ID:', adminId);
    console.error(
      'Available admin IDs:',
      admins.map((a) => a.id),
    );
    return;
  }

  console.info('Found admin:', admin);

  const confirmDelete = await showDeleteConfirmationModal(admin);

  if (!confirmDelete) {
    console.info('Delete cancelled');
    return;
  }

  try {
    await deleteAdminAPI(adminId);

    // Admin-Liste neu laden
    await loadAdminsAndRender();
    showSuccessAlert('Administrator gelöscht');
  } catch (error) {
    console.error('Error deleting admin:', error);
    showErrorAlert('Netzwerkfehler beim Löschen');
  }
}

// Close delete modal
function closeDeleteModal(): void {
  deleteModal?.classList.remove('active');
}

// Show delete modal
function showDeleteModal(adminId: number): void {
  const admin = admins.find((a) => a.id === adminId);
  if (!admin) {
    showErrorAlert('Administrator nicht gefunden');
    return;
  }

  const deleteIdInput = document.querySelector<HTMLInputElement>('#delete-admin-id');

  if (deleteModal && deleteIdInput) {
    deleteIdInput.value = String(adminId);
    deleteModal.classList.add('active');
  }
}

// Helper function to setup global functions
function setupGlobalFunctions() {
  (window as unknown as ManageAdminsWindow).editAdmin = editAdminHandler;
  (window as unknown as ManageAdminsWindow).deleteAdmin = deleteAdminHandler;
  (window as unknown as ManageAdminsWindow).showPermissionsModal = showPermissionsModal;
  (window as unknown as ManageAdminsWindow).showAddAdminModal = showAddAdminModal;
  (window as unknown as ManageAdminsWindow).closeAdminModal = closeAdminModal;
  (window as unknown as ManageAdminsWindow).closePermissionsModal = closePermissionsModal;
  (window as unknown as ManageAdminsWindow).savePermissionsHandler = savePermissionsHandler;
}

// Helper function to initialize tooltip handlers
function initializeTooltipHandlers() {
  // Event delegation for admin actions
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Handle tooltip visibility
    if (target.classList.contains('info-icon') || target.closest('.info-icon')) {
      e.stopPropagation();
      const icon = target.classList.contains('info-icon') ? target : target.closest('.info-icon');
      const tooltip = icon?.querySelector('.info-tooltip');

      if (tooltip) {
        tooltip.classList.toggle('show');

        // Ensure tooltip doesn't go off-screen
        const rect = tooltip.getBoundingClientRect();
        if (rect.left < 0) {
          (tooltip as HTMLElement).style.left = '0';
          (tooltip as HTMLElement).style.transform = 'translateX(0)';
        } else if (rect.right > window.innerWidth) {
          (tooltip as HTMLElement).style.left = 'auto';
          (tooltip as HTMLElement).style.right = '0';
          (tooltip as HTMLElement).style.transform = 'translateX(0)';
        }
      }
    }
  });

  // Hide tooltips when clicking elsewhere
  document.addEventListener('click', (e) => {
    $all('.info-tooltip.show').forEach((tooltip) => {
      const icon = tooltip.closest('.info-icon');
      const currentEvent = e;
      if (icon !== null && !icon.contains(currentEvent.target as Node)) {
        tooltip.classList.remove('show');
      }
    });
  });
}

// Helper function to setup password validation
function setupPasswordValidation() {
  const passwordField = $$(SELECTORS.ADMIN_PASSWORD) as HTMLInputElement | null;
  const passwordConfirmField = $$(SELECTORS.ADMIN_PASSWORD_CONFIRM) as HTMLInputElement | null;
  const passwordError = $$(SELECTORS.PASSWORD_ERROR);

  if (passwordField !== null && passwordConfirmField !== null) {
    passwordConfirmField.addEventListener('input', () => {
      const password = passwordField.value;
      const passwordConfirm = passwordConfirmField.value;

      if (passwordConfirm !== '' && password !== passwordConfirm) {
        if (passwordError) passwordError.style.display = 'block';
      } else {
        if (passwordError) passwordError.style.display = 'none';
      }
    });
  }
}

// Position dropdown no longer needed - using standard select element

// Check authentication
function checkAuth(): boolean {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('userRole');

  if (token === null || token === '' || userRole !== 'root') {
    window.location.href = '/login';
    return false;
  }
  return true;
}

// Load initial data
function loadInitialData(): void {
  void (async () => {
    await loadAdminsAndRender();
    await loadTenantsAndUpdate();
  })();
}

// Setup permission type radio handlers
function setupPermissionRadioHandlers(): void {
  $all(SELECTORS.PERMISSION_TYPE_RADIO).forEach((radio) => {
    radio.addEventListener('change', (e) => {
      void (async () => {
        const permissionType = (e.target as HTMLInputElement).value;
        const deptContainer = $$(SELECTORS.DEPARTMENT_SELECT_CONTAINER);
        const groupContainer = $$('#group-select-container');

        // Hide all containers first
        if (deptContainer !== null) deptContainer.style.display = 'none';
        if (groupContainer !== null) groupContainer.style.display = 'none';

        if (permissionType === 'specific' && deptContainer !== null) {
          deptContainer.style.display = 'block';
          await loadAndPopulateDepartments();
        } else if (permissionType === 'groups' && groupContainer !== null) {
          groupContainer.style.display = 'block';
          // TODO: Load and populate groups
        }
      })();
    });
  });
}

// Setup department selection buttons
function setupDepartmentSelectionButtons(): void {
  const selectAllBtn = $$('#select-all-departments');
  const deselectAllBtn = $$('#deselect-all-departments');
  const deptSelect = $$(SELECTORS.DEPARTMENT_SELECT) as HTMLSelectElement | null;

  selectAllBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    if (deptSelect !== null) {
      [...deptSelect.options].forEach((option) => {
        option.selected = true;
      });
    }
  });

  deselectAllBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    if (deptSelect !== null) {
      [...deptSelect.options].forEach((option) => {
        option.selected = false;
      });
    }
  });
}

// Setup form submit handler
function setupFormSubmitHandler(): void {
  adminForm?.addEventListener('submit', (e) => {
    void (async () => {
      await handleFormSubmit(e);
      // Reload admins table after form submission
      await loadAdminsAndRender();
    })();
  });
}

// Initialize DOM elements
function initializeDOMElements(): void {
  addAdminBtn = document.querySelector<HTMLButtonElement>('#add-admin-btn');
  deleteModal = document.querySelector('#delete-admin-modal');
  adminForm = document.querySelector<HTMLFormElement>('#admin-form');
  adminsTableContent = document.querySelector('#admins-table-content');
  loadingDiv = document.querySelector('#admins-loading');
  emptyDiv = document.querySelector('#admins-empty');
}

// Attach event listeners
function attachEventListeners(): void {
  // Add admin button
  addAdminBtn?.addEventListener('click', () => {
    showAddAdminModal();
  });

  // Modal close buttons
  document.querySelector('#close-admin-modal')?.addEventListener('click', () => {
    closeAdminModal();
  });
  document.querySelector('#cancel-admin-modal')?.addEventListener('click', () => {
    closeAdminModal();
  });
  document.querySelector('#close-delete-modal')?.addEventListener('click', closeDeleteModal);
  document.querySelector('#cancel-delete-modal')?.addEventListener('click', closeDeleteModal);

  // Delete confirmation
  document.querySelector('#confirm-delete-admin')?.addEventListener('click', () => {
    const deleteInput = document.querySelector<HTMLInputElement>('#delete-admin-id');
    if (deleteInput !== null && deleteInput.value !== '') {
      void deleteAdminHandler(Number.parseInt(deleteInput.value, 10));
    }
  });

  // Event delegation for admin action buttons
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Handle edit admin
    const editBtn = target.closest<HTMLElement>('[data-action="edit-admin"]');
    if (editBtn) {
      const adminId = editBtn.dataset.adminId;
      if (adminId !== undefined) {
        void editAdminHandler(Number.parseInt(adminId, 10));
      }
    }

    // Handle delete admin
    const deleteBtn = target.closest<HTMLElement>('[data-action="delete-admin"]');
    if (deleteBtn) {
      const adminId = deleteBtn.dataset.adminId;
      if (adminId !== undefined) {
        showDeleteModal(Number.parseInt(adminId, 10));
      }
    }

    // Handle permissions
    const permBtn = target.closest<HTMLElement>('[data-action="show-permissions"]');
    if (permBtn) {
      const adminId = permBtn.dataset.adminId;
      if (adminId !== undefined) {
        void showPermissionsModal(Number.parseInt(adminId, 10));
      }
    }
  });
}

// Initialize the admin management
(() => {
  if (!checkAuth()) return;

  initializeDOMElements();
  attachEventListeners();
  setupGlobalFunctions();
  loadInitialData();
  // setupPositionDropdown(); - No longer needed, using standard select
  setupPermissionRadioHandlers();
  setupDepartmentSelectionButtons();
  setupFormSubmitHandler();
  initializeTooltipHandlers();
  setupPasswordValidation();
})();

// End of file
