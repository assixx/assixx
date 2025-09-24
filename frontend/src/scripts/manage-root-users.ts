/**
 * Root User Management Script
 * Verwaltet Root-Benutzer im System
 * Migrated to API v2 with modern patterns
 */

import { ApiClient } from '../utils/api-client';
import { $, setHTML } from '../utils/dom-utils';
import { showSuccessAlert, showErrorAlert } from './utils/alerts';

// Interfaces
interface RootUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  position?: string;
  notes?: string;
  employeeId?: string;
  employeeNumber?: string;
  departmentId?: number;
  isActive: boolean | number;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

interface FormValues {
  firstName: string;
  lastName: string;
  email: string;
  emailConfirm: string;
  password: string;
  passwordConfirm: string;
  position: string;
  notes: string;
  employeeNumber: string;
  departmentId: string;
  isActive: boolean;
}

interface RootUsersWindow extends Window {
  showAddRootModal: (() => void) | null;
  showAddRootUserModal: (() => void) | null;
  closeRootModal: (() => void) | null;
  editRootUser: ((userId: number) => Promise<void>) | null;
  showRootPermissionsModal: ((userId: number) => void) | null;
  deleteRootUser: ((userId: number) => Promise<void>) | null;
}

// Module-level variables
let currentEditId: number | null = null;
let currentUserId: number | null = null;
const apiClient = ApiClient.getInstance();

// Helper functions
const getCurrentUserId = (): number | null => {
  const userId = localStorage.getItem('userId');
  if (userId !== null && userId !== '') {
    return Number.parseInt(userId, 10);
  }

  // Try to decode from JWT token if userId not in localStorage
  const token = localStorage.getItem('token');
  if (token !== null && token !== '') {
    try {
      const payload = JSON.parse(atob(token.split('.')[1])) as { id?: number };
      return payload.id ?? null;
    } catch {
      return null;
    }
  }
  return null;
};

function setupValidationListeners(): void {
  // Add real-time validation for email confirm
  const emailConfirmInput = $('#rootEmailConfirm') as HTMLInputElement | null;
  if (emailConfirmInput !== null) {
    emailConfirmInput.addEventListener('input', () => {
      const email = ($('#rootEmail') as HTMLInputElement).value;
      const emailConfirm = emailConfirmInput.value;
      const emailError = $('#emailMismatchError');

      if (emailConfirm !== '' && email !== emailConfirm) {
        emailError.style.display = 'block';
      } else {
        emailError.style.display = 'none';
      }
    });
  }

  // Add real-time validation for password confirm
  const passwordConfirmInput = $('#rootPasswordConfirm') as HTMLInputElement | null;
  if (passwordConfirmInput !== null) {
    passwordConfirmInput.addEventListener('input', () => {
      const password = ($('#rootPassword') as HTMLInputElement).value;
      const passwordConfirm = passwordConfirmInput.value;
      const passwordError = $('#passwordMismatchError');

      if (passwordConfirm !== '' && password !== passwordConfirm) {
        passwordError.style.display = 'block';
      } else {
        passwordError.style.display = 'none';
      }
    });
  }
}

async function loadDepartments(): Promise<void> {
  try {
    const departments = await apiClient.request<{ id: number; name: string }[]>(
      '/departments',
      { method: 'GET' },
      { version: 'v2' },
    );

    const departmentSelect = $('#rootDepartmentId') as HTMLSelectElement | null;
    if (departmentSelect !== null) {
      // Keep first option (no department)
      setHTML(departmentSelect, '<option value="">Keine Abteilung zuweisen</option>');

      departments.forEach((dept) => {
        const option = document.createElement('option');
        option.value = dept.id.toString();
        option.textContent = dept.name;
        departmentSelect.append(option);
      });
    }
  } catch (error) {
    console.error('Failed to load departments:', error);
  }
}

async function loadRootUsers(): Promise<void> {
  try {
    const data = await apiClient.request<{ users: RootUser[] }>('/root/users', { method: 'GET' }, { version: 'v2' });

    // Filter out the current logged-in user
    const rootUsers = data.users.filter((user) => user.id !== currentUserId);
    displayRootUsers(rootUsers);
  } catch (error) {
    console.error('Error loading root users:', error);
    showErrorAlert('Fehler beim Laden der Root-Benutzer');
  }
}

function renderEmptyState(): string {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">
        <i class="fas fa-user-shield"></i>
      </div>
      <div class="empty-state-text">Keine weiteren Root-Benutzer vorhanden</div>
      <div class="empty-state-subtext">
        Sie sind der einzige Root-Benutzer. Klicken Sie auf den + Button, um weitere Root-Benutzer hinzuzufügen.
      </div>
    </div>
    <div style="margin-top: 16px; padding: 12px; background: rgba(255, 193, 7, 0.1); border: 1px solid rgba(255, 193, 7, 0.3); border-radius: 8px;">
      <p style="margin: 0; color: #ffc107; font-size: 14px;">
        <i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i>
        Ihr eigenes Profil wird hier nicht angezeigt. Bearbeiten Sie es über <a href="/root-profile" style="color: #ffc107; text-decoration: underline;">Mein Profil</a>.
      </p>
    </div>
  `;
}

function renderUserRow(user: RootUser): string {
  return `
    <tr>
      <td>${user.id}</td>
      <td>${user.firstName} ${user.lastName}</td>
      <td>${user.email}</td>
      <td>${user.position ?? '-'}</td>
      <td>
        <span class="status-badge ${user.isActive === true ? 'active' : 'inactive'}">
          ${user.isActive === true ? 'Aktiv' : 'Inaktiv'}
        </span>
      </td>
      <td>${new Date(user.createdAt).toLocaleDateString('de-DE')}</td>
      <td>${user.lastLogin !== undefined ? new Date(user.lastLogin).toLocaleDateString('de-DE') : '-'}</td>
      <td>
        <button class="action-btn edit" data-action="edit-root-user" data-user-id="${user.id}">Bearbeiten</button>
        <button class="action-btn permissions" data-action="show-root-permissions" data-user-id="${
          user.id
        }" style="border-color: rgba(76, 175, 80, 0.3); background: rgba(76, 175, 80, 0.1);">Berechtigungen</button>
        <button class="action-btn delete" data-action="delete-root-user" data-user-id="${user.id}">Löschen</button>
      </td>
    </tr>
  `;
}

function renderProfileInfo(): string {
  return `
    <div style="margin-top: 16px; padding: 12px; background: rgba(255, 255, 255, 0.02); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);">
      <p style="margin: 0; color: var(--text-secondary); font-size: 14px;">
        <i class="fas fa-info-circle" style="margin-right: 8px; color: var(--primary-color);"></i>
        Ihr eigenes Profil wird hier nicht angezeigt. Bearbeiten Sie es über <a href="/root-profile" style="color: var(--primary-color); text-decoration: underline;">Mein Profil</a>.
      </p>
    </div>
  `;
}

function displayRootUsers(users: RootUser[]): void {
  const container = $('#rootTableContent');

  if (users.length === 0) {
    setHTML(container, renderEmptyState());
    return;
  }

  setHTML(
    container,
    `
    <table class="root-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>E-Mail</th>
          <th>Position</th>
          <th>Status</th>
          <th>Erstellt am</th>
          <th>Letzter Login</th>
          <th>Aktionen</th>
        </tr>
      </thead>
      <tbody>
        ${users.map((user) => renderUserRow(user)).join('')}
      </tbody>
    </table>
    ${renderProfileInfo()}
  `,
  );
}

function getFormValues(): FormValues {
  return {
    firstName: ($('#rootFirstName') as HTMLInputElement).value,
    lastName: ($('#rootLastName') as HTMLInputElement).value,
    email: ($('#rootEmail') as HTMLInputElement).value,
    emailConfirm: ($('#rootEmailConfirm') as HTMLInputElement | null)?.value ?? '',
    password: ($('#rootPassword') as HTMLInputElement | null)?.value ?? '',
    passwordConfirm: ($('#rootPasswordConfirm') as HTMLInputElement | null)?.value ?? '',
    position: ($('#positionDropdownValue') as HTMLInputElement | null)?.value ?? '',
    notes: ($('#rootNotes') as HTMLTextAreaElement | null)?.value ?? '',
    employeeNumber: ($('#rootEmployeeNumber') as HTMLInputElement | null)?.value ?? '',
    departmentId: ($('#rootDepartmentId') as HTMLSelectElement | null)?.value ?? '',
    isActive: currentEditId !== null ? (($('#rootIsActive') as HTMLInputElement | null)?.checked ?? false) : true,
  };
}

function clearErrorMessages(): void {
  const emailError = $('#email-error');
  const passwordError = $('#password-error');
  emailError.style.display = 'none';
  passwordError.style.display = 'none';
}

function validateForm(values: FormValues, isEdit: boolean): boolean {
  const emailError = $('#email-error');
  const passwordError = $('#password-error');

  if (values.email !== values.emailConfirm) {
    emailError.style.display = 'block';
    showErrorAlert('E-Mail-Adressen stimmen nicht überein');
    return false;
  }

  if (!isEdit && values.password !== values.passwordConfirm) {
    passwordError.style.display = 'block';
    showErrorAlert('Passwörter stimmen nicht überein');
    return false;
  }

  if (!isEdit && values.password.length < 8) {
    showErrorAlert('Passwort muss mindestens 8 Zeichen lang sein');
    return false;
  }

  return true;
}

function buildUserData(values: FormValues, isEdit: boolean): Record<string, unknown> {
  const userData: Record<string, unknown> = {
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email,
    position: values.position,
    notes: values.notes,
    isActive: values.isActive,
  };

  if (values.employeeNumber !== '') {
    userData.employeeNumber = values.employeeNumber;
  }

  if (values.departmentId !== '') {
    userData.departmentId = Number.parseInt(values.departmentId, 10);
  }

  if (!isEdit) {
    userData.password = values.password;
    userData.username = values.email;
  }

  return userData;
}

async function handleFormSubmit(event: Event): Promise<void> {
  event.preventDefault();

  const values = getFormValues();
  clearErrorMessages();

  const isEdit = currentEditId !== null;
  if (!validateForm(values, isEdit)) {
    return;
  }

  const userData = buildUserData(values, isEdit);

  try {
    const endpoint = isEdit && currentEditId !== null ? `/root/users/${currentEditId}` : '/root/users';
    const method = isEdit ? 'PUT' : 'POST';

    await apiClient.request(endpoint, { method, body: JSON.stringify(userData) }, { version: 'v2' });

    showSuccessAlert(isEdit ? 'Root-Benutzer aktualisiert' : 'Root-Benutzer erstellt');
    closeRootModal();
    await loadRootUsers();
  } catch (error) {
    showErrorAlert(error instanceof Error ? error.message : 'Fehler beim Speichern des Root-Benutzers');
  }
}

function closeRootModal(): void {
  const modal = $('#rootModal');
  modal.classList.remove('active');
  currentEditId = null;
  const form = $('#rootForm') as HTMLFormElement;
  form.reset();

  // Clear error messages
  const emailError = $('#email-error');
  const passwordError = $('#password-error');
  emailError.style.display = 'none';
  passwordError.style.display = 'none';
}

function showAddRootModal(): void {
  currentEditId = null;

  const modalTitle = $('#modalTitle') as HTMLElement | null;
  if (modalTitle !== null) {
    modalTitle.textContent = 'Root User hinzufügen';
  }

  const form = $('#rootForm') as HTMLFormElement;
  form.reset();

  const positionDropdown = $('#positionDropdownDisplay') as HTMLElement | null;
  const positionSpan = positionDropdown !== null ? positionDropdown.querySelector('span') : null;
  if (positionSpan !== null) {
    positionSpan.textContent = 'Position auswählen...';
  }

  const passwordGroup = $('#passwordGroup') as HTMLElement | null;
  if (passwordGroup !== null) {
    passwordGroup.style.display = 'block';
  }

  const passwordConfirmGroup = $('#passwordConfirmGroup') as HTMLElement | null;
  if (passwordConfirmGroup !== null) {
    passwordConfirmGroup.style.display = 'block';
  }

  const activeStatusGroup = $('#activeStatusGroup') as HTMLElement | null;
  if (activeStatusGroup !== null) {
    activeStatusGroup.style.display = 'none';
  }

  // Clear error messages
  const emailError = $('#email-error');
  const passwordError = $('#password-error');
  emailError.style.display = 'none';
  passwordError.style.display = 'none';

  const modal = $('#rootModal');
  modal.classList.add('active');
}

async function editRootUserHandler(userId: number): Promise<void> {
  currentEditId = userId;
  const user = (
    await apiClient.request<{ users: RootUser[] }>('/root/users', { method: 'GET' }, { version: 'v2' })
  ).users.find((u) => u.id === userId);

  if (!user) {
    showErrorAlert('Benutzer nicht gefunden');
    return;
  }

  const modalTitle = $('#modalTitle');
  modalTitle.textContent = 'Root User bearbeiten';

  // Fill form with user data
  ($('#rootFirstName') as HTMLInputElement).value = user.firstName;
  ($('#rootLastName') as HTMLInputElement).value = user.lastName;
  ($('#rootEmail') as HTMLInputElement).value = user.email;
  ($('#rootEmailConfirm') as HTMLInputElement).value = user.email;
  ($('#rootNotes') as HTMLTextAreaElement).value = user.notes ?? '';

  // Set employee number if exists
  const employeeNumberInput = $('#rootEmployeeNumber') as HTMLInputElement | null;
  if (employeeNumberInput !== null) {
    employeeNumberInput.value = user.employeeNumber ?? '';
  }

  // Set department if exists
  const departmentSelect = $('#rootDepartmentId') as HTMLSelectElement | null;
  if (departmentSelect !== null && user.departmentId !== undefined) {
    departmentSelect.value = user.departmentId.toString();
  }

  // Set position
  const positionDropdownValue = $('#positionDropdownValue') as HTMLInputElement;
  const positionDropdownDisplay = $('#positionDropdownDisplay');
  if (user.position !== undefined && user.position !== '') {
    positionDropdownValue.value = user.position;
    const positionSpan = positionDropdownDisplay.querySelector('span');
    if (positionSpan !== null) {
      positionSpan.textContent = user.position;
    }
  }

  // Hide password fields for edit
  const passwordGroup = $('#passwordGroup');
  const passwordConfirmGroup = $('#passwordConfirmGroup');
  passwordGroup.style.display = 'none';
  passwordConfirmGroup.style.display = 'none';

  // Show active status checkbox
  const activeStatusGroup = $('#activeStatusGroup');
  activeStatusGroup.style.display = 'block';
  const checkbox = $('#rootIsActive') as HTMLInputElement;
  checkbox.checked = Boolean(user.isActive);

  const modal = $('#rootModal');
  modal.classList.add('active');
}

function showRootPermissionsModal(_userId: number): void {
  showSuccessAlert('Berechtigungen-Verwaltung wird in Kürze verfügbar sein');
}

async function deleteRootUser(userId: number): Promise<void> {
  if (!confirm('Sind Sie sicher, dass Sie diesen Root-Benutzer löschen möchten?')) {
    return;
  }

  try {
    await apiClient.request(`/root/users/${userId}`, { method: 'DELETE' }, { version: 'v2' });
    showSuccessAlert('Root-Benutzer erfolgreich gelöscht');
    await loadRootUsers();
  } catch (error) {
    showErrorAlert(error instanceof Error ? error.message : 'Fehler beim Löschen des Root-Benutzers');
  }
}

function initializeApp(): void {
  console.log('[RootUsers] Initializing with user ID:', currentUserId);
  void loadRootUsers();
  void loadDepartments();

  const form = $('#rootForm');
  form.addEventListener('submit', (e) => void handleFormSubmit(e));

  // Setup validation listeners
  setupValidationListeners();

  // Event delegation for root user actions
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Handle edit root user
    const editBtn = target.closest<HTMLElement>('[data-action="edit-root-user"]');
    if (editBtn) {
      const userId = editBtn.dataset.userId;
      if (userId !== undefined) {
        void editRootUserHandler(Number.parseInt(userId, 10));
      }
    }

    // Handle show root permissions
    // eslint-disable-next-line max-lines
    const permissionsBtn = target.closest<HTMLElement>('[data-action="show-root-permissions"]');
    if (permissionsBtn) {
      const userId = permissionsBtn.dataset.userId;
      if (userId !== undefined) {
        showRootPermissionsModal(Number.parseInt(userId, 10));
      }
    }

    // Handle delete root user
    const deleteBtn = target.closest<HTMLElement>('[data-action="delete-root-user"]');
    if (deleteBtn) {
      const userId = deleteBtn.dataset.userId;
      if (userId !== undefined) {
        void deleteRootUser(Number.parseInt(userId, 10));
      }
    }
  });
}

// Execute immediately
(() => {
  // Auth check
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('userRole');

  if (token === null || token === '' || userRole !== 'root') {
    window.location.href = '/login';
    return;
  }

  // Get current user ID
  currentUserId = getCurrentUserId();

  // Initialize immediately to prevent tree-shaking
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeApp();
    });
  } else {
    initializeApp();
  }

  // Make functions globally available for event delegation
  (window as unknown as RootUsersWindow).showAddRootModal = showAddRootModal;
  (window as unknown as RootUsersWindow).showAddRootUserModal = showAddRootModal; // Alias for compatibility
  (window as unknown as RootUsersWindow).closeRootModal = closeRootModal;
  (window as unknown as RootUsersWindow).editRootUser = editRootUserHandler;
  (window as unknown as RootUsersWindow).showRootPermissionsModal = showRootPermissionsModal;
  (window as unknown as RootUsersWindow).deleteRootUser = deleteRootUser;
})();
