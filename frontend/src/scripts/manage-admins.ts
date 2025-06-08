// Admin Management TypeScript

// Auth check
const token = localStorage.getItem('token');
const userRole = localStorage.getItem('userRole');

if (!token || userRole !== 'root') {
  window.location.href = '/pages/login.html';
}

interface Admin {
  id: number | string; // API returns string IDs
  username: string;
  email: string;
  full_name?: string;
  role: string;
  tenant_id?: number | string;
  tenant_name?: string;
  position?: string;
  notes?: string;
  created_at: string;
  last_login?: string;
  is_active: boolean;
}

interface Tenant {
  id: number;
  name: string;
  subdomain: string;
}

let currentAdminId: number | null = null;
let admins: Admin[] = [];
let tenants: Tenant[] = [];

// Make functions available globally immediately
// These will be properly defined later
(window as any).editAdmin = null;
(window as any).deleteAdmin = null;

// Logout wird jetzt durch header-user-info.ts gehandhabt

// Admins laden
async function loadAdmins() {
  console.log('loadAdmins called');
  try {
    const token = localStorage.getItem('token');
    console.log('Token available:', !!token);
    const response = await fetch('/api/root/admins', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Response status:', response.status);

    if (response.ok) {
      admins = await response.json();
      console.log('Loaded admins:', admins);
      // Log each admin's is_active status
      admins.forEach((admin: any) => {
        console.log(`Admin ${admin.username} (ID: ${admin.id}) - is_active: ${admin.is_active}`);
      });
      renderAdminTable();
    } else {
      console.error('Fehler beim Laden der Admins:', response.status);
      showError('Admins konnten nicht geladen werden');
    }
  } catch (error) {
    console.error('Fehler:', error);
    showError('Netzwerkfehler beim Laden der Admins');
  }
}

// Tenants laden für Dropdown
async function loadTenants() {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/root/tenants', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      tenants = await response.json();
      updateTenantDropdown();
    }
  } catch (error) {
    console.error('Fehler beim Laden der Tenants:', error);
  }
}

// Helper function to display position names
function getPositionDisplay(position: string): string {
  const positionMap: Record<string, string> = {
    bereichsleiter: 'Bereichsleiter',
    personalleiter: 'Personalleiter',
    geschaeftsfuehrer: 'Geschäftsführer',
    werksleiter: 'Werksleiter',
    produktionsleiter: 'Produktionsleiter',
    qualitaetsleiter: 'Qualitätsleiter',
    'it-leiter': 'IT-Leiter',
    vertriebsleiter: 'Vertriebsleiter',
  };
  return positionMap[position] || position;
}

// Tenant Dropdown aktualisieren
function updateTenantDropdown() {
  const select = document.getElementById('adminTenant') as HTMLSelectElement;
  select.innerHTML = '<option value="">Firma auswählen...</option>';

  tenants.forEach((tenant) => {
    const option = document.createElement('option');
    option.value = tenant.id.toString();
    option.textContent = `${tenant.name} (${tenant.subdomain})`;
    select.appendChild(option);
  });
}

// Admin-Tabelle rendern
function renderAdminTable() {
  console.log('renderAdminTable called');
  const container = document.getElementById('adminTableContent');

  if (!container) {
    console.error('Container adminTableContent not found!');
    return;
  }

  console.log('Container found:', container);

  if (admins.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👤</div>
        <div class="empty-state-text">Keine Administratoren gefunden</div>
        <div class="empty-state-subtext">Fügen Sie Ihren ersten Administrator hinzu</div>
      </div>
    `;
    return;
  }

  const tableHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Benutzername</th>
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
        ${admins
          .map((admin) => {
            const fullName = `${admin.first_name || ''} ${admin.last_name || ''}`.trim() || '-';
            return `
          <tr>
            <td>${admin.id}</td>
            <td>${admin.username}</td>
            <td>${fullName}</td>
            <td>${admin.email || '-'}</td>
            <td>${admin.position ? getPositionDisplay(admin.position) : '-'}</td>
            <td>
              <span class="status-badge ${admin.is_active ? 'active' : 'inactive'}">
                ${admin.is_active ? 'Aktiv' : 'Inaktiv'}
              </span>
            </td>
            <td>${new Date(admin.created_at).toLocaleDateString('de-DE')}</td>
            <td>${admin.last_login ? new Date(admin.last_login).toLocaleDateString('de-DE') : '-'}</td>
            <td>
              <button class="action-btn edit" data-admin-id="${admin.id}">Bearbeiten</button>
              <button class="action-btn delete" data-admin-id="${admin.id}">Löschen</button>
            </td>
          </tr>
        `;
          })
          .join('')}
      </tbody>
    </table>
  `;

  container.innerHTML = tableHTML;

  console.log('Adding event listeners to buttons...');

  // Add event listeners to buttons
  const editButtons = container.querySelectorAll('.action-btn.edit');
  console.log('Found edit buttons:', editButtons.length);
  editButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      console.log('Edit button clicked!');
      const adminId = parseInt((e.target as HTMLElement).getAttribute('data-admin-id') || '0');
      console.log('Admin ID:', adminId);
      if (adminId) editAdminHandler(adminId);
    });
  });

  const deleteButtons = container.querySelectorAll('.action-btn.delete');
  console.log('Found delete buttons:', deleteButtons.length);
  deleteButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      console.log('Delete button clicked!');
      const adminId = parseInt((e.target as HTMLElement).getAttribute('data-admin-id') || '0');
      console.log('Admin ID:', adminId);
      if (adminId) deleteAdminHandler(adminId);
    });
  });
}

// Make functions available globally
declare global {
  interface Window {
    showAddAdminModal: () => void;
    editAdmin: (adminId: number) => Promise<void>;
    deleteAdmin: (adminId: number) => Promise<void>;
    closeAdminModal: () => void;
  }
}

// Define functions before they're used
async function editAdminHandler(adminId: number) {
  currentAdminId = adminId;
  // Convert to string for comparison since API returns string IDs
  const admin = admins.find((a) => String(a.id) === String(adminId));

  if (!admin) return;

  const modal = document.getElementById('adminModal');
  const title = document.getElementById('modalTitle');

  if (title) title.textContent = 'Admin bearbeiten';

  // Formular mit Admin-Daten füllen
  (document.getElementById('adminUsername') as HTMLInputElement).value = admin.username;
  (document.getElementById('adminFirstName') as HTMLInputElement).value = admin.first_name || '';
  (document.getElementById('adminLastName') as HTMLInputElement).value = admin.last_name || '';
  (document.getElementById('adminEmail') as HTMLInputElement).value = admin.email || '';
  (document.getElementById('adminEmailConfirm') as HTMLInputElement).value = admin.email || '';

  // Custom dropdown for position
  const positionValue = admin.position || '';
  (document.getElementById('positionDropdownValue') as HTMLInputElement).value = positionValue;
  const displayText = positionValue ? getPositionDisplay(positionValue) : 'Position auswählen...';
  document.getElementById('positionDropdownDisplay')!.querySelector('span')!.textContent = displayText;

  (document.getElementById('adminNotes') as HTMLTextAreaElement).value = admin.notes || '';

  // Show active status checkbox when editing
  const activeStatusGroup = document.getElementById('activeStatusGroup');
  if (activeStatusGroup) activeStatusGroup.style.display = 'block';

  const isActiveCheckbox = document.getElementById('adminIsActive') as HTMLInputElement;
  const isActive = admin.is_active !== false;
  console.log('Setting checkbox for edit - admin.is_active:', admin.is_active, 'checkbox will be:', isActive);
  isActiveCheckbox.checked = isActive;

  // Hide password fields when editing (optional password change)
  const passwordGroup = document.getElementById('passwordGroup');
  const passwordConfirmGroup = document.getElementById('passwordConfirmGroup');
  if (passwordGroup) passwordGroup.style.display = 'none';
  if (passwordConfirmGroup) passwordConfirmGroup.style.display = 'none';

  // Passwort-Felder als optional setzen beim Bearbeiten
  const passwordField = document.getElementById('adminPassword') as HTMLInputElement;
  const passwordConfirmField = document.getElementById('adminPasswordConfirm') as HTMLInputElement;
  passwordField.required = false;
  passwordConfirmField.required = false;
  passwordField.value = '';
  passwordConfirmField.value = '';

  modal?.classList.add('active');
}

async function deleteAdminHandler(adminId: number) {
  console.log('deleteAdminHandler called with ID:', adminId);
  console.log('Current admins array:', admins);
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

  console.log('Found admin:', admin);

  if (!confirm(`Möchten Sie den Administrator "${admin.username}" wirklich löschen?`)) {
    console.log('Delete cancelled by user');
    return;
  }

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/root/admins/${adminId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      showSuccess('Administrator erfolgreich gelöscht');
      await loadAdmins();
    } else {
      const error = await response.json();
      showError(error.message || 'Fehler beim Löschen des Administrators');
    }
  } catch (error) {
    console.error('Fehler:', error);
    showError('Netzwerkfehler beim Löschen');
  }
}

// Admin hinzufügen Modal anzeigen
window.showAddAdminModal = function () {
  currentAdminId = null;
  const modal = document.getElementById('adminModal');
  const title = document.getElementById('modalTitle');
  const form = document.getElementById('adminForm') as HTMLFormElement;

  if (title) title.textContent = 'Admin hinzufügen';
  form.reset();

  // Reset custom dropdown
  (document.getElementById('positionDropdownValue') as HTMLInputElement).value = '';
  document.getElementById('positionDropdownDisplay')!.querySelector('span')!.textContent = 'Position auswählen...';

  // Hide active status checkbox for new admins (they are always active)
  const activeStatusGroup = document.getElementById('activeStatusGroup');
  if (activeStatusGroup) activeStatusGroup.style.display = 'none';

  // Passwort-Felder als required setzen für neue Admins
  const passwordField = document.getElementById('adminPassword') as HTMLInputElement;
  const passwordConfirmField = document.getElementById('adminPasswordConfirm') as HTMLInputElement;
  passwordField.required = true;
  passwordConfirmField.required = true;

  // Show password fields for new admin
  const passwordGroup = document.getElementById('passwordGroup');
  const passwordConfirmGroup = document.getElementById('passwordConfirmGroup');
  if (passwordGroup) passwordGroup.style.display = 'block';
  if (passwordConfirmGroup) passwordConfirmGroup.style.display = 'block';

  modal?.classList.add('active');
};

// Modal schließen
window.closeAdminModal = function () {
  const modal = document.getElementById('adminModal');
  modal?.classList.remove('active');
  currentAdminId = null;
};

// Admin-Formular submit
document.getElementById('adminForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Validate email match
  const email = (document.getElementById('adminEmail') as HTMLInputElement).value;
  const emailConfirm = (document.getElementById('adminEmailConfirm') as HTMLInputElement).value;
  if (email !== emailConfirm) {
    showError('Die E-Mail-Adressen stimmen nicht überein!');
    return;
  }

  // Validate password match (only for new admins or if password is being changed)
  const password = (document.getElementById('adminPassword') as HTMLInputElement).value;
  const passwordConfirm = (document.getElementById('adminPasswordConfirm') as HTMLInputElement).value;
  if (password && password !== passwordConfirm) {
    showError('Die Passwörter stimmen nicht überein!');
    return;
  }

  const formData: any = {
    username: (document.getElementById('adminUsername') as HTMLInputElement).value,
    first_name: (document.getElementById('adminFirstName') as HTMLInputElement).value,
    last_name: (document.getElementById('adminLastName') as HTMLInputElement).value,
    email: email,
    password: password,
    position: (document.getElementById('positionDropdownValue') as HTMLInputElement).value,
    notes: (document.getElementById('adminNotes') as HTMLTextAreaElement).value,
    role: 'admin',
  };

  // Include is_active only when updating
  if (currentAdminId) {
    const checkbox = document.getElementById('adminIsActive') as HTMLInputElement;
    console.log('Checkbox element:', checkbox);
    console.log('Checkbox checked state:', checkbox.checked);
    formData.is_active = checkbox.checked;
  }

  console.log('Sending form data:', formData);
  console.log('Current admin ID:', currentAdminId);
  console.log('is_active value being sent:', formData.is_active);

  try {
    const token = localStorage.getItem('token');
    const url = currentAdminId ? `/api/root/admins/${currentAdminId}` : '/api/root/admins';

    const method = currentAdminId ? 'PUT' : 'POST';

    // Bei Update: Passwort nur senden wenn ausgefüllt
    if (currentAdminId && !formData.password) {
      delete formData.password;
    }

    const response = await fetch(url, {
      method: method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    });

    if (response.ok) {
      showSuccess(currentAdminId ? 'Administrator aktualisiert' : 'Administrator hinzugefügt');
      window.closeAdminModal();
      await loadAdmins();
    } else {
      const error = await response.json();
      showError(error.message || 'Fehler beim Speichern');
    }
  } catch (error) {
    console.error('Fehler:', error);
    showError('Netzwerkfehler beim Speichern');
  }
});

// Hilfsfunktionen für Benachrichtigungen
function showError(message: string) {
  alert('Fehler: ' + message); // TODO: Bessere Notification implementieren
}

function showSuccess(message: string) {
  alert('Erfolg: ' + message); // TODO: Bessere Notification implementieren
}

// Modal schließen bei Klick außerhalb
window.addEventListener('click', (e) => {
  const modal = document.getElementById('adminModal');
  if (e.target === modal) {
    closeAdminModal();
  }
});

// Initialisierung
document.addEventListener('DOMContentLoaded', async () => {
  // Prüfen ob User eingeloggt ist
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('userRole');

  if (!token || userRole !== 'root') {
    window.location.href = '/pages/login.html';
    return;
  }

  // Assign global functions to handlers after DOM is ready
  window.editAdmin = editAdminHandler;
  window.deleteAdmin = deleteAdminHandler;

  // Daten laden
  await loadAdmins();
  await loadTenants();
});
