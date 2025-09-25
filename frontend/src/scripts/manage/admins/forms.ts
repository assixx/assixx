/* eslint-disable max-lines */
// Admin Management Forms Layer - UI and Form Handling
import { $, $$, $all, setHTML } from '../../../utils/dom-utils';
import {
  type Admin,
  type AdminFormData,
  admins,
  tenants,
  currentAdminId,
  setCurrentAdminId,
  loadDepartments,
  loadAdminPermissions,
  saveAdmin as saveAdminAPI,
  updateAdminPermissions,
  savePermissions,
} from './data';
import { showSuccessAlert, showErrorAlert } from '../../utils/alerts';

// ===== DOM ELEMENT SELECTORS =====
export const SELECTORS = {
  ADMIN_MODAL: '#admin-modal',
  MODAL_TITLE: '#admin-modal-title',
  ADMIN_PASSWORD: '#admin-password',
  ADMIN_PASSWORD_CONFIRM: '#admin-password-confirm',
  ADMIN_EMAIL_CONFIRM: '#admin-email-confirm',
  DEPARTMENT_SELECT: '#department-select',
  DEPARTMENT_SELECT_CONTAINER: '#department-select-container',
  PERMISSION_TYPE_RADIO: 'input[name="permission-type"]',
  PERMISSION_TYPE_CHECKED: 'input[name="permission-type"]:checked',
  EMAIL_ERROR: '#email-error',
  PASSWORD_ERROR: '#password-error',
} as const;

// ===== HELPER FUNCTIONS =====

// Helper function to display position names
export function getPositionDisplay(position: string): string {
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
export function getDepartmentsBadge(admin: Admin): string {
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

// Load and populate departments in select
export async function loadAndPopulateDepartments(): Promise<void> {
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

// Update tenant dropdown
export function updateTenantDropdown(): void {
  const select = $$('#admin-tenant') as HTMLSelectElement | null;
  if (select !== null) {
    setHTML(
      select,
      tenants
        .map((t) => `<option value="${String(t.id)}">${t.name ?? t.company_name ?? t.subdomain}</option>`)
        .join(''),
    );
  }
}

// ===== FORM VALIDATION =====

export function validateEmails(): boolean {
  const emailEl = $$('#admin-email') as HTMLInputElement | null;
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

export function validatePasswords(): boolean {
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

// ===== FORM DATA HANDLING =====

export function getFormData(): AdminFormData {
  const firstNameEl = $$('#admin-first-name') as HTMLInputElement | null;
  const lastNameEl = $$('#admin-last-name') as HTMLInputElement | null;
  const emailEl = $$('#admin-email') as HTMLInputElement | null;
  const email = emailEl !== null ? emailEl.value : '';
  const passwordEl = $$(SELECTORS.ADMIN_PASSWORD) as HTMLInputElement | null;
  const positionEl = $$('#admin-position') as HTMLSelectElement | null;
  const employeeNumberEl = $$('#admin-employee-number') as HTMLInputElement | null;

  const formData: AdminFormData = {
    firstName: firstNameEl !== null ? firstNameEl.value : '',
    lastName: lastNameEl !== null ? lastNameEl.value : '',
    email,
    username: email,
    password: passwordEl !== null ? passwordEl.value : '',
    position: positionEl !== null ? positionEl.value : '',
    notes: ($('#admin-notes') as HTMLTextAreaElement).value,
    role: 'admin',
    employeeNumber: employeeNumberEl !== null ? employeeNumberEl.value : '',
  };

  // Include isActive only when updating
  if (currentAdminId !== null && currentAdminId !== 0) {
    const checkbox = $('#admin-is-active') as HTMLInputElement;
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

export async function getPermissionData(
  permissionType: string,
): Promise<{ departmentIds: number[]; groupIds: number[] }> {
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

export async function updatePermissions(adminId: number): Promise<void> {
  const permissionTypeInput = document.querySelector(SELECTORS.PERMISSION_TYPE_CHECKED);
  const permissionType = permissionTypeInput instanceof HTMLInputElement ? permissionTypeInput.value : undefined;
  console.info('🔵 Permission type selected:', permissionType);

  if (adminId === 0 || permissionType === undefined) return;

  const { departmentIds, groupIds } = await getPermissionData(permissionType);

  console.info('🔵 Setting department permissions for admin:', adminId);
  console.info('Department IDs:', departmentIds);

  await updateAdminPermissions(adminId, departmentIds, groupIds);
}

// ===== FORM UI HELPERS =====

export function fillAdminFormFields(admin: Admin): void {
  ($('#admin-first-name') as HTMLInputElement).value = admin.firstName;
  ($('#admin-last-name') as HTMLInputElement).value = admin.lastName;
  ($('#admin-email') as HTMLInputElement).value = admin.email;
  ($(SELECTORS.ADMIN_EMAIL_CONFIRM) as HTMLInputElement).value = admin.email;
  ($('#admin-notes') as HTMLTextAreaElement).value = admin.notes ?? '';
}

export function setPositionDropdown(positionValue: string): void {
  const positionSelect = $$('#admin-position') as HTMLSelectElement | null;
  if (positionSelect) {
    positionSelect.value = positionValue;
  }
}

export function setActiveStatus(isActive: boolean): void {
  const activeStatusGroup = $$('#active-status-group');
  if (activeStatusGroup) activeStatusGroup.style.display = 'block';

  const isActiveCheckbox = $('#admin-is-active') as HTMLInputElement;
  console.info('Setting checkbox for edit - isActive:', isActive);
  isActiveCheckbox.checked = isActive;
}

export function hideEditModeElements(): void {
  const elements = [
    { selector: '#email-confirm-group', display: 'none' },
    { selector: '#password-group', display: 'none' },
    { selector: '#password-confirm-group', display: 'none' },
    { selector: SELECTORS.EMAIL_ERROR, display: 'none' },
    { selector: SELECTORS.PASSWORD_ERROR, display: 'none' },
  ];

  elements.forEach(({ selector, display }) => {
    const element = $$(selector);
    if (element) element.style.display = display;
  });
}

export async function setPermissionType(admin: Admin): Promise<void> {
  // Reset all permission type radio buttons
  $all(SELECTORS.PERMISSION_TYPE_RADIO).forEach((radio) => {
    (radio as HTMLInputElement).checked = false;
  });

  // Hide all containers first
  const deptContainer = $$(SELECTORS.DEPARTMENT_SELECT_CONTAINER);
  const groupContainer = $$('#group-select-container');
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

export function setRadioButton(value: string): void {
  const radio = document.querySelector(`input[name="permissionType"][value="${value}"]`);
  if (radio) {
    (radio as HTMLInputElement).checked = true;
    console.info(`✅ Set permission type to: ${value}`);
  }
}

export async function setupDepartmentSelection(admin: Admin, deptContainer: HTMLElement | null): Promise<void> {
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

export function setOptionalFields(): void {
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

// ===== CLEAR/RESET FUNCTIONS =====

export function clearFormFields(): void {
  ($('#admin-first-name') as HTMLInputElement).value = '';
  ($('#admin-last-name') as HTMLInputElement).value = '';
  ($('#admin-email') as HTMLInputElement).value = '';
  ($(SELECTORS.ADMIN_EMAIL_CONFIRM) as HTMLInputElement).value = '';
  ($(SELECTORS.ADMIN_PASSWORD) as HTMLInputElement).value = '';
  ($(SELECTORS.ADMIN_PASSWORD_CONFIRM) as HTMLInputElement).value = '';
  ($('#admin-notes') as HTMLTextAreaElement).value = '';
  resetPositionDropdown();
}

export function resetPositionDropdown(): void {
  const positionSelect = $$('#admin-position') as HTMLSelectElement | null;
  if (positionSelect) {
    positionSelect.value = '';
  }
}

export function resetFormVisibility(): void {
  const activeStatusGroup = $$('#active-status-group');
  if (activeStatusGroup) activeStatusGroup.style.display = 'none';

  const emailConfirmGroup = $$('#email-confirm-group');
  if (emailConfirmGroup) emailConfirmGroup.style.display = 'block';

  const passwordGroup = $$('#password-group');
  const passwordConfirmGroup = $$('#password-confirm-group');
  if (passwordGroup) passwordGroup.style.display = 'block';
  if (passwordConfirmGroup) passwordConfirmGroup.style.display = 'block';
}

export function resetErrorMessages(): void {
  const emailError = $$(SELECTORS.EMAIL_ERROR);
  const passwordError = $$(SELECTORS.PASSWORD_ERROR);
  if (emailError) emailError.style.display = 'none';
  if (passwordError) passwordError.style.display = 'none';
}

export function resetPermissionSettings(): void {
  $all(SELECTORS.PERMISSION_TYPE_RADIO).forEach((radio) => {
    (radio as HTMLInputElement).checked = false;
  });

  const deptContainer = $$(SELECTORS.DEPARTMENT_SELECT_CONTAINER);
  const groupContainer = $$('#group-select-container');
  if (deptContainer) deptContainer.style.display = 'none';
  if (groupContainer) groupContainer.style.display = 'none';

  const noneRadio = document.querySelector('input[name="permission-type"][value="none"]');
  if (noneRadio) {
    (noneRadio as HTMLInputElement).checked = true;
  }
}

export function resetModalUIElements(): void {
  resetPositionDropdown();
  resetFormVisibility();
  resetErrorMessages();
  resetPermissionSettings();
}

// ===== MODAL HANDLERS =====

export async function editAdminHandler(adminId: number): Promise<void> {
  setCurrentAdminId(adminId);
  const admin = admins.find((a) => String(a.id) === String(adminId));
  if (!admin) return;

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

  const adminModal = $$('#admin-modal');
  adminModal?.classList.add('active');
}

export function showAddAdminModal(): void {
  setCurrentAdminId(null);
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

  const adminModal = $$('#admin-modal');
  adminModal?.classList.add('active');
}

export function closeAdminModal(): void {
  const adminModal = $$('#admin-modal');
  adminModal?.classList.remove('active');
  setCurrentAdminId(null);
}

export function closePermissionsModal(): void {
  const modal = $$('#permissionsModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// Show permissions modal
export async function showPermissionsModal(adminId: number): Promise<void> {
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
  setCurrentAdminId(adminId);

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
        // eslint-disable-next-line max-lines
        // eslint-disable-next-line max-lines
        // eslint-disable-next-line max-lines
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

// Save permissions handler
export async function savePermissionsHandler(): Promise<void> {
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
    await savePermissions(currentAdminId, departments);
    showSuccessAlert('Berechtigungen aktualisiert');
    closePermissionsModal();
  } catch (error) {
    console.error('Error saving permissions:', error);
    showErrorAlert('Netzwerkfehler beim Speichern');
  }
}

// Form submit handling
export async function handleFormSubmit(e: Event): Promise<void> {
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
    const adminId = await saveAdminAPI(formData);

    // Update permissions
    await updatePermissions(adminId);

    showSuccessAlert(
      currentAdminId !== null && currentAdminId !== 0 ? 'Administrator aktualisiert' : 'Administrator hinzugefügt',
    );
    closeAdminModal();
  } catch (error) {
    console.error('Fehler:', error);
    showErrorAlert('Netzwerkfehler beim Speichern');
  }
}
