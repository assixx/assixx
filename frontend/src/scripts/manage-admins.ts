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
  first_name?: string;
  last_name?: string;
  role: string;
  tenant_id?: number | string;
  tenant_name?: string;
  position?: string;
  notes?: string;
  created_at: string;
  last_login?: string;
  is_active: boolean;
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

interface DepartmentGroup {
  id: number;
  name: string;
  description?: string;
  parent_group_id?: number;
  departments?: Department[];
  subgroups?: DepartmentGroup[];
}

interface Tenant {
  id: number;
  name?: string;
  company_name?: string;
  subdomain: string;
}

let currentAdminId: number | null = null;
let admins: Admin[] = [];
let tenants: Tenant[] = [];

// Make functions available globally immediately
// These will be properly defined later
(window as any).editAdmin = null;
(window as any).deleteAdmin = null;
(window as any).showAddAdminModal = null;
(window as any).closeAdminModal = null;

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
      
      // Load permissions for each admin
      for (const admin of admins) {
        try {
          const perms = await loadAdminPermissions(parseInt(admin.id.toString()));
          console.log(`Permissions for admin ${admin.id}:`, perms);
          admin.departments = perms.departments;
          admin.hasAllAccess = perms.hasAllAccess;
        } catch (error) {
          console.error(`Error loading permissions for admin ${admin.id}:`, error);
          admin.departments = [];
          admin.hasAllAccess = false;
        }
      }
      
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
      console.log('Loaded tenants:', tenants);
      updateTenantDropdown();
    } else {
      console.error('Error loading tenants - status:', response.status);
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

// Helper function to display departments badge
function getDepartmentsBadge(admin: Admin): string {
  console.log(`Getting badge for admin ${admin.id}:`, {
    hasAllAccess: admin.hasAllAccess,
    departments: admin.departments,
    departmentCount: admin.departments ? admin.departments.length : 0
  });
  
  if (admin.hasAllAccess) {
    return '<span class="status-badge active" style="background: rgba(76, 175, 80, 0.2); color: #4caf50; border-color: rgba(76, 175, 80, 0.3);">Alle Abteilungen</span>';
  } else if (admin.departments && admin.departments.length > 0) {
    const departmentNames = admin.departments.map(d => d.name).join(', ');
    const singularPlural = admin.departments.length === 1 ? 'Abteilung' : 'Abteilungen';
    return `
      <span class="status-badge department-badge" 
            style="background: rgba(33, 150, 243, 0.2); color: #2196f3; border-color: rgba(33, 150, 243, 0.3); cursor: help; position: relative;" 
            data-departments="${departmentNames.replace(/"/g, '&quot;')}">
        ${admin.departments.length} ${singularPlural}
        <span class="department-tooltip" style="
          display: none;
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-bottom: 8px;
          padding: 8px 12px;
          background: rgba(18, 18, 18, 0.95);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          white-space: nowrap;
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
          color: #fff;
          font-size: 12px;
          font-weight: normal;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          z-index: 1000;
          pointer-events: none;
        ">${departmentNames}</span>
      </span>
    `;
  } else {
    return '<span class="status-badge inactive" style="background: rgba(255, 152, 0, 0.2); color: #ff9800; border-color: rgba(255, 152, 0, 0.3);">Keine Abteilungen</span>';
  }
}

// Tenant Dropdown aktualisieren
function updateTenantDropdown() {
  const select = document.getElementById('adminTenant') as HTMLSelectElement;
  if (!select) {
    console.log('Tenant dropdown not found - skipping update');
    return;
  }
  
  select.innerHTML = '<option value="">Firma auswählen...</option>';

  if (!tenants || !Array.isArray(tenants)) {
    console.error('Tenants is not an array:', tenants);
    return;
  }

  tenants.forEach((tenant) => {
    if (!tenant) return;
    const option = document.createElement('option');
    option.value = tenant.id.toString();
    option.textContent = `${tenant.company_name || tenant.name || 'Unnamed'} (${tenant.subdomain})`;
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
          <th>Abteilungen</th>
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
            <td>${getDepartmentsBadge(admin)}</td>
            <td>
              <span class="status-badge ${admin.is_active ? 'active' : 'inactive'}">
                ${admin.is_active ? 'Aktiv' : 'Inaktiv'}
              </span>
            </td>
            <td>${new Date(admin.created_at).toLocaleDateString('de-DE')}</td>
            <td>${admin.last_login ? new Date(admin.last_login).toLocaleDateString('de-DE') : '-'}</td>
            <td>
              <button class="action-btn edit" data-admin-id="${admin.id}">Bearbeiten</button>
              <button class="action-btn permissions" data-admin-id="${admin.id}" style="border-color: rgba(76, 175, 80, 0.3); background: rgba(76, 175, 80, 0.1);">Berechtigungen</button>
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

  const permissionButtons = container.querySelectorAll('.action-btn.permissions');
  console.log('Found permission buttons:', permissionButtons.length);
  permissionButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      console.log('🔵 Permission button clicked!');
      const target = e.target as HTMLElement;
      const button = target.closest('.action-btn.permissions') as HTMLElement;
      const adminId = parseInt(button?.getAttribute('data-admin-id') || '0');
      console.log('Admin ID from button:', adminId);
      if (adminId) {
        e.preventDefault();
        e.stopPropagation();
        showPermissionsModal(adminId);
      }
    });
  });

  // Add hover event listeners for department badges
  const departmentBadges = container.querySelectorAll('.department-badge');
  departmentBadges.forEach((badge) => {
    badge.addEventListener('mouseenter', (e) => {
      const tooltip = (e.target as HTMLElement).querySelector('.department-tooltip');
      if (tooltip) {
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
    });
  });
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

  // Load current department assignments
  console.log('🔵 Loading department assignments for admin:', adminId);
  console.log('Admin departments:', admin.departments);
  console.log('Admin hasAllAccess:', admin.hasAllAccess);
  
  // Reset all permission type radio buttons
  document.querySelectorAll('input[name="permissionType"]').forEach(radio => {
    (radio as HTMLInputElement).checked = false;
  });
  
  // Hide all containers first
  const deptContainer = document.getElementById('departmentSelectContainer');
  const groupContainer = document.getElementById('groupSelectContainer');
  if (deptContainer) deptContainer.style.display = 'none';
  if (groupContainer) groupContainer.style.display = 'none';
  
  // Set the appropriate permission type based on current assignments
  if (admin.hasAllAccess) {
    const allRadio = document.querySelector('input[name="permissionType"][value="all"]') as HTMLInputElement;
    if (allRadio) {
      allRadio.checked = true;
      console.log('✅ Set permission type to: all');
    }
  } else if (admin.departments && admin.departments.length > 0) {
    const specificRadio = document.querySelector('input[name="permissionType"][value="specific"]') as HTMLInputElement;
    if (specificRadio) {
      specificRadio.checked = true;
      console.log('✅ Set permission type to: specific');
      
      // Show department container and load departments
      if (deptContainer) {
        deptContainer.style.display = 'block';
        await loadAndPopulateDepartments();
        
        // Select current departments
        const deptSelect = document.getElementById('departmentSelect') as HTMLSelectElement;
        if (deptSelect) {
          // Clear all selections first
          Array.from(deptSelect.options).forEach(option => option.selected = false);
          
          // Select assigned departments
          admin.departments.forEach(dept => {
            const option = Array.from(deptSelect.options).find(
              opt => opt.value === dept.id.toString()
            );
            if (option) {
              option.selected = true;
              console.log('✅ Selected department:', dept.name);
            }
          });
        }
      }
    }
  } else {
    const noneRadio = document.querySelector('input[name="permissionType"][value="none"]') as HTMLInputElement;
    if (noneRadio) {
      noneRadio.checked = true;
      console.log('✅ Set permission type to: none');
    }
  }

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
(window as any).showAddAdminModal = function () {
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
(window as any).closeAdminModal = function () {
  const modal = document.getElementById('adminModal');
  modal?.classList.remove('active');
  currentAdminId = null;
};

// Permissions Modal schließen
(window as any).closePermissionsModal = function () {
  console.log('🔵 closePermissionsModal called');
  const modal = document.getElementById('permissionsModal');
  if (modal) {
    modal.classList.remove('active');
    currentPermissionAdminId = null;
  }
};

// Department Permission Handling Functions
async function loadDepartments(): Promise<Department[]> {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/departments', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Fehler beim Laden der Abteilungen:', error);
  }
  return [];
}

async function loadDepartmentGroups(): Promise<DepartmentGroup[]> {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/department-groups/hierarchy', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const result = await response.json();
      return result.data || [];
    }
  } catch (error) {
    console.error('Fehler beim Laden der Abteilungsgruppen:', error);
  }
  return [];
}

// Load admin permissions
async function loadAdminPermissions(adminId: number): Promise<{departments: Department[], hasAllAccess: boolean}> {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/admin-permissions/${adminId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`Raw API response for admin ${adminId}:`, result);
      
      // Handle the wrapped response structure
      if (result.success && result.data) {
        return result.data;
      } else if (result.departments !== undefined) {
        // Fallback for direct structure
        return result;
      }
    }
  } catch (error) {
    console.error('Fehler beim Laden der Admin-Berechtigungen:', error);
  }
  return { departments: [], hasAllAccess: false };
}

// Handle permission type radio change
function handlePermissionTypeChange() {
  const type = (document.querySelector('input[name="permissionType"]:checked') as HTMLInputElement)?.value;
  const departmentContainer = document.getElementById('departmentSelectContainer');
  const groupContainer = document.getElementById('groupSelectContainer');

  if (departmentContainer) departmentContainer.style.display = type === 'specific' ? 'block' : 'none';
  if (groupContainer) groupContainer.style.display = type === 'groups' ? 'block' : 'none';

  if (type === 'specific') {
    loadAndPopulateDepartments();
  } else if (type === 'groups') {
    loadAndPopulateGroups();
  }
}

// Load and populate departments
async function loadAndPopulateDepartments() {
  const departments = await loadDepartments();
  const select = document.getElementById('departmentSelect') as HTMLSelectElement;
  
  if (select) {
    select.innerHTML = '';
    departments.forEach(dept => {
      const option = document.createElement('option');
      option.value = dept.id.toString();
      option.textContent = dept.name;
      select.appendChild(option);
    });
  }
}

// Load and populate groups
async function loadAndPopulateGroups() {
  const groups = await loadDepartmentGroups();
  const container = document.getElementById('groupTreeView');
  
  if (container) {
    container.innerHTML = renderGroupTree(groups);
  }
}

// Render group tree
function renderGroupTree(groups: DepartmentGroup[], level: number = 0): string {
  return groups.map(group => `
    <div style="margin-left: ${level * 20}px; margin-bottom: 8px;">
      <label style="display: flex; align-items: center; cursor: pointer;">
        <input type="checkbox" name="groupSelect" value="${group.id}" style="margin-right: 8px;" />
        <span>${group.name}</span>
        ${group.departments && group.departments.length > 0 ? 
          `<small style="margin-left: 8px; color: var(--text-secondary);">(${group.departments.length} Abteilungen)</small>` : ''}
      </label>
      ${group.subgroups && group.subgroups.length > 0 ? renderGroupTree(group.subgroups, level + 1) : ''}
    </div>
  `).join('');
}

// Current admin ID for permissions modal
let currentPermissionAdminId: number | null = null;

// Show permissions modal
async function showPermissionsModal(adminId: number) {
  console.log('🔵 showPermissionsModal called for admin ID:', adminId);
  currentPermissionAdminId = adminId;
  const admin = admins.find(a => parseInt(a.id.toString()) === adminId);
  
  if (!admin) {
    console.error('Admin not found for ID:', adminId);
    return;
  }
  
  console.log('Found admin:', admin);
  
  // Set admin info
  const nameEl = document.getElementById('permAdminName');
  const emailEl = document.getElementById('permAdminEmail');
  
  if (nameEl) nameEl.textContent = `${admin.first_name || ''} ${admin.last_name || ''} (${admin.username})`.trim();
  if (emailEl) emailEl.textContent = admin.email || '-';
  
  // Load departments and current permissions
  await loadPermissionsModalData(adminId);
  
  // Ensure departments tab is active by default
  const deptTab = document.querySelector('[data-tab="departments"]') as HTMLElement;
  const groupTab = document.querySelector('[data-tab="groups"]') as HTMLElement;
  const deptContent = document.getElementById('departmentsTab') as HTMLElement;
  const groupContent = document.getElementById('groupsTab') as HTMLElement;
  
  if (deptTab && groupTab && deptContent && groupContent) {
    // Reset all tabs
    deptTab.classList.add('active');
    deptTab.style.borderBottomColor = 'var(--primary-color)';
    deptTab.style.color = 'var(--text-primary)';
    
    groupTab.classList.remove('active');
    groupTab.style.borderBottomColor = 'transparent';
    groupTab.style.color = 'var(--text-secondary)';
    
    // Show departments content, hide groups
    deptContent.style.display = 'block';
    groupContent.style.display = 'none';
  }
  
  // Show modal
  const modal = document.getElementById('permissionsModal');
  if (modal) {
    modal.classList.add('active');
    console.log('✅ Permissions modal opened with departments tab active');
  } else {
    console.error('❌ Permissions modal element not found!');
  }
}

// Load data for permissions modal
async function loadPermissionsModalData(adminId: number) {
  console.log('🔵 loadPermissionsModalData called for admin:', adminId);
  try {
    // Load all departments
    const departments = await loadDepartments();
    console.log('Available departments:', departments);
    
    const groups = await loadDepartmentGroups();
    
    // Load current permissions
    const currentPerms = await loadAdminPermissions(adminId);
    console.log('Current permissions:', currentPerms);
    
    // Render departments
    const deptList = document.getElementById('permissionDepartmentList');
    if (deptList) {
      deptList.innerHTML = departments.map(dept => {
        const hasPermission = currentPerms.departments.some(d => d.id === dept.id);
        return `
          <label style="display: flex; align-items: center; padding: 8px; cursor: pointer; border-radius: 4px; transition: background 0.2s;" 
                 onmouseover="this.style.background='rgba(255,255,255,0.02)'" 
                 onmouseout="this.style.background='transparent'">
            <input type="checkbox" name="deptPermission" value="${dept.id}" 
                   ${hasPermission ? 'checked' : ''} 
                   style="margin-right: 8px;" />
            <span>${dept.name}</span>
            ${dept.description ? `<small style="margin-left: 8px; color: var(--text-secondary);">${dept.description}</small>` : ''}
          </label>
        `;
      }).join('');
    }
    
    // Render groups
    const groupList = document.getElementById('permissionGroupList');
    if (groupList) {
      groupList.innerHTML = renderGroupTree(groups);
    }
    
    // Set permission levels
    if (currentPerms.departments.length > 0) {
      const firstDept = currentPerms.departments[0];
      (document.getElementById('permCanWrite') as HTMLInputElement).checked = firstDept.can_write || false;
      (document.getElementById('permCanDelete') as HTMLInputElement).checked = firstDept.can_delete || false;
    }
  } catch (error) {
    console.error('Error loading permissions modal data:', error);
  }
}

// Save permissions handler
(window as any).savePermissionsHandler = async function() {
  console.log('🔵 savePermissionsHandler called');
  console.log('currentPermissionAdminId:', currentPermissionAdminId);
  
  if (!currentPermissionAdminId) {
    console.error('❌ No currentPermissionAdminId set');
    return;
  }
  
  try {
    const token = localStorage.getItem('token');
    console.log('🔵 Saving permissions for admin:', currentPermissionAdminId);
    
    // Get selected departments
    const selectedDepts = Array.from(
      document.querySelectorAll('#permissionDepartmentList input[name="deptPermission"]:checked')
    ).map(cb => parseInt((cb as HTMLInputElement).value));
    
    console.log('Selected departments:', selectedDepts);
    
    // Get selected groups
    const selectedGroups = Array.from(
      document.querySelectorAll('#permissionGroupList input[name="groupSelect"]:checked')
    ).map(cb => parseInt((cb as HTMLInputElement).value));
    
    console.log('Selected groups:', selectedGroups);
    
    // Get permission levels
    const permissions = {
      can_read: true,
      can_write: (document.getElementById('permCanWrite') as HTMLInputElement).checked,
      can_delete: (document.getElementById('permCanDelete') as HTMLInputElement).checked
    };
    
    console.log('Permissions:', permissions);
    
    // Update department permissions
    const requestBody = {
      adminId: currentPermissionAdminId,
      departmentIds: selectedDepts,
      permissions
    };
    
    console.log('Request body:', requestBody);
    console.log('Token exists:', !!token);
    console.log('Making request to:', '/api/admin-permissions');
    
    const deptResponse = await fetch('/api/admin-permissions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    console.log('Department response status:', deptResponse.status);
    
    if (!deptResponse.ok) {
      const errorData = await deptResponse.json();
      console.error('❌ Department response error:', errorData);
    } else {
      const responseData = await deptResponse.json();
      console.log('✅ Department permissions saved successfully:', responseData);
    }
    
    // Update group permissions if any selected
    if (selectedGroups.length > 0) {
      const groupResponse = await fetch('/api/admin-permissions/groups', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminId: currentPermissionAdminId,
          groupIds: selectedGroups,
          permissions
        }),
      });
      
      console.log('Group response status:', groupResponse.status);
      
      if (!groupResponse.ok) {
        const errorData = await groupResponse.json();
        console.error('Group response error:', errorData);
      }
    }
    
    if (deptResponse.ok) {
      console.log('✅ Permissions saved successfully, reloading page...');
      showSuccess('Berechtigungen erfolgreich aktualisiert');
      (window as any).closePermissionsModal();
      // Seite neu laden für vollständige Aktualisierung
      window.location.reload();
    } else {
      console.error('❌ Failed to save permissions');
      showError('Fehler beim Speichern der Berechtigungen');
    }
  } catch (error) {
    console.error('Error saving permissions:', error);
    showError('Netzwerkfehler beim Speichern');
  }
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
      const result = await response.json();
      const adminId = currentAdminId || result.adminId || result.id;
      
      // Set permissions for both new and existing admins
      const permissionType = (document.querySelector('input[name="permissionType"]:checked') as HTMLInputElement)?.value;
      console.log('🔵 Permission type selected:', permissionType);
      
      if (adminId && permissionType) {
        // Always update permissions based on form selection
        if (permissionType !== 'none') {
          let departmentIds: number[] = [];
          let groupIds: number[] = [];
          
          if (permissionType === 'specific') {
            const select = document.getElementById('departmentSelect') as HTMLSelectElement;
            departmentIds = Array.from(select.selectedOptions).map(opt => parseInt(opt.value));
          } else if (permissionType === 'groups') {
            const checkboxes = document.querySelectorAll('input[name="groupSelect"]:checked');
            groupIds = Array.from(checkboxes).map(cb => parseInt((cb as HTMLInputElement).value));
          } else if (permissionType === 'all') {
            // Get all departments
            const allDepts = await loadDepartments();
            departmentIds = allDepts.map(d => d.id);
          }
          
          // Set permissions
          console.log('🔵 Setting department permissions for admin:', adminId);
          console.log('Department IDs:', departmentIds);
          
          const permResponse = await fetch('/api/admin-permissions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              adminId: adminId,
              departmentIds: departmentIds,
              permissions: { can_read: true, can_write: false, can_delete: false }
            }),
          });
          
          if (permResponse.ok) {
            console.log('✅ Department permissions updated successfully');
          } else {
            console.error('❌ Failed to update department permissions');
          }
          
          if (groupIds.length > 0) {
            await fetch('/api/admin-permissions/groups', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                adminId: adminId,
                groupIds: groupIds,
                permissions: { can_read: true, can_write: false, can_delete: false }
              }),
            });
          }
        } else {
          // Permission type is 'none' - remove all permissions
          console.log('🔵 Removing all department permissions for admin:', adminId);
          
          const permResponse = await fetch('/api/admin-permissions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              adminId: adminId,
              departmentIds: [], // Empty array removes all permissions
              permissions: { can_read: true, can_write: false, can_delete: false }
            }),
          });
          
          if (permResponse.ok) {
            console.log('✅ All department permissions removed');
          } else {
            console.error('❌ Failed to remove department permissions');
          }
        }
      }
      
      showSuccess(currentAdminId ? 'Administrator aktualisiert' : 'Administrator hinzugefügt');
      (window as any).closeAdminModal();
      // Seite neu laden für vollständige Aktualisierung
      window.location.reload();
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
    (window as any).closeAdminModal();
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
  (window as any).editAdmin = editAdminHandler;
  (window as any).deleteAdmin = deleteAdminHandler;

  // Daten laden
  await loadAdmins();
  await loadTenants();
  
  // Add event listeners for permission type radio buttons
  document.querySelectorAll('input[name="permissionType"]').forEach(radio => {
    radio.addEventListener('change', handlePermissionTypeChange);
  });
});
