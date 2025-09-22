// Admin Management TypeScript
import { ApiClient } from '../utils/api-client';
import { mapUsers, type MappedUser, type UserAPIResponse } from '../utils/api-mappers';
import { $, $$, $all, setHTML } from '../utils/dom-utils';
import { showSuccessAlert, showErrorAlert } from './utils/alerts';

// DOM Element Selectors - Constants to avoid duplication
const SELECTORS = {
  ADMIN_MODAL: '#adminModal',
  MODAL_TITLE: '#modalTitle',
  ADMIN_PASSWORD: '#adminPassword',
  ADMIN_PASSWORD_CONFIRM: '#adminPasswordConfirm',
  ADMIN_EMAIL_CONFIRM: '#adminEmailConfirm',
  POSITION_DROPDOWN_VALUE: '#positionDropdownValue',
  DEPARTMENT_SELECT: '#departmentSelect',
  DEPARTMENT_SELECT_CONTAINER: '#departmentSelectContainer',
  PERMISSION_TYPE_RADIO: 'input[name="permissionType"]',
  PERMISSION_TYPE_CHECKED: 'input[name="permissionType"]:checked',
  EMAIL_ERROR: '#email-error',
  PASSWORD_ERROR: '#password-error',
} as const;

// Interfaces
interface Admin extends MappedUser {
  tenantName?: string;
  notes?: string;
  lastLogin?: string;
  departments?: Department[];
  hasAllAccess?: boolean;
}

interface Department {
  id: number;
  name: string;
  description?: string;
  can_read?: boolean;
  can_write?: boolean;
  can_delete?: boolean;
}

interface Tenant {
  id: number;
  name?: string;
  company_name?: string;
  subdomain: string;
}

interface ManageAdminsWindow extends Window {
  editAdmin: typeof editAdminHandler | null;
  deleteAdmin: typeof deleteAdminHandler | null;
  showPermissionsModal: typeof showPermissionsModal | null;
  showAddAdminModal: (() => void) | null;
  closeAdminModal: (() => void) | null;
  closePermissionsModal: (() => void) | null;
  savePermissionsHandler: (() => Promise<void>) | null;
}

interface AdminFormData {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  password?: string;
  position: string;
  notes: string;
  role: string;
  isActive?: boolean;
  employeeNumber?: string;
}

// Global state
let currentAdminId: number | null = null;
let admins: Admin[] = [];
let tenants: Tenant[] = [];

// Initialize API Client
const apiClient = ApiClient.getInstance();

// Check feature flag for v2 API - manage-admins uses ROOT endpoints
const w = window as Window & { FEATURE_FLAGS?: { USE_API_V2_ROOT?: boolean } };
const useV2API = w.FEATURE_FLAGS?.USE_API_V2_ROOT === true;

// Helper function to display position names
function getPositionDisplay(position: string): string {
  const positionMap = new Map<string, string>([
    ['bereichsleiter', 'Bereichsleiter'],
    ['personalleiter', 'Personalleiter'],
    ['geschaeftsfuehrer', 'Geschäftsführer'],
    ['werksleiter', 'Werksleiter'],
    ['produktionsleiter', 'Produktionsleiter'],
    ['qualitaetsleiter', 'Qualitätsleiter'],
    ['it-leiter', 'IT-Leiter'],
    ['vertriebsleiter', 'Vertriebsleiter'],
  ]);
  return positionMap.get(position) ?? position;
}

// Helper function to display departments badge
function getDepartmentsBadge(admin: Admin): string {
  console.info(`Getting badge for admin ${String(admin.id)}:`, {
    hasAllAccess: admin.hasAllAccess,
    departments: admin.departments,
    departmentCount: admin.departments ? admin.departments.length : 0,
  });

  if (admin.hasAllAccess === true) {
    return '<span class="badge badge-success">Alle Abteilungen</span>';
  }

  if (!admin.departments || admin.departments.length === 0) {
    return '<span class="badge badge-secondary">Keine Abteilungen</span>';
  }

  const count = admin.departments.length;
  const label = count === 1 ? 'Abteilung' : 'Abteilungen';
  return `<span class="badge badge-info">${String(count)} ${label}</span>`;
}

// Load admin permissions
async function loadAdminPermissions(adminId: number): Promise<{ departments: Department[]; hasAllAccess: boolean }> {
  try {
    const response = await apiClient.request<{
      permissions?: { departments?: Department[] };
      departments?: Department[];
      hasAllAccess?: boolean;
    }>(`/root/admins/${String(adminId)}/permissions`, { method: 'GET' }, { version: 'v2' });

    // API v2 structure
    if (response.permissions !== undefined) {
      const deptArray = response.permissions.departments ?? [];
      const hasAll = deptArray.length > 0 && deptArray.some((dept) => dept.id === -1);
      return {
        departments: deptArray.filter((dept) => dept.id !== -1),
        hasAllAccess: hasAll,
      };
    }

    // API v1 structure (fallback)
    const depts = response.departments ?? [];
    const hasAll = response.hasAllAccess ?? false;
    return { departments: depts, hasAllAccess: hasAll };
  } catch (error) {
    console.error('Error loading permissions:', error);
    return { departments: [], hasAllAccess: false };
  }
}

// Load all departments
async function loadDepartments(): Promise<Department[]> {
  try {
    const response = await apiClient.request<Department[] | { success: boolean; data: Department[] }>(
      '/departments',
      { method: 'GET' },
      { version: useV2API ? 'v2' : 'v1' },
    );

    if (Array.isArray(response)) {
      return response;
    } else if ('data' in response && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (error) {
    console.error('Error loading departments:', error);
    return [];
  }
}

// Load and populate departments in select
async function loadAndPopulateDepartments() {
  const departments = await loadDepartments();
  const deptSelect = $$(SELECTORS.DEPARTMENT_SELECT) as HTMLSelectElement | null;

  if (deptSelect !== null && departments.length > 0) {
    deptSelect.innerHTML = '';
    departments.forEach((dept) => {
      const option = document.createElement('option');
      option.value = dept.id.toString();
      option.textContent = dept.name;
      deptSelect.appendChild(option);
    });
  }
}

// Render admin table
function renderAdminTable() {
  console.info('renderAdminTable called');
  const tbody = $$('#admins-table tbody');
  if (tbody === null) {
    console.error('admins-table tbody not found');
    return;
  }

  if (admins.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center">Keine Administratoren gefunden</td></tr>';
    return;
  }

  console.info('Admins to render:', admins);

  const rows = admins
    .map((admin) => {
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
            <button class="btn btn-sm btn-primary" onclick="window.editAdmin && window.editAdmin(${String(admin.id)})">
              Bearbeiten
            </button>
            <button class="btn btn-sm btn-secondary" onclick="window.showPermissionsModal && window.showPermissionsModal(${String(
              admin.id,
            )})">
              Berechtigungen
            </button>
            <button class="btn btn-sm btn-danger" onclick="window.deleteAdmin && window.deleteAdmin(${String(admin.id)})">
              Löschen
            </button>
          </td>
        </tr>
      `;
    })
    .join('');

  setHTML(tbody, rows);
}

// Load admins
async function loadAdmins() {
  console.info('loadAdmins called');
  try {
    const endpoint = '/root/admins';

    const data = await apiClient.request<Admin[]>(
      endpoint,
      {
        method: 'GET',
      },
      { version: useV2API ? 'v2' : 'v1' },
    );

    // Map the API response to ensure consistent field names
    // API v2 returns { admins: [...] }, v1 returns array directly
    const adminData =
      useV2API && typeof data === 'object' && 'admins' in data
        ? (data as { admins: UserAPIResponse[] }).admins
        : Array.isArray(data)
          ? data
          : [];
    admins = mapUsers(adminData as UserAPIResponse[]) as Admin[];
    console.info('Loaded admins:', admins);

    // Load permissions for each admin
    for (const admin of admins) {
      try {
        const perms = await loadAdminPermissions(admin.id);
        console.info(`Permissions for admin ${String(admin.id)}:`, perms);
        admin.departments = perms.departments;
        admin.hasAllAccess = perms.hasAllAccess;
      } catch (error) {
        console.error(`Error loading permissions for admin ${String(admin.id)}:`, error);
        admin.departments = [];
        admin.hasAllAccess = false;
      }
    }

    // Log each admin's isActive status
    admins.forEach((admin) => {
      console.info(`Admin ${admin.username} (ID: ${String(admin.id)}) - isActive: ${String(admin.isActive)}`);
    });
    renderAdminTable();
  } catch (error) {
    console.error('Fehler:', error);
    showErrorAlert('Netzwerkfehler beim Laden der Admins');
  }
}

// Load tenants for dropdown
async function loadTenants() {
  try {
    const endpoint = '/root/tenants';

    const response = await apiClient.request<{ success: boolean; data: Tenant[]; timestamp: string }>(
      endpoint,
      {
        method: 'GET',
      },
      { version: useV2API ? 'v2' : 'v1' },
    );

    console.info('Loaded tenants:', response);
    // The data field is always present in the response type
    tenants = response.data;
    updateTenantDropdown();
  } catch (error) {
    console.error('Fehler beim Laden der Tenants:', error);
  }
}

// Update tenant dropdown
function updateTenantDropdown() {
  const select = $$('#adminTenant') as HTMLSelectElement | null;
  if (select !== null) {
    setHTML(
      select,
      tenants
        .map((t) => `<option value="${String(t.id)}">${t.name ?? t.company_name ?? t.subdomain}</option>`)
        .join(''),
    );
  }
}

// Show permissions modal
async function showPermissionsModal(adminId: number) {
  console.info('showPermissionsModal called with admin ID:', adminId);

  const admin = admins.find((a) => a.id === adminId);
  if (!admin) {
    console.error('Admin not found:', adminId);
    return;
  }

  console.info('Found admin:', admin);

  // Update modal title
  const modalTitle = $$('#permissionsModalTitle');
  if (modalTitle) {
    modalTitle.textContent = `Berechtigungen für ${admin.firstName} ${admin.lastName}`;
  }

  // Store admin ID for save handler
  currentAdminId = adminId;

  // Load current permissions
  const permissionsResponse = await loadAdminPermissions(adminId);
  console.info('Current permissions:', permissionsResponse);

  // Load all departments
  const allDepartments = await loadDepartments();
  console.info('All departments:', allDepartments);

  // Build permissions table
  const permissionsBody = $$('#permissions-tbody');
  if (permissionsBody) {
    const rows = allDepartments
      .map((dept) => {
        const currentPerm = permissionsResponse.departments.find((p) => p.id === dept.id);
        const canRead = currentPerm?.can_read ?? false;
        const canWrite = currentPerm?.can_write ?? false;
        const canDelete = currentPerm?.can_delete ?? false;

        return `
          <tr>
            <td>${dept.name}</td>
            <td>
              <input type="checkbox" class="perm-read" data-dept-id="${String(dept.id)}"
                ${canRead ? 'checked' : ''}>
            </td>
            <td>
              <input type="checkbox" class="perm-write" data-dept-id="${String(dept.id)}"
                ${canWrite ? 'checked' : ''}>
            </td>
            <td>
              <input type="checkbox" class="perm-delete" data-dept-id="${String(dept.id)}"
                ${canDelete ? 'checked' : ''}>
            </td>
          </tr>
        `;
      })
      .join('');
    setHTML(permissionsBody, rows);
  }

  // Show modal
  const modal = $$('#permissionsModal');
  if (modal) {
    modal.classList.add('active');
  }
}

// Helper functions for form submission
function validateEmails(): boolean {
  const emailEl = $$('#adminEmail') as HTMLInputElement | null;
  const emailConfirmEl = $$(SELECTORS.ADMIN_EMAIL_CONFIRM) as HTMLInputElement | null;
  const email = emailEl !== null ? emailEl.value : '';
  const emailConfirm = emailConfirmEl !== null ? emailConfirmEl.value : '';
  const emailError = $$(SELECTORS.EMAIL_ERROR);

  if (email !== emailConfirm) {
    if (emailError) emailError.style.display = 'block';
    showErrorAlert('Die E-Mail-Adressen stimmen nicht überein!');
    return false;
  }
  if (emailError) emailError.style.display = 'none';
  return true;
}

function validatePasswords(): boolean {
  const passwordEl = $$(SELECTORS.ADMIN_PASSWORD) as HTMLInputElement | null;
  const passwordConfirmEl = $$(SELECTORS.ADMIN_PASSWORD_CONFIRM) as HTMLInputElement | null;
  const password = passwordEl !== null ? passwordEl.value : '';
  const passwordConfirm = passwordConfirmEl !== null ? passwordConfirmEl.value : '';
  const passwordError = $$(SELECTORS.PASSWORD_ERROR);

  if (password !== '' && password !== passwordConfirm) {
    if (passwordError) passwordError.style.display = 'block';
    showErrorAlert('Die Passwörter stimmen nicht überein!');
    return false;
  }
  if (passwordError) passwordError.style.display = 'none';
  return true;
}

function getFormData(): AdminFormData {
  const firstNameEl = $$('#adminFirstName') as HTMLInputElement | null;
  const lastNameEl = $$('#adminLastName') as HTMLInputElement | null;
  const emailEl = $$('#adminEmail') as HTMLInputElement | null;
  const email = emailEl !== null ? emailEl.value : '';
  const passwordEl = $$(SELECTORS.ADMIN_PASSWORD) as HTMLInputElement | null;
  const positionEl = $$(SELECTORS.POSITION_DROPDOWN_VALUE) as HTMLInputElement | null;
  const employeeNumberEl = $$('#adminEmployeeNumber') as HTMLInputElement | null;

  const formData: AdminFormData = {
    firstName: firstNameEl !== null ? firstNameEl.value : '',
    lastName: lastNameEl !== null ? lastNameEl.value : '',
    email,
    username: email,
    password: passwordEl !== null ? passwordEl.value : '',
    position: positionEl !== null ? positionEl.value : '',
    notes: ($('#adminNotes') as HTMLTextAreaElement).value,
    role: 'admin',
    employeeNumber: employeeNumberEl !== null ? employeeNumberEl.value : '',
  };

  // Include isActive only when updating
  if (currentAdminId !== null && currentAdminId !== 0) {
    const checkbox = $('#adminIsActive') as HTMLInputElement;
    console.info('Checkbox checked state:', checkbox.checked);
    formData.isActive = checkbox.checked;
  }

  // Remove empty password for updates
  if (
    currentAdminId !== null &&
    currentAdminId !== 0 &&
    (formData.password === undefined || formData.password === '')
  ) {
    delete formData.password;
  }

  return formData;
}

async function saveAdmin(formData: AdminFormData): Promise<number> {
  const isUpdate = currentAdminId !== null && currentAdminId !== 0;
  const endpoint = isUpdate ? `/root/admins/${String(currentAdminId)}` : '/root/admins';
  const method = isUpdate ? 'PUT' : 'POST';

  const result = await apiClient.request<{ adminId?: number; id?: number }>(
    endpoint,
    {
      method,
      body: JSON.stringify(formData),
    },
    { version: 'v2' },
  );

  return currentAdminId ?? result.adminId ?? result.id ?? 0;
}

async function getPermissionData(permissionType: string): Promise<{ departmentIds: number[]; groupIds: number[] }> {
  let departmentIds: number[] = [];
  let groupIds: number[] = [];

  if (permissionType === 'specific') {
    const select = $$(SELECTORS.DEPARTMENT_SELECT) as HTMLSelectElement | null;
    if (select !== null) {
      departmentIds = [...select.selectedOptions].map((opt) => Number.parseInt(opt.value, 10));
    }
  } else if (permissionType === 'groups') {
    const checkboxes = $all('input[name="groupSelect"]:checked');
    groupIds = [...checkboxes].map((checkbox) => Number.parseInt((checkbox as HTMLInputElement).value, 10));
  } else if (permissionType === 'all') {
    const allDepts = await loadDepartments();
    departmentIds = allDepts.map((d) => d.id);
  }

  return { departmentIds, groupIds };
}

async function updatePermissions(adminId: number): Promise<void> {
  const permissionTypeInput = document.querySelector(SELECTORS.PERMISSION_TYPE_CHECKED);
  const permissionType = permissionTypeInput instanceof HTMLInputElement ? permissionTypeInput.value : undefined;
  console.info('🔵 Permission type selected:', permissionType);

  if (adminId === 0 || permissionType === undefined) return;

  const { departmentIds, groupIds } = await getPermissionData(permissionType);

  console.info('🔵 Setting department permissions for admin:', adminId);
  console.info('Department IDs:', departmentIds);

  await apiClient.request(
    '/admin-permissions',
    {
      method: 'POST',
      body: JSON.stringify({
        adminId,
        departmentIds,
        permissions: { can_read: true, can_write: false, can_delete: false },
      }),
    },
    { version: useV2API ? 'v2' : 'v1' },
  );

  if (groupIds.length > 0) {
    await apiClient.request(
      '/admin-permissions/groups',
      {
        method: 'POST',
        body: JSON.stringify({
          adminId,
          groupIds,
          permissions: { can_read: true, can_write: false, can_delete: false },
        }),
      },
      { version: useV2API ? 'v2' : 'v1' },
    );
  }

  console.info('✅ Permissions updated successfully');
}

// Helper functions to reduce cognitive complexity
function fillAdminFormFields(admin: Admin): void {
  ($('#adminFirstName') as HTMLInputElement).value = admin.firstName;
  ($('#adminLastName') as HTMLInputElement).value = admin.lastName;
  ($('#adminEmail') as HTMLInputElement).value = admin.email;
  ($(SELECTORS.ADMIN_EMAIL_CONFIRM) as HTMLInputElement).value = admin.email;
  ($('#adminNotes') as HTMLTextAreaElement).value = admin.notes ?? '';
}

function setPositionDropdown(positionValue: string): void {
  ($(SELECTORS.POSITION_DROPDOWN_VALUE) as HTMLInputElement).value = positionValue;
  const displayText = positionValue !== '' ? getPositionDisplay(positionValue) : 'Position auswählen...';
  const positionDropdown = $$('#positionDropdownDisplay');
  if (!positionDropdown) return;

  const span = positionDropdown.querySelector('span');
  if (span) span.textContent = displayText;
}

function setActiveStatus(isActive: boolean): void {
  const activeStatusGroup = $$('#activeStatusGroup');
  if (activeStatusGroup) activeStatusGroup.style.display = 'block';

  const isActiveCheckbox = $('#adminIsActive') as HTMLInputElement;
  console.info('Setting checkbox for edit - isActive:', isActive);
  isActiveCheckbox.checked = isActive;
}

function hideEditModeElements(): void {
  const elements = [
    { selector: '#emailConfirmGroup', display: 'none' },
    { selector: '#passwordGroup', display: 'none' },
    { selector: '#passwordConfirmGroup', display: 'none' },
    { selector: SELECTORS.EMAIL_ERROR, display: 'none' },
    { selector: SELECTORS.PASSWORD_ERROR, display: 'none' },
  ];

  elements.forEach(({ selector, display }) => {
    const element = $$(selector);
    if (element) element.style.display = display;
  });
}

async function setPermissionType(admin: Admin): Promise<void> {
  // Reset all permission type radio buttons
  $all(SELECTORS.PERMISSION_TYPE_RADIO).forEach((radio) => {
    (radio as HTMLInputElement).checked = false;
  });

  // Hide all containers first
  const deptContainer = $$(SELECTORS.DEPARTMENT_SELECT_CONTAINER);
  const groupContainer = $$('#groupSelectContainer');
  if (deptContainer) deptContainer.style.display = 'none';
  if (groupContainer) groupContainer.style.display = 'none';

  if (admin.hasAllAccess === true) {
    setRadioButton('all');
  } else if (admin.departments !== undefined && admin.departments.length > 0) {
    setRadioButton('specific');
    await setupDepartmentSelection(admin, deptContainer);
  } else {
    setRadioButton('none');
  }
}

function setRadioButton(value: string): void {
  const radio = document.querySelector(`input[name="permissionType"][value="${value}"]`);
  if (radio) {
    (radio as HTMLInputElement).checked = true;
    console.info(`✅ Set permission type to: ${value}`);
  }
}

async function setupDepartmentSelection(admin: Admin, deptContainer: HTMLElement | null): Promise<void> {
  if (!deptContainer) return;

  deptContainer.style.display = 'block';
  await loadAndPopulateDepartments();

  const deptSelect = $$(SELECTORS.DEPARTMENT_SELECT) as HTMLSelectElement | null;
  if (!deptSelect) return;

  // Clear all selections first
  [...deptSelect.options].forEach((option) => (option.selected = false));

  // Select assigned departments
  if (admin.departments) {
    admin.departments.forEach((dept) => {
      const option = [...deptSelect.options].find((opt) => opt.value === dept.id.toString());
      if (option) {
        option.selected = true;
        console.info('✅ Selected department:', dept.name);
      }
    });
  }
}

function setOptionalFields(): void {
  const fields = [
    { selector: SELECTORS.ADMIN_EMAIL_CONFIRM, type: 'input' },
    { selector: SELECTORS.ADMIN_PASSWORD, type: 'password' },
    { selector: SELECTORS.ADMIN_PASSWORD_CONFIRM, type: 'password' },
  ];

  fields.forEach(({ selector, type }) => {
    const field = $$(selector) as HTMLInputElement | null;
    if (!field) return;

    field.required = false;
    if (type === 'password') field.value = '';
  });
}

// Define functions before they're used
async function editAdminHandler(adminId: number) {
  currentAdminId = adminId;
  const admin = admins.find((a) => String(a.id) === String(adminId));
  if (!admin) return;

  const modal = $$(SELECTORS.ADMIN_MODAL);
  const title = $$(SELECTORS.MODAL_TITLE);
  if (title) title.textContent = 'Admin bearbeiten';

  fillAdminFormFields(admin);
  setPositionDropdown(admin.position ?? '');
  setActiveStatus(admin.isActive);
  hideEditModeElements();

  console.info('🔵 Loading department assignments for admin:', adminId);
  console.info('Admin departments:', admin.departments);
  console.info('Admin hasAllAccess:', admin.hasAllAccess);

  await setPermissionType(admin);
  setOptionalFields();

  modal?.classList.add('active');
}

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
    const cancelBtn = modal.querySelector('#cancel-delete');

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
    const endpoint = `/root/admins/${String(adminId)}`;
    const result = await apiClient.request(
      endpoint,
      {
        method: 'DELETE',
      },
      { version: useV2API ? 'v2' : 'v1' },
    );

    console.info('Delete response:', result);

    // Admin-Liste neu laden
    await loadAdmins();
    showSuccessAlert('Administrator gelöscht');
  } catch (error) {
    console.error('Error deleting admin:', error);
    showErrorAlert('Netzwerkfehler beim Löschen');
  }
}

// Helper function to clear form fields
function clearFormFields() {
  ($('#adminFirstName') as HTMLInputElement).value = '';
  ($('#adminLastName') as HTMLInputElement).value = '';
  ($('#adminEmail') as HTMLInputElement).value = '';
  ($(SELECTORS.ADMIN_EMAIL_CONFIRM) as HTMLInputElement).value = '';
  ($(SELECTORS.ADMIN_PASSWORD) as HTMLInputElement).value = '';
  ($(SELECTORS.ADMIN_PASSWORD_CONFIRM) as HTMLInputElement).value = '';
  ($('#adminNotes') as HTMLTextAreaElement).value = '';
  ($(SELECTORS.POSITION_DROPDOWN_VALUE) as HTMLInputElement).value = '';
}

// Helper function to reset position dropdown
function resetPositionDropdown() {
  const positionDropdown = $$('#positionDropdownDisplay');
  if (positionDropdown) {
    const span = positionDropdown.querySelector('span');
    if (span) span.textContent = 'Position auswählen...';
  }
}

// Helper function to reset form visibility
function resetFormVisibility() {
  const activeStatusGroup = $$('#activeStatusGroup');
  if (activeStatusGroup) activeStatusGroup.style.display = 'none';

  const emailConfirmGroup = $$('#emailConfirmGroup');
  if (emailConfirmGroup) emailConfirmGroup.style.display = 'block';

  const passwordGroup = $$('#passwordGroup');
  const passwordConfirmGroup = $$('#passwordConfirmGroup');
  if (passwordGroup) passwordGroup.style.display = 'block';
  if (passwordConfirmGroup) passwordConfirmGroup.style.display = 'block';
}

// Helper function to reset error messages
function resetErrorMessages() {
  const emailError = $$(SELECTORS.EMAIL_ERROR);
  const passwordError = $$(SELECTORS.PASSWORD_ERROR);
  if (emailError) emailError.style.display = 'none';
  if (passwordError) passwordError.style.display = 'none';
}

// Helper function to reset permissions
function resetPermissionSettings() {
  $all(SELECTORS.PERMISSION_TYPE_RADIO).forEach((radio) => {
    (radio as HTMLInputElement).checked = false;
  });

  const deptContainer = $$(SELECTORS.DEPARTMENT_SELECT_CONTAINER);
  const groupContainer = $$('#groupSelectContainer');
  if (deptContainer) deptContainer.style.display = 'none';
  if (groupContainer) groupContainer.style.display = 'none';

  const noneRadio = document.querySelector('input[name="permissionType"][value="none"]');
  if (noneRadio) {
    (noneRadio as HTMLInputElement).checked = true;
  }
}

// Helper function to reset UI elements
function resetModalUIElements() {
  resetPositionDropdown();
  resetFormVisibility();
  resetErrorMessages();
  resetPermissionSettings();
}

// Modal functions
function showAddAdminModal() {
  currentAdminId = null;
  const modal = $$(SELECTORS.ADMIN_MODAL);
  const title = $$(SELECTORS.MODAL_TITLE);

  if (title) title.textContent = 'Neuen Administrator hinzufügen';

  clearFormFields();
  resetModalUIElements();

  // Set fields as required for new admin
  const emailConfirmField = $$(SELECTORS.ADMIN_EMAIL_CONFIRM) as HTMLInputElement | null;
  if (emailConfirmField !== null) {
    emailConfirmField.required = true;
  }

  const passwordField = $$(SELECTORS.ADMIN_PASSWORD) as HTMLInputElement | null;
  const passwordConfirmField = $$(SELECTORS.ADMIN_PASSWORD_CONFIRM) as HTMLInputElement | null;
  if (passwordField !== null) {
    passwordField.required = true;
  }
  if (passwordConfirmField !== null) {
    passwordConfirmField.required = true;
  }

  modal?.classList.add('active');
}

function closeAdminModal() {
  const modal = $$(SELECTORS.ADMIN_MODAL);
  modal?.classList.remove('active');
  currentAdminId = null;
}

function closePermissionsModal() {
  const modal = $$('#permissionsModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// Save permissions handler
const savePermissionsHandler = async (): Promise<void> => {
  if (currentAdminId === null) {
    console.error('No admin ID set');
    return;
  }

  // Collect permissions from table
  const departments: { id: number; can_read: boolean; can_write: boolean; can_delete: boolean }[] = [];

  const rows = $all('#permissions-tbody tr');
  rows.forEach((row) => {
    const readCheckbox = row.querySelector<HTMLInputElement>('.perm-read');
    const writeCheckbox = row.querySelector<HTMLInputElement>('.perm-write');
    const deleteCheckbox = row.querySelector<HTMLInputElement>('.perm-delete');

    if (readCheckbox?.dataset.deptId !== undefined && readCheckbox.dataset.deptId !== '') {
      const deptId = Number.parseInt(readCheckbox.dataset.deptId, 10);
      departments.push({
        id: deptId,
        can_read: readCheckbox.checked,
        can_write: writeCheckbox !== null ? writeCheckbox.checked : false,
        can_delete: deleteCheckbox !== null ? deleteCheckbox.checked : false,
      });
    }
  });

  try {
    // Save permissions
    await apiClient.request(
      '/admin-permissions',
      {
        method: 'POST',
        body: JSON.stringify({
          adminId: currentAdminId,
          departmentIds: departments.filter((d) => d.can_read).map((d) => d.id),
          permissions: { can_read: true, can_write: false, can_delete: false },
        }),
      },
      { version: useV2API ? 'v2' : 'v1' },
    );

    showSuccessAlert('Berechtigungen aktualisiert');
    closePermissionsModal();

    // Reload admins to update table
    await loadAdmins();
  } catch (error) {
    console.error('Error saving permissions:', error);
    showErrorAlert('Netzwerkfehler beim Speichern');
  }
};

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

// Helper function to setup position dropdown
function setupPositionDropdown() {
  const positionDropdown = $$('#positionDropdownDisplay');
  const positionDropdownMenu = $$('.position-dropdown-menu');

  if (positionDropdown && positionDropdownMenu) {
    positionDropdown.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      positionDropdownMenu.classList.toggle('show');
    });

    // Handle position selection
    const positionItems = positionDropdownMenu.querySelectorAll('.dropdown-item');
    positionItems.forEach((item) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        if (!(e.target instanceof HTMLElement)) return;
        const target = e.target;
        const position = target.dataset.value ?? '';
        const displayText = target.textContent;

        // Update display
        const span = positionDropdown.querySelector('span');
        if (span) span.textContent = displayText;

        // Update hidden input
        ($(SELECTORS.POSITION_DROPDOWN_VALUE) as HTMLInputElement).value = position;

        // Close dropdown
        positionDropdownMenu.classList.remove('show');
      });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!positionDropdown.contains(e.target as Node) && !positionDropdownMenu.contains(e.target as Node)) {
        positionDropdownMenu.classList.remove('show');
      }
    });
  }
}

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
    await loadAdmins();
    await loadTenants();
  })();
}

// Setup permission type radio handlers
function setupPermissionRadioHandlers(): void {
  $all(SELECTORS.PERMISSION_TYPE_RADIO).forEach((radio) => {
    radio.addEventListener('change', (e) => {
      void (async () => {
        const permissionType = (e.target as HTMLInputElement).value;
        const deptContainer = $$(SELECTORS.DEPARTMENT_SELECT_CONTAINER);
        const groupContainer = $$('#groupSelectContainer');

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
  const selectAllBtn = $$('#selectAllDepartments');
  const deselectAllBtn = $$('#deselectAllDepartments');
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
  $$('#adminForm')?.addEventListener('submit', (e) => {
    void (async () => {
      e.preventDefault();

      // Validate form
      if (!validateEmails()) return;
      if (!validatePasswords()) return;

      // Get form data
      const formData = getFormData();
      console.info('Sending form data:', formData);
      console.info('Current admin ID:', currentAdminId);
      console.info('isActive value being sent:', formData.isActive);

      try {
        // Save admin
        const adminId = await saveAdmin(formData);

        // Update permissions
        await updatePermissions(adminId);

        showSuccessAlert(
          currentAdminId !== null && currentAdminId !== 0 ? 'Administrator aktualisiert' : 'Administrator hinzugefügt',
        );
        const closeModal = (window as unknown as ManageAdminsWindow).closeAdminModal;
        if (closeModal) closeModal();

        // Admin-Liste dynamisch neu laden (ohne Seiten-Reload)
        await loadAdmins();
      } catch (error) {
        console.error('Fehler:', error);
        showErrorAlert('Netzwerkfehler beim Speichern');
      }
    })();
  });
}

// Initialize the admin management
(() => {
  if (!checkAuth()) return;

  setupGlobalFunctions();
  loadInitialData();
  setupPositionDropdown();
  setupPermissionRadioHandlers();
  setupDepartmentSelectionButtons();
  setupFormSubmitHandler();
  initializeTooltipHandlers();
  setupPasswordValidation();
})();

// End of file
