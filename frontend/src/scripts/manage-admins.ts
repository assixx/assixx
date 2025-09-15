// Admin Management TypeScript
import { ApiClient } from '../utils/api-client';
import { mapUsers, type MappedUser, type UserAPIResponse } from '../utils/api-mappers';
import { $, $$, $all, setHTML } from '../utils/dom-utils';
import { showSuccessAlert, showErrorAlert } from './utils/alerts';

(() => {
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

  // API Endpoints
  const API_ENDPOINTS = {
    ADMIN_PERMISSIONS: '/api/admin-permissions',
    ADMIN_PERMISSIONS_GROUPS: '/api/admin-permissions/groups',
    USERS_ME: '/users/me',
  } as const;

  // Initialize API Client
  const apiClient = ApiClient.getInstance();

  // Check feature flag for v2 API - manage-admins uses ROOT endpoints
  const w = window as Window & { FEATURE_FLAGS?: { USE_API_V2_ROOT?: boolean } };
  const useV2API = w.FEATURE_FLAGS?.USE_API_V2_ROOT === true;

  // Auth check
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('userRole');

  if (token === null || token === '' || userRole !== 'root') {
    window.location.href = '/login';
    return;
  }

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
  interface ManageAdminsWindow extends Window {
    editAdmin: typeof editAdminHandler | null;
    deleteAdmin: typeof deleteAdminHandler | null;
    showPermissionsModal: typeof showPermissionsModal | null;
    showAddAdminModal: (() => void) | null;
    closeAdminModal: (() => void) | null;
    closePermissionsModal: (() => void) | null;
    savePermissionsHandler: (() => Promise<void>) | null;
  }

  (window as unknown as ManageAdminsWindow).editAdmin = null;
  (window as unknown as ManageAdminsWindow).deleteAdmin = null;
  (window as unknown as ManageAdminsWindow).showPermissionsModal = null;
  (window as unknown as ManageAdminsWindow).showAddAdminModal = null;
  (window as unknown as ManageAdminsWindow).closeAdminModal = null;

  // Logout wird jetzt durch header-user-info.ts gehandhabt

  // Admins laden
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

  // Tenants laden für Dropdown
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
      return '<span class="status-badge active" style="background: rgba(76, 175, 80, 0.2); color: #4caf50; border-color: rgba(76, 175, 80, 0.3); white-space: nowrap;">Alle Abteilungen</span>';
    } else if (admin.departments !== undefined && admin.departments.length > 0) {
      const departmentNames = admin.departments.map((d) => d.name).join(', ');
      const singularPlural = admin.departments.length === 1 ? 'Abteilung' : 'Abteilungen';
      return `
      <span class="status-badge department-badge"
            style="background: rgba(33, 150, 243, 0.2); color: #2196f3; border-color: rgba(33, 150, 243, 0.3); cursor: help; position: relative; white-space: nowrap;"
            data-departments="${departmentNames.replace(/"/g, '&quot;')}">
        ${String(admin.departments.length)} ${singularPlural}
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
      return '<span class="status-badge inactive" style="background: rgba(255, 152, 0, 0.2); color: #ff9800; border-color: rgba(255, 152, 0, 0.3); white-space: nowrap;">Keine Abteilungen</span>';
    }
  }

  // Tenant Dropdown aktualisieren
  function updateTenantDropdown() {
    const select = $$('#adminTenant') as HTMLSelectElement | null;
    if (select === null) {
      console.info('Tenant dropdown not found - skipping update');
      return;
    }

    select.innerHTML = '<option value="">Firma auswählen...</option>';

    if (!Array.isArray(tenants)) {
      console.error('Tenants is not an array:', tenants);
      return;
    }

    tenants.forEach((tenant) => {
      const option = document.createElement('option');
      option.value = tenant.id.toString();
      option.textContent = `${tenant.company_name ?? tenant.name ?? 'Unnamed'} (${tenant.subdomain})`;
      select.append(option);
    });
  }

  // Admin-Tabelle rendern
  function renderAdminTable() {
    console.info('renderAdminTable called');
    const container = $$('#adminTableContent');

    if (!container) {
      console.error('Container adminTableContent not found!');
      return;
    }

    console.info('Container found:', container);

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
            const fullName = `${admin.firstName} ${admin.lastName}`.trim();
            const displayName = fullName !== '' ? fullName : '-';
            return `
          <tr>
            <td>${String(admin.id)}</td>
            <td>${displayName}</td>
            <td>${admin.email !== '' ? admin.email : '-'}</td>
            <td>${admin.position !== undefined && admin.position !== '' ? getPositionDisplay(admin.position) : '-'}</td>
            <td>${getDepartmentsBadge(admin)}</td>
            <td>
              <span class="status-badge ${admin.isActive ? 'active' : 'inactive'}">
                ${admin.isActive ? 'Aktiv' : 'Inaktiv'}
              </span>
            </td>
            <td>${admin.createdAt !== undefined ? new Date(admin.createdAt).toLocaleDateString('de-DE') : '-'}</td>
            <td>${admin.lastLogin !== undefined && admin.lastLogin !== '' ? new Date(admin.lastLogin).toLocaleDateString('de-DE') : '-'}</td>
            <td>
              <button class="action-btn edit" onclick="editAdmin(${String(admin.id)})">Bearbeiten</button>
              <button class="action-btn permissions" onclick="showPermissionsModal(${String(admin.id)})" style="border-color: rgba(76, 175, 80, 0.3); background: rgba(76, 175, 80, 0.1);">Berechtigungen</button>
              <button class="action-btn delete" onclick="deleteAdmin(${String(admin.id)})">Löschen</button>
            </td>
          </tr>
        `;
          })
          .join('')}
      </tbody>
    </table>
  `;

    setHTML(container, tableHTML);

    // Add hover event listeners for department badges
    const departmentBadges = $all('.department-badge');
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

    const modal = $$(SELECTORS.ADMIN_MODAL);
    const title = $$(SELECTORS.MODAL_TITLE);

    if (title) title.textContent = 'Admin bearbeiten';

    // Formular mit Admin-Daten füllen
    ($('#adminFirstName') as HTMLInputElement).value = admin.firstName;
    ($('#adminLastName') as HTMLInputElement).value = admin.lastName;
    ($('#adminEmail') as HTMLInputElement).value = admin.email;
    ($(SELECTORS.ADMIN_EMAIL_CONFIRM) as HTMLInputElement).value = admin.email;

    // Custom dropdown for position
    const positionValue = admin.position ?? '';
    ($(SELECTORS.POSITION_DROPDOWN_VALUE) as HTMLInputElement).value = positionValue;
    const displayText = positionValue !== '' ? getPositionDisplay(positionValue) : 'Position auswählen...';
    const positionDropdown = $$('#positionDropdownDisplay');
    if (positionDropdown) {
      const span = positionDropdown.querySelector('span');
      if (span) span.textContent = displayText;
    }

    ($('#adminNotes') as HTMLTextAreaElement).value = admin.notes ?? '';

    // Show active status checkbox when editing
    const activeStatusGroup = $$('#activeStatusGroup');
    if (activeStatusGroup) activeStatusGroup.style.display = 'block';

    const isActiveCheckbox = $('#adminIsActive') as HTMLInputElement;
    const isActive = admin.isActive;
    console.info('Setting checkbox for edit - admin.isActive:', admin.isActive, 'checkbox will be:', isActive);
    isActiveCheckbox.checked = isActive;

    // Hide confirmation fields when editing
    const emailConfirmGroup = $$('#emailConfirmGroup');
    if (emailConfirmGroup) emailConfirmGroup.style.display = 'none';
    const passwordGroup = $$('#passwordGroup');
    const passwordConfirmGroup = $$('#passwordConfirmGroup');
    if (passwordGroup) passwordGroup.style.display = 'none';
    if (passwordConfirmGroup) passwordConfirmGroup.style.display = 'none';

    // Clear error messages
    const emailError = $$(SELECTORS.EMAIL_ERROR);
    const passwordError = $$(SELECTORS.PASSWORD_ERROR);
    if (emailError) emailError.style.display = 'none';
    if (passwordError) passwordError.style.display = 'none';

    // Load current department assignments
    console.info('🔵 Loading department assignments for admin:', adminId);
    console.info('Admin departments:', admin.departments);
    console.info('Admin hasAllAccess:', admin.hasAllAccess);

    // Reset all permission type radio buttons
    $all(SELECTORS.PERMISSION_TYPE_RADIO).forEach((radio) => {
      (radio as HTMLInputElement).checked = false;
    });

    // Hide all containers first
    const deptContainer = $$(SELECTORS.DEPARTMENT_SELECT_CONTAINER);
    const groupContainer = $$('#groupSelectContainer');
    if (deptContainer) deptContainer.style.display = 'none';
    if (groupContainer) groupContainer.style.display = 'none';

    // Set the appropriate permission type based on current assignments
    if (admin.hasAllAccess === true) {
      const allRadio = document.querySelector('input[name="permissionType"][value="all"]');
      if (allRadio) {
        (allRadio as HTMLInputElement).checked = true;
        console.info('✅ Set permission type to: all');
      }
    } else if (admin.departments !== undefined && admin.departments.length > 0) {
      const specificRadio = document.querySelector('input[name="permissionType"][value="specific"]');
      if (specificRadio) {
        (specificRadio as HTMLInputElement).checked = true;
        console.info('✅ Set permission type to: specific');

        // Show department container and load departments
        if (deptContainer) {
          deptContainer.style.display = 'block';
          await loadAndPopulateDepartments();

          // Select current departments
          const deptSelect = $$(SELECTORS.DEPARTMENT_SELECT) as HTMLSelectElement | null;
          if (deptSelect !== null) {
            // Clear all selections first
            [...deptSelect.options].forEach((option) => (option.selected = false));

            // Select assigned departments
            admin.departments.forEach((dept) => {
              const option = [...deptSelect.options].find((opt) => opt.value === dept.id.toString());
              if (option) {
                option.selected = true;
                console.info('✅ Selected department:', dept.name);
              }
            });
          }
        }
      }
    } else {
      const noneRadio = document.querySelector('input[name="permissionType"][value="none"]');
      if (noneRadio) {
        (noneRadio as HTMLInputElement).checked = true;
        console.info('✅ Set permission type to: none');
      }
    }

    // Passwort-Felder und E-Mail-Bestätigung als optional setzen beim Bearbeiten
    const emailConfirmField = $$(SELECTORS.ADMIN_EMAIL_CONFIRM) as HTMLInputElement | null;
    if (emailConfirmField !== null) {
      emailConfirmField.required = false;
    }

    const passwordField = $$(SELECTORS.ADMIN_PASSWORD) as HTMLInputElement | null;
    const passwordConfirmField = $$(SELECTORS.ADMIN_PASSWORD_CONFIRM) as HTMLInputElement | null;
    if (passwordField !== null) {
      passwordField.required = false;
      passwordField.value = '';
    }
    if (passwordConfirmField !== null) {
      passwordConfirmField.required = false;
      passwordConfirmField.value = '';
    }

    modal?.classList.add('active');
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

    // Create custom confirmation modal instead of using confirm()
    const confirmDelete = await new Promise<boolean>((resolve) => {
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
      document.body.append(modal);

      const confirmBtn = modal.querySelector('#confirm-delete');
      const cancelBtn = modal.querySelector('#cancel-delete');

      confirmBtn?.addEventListener('click', () => {
        modal.remove();
        resolve(true);
      });

      cancelBtn?.addEventListener('click', () => {
        modal.remove();
        resolve(false);
      });

      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
          resolve(false);
        }
      });
    });

    if (!confirmDelete) {
      console.info('Delete cancelled by user');
      return;
    }

    try {
      const endpoint = `/root/admins/${String(adminId)}`;

      await apiClient.request(
        endpoint,
        {
          method: 'DELETE',
        },
        { version: useV2API ? 'v2' : 'v1' },
      );

      showSuccessAlert('Administrator erfolgreich gelöscht');
      await loadAdmins();
    } catch (error) {
      console.error('Fehler:', error);
      const errorMessage = error instanceof Error ? error.message : 'Netzwerkfehler beim Löschen';
      showErrorAlert(errorMessage);
    }
  }

  // Admin hinzufügen Modal anzeigen
  (window as unknown as ManageAdminsWindow).showAddAdminModal = function () {
    currentAdminId = null;
    const modal = $$(SELECTORS.ADMIN_MODAL);
    const title = $$(SELECTORS.MODAL_TITLE);
    const form = $$('#adminForm') as HTMLFormElement | null;

    if (title !== null) title.textContent = 'Admin hinzufügen';
    if (form !== null) form.reset();

    // Reset custom dropdown
    const positionValue = $$(SELECTORS.POSITION_DROPDOWN_VALUE) as HTMLInputElement | null;
    if (positionValue !== null) positionValue.value = '';
    const positionDropdown = $$('#positionDropdownDisplay');
    if (positionDropdown) {
      const span = positionDropdown.querySelector('span');
      if (span) span.textContent = 'Position auswählen...';
    }

    // Hide active status checkbox for new admins (they are always active)
    const activeStatusGroup = $$('#activeStatusGroup');
    if (activeStatusGroup) activeStatusGroup.style.display = 'none';

    // Passwort-Felder und E-Mail-Bestätigung als required setzen für neue Admins
    const emailConfirmField = $$(SELECTORS.ADMIN_EMAIL_CONFIRM) as HTMLInputElement | null;
    if (emailConfirmField !== null) emailConfirmField.required = true;

    const passwordField = $$(SELECTORS.ADMIN_PASSWORD) as HTMLInputElement | null;
    const passwordConfirmField = $$(SELECTORS.ADMIN_PASSWORD_CONFIRM) as HTMLInputElement | null;
    if (passwordField !== null) passwordField.required = true;
    if (passwordConfirmField !== null) passwordConfirmField.required = true;

    // Show confirmation fields for new admin
    const emailConfirmGroup = $$('#emailConfirmGroup');
    if (emailConfirmGroup) emailConfirmGroup.style.display = 'block';
    const passwordGroup = $$('#passwordGroup');
    const passwordConfirmGroup = $$('#passwordConfirmGroup');
    if (passwordGroup) passwordGroup.style.display = 'block';
    if (passwordConfirmGroup) passwordConfirmGroup.style.display = 'block';

    // Clear error messages
    const emailError = $$(SELECTORS.EMAIL_ERROR);
    const passwordError = $$(SELECTORS.PASSWORD_ERROR);
    if (emailError) emailError.style.display = 'none';
    if (passwordError) passwordError.style.display = 'none';

    modal?.classList.add('active');
  };

  // Modal schließen
  (window as unknown as ManageAdminsWindow).closeAdminModal = function () {
    const modal = $$(SELECTORS.ADMIN_MODAL);
    modal?.classList.remove('active');
    currentAdminId = null;

    // Clear error messages when closing
    const emailError = $$(SELECTORS.EMAIL_ERROR);
    const passwordError = $$(SELECTORS.PASSWORD_ERROR);
    if (emailError) emailError.style.display = 'none';
    if (passwordError) passwordError.style.display = 'none';
  };

  // Permissions Modal schließen
  (window as unknown as ManageAdminsWindow).closePermissionsModal = function () {
    console.info('🔵 closePermissionsModal called');
    const modal = $$('#permissionsModal');
    if (modal) {
      modal.classList.remove('active');
      currentPermissionAdminId = null;
    }
  };

  // Department Permission Handling Functions
  async function loadDepartments(): Promise<Department[]> {
    try {
      const endpoint = '/departments';
      return await apiClient.request<Department[]>(
        endpoint,
        {
          method: 'GET',
        },
        { version: useV2API ? 'v2' : 'v1' },
      );
    } catch (error) {
      console.error('Fehler beim Laden der Abteilungen:', error);
      return [];
    }
  }

  async function loadDepartmentGroups(): Promise<DepartmentGroup[]> {
    try {
      const endpoint = '/department-groups/hierarchy';
      const result = await apiClient.request<{ data?: DepartmentGroup[] }>(
        endpoint,
        {
          method: 'GET',
        },
        { version: useV2API ? 'v2' : 'v1' },
      );
      return result.data ?? [];
    } catch (error) {
      console.error('Fehler beim Laden der Abteilungsgruppen:', error);
      return [];
    }
  }

  // Load admin permissions
  async function loadAdminPermissions(adminId: number): Promise<{ departments: Department[]; hasAllAccess: boolean }> {
    try {
      const endpoint = `/admin-permissions/${String(adminId)}`;
      const result = await apiClient.request<{
        success?: boolean;
        data?: { departments: Department[]; hasAllAccess: boolean };
        departments?: Department[];
        hasAllAccess?: boolean;
      }>(
        endpoint,
        {
          method: 'GET',
        },
        { version: useV2API ? 'v2' : 'v1' },
      );

      console.info(`Raw API response for admin ${String(adminId)}:`, result);

      // Handle the wrapped response structure
      if (result.success === true && result.data !== undefined) {
        return result.data;
      } else if (result.departments !== undefined) {
        // Fallback for direct structure
        return {
          departments: result.departments,
          hasAllAccess: result.hasAllAccess ?? false,
        };
      }
    } catch (error) {
      console.error('Fehler beim Laden der Admin-Berechtigungen:', error);
    }
    return { departments: [], hasAllAccess: false };
  }

  // Handle permission type radio change
  function handlePermissionTypeChange() {
    const radioElement = document.querySelector(SELECTORS.PERMISSION_TYPE_CHECKED);
    const type = (radioElement as HTMLInputElement | null)?.value;
    const departmentContainer = $$(SELECTORS.DEPARTMENT_SELECT_CONTAINER);
    const groupContainer = $$('#groupSelectContainer');

    if (departmentContainer) departmentContainer.style.display = type === 'specific' ? 'block' : 'none';
    if (groupContainer) groupContainer.style.display = type === 'groups' ? 'block' : 'none';

    if (type === 'specific') {
      void loadAndPopulateDepartments();
    } else if (type === 'groups') {
      void loadAndPopulateGroups();
    }
  }

  // Load and populate departments
  async function loadAndPopulateDepartments() {
    const departments = await loadDepartments();
    const select = $$(SELECTORS.DEPARTMENT_SELECT);

    if (select !== null) {
      select.innerHTML = '';
      departments.forEach((dept) => {
        const option = document.createElement('option');
        option.value = dept.id.toString();
        option.textContent = dept.name;
        select.append(option);
      });
    }
  }

  // Load and populate groups
  async function loadAndPopulateGroups() {
    const groups = await loadDepartmentGroups();
    const container = $$('#groupTreeView');

    if (container) {
      setHTML(container, renderGroupTree(groups));
    }
  }

  // Render group tree
  function renderGroupTree(groups: DepartmentGroup[], level = 0): string {
    return groups
      .map(
        (group) => `
    <div style="margin-left: ${String(level * 20)}px; margin-bottom: 8px;">
      <label style="display: flex; align-items: center; cursor: pointer;">
        <input type="checkbox" name="groupSelect" value="${String(group.id)}" style="margin-right: 8px;" />
        <span>${group.name}</span>
        ${
          group.departments && group.departments.length > 0
            ? `<small style="margin-left: 8px; color: var(--text-secondary);">(${String(group.departments.length)} Abteilungen)</small>`
            : ''
        }
      </label>
      ${group.subgroups && group.subgroups.length > 0 ? renderGroupTree(group.subgroups, level + 1) : ''}
    </div>
  `,
      )
      .join('');
  }

  // Current admin ID for permissions modal
  let currentPermissionAdminId: number | null = null;

  // Show permissions modal
  async function showPermissionsModal(adminId: number) {
    console.info('🔵 showPermissionsModal called for admin ID:', adminId);
    currentPermissionAdminId = adminId;
    const admin = admins.find((a) => Number.parseInt(a.id.toString(), 10) === adminId);

    if (!admin) {
      console.error('Admin not found for ID:', adminId);
      return;
    }

    console.info('Found admin:', admin);

    // Set admin info
    const nameEl = $$('#permAdminName');
    const emailEl = $$('#permAdminEmail');

    if (nameEl) nameEl.textContent = `${admin.firstName} ${admin.lastName} (${admin.username})`.trim();
    if (emailEl) emailEl.textContent = admin.email;

    // Load departments and current permissions
    await loadPermissionsModalData(adminId);

    // Ensure departments tab is active by default
    const deptTab = document.querySelector('[data-tab="departments"]');
    const groupTab = document.querySelector('[data-tab="groups"]');
    const deptContent = $$('#departmentsTab');
    const groupContent = $$('#groupsTab');

    if (deptTab && groupTab && deptContent && groupContent) {
      // Reset all tabs
      deptTab.classList.add('active');
      (deptTab as HTMLElement).style.borderBottomColor = 'var(--primary-color)';
      (deptTab as HTMLElement).style.color = 'var(--text-primary)';

      groupTab.classList.remove('active');
      (groupTab as HTMLElement).style.borderBottomColor = 'transparent';
      (groupTab as HTMLElement).style.color = 'var(--text-secondary)';

      // Show departments content, hide groups
      deptContent.style.display = 'block';
      groupContent.style.display = 'none';
    }

    // Show modal
    const modal = $$('#permissionsModal');
    if (modal) {
      modal.classList.add('active');
      console.info('✅ Permissions modal opened with departments tab active');
    } else {
      console.error('❌ Permissions modal element not found!');
    }
  }

  // Load data for permissions modal
  async function loadPermissionsModalData(adminId: number) {
    console.info('🔵 loadPermissionsModalData called for admin:', adminId);
    try {
      // Load all departments
      const departments = await loadDepartments();
      console.info('Available departments:', departments);

      const groups = await loadDepartmentGroups();

      // Load current permissions
      const currentPerms = await loadAdminPermissions(adminId);
      console.info('Current permissions:', currentPerms);

      // Render departments
      const deptList = $$('#permissionDepartmentList');
      if (deptList) {
        const deptContent = departments
          .map((dept) => {
            const hasPermission = currentPerms.departments.some((d) => d.id === dept.id);
            return `
          <label style="display: flex; align-items: center; padding: 8px; cursor: pointer; border-radius: 4px; /* transition: background 0.2s; */"
                 onmouseover="this.style.background='rgba(255,255,255,0.02)'"
                 onmouseout="this.style.background='transparent'">
            <input type="checkbox" name="deptPermission" value="${String(dept.id)}"
                   ${hasPermission ? 'checked' : ''}
                   style="margin-right: 8px;" />
            <span>${dept.name}</span>
            ${dept.description !== undefined && dept.description !== '' ? `<small style="margin-left: 8px; color: var(--text-secondary);">${dept.description}</small>` : ''}
          </label>
        `;
          })
          .join('');

        setHTML(deptList, deptContent);
      }

      // Render groups
      const groupList = $$('#permissionGroupList');
      if (groupList) {
        setHTML(groupList, renderGroupTree(groups));
      }

      // Set permission levels
      if (currentPerms.departments.length > 0) {
        const firstDept = currentPerms.departments[0];
        const canWriteEl = $$('#permCanWrite') as HTMLInputElement | null;
        const canDeleteEl = $$('#permCanDelete') as HTMLInputElement | null;
        if (canWriteEl !== null) canWriteEl.checked = firstDept.can_write ?? false;
        if (canDeleteEl !== null) canDeleteEl.checked = firstDept.can_delete ?? false;
      }
    } catch (error) {
      console.error('Error loading permissions modal data:', error);
    }
  }

  // Save permissions handler
  (window as unknown as ManageAdminsWindow).savePermissionsHandler = async function () {
    console.info('🔵 savePermissionsHandler called');
    console.info('currentPermissionAdminId:', currentPermissionAdminId);

    if (currentPermissionAdminId === null || currentPermissionAdminId === 0) {
      console.error('❌ No currentPermissionAdminId set');
      return;
    }

    try {
      const authToken = localStorage.getItem('token');
      console.info('🔵 Saving permissions for admin:', currentPermissionAdminId);

      // Get selected departments
      const selectedDepts = [...$all('#permissionDepartmentList input[name="deptPermission"]:checked')].map(
        (checkbox) => Number.parseInt((checkbox as HTMLInputElement).value, 10),
      );

      console.info('Selected departments:', selectedDepts);

      // Get selected groups
      const selectedGroups = [...$all('#permissionGroupList input[name="groupSelect"]:checked')].map((checkbox) =>
        Number.parseInt((checkbox as HTMLInputElement).value, 10),
      );

      console.info('Selected groups:', selectedGroups);

      // Get permission levels
      const canWriteEl = $$('#permCanWrite') as HTMLInputElement | null;
      const canDeleteEl = $$('#permCanDelete') as HTMLInputElement | null;
      const permissions = {
        canRead: true,
        canWrite: canWriteEl !== null ? canWriteEl.checked : false,
        canDelete: canDeleteEl !== null ? canDeleteEl.checked : false,
      };

      console.info('Permissions:', permissions);

      // Update department permissions
      const requestBody = {
        adminId: currentPermissionAdminId,
        departmentIds: selectedDepts,
        permissions,
      };

      console.info('Request body:', requestBody);
      console.info('Token exists:', authToken !== null && authToken !== '');
      console.info('Making request to:', API_ENDPOINTS.ADMIN_PERMISSIONS);

      const deptResponse = await apiClient.request<{ success?: boolean; message?: string }>(
        '/admin-permissions',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        },
        { version: useV2API ? 'v2' : 'v1' },
      );

      console.info('✅ Department permissions saved successfully:', deptResponse);

      // Update group permissions if any selected
      if (selectedGroups.length > 0) {
        await apiClient.request(
          '/admin-permissions/groups',
          {
            method: 'POST',
            body: JSON.stringify({
              adminId: currentPermissionAdminId,
              groupIds: selectedGroups,
              permissions,
            }),
          },
          { version: useV2API ? 'v2' : 'v1' },
        );

        console.info('✅ Group permissions saved successfully');
      }

      // Request succeeded, show success message
      console.info('✅ Permissions saved successfully');
      showSuccessAlert('Berechtigungen erfolgreich aktualisiert');
      const closeModal = (window as unknown as ManageAdminsWindow).closePermissionsModal;
      if (closeModal) closeModal();

      // Admin-Liste dynamisch neu laden (ohne Seiten-Reload)
      await loadAdmins();
    } catch (error) {
      console.error('Error saving permissions:', error);
      showErrorAlert('Netzwerkfehler beim Speichern');
    }
  };

  // Admin-Formular submit
  $$('#adminForm')?.addEventListener('submit', (e) => {
    void (async () => {
      e.preventDefault();

      // Validate email match
      const emailEl = $$('#adminEmail') as HTMLInputElement | null;
      const emailConfirmEl = $$(SELECTORS.ADMIN_EMAIL_CONFIRM) as HTMLInputElement | null;
      const email = emailEl !== null ? emailEl.value : '';
      const emailConfirm = emailConfirmEl !== null ? emailConfirmEl.value : '';
      const emailError = $$(SELECTORS.EMAIL_ERROR);

      if (email !== emailConfirm) {
        if (emailError) emailError.style.display = 'block';
        showErrorAlert('Die E-Mail-Adressen stimmen nicht überein!');
        return;
      } else {
        if (emailError) emailError.style.display = 'none';
      }

      // Validate password match (only for new admins or if password is being changed)
      const passwordEl = $$(SELECTORS.ADMIN_PASSWORD) as HTMLInputElement | null;
      const passwordConfirmEl = $$(SELECTORS.ADMIN_PASSWORD_CONFIRM) as HTMLInputElement | null;
      const password = passwordEl !== null ? passwordEl.value : '';
      const passwordConfirm = passwordConfirmEl !== null ? passwordConfirmEl.value : '';
      const passwordError = $$(SELECTORS.PASSWORD_ERROR);

      if (password !== '' && password !== passwordConfirm) {
        if (passwordError) passwordError.style.display = 'block';
        showErrorAlert('Die Passwörter stimmen nicht überein!');
        return;
      } else {
        if (passwordError) passwordError.style.display = 'none';
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
        employeeNumber?: string; // camelCase für API!
      }

      const firstNameEl = $$('#adminFirstName') as HTMLInputElement | null;
      const lastNameEl = $$('#adminLastName') as HTMLInputElement | null;
      const positionEl = $$(SELECTORS.POSITION_DROPDOWN_VALUE) as HTMLInputElement | null;

      const employeeNumberEl = $$('#adminEmployeeNumber') as HTMLInputElement | null;
      const formData: AdminFormData = {
        firstName: firstNameEl !== null ? firstNameEl.value : '',
        lastName: lastNameEl !== null ? lastNameEl.value : '',
        email,
        username: email, // Use email as username
        password,
        position: positionEl !== null ? positionEl.value : '',
        notes: ($('#adminNotes') as HTMLTextAreaElement).value,
        role: 'admin',
        employeeNumber: employeeNumberEl !== null ? employeeNumberEl.value : '', // camelCase für API!
      };

      // Include isActive only when updating
      if (currentAdminId !== null && currentAdminId !== 0) {
        const checkbox = $('#adminIsActive') as HTMLInputElement;
        console.info('Checkbox element:', checkbox);
        console.info('Checkbox checked state:', checkbox.checked);
        formData.isActive = checkbox.checked;
      }

      console.info('Sending form data:', formData);
      console.info('Current admin ID:', currentAdminId);
      console.info('isActive value being sent:', formData.isActive);

      try {
        const isUpdate = currentAdminId !== null && currentAdminId !== 0;
        const endpoint = isUpdate ? `/root/admins/${String(currentAdminId)}` : '/root/admins';
        const method = isUpdate ? 'PUT' : 'POST';

        // Bei Update: Passwort nur senden wenn ausgefüllt
        if (
          currentAdminId !== null &&
          currentAdminId !== 0 &&
          (formData.password === undefined || formData.password === '')
        ) {
          delete formData.password;
        }

        // Use apiClient for consistent v2 API usage
        const result = await apiClient.request<{ adminId?: number; id?: number }>(
          endpoint,
          {
            method,
            body: JSON.stringify(formData),
          },
          { version: 'v2' },
        );

        const adminId = currentAdminId ?? result.adminId ?? result.id ?? 0;

        // Set permissions for both new and existing admins
        const permissionTypeInput = document.querySelector(SELECTORS.PERMISSION_TYPE_CHECKED);
        const permissionType = permissionTypeInput instanceof HTMLInputElement ? permissionTypeInput.value : undefined;
        console.info('🔵 Permission type selected:', permissionType);

        if (adminId !== 0 && permissionType !== undefined) {
          // Always update permissions based on form selection
          if (permissionType !== 'none') {
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
              // Get all departments
              const allDepts = await loadDepartments();
              departmentIds = allDepts.map((d) => d.id);
            }

            // Set permissions
            console.info('🔵 Setting department permissions for admin:', adminId);
            console.info('Department IDs:', departmentIds);

            const permResponse = await apiClient.request(
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

            if (permResponse != null) {
              console.info('✅ Department permissions updated successfully');
            }

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
          } else {
            // Permission type is 'none' - remove all permissions
            console.info('🔵 Removing all department permissions for admin:', adminId);

            const permResponse = await apiClient.request(
              '/admin-permissions',
              {
                method: 'POST',
                body: JSON.stringify({
                  adminId,
                  departmentIds: [], // Empty array removes all permissions
                  permissions: { can_read: true, can_write: false, can_delete: false },
                }),
              },
              { version: useV2API ? 'v2' : 'v1' },
            );

            if (permResponse != null) {
              console.info('✅ All department permissions removed');
            }
          }
        }

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

  // Hilfsfunktionen wurden bereits aus auth.ts importiert
  // showErrorAlert und showSuccessAlert sind bereits oben importiert

  // Modal schließen bei Klick außerhalb
  window.addEventListener('click', (e) => {
    const modal = $$(SELECTORS.ADMIN_MODAL);
    if (e.target === modal) {
      const closeModal = (window as unknown as ManageAdminsWindow).closeAdminModal;
      if (closeModal) closeModal();
    }
  });

  // Make functions globally available
  (window as unknown as ManageAdminsWindow).editAdmin = editAdminHandler;
  (window as unknown as ManageAdminsWindow).deleteAdmin = deleteAdminHandler;
  (window as unknown as ManageAdminsWindow).showPermissionsModal = showPermissionsModal;

  // Initialisierung
  document.addEventListener('DOMContentLoaded', () => {
    void (async () => {
      // Load user profile to trigger unified navigation update
      try {
        const userProfile = await apiClient.get<MappedUser>(API_ENDPOINTS.USERS_ME);
        console.info('[manage-admins] User profile loaded:', userProfile);
      } catch (error) {
        console.error('[manage-admins] Failed to load user profile:', error);
      }

      // Daten laden
      await loadAdmins();
      await loadTenants();

      // Add event listeners for permission type radio buttons
      $all(SELECTORS.PERMISSION_TYPE_RADIO).forEach((radio) => {
        radio.addEventListener('change', handlePermissionTypeChange);
      });

      // Real-time validation for email confirmation
      const emailConfirmInput = $$(SELECTORS.ADMIN_EMAIL_CONFIRM) as HTMLInputElement | null;
      if (emailConfirmInput) {
        emailConfirmInput.addEventListener('input', () => {
          const emailEl = $$('#adminEmail') as HTMLInputElement | null;
          const email = emailEl !== null ? emailEl.value : '';
          const emailConfirm = emailConfirmInput.value;
          const emailError = $$(SELECTORS.EMAIL_ERROR);

          if (emailConfirm !== '' && email !== emailConfirm) {
            if (emailError) emailError.style.display = 'block';
          } else {
            if (emailError) emailError.style.display = 'none';
          }
        });
      }

      // Real-time validation for password confirmation
      const passwordConfirmInput = $$(SELECTORS.ADMIN_PASSWORD_CONFIRM) as HTMLInputElement | null;
      if (passwordConfirmInput) {
        passwordConfirmInput.addEventListener('input', () => {
          const passwordEl = $$(SELECTORS.ADMIN_PASSWORD) as HTMLInputElement | null;
          const password = passwordEl !== null ? passwordEl.value : '';
          const passwordConfirm = passwordConfirmInput.value;
          const passwordError = $$(SELECTORS.PASSWORD_ERROR);

          if (passwordConfirm !== '' && password !== passwordConfirm) {
            if (passwordError) passwordError.style.display = 'block';
          } else {
            if (passwordError) passwordError.style.display = 'none';
          }
        });
      }
    })();
  });
})();

// End of IIFE
