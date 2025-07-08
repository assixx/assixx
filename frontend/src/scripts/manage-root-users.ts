/**
 * Root User Management Script
 * Verwaltet Root-Benutzer im System
 */

import { fetchWithAuth, showSuccess, showError } from './auth';

interface RootUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  position?: string;
  notes?: string;
  employee_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

let currentEditId: number | null = null;

// Load root users on page load
async function loadRootUsers() {
  try {
    const response = await fetchWithAuth('/api/root/users');
    if (!response.ok) {
      throw new Error('Fehler beim Laden der Root-Benutzer');
    }

    const data = await response.json();
    // successResponse wraps data in data property
    const rootUsers = data.data?.users || data.users || [];

    displayRootUsers(rootUsers);
  } catch (error) {
    console.error('Error loading root users:', error);
    showError('Fehler beim Laden der Root-Benutzer');
  }
}

// Display root users in table
function displayRootUsers(users: RootUser[]) {
  const container = document.getElementById('rootTableContent');
  if (!container) return;

  if (users.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i class="fas fa-user-shield"></i>
        </div>
        <div class="empty-state-text">Keine Root-Benutzer vorhanden</div>
        <div class="empty-state-subtext">
          Klicken Sie auf den + Button, um einen Root-Benutzer hinzuzufügen
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <table class="root-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>E-Mail</th>
          <th>Position</th>
          <th>Status</th>
          <th>Employee ID</th>
          <th>Erstellt am</th>
        </tr>
      </thead>
      <tbody>
        ${users
          .map(
            (user) => `
          <tr>
            <td>${user.first_name} ${user.last_name}</td>
            <td>${user.email}</td>
            <td>${user.position || '-'}</td>
            <td>
              <span class="status-badge ${user.is_active ? 'active' : 'inactive'}">
                ${user.is_active ? 'Aktiv' : 'Inaktiv'}
              </span>
            </td>
            <td style="font-family: monospace; font-size: 12px; color: var(--text-secondary);">
              ${user.employee_id || '-'}
            </td>
            <td>${new Date(user.created_at).toLocaleDateString('de-DE')}</td>
          </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>
    <div style="margin-top: 16px; padding: 12px; background: rgba(33, 150, 243, 0.05); border-radius: 8px; border: 1px solid rgba(33, 150, 243, 0.2);">
      <div class="approval-badge">
        <i class="fas fa-user-friends"></i>
        <span>Zwei-Personen-Prinzip aktiv für kritische Operationen</span>
      </div>
    </div>
    <div style="margin-top: 12px; padding: 12px; background: rgba(255, 255, 255, 0.02); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);">
      <p style="margin: 0; color: var(--text-secondary); font-size: 14px;">
        <i class="fas fa-info-circle" style="margin-right: 8px; color: var(--primary-color);"></i>
        Root-User können ihr eigenes Profil über <a href="/pages/root-profile.html" style="color: var(--primary-color); text-decoration: underline;">Mein Profil</a> bearbeiten.
      </p>
    </div>
  `;
}

// Handle form submission
async function handleFormSubmit(event: Event) {
  event.preventDefault();

  const firstName = (document.getElementById('rootFirstName') as HTMLInputElement).value;
  const lastName = (document.getElementById('rootLastName') as HTMLInputElement).value;
  const email = (document.getElementById('rootEmail') as HTMLInputElement).value;
  const emailConfirm = (document.getElementById('rootEmailConfirm') as HTMLInputElement).value;
  const password = (document.getElementById('rootPassword') as HTMLInputElement).value;
  const passwordConfirm = (document.getElementById('rootPasswordConfirm') as HTMLInputElement).value;
  const position = (document.getElementById('positionDropdownValue') as HTMLInputElement).value;
  const notes = (document.getElementById('rootNotes') as HTMLTextAreaElement).value;
  const isActive = (document.getElementById('rootIsActive') as HTMLInputElement)?.checked ?? true;

  // Validation
  if (email !== emailConfirm) {
    showError('E-Mail-Adressen stimmen nicht überein');
    return;
  }

  if (!currentEditId && password !== passwordConfirm) {
    showError('Passwörter stimmen nicht überein');
    return;
  }

  if (!currentEditId && password.length < 8) {
    showError('Passwort muss mindestens 8 Zeichen lang sein');
    return;
  }

  interface UserData {
    first_name: string;
    last_name: string;
    email: string;
    position?: string;
    notes?: string;
    is_active?: boolean;
    username?: string;
    password?: string;
  }

  const userData: UserData = {
    first_name: firstName,
    last_name: lastName,
    email: email,
    position: position,
    notes: notes,
    is_active: currentEditId ? isActive : true, // New users are always active
  };

  if (!currentEditId) {
    userData.password = password;
    userData.username = email; // Username is email for root users
  }

  try {
    const url = currentEditId ? `/api/root/users/${currentEditId}` : '/api/root/users';

    const method = currentEditId ? 'PUT' : 'POST';

    const response = await fetchWithAuth(url, {
      method: method,
      body: JSON.stringify(userData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Fehler beim Speichern');
    }

    showSuccess(currentEditId ? 'Root-Benutzer aktualisiert' : 'Root-Benutzer erstellt');
    closeRootModal();
    loadRootUsers();
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Fehler beim Speichern des Root-Benutzers');
  }
}

// Note: Edit and Delete functions removed - Root users manage their own profile via /pages/root-profile.html

// Close modal and reset
function closeRootModal() {
  const modal = document.getElementById('rootModal');
  if (modal) {
    modal.classList.remove('active');
  }
  currentEditId = null;
  (document.getElementById('rootForm') as HTMLFormElement).reset();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  loadRootUsers();

  // Attach form submit handler
  const form = document.getElementById('rootForm');
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }
});

// Make functions available globally for onclick handlers
declare global {
  interface Window {
    showAddRootModal: () => void;
    closeRootModal: () => void;
  }
}

window.showAddRootModal = () => {
  currentEditId = null;
  const modalTitle = document.getElementById('modalTitle');
  if (modalTitle) modalTitle.textContent = 'Root User hinzufügen';

  const rootForm = document.getElementById('rootForm') as HTMLFormElement;
  if (rootForm) rootForm.reset();

  const positionDropdown = document.getElementById('positionDropdownDisplay');
  const positionSpan = positionDropdown?.querySelector('span');
  if (positionSpan) positionSpan.textContent = 'Position auswählen...';

  const passwordGroup = document.getElementById('passwordGroup');
  if (passwordGroup) passwordGroup.style.display = 'block';

  const passwordConfirmGroup = document.getElementById('passwordConfirmGroup');
  if (passwordConfirmGroup) passwordConfirmGroup.style.display = 'block';

  const activeStatusGroup = document.getElementById('activeStatusGroup');
  if (activeStatusGroup) activeStatusGroup.style.display = 'none';

  const rootModal = document.getElementById('rootModal');
  if (rootModal) rootModal.classList.add('active');
};
window.closeRootModal = closeRootModal;
