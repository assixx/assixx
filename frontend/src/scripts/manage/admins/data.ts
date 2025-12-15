/* eslint-disable max-lines */
/**
 * Admin Management - Data Layer
 * API calls, data fetching, and state management
 */

import { ApiClient } from '../../../utils/api-client';
import type { Admin, Area, Department, Team, Tenant, AdminFormData } from './types';

// ===== CONSTANTS =====
const ADMIN_FORM_ELEMENT_IDS = {
  AREAS_SELECT: 'admin-areas',
  DEPARTMENTS_SELECT: 'admin-departments',
  TEAMS_SELECT: 'admin-teams',
  FULL_ACCESS_TOGGLE: 'admin-full-access',
} as const;

// ===== GLOBAL STATE =====
export let currentAdminId: number | null = null;
export let admins: Admin[] = [];
export let tenants: Tenant[] = [];

// Functions to modify state (needed for import safety)
export function setCurrentAdminId(id: number | null): void {
  currentAdminId = id;
}

export function setAdmins(newAdmins: Admin[]): void {
  admins = newAdmins;
}

export function setTenants(newTenants: Tenant[]): void {
  tenants = newTenants;
}

// ===== API CLIENT =====
export const apiClient = ApiClient.getInstance();

// ===== API FUNCTIONS =====

// Load admin permissions (includes areas, departments, hasFullAccess)
export async function loadAdminPermissions(adminId: number): Promise<{
  areas: Area[];
  departments: Department[];
  hasFullAccess: boolean;
}> {
  try {
    const response = await apiClient.request<{
      areas?: Area[];
      departments?: Department[];
      hasFullAccess?: boolean;
    }>(`/admin-permissions/${String(adminId)}`, { method: 'GET' }, { version: 'v2' });

    return {
      areas: response.areas ?? [],
      departments: response.departments ?? [],
      hasFullAccess: response.hasFullAccess ?? false,
    };
  } catch (error) {
    console.error('Error loading permissions:', error);
    return { areas: [], departments: [], hasFullAccess: false };
  }
}

// Load all areas for selection
export async function loadAreas(): Promise<Area[]> {
  try {
    const response = await apiClient.request<Area[] | { success: boolean; data: Area[] }>(
      '/areas',
      { method: 'GET' },
      { version: 'v2' },
    );

    if (Array.isArray(response)) {
      return response;
    } else if ('data' in response && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (error) {
    console.error('Error loading areas:', error);
    return [];
  }
}

// Load all departments
export async function loadDepartments(): Promise<Department[]> {
  try {
    const response = await apiClient.request<Department[] | { success: boolean; data: Department[] }>(
      '/departments',
      { method: 'GET' },
      { version: 'v2' },
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

// Load all teams
export async function loadTeams(): Promise<Team[]> {
  try {
    const response = await apiClient.request<Team[] | { success: boolean; data: Team[] }>(
      '/teams',
      { method: 'GET' },
      { version: 'v2' },
    );

    if (Array.isArray(response)) {
      return response;
    } else if ('data' in response && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (error) {
    console.error('Error loading teams:', error);
    return [];
  }
}

// NOTE: loadDepartmentGroups REMOVED - department_groups deprecated, use Areas
// The function was: GET /department-groups
// This endpoint no longer exists

// Load admins
export async function loadAdmins(): Promise<void> {
  console.info('loadAdmins called');

  try {
    const endpoint = '/root/admins';

    const data = await apiClient.request<Admin[]>(
      endpoint,
      {
        method: 'GET',
      },
      { version: 'v2' },
    );

    // API v2 returns { admins: [...] } or array directly - backend uses fieldMapping for camelCase
    const adminData =
      typeof data === 'object' && 'admins' in data
        ? (data as { admins: Admin[] }).admins
        : Array.isArray(data)
          ? data
          : [];
    const loadedAdmins = adminData;
    console.info('Loaded admins:', loadedAdmins);

    // Load permissions for each admin (hasFullAccess is single source of truth)
    for (const admin of loadedAdmins) {
      try {
        const perms = await loadAdminPermissions(admin.id);
        console.info(`Permissions for admin ${String(admin.id)}:`, perms);
        admin.areas = perms.areas;
        admin.departments = perms.departments;
        admin.hasFullAccess = perms.hasFullAccess;
      } catch (error) {
        console.error(`Error loading permissions for admin ${String(admin.id)}:`, error);
        admin.areas = [];
        admin.departments = [];
        admin.hasFullAccess = false;
      }
    }

    // Log each admin's isActive status
    loadedAdmins.forEach((admin) => {
      console.info(`Admin ${admin.username} (ID: ${String(admin.id)}) - isActive: ${String(admin.isActive)}`);
    });

    setAdmins(loadedAdmins);
  } catch (error) {
    console.error('Fehler:', error);
    throw new Error('Netzwerkfehler beim Laden der Admins');
  }
}

// Load tenants for dropdown
export async function loadTenants(): Promise<void> {
  try {
    const endpoint = '/root/tenants';

    const response = await apiClient.request<{ success: boolean; data: Tenant[]; timestamp: string }>(
      endpoint,
      {
        method: 'GET',
      },
      { version: 'v2' },
    );

    console.info('Loaded tenants:', response);
    // The data field is always present in the response type
    setTenants(response.data);
  } catch (error) {
    console.error('Fehler beim Laden der Tenants:', error);
    throw error;
  }
}

// Save admin
export async function saveAdmin(formData: AdminFormData): Promise<number> {
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

// Delete admin
export async function deleteAdmin(adminId: number): Promise<void> {
  const endpoint = `/root/admins/${String(adminId)}`;
  const result = await apiClient.request(
    endpoint,
    {
      method: 'DELETE',
    },
    { version: 'v2' },
  );

  console.info('Delete response:', result);
}

// Update permissions
export async function updateAdminPermissions(
  adminId: number,
  departmentIds: number[],
  groupIds: number[],
): Promise<void> {
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
    { version: 'v2' },
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
      { version: 'v2' },
    );
  }

  console.info('✅ Permissions updated successfully');
}

// Save permissions from permission modal
export async function savePermissions(
  adminId: number,
  departments: { id: number; can_read: boolean; can_write: boolean; can_delete: boolean }[],
): Promise<void> {
  await apiClient.request(
    '/admin-permissions',
    {
      method: 'POST',
      body: JSON.stringify({
        adminId,
        departmentIds: departments.filter((d) => d.can_read).map((d) => d.id),
        permissions: { can_read: true, can_write: false, can_delete: false },
      }),
    },
    { version: 'v2' },
  );
}

// ===== AREA PERMISSION FUNCTIONS (Assignment System 2025-11-27) =====

// Update area permissions for a user
export async function updateUserAreaPermissions(
  userId: number,
  areaIds: number[],
  permissions: { canRead: boolean; canWrite: boolean; canDelete: boolean } = {
    canRead: true,
    canWrite: false,
    canDelete: false,
  },
): Promise<void> {
  await apiClient.request(
    `/admin-permissions/${String(userId)}/areas`,
    {
      method: 'POST',
      body: JSON.stringify({ areaIds, permissions }),
    },
    { version: 'v2' },
  );
  console.info('✅ Area permissions updated successfully');
}

// Set has_full_access flag for a user
export async function setUserFullAccess(userId: number, hasFullAccess: boolean): Promise<void> {
  await apiClient.request(
    `/admin-permissions/${String(userId)}/full-access`,
    {
      method: 'PATCH',
      body: JSON.stringify({ hasFullAccess }),
    },
    { version: 'v2' },
  );
  console.info(`✅ Full access ${hasFullAccess ? 'granted' : 'revoked'} successfully`);
}

// ===== N:M REFACTORING: Multi-Select Helpers for Admin Form =====

/**
 * Extract multi-select values as arrays
 * N:M REFACTORING: Helper to get selected values from multi-select elements
 */
export function getMultiSelectValues(selectId: string): number[] {
  const select = document.getElementById(selectId) as HTMLSelectElement | null;
  if (select === null) return [];

  return Array.from(select.selectedOptions).map((opt) => Number.parseInt(opt.value, 10));
}

/**
 * Set multi-select values from array
 * N:M REFACTORING: Helper to restore selected values in multi-select
 */
export function setMultiSelectValues(selectId: string, values: number[]): void {
  const select = document.getElementById(selectId) as HTMLSelectElement | null;
  if (select === null) return;

  Array.from(select.options).forEach((opt) => {
    opt.selected = values.includes(Number.parseInt(opt.value, 10));
  });
}

/**
 * Load areas into admin form multi-select
 * N:M REFACTORING: For the admin modal form
 */
export async function loadAreasForAdminForm(): Promise<void> {
  const areas = await loadAreas();
  const select = document.getElementById(ADMIN_FORM_ELEMENT_IDS.AREAS_SELECT) as HTMLSelectElement | null;

  if (select !== null && areas.length > 0) {
    select.innerHTML = '';
    areas.forEach((area) => {
      const option = document.createElement('option');
      option.value = area.id.toString();
      option.textContent =
        area.departmentCount !== undefined ? `${area.name} (${String(area.departmentCount)} Abt.)` : area.name;
      select.append(option);
    });
    console.info('[AdminForm] Loaded areas into multi-select:', areas.length);
  }
}

/**
 * Load departments into admin form multi-select
 * N:M REFACTORING: For the admin modal form
 * Includes data-area-id attribute for filtering by selected areas
 */
export async function loadDepartmentsForAdminForm(): Promise<void> {
  const departments = await loadDepartments();
  const select = document.getElementById(ADMIN_FORM_ELEMENT_IDS.DEPARTMENTS_SELECT) as HTMLSelectElement | null;

  if (select !== null && departments.length > 0) {
    select.innerHTML = '';
    departments.forEach((dept) => {
      const option = document.createElement('option');
      option.value = dept.id.toString();
      option.textContent = dept.areaName !== undefined ? `${dept.name} (${dept.areaName})` : dept.name;
      // Add data-area-id for filtering departments by selected areas
      if (dept.areaId !== undefined) {
        option.dataset['areaId'] = dept.areaId.toString();
      }
      select.append(option);
    });
    console.info('[AdminForm] Loaded departments into multi-select:', departments.length);
  }
}

/**
 * Load teams into admin form multi-select
 * N:M REFACTORING: For the admin modal form
 * Includes data-department-id attribute for filtering by selected departments
 */
export async function loadTeamsForAdminForm(): Promise<void> {
  const teams = await loadTeams();
  const select = document.getElementById(ADMIN_FORM_ELEMENT_IDS.TEAMS_SELECT) as HTMLSelectElement | null;

  if (select !== null && teams.length > 0) {
    select.innerHTML = '';
    teams.forEach((team) => {
      const option = document.createElement('option');
      option.value = team.id.toString();
      const label = team.departmentName !== undefined ? `${team.name} (${team.departmentName})` : team.name;
      option.textContent = label;
      // Add data-department-id for filtering teams by selected departments
      if (team.departmentId !== undefined) {
        option.dataset['departmentId'] = team.departmentId.toString();
      }
      select.append(option);
    });
    console.info('[AdminForm] Loaded teams into multi-select:', teams.length);
  }
}

// N:M REFACTORING: CSS class constant for visual feedback
const OPACITY_REDUCED_CLASS = 'opacity-50';

/**
 * Disable and clear a multi-select element
 */
function disableAndClearSelect(select: HTMLSelectElement | null): void {
  if (select === null) return;
  select.disabled = true;
  Array.from(select.options).forEach((opt) => (opt.selected = false));
}

/**
 * Enable a multi-select element
 */
function enableSelect(select: HTMLSelectElement | null): void {
  if (select !== null) select.disabled = false;
}

/**
 * Apply full access visual state to organization selects
 */
function applyFullAccessState(isEnabled: boolean): void {
  const areaSelect = document.getElementById(ADMIN_FORM_ELEMENT_IDS.AREAS_SELECT) as HTMLSelectElement | null;
  const deptSelect = document.getElementById(ADMIN_FORM_ELEMENT_IDS.DEPARTMENTS_SELECT) as HTMLSelectElement | null;
  const teamSelect = document.getElementById(ADMIN_FORM_ELEMENT_IDS.TEAMS_SELECT) as HTMLSelectElement | null;
  const areaContainer = document.getElementById('admin-area-select-container');
  const deptContainer = document.getElementById('admin-department-select-container');
  const teamContainer = document.getElementById('admin-team-select-container');

  if (isEnabled) {
    disableAndClearSelect(areaSelect);
    disableAndClearSelect(deptSelect);
    disableAndClearSelect(teamSelect);
    areaContainer?.classList.add(OPACITY_REDUCED_CLASS);
    deptContainer?.classList.add(OPACITY_REDUCED_CLASS);
    teamContainer?.classList.add(OPACITY_REDUCED_CLASS);
    console.info('[AdminForm] Full access enabled - organization selects disabled');
  } else {
    enableSelect(areaSelect);
    enableSelect(deptSelect);
    enableSelect(teamSelect);
    areaContainer?.classList.remove(OPACITY_REDUCED_CLASS);
    deptContainer?.classList.remove(OPACITY_REDUCED_CLASS);
    teamContainer?.classList.remove(OPACITY_REDUCED_CLASS);
    console.info('[AdminForm] Full access disabled - organization selects enabled');
  }
}

/**
 * Setup full access toggle to disable/enable organization selects
 * N:M REFACTORING: Following calendar/employee pattern for company-wide toggle
 */
export function setupAdminFullAccessToggle(): void {
  const fullAccessToggle = document.getElementById(
    ADMIN_FORM_ELEMENT_IDS.FULL_ACCESS_TOGGLE,
  ) as HTMLInputElement | null;
  if (fullAccessToggle === null) return;

  fullAccessToggle.addEventListener('change', () => {
    applyFullAccessState(fullAccessToggle.checked);
  });
}

// ===== AREA → DEPARTMENT FILTER LOGIC =====

/**
 * Filter departments in multi-select based on selected areas
 * Departments that belong to a selected area are hidden/disabled
 * because they are already covered by area inheritance
 */
export function filterDepartmentsBySelectedAreas(): void {
  const areaSelect = document.getElementById(ADMIN_FORM_ELEMENT_IDS.AREAS_SELECT) as HTMLSelectElement | null;
  const deptSelect = document.getElementById(ADMIN_FORM_ELEMENT_IDS.DEPARTMENTS_SELECT) as HTMLSelectElement | null;

  if (areaSelect === null || deptSelect === null) return;

  // Get selected area IDs as strings for comparison
  const selectedAreaIds = Array.from(areaSelect.selectedOptions).map((opt) => opt.value);

  // Filter department options
  Array.from(deptSelect.options).forEach((option) => {
    const deptAreaId = option.dataset['areaId'];

    if (deptAreaId !== undefined && selectedAreaIds.includes(deptAreaId)) {
      // Department belongs to a selected area → hide/disable (already covered by area)
      option.disabled = true;
      option.hidden = true;
      option.selected = false; // Deselect if was selected
    } else {
      // Department does NOT belong to selected area → show/enable
      option.disabled = false;
      option.hidden = false;
    }
  });

  console.info('[AdminForm] Filtered departments by selected areas:', selectedAreaIds);
}

/**
 * Setup event listener on area select to filter departments dynamically
 * When areas change, departments belonging to those areas are hidden
 */
export function setupAreaDepartmentFilter(): void {
  const areaSelect = document.getElementById(ADMIN_FORM_ELEMENT_IDS.AREAS_SELECT) as HTMLSelectElement | null;
  if (areaSelect === null) return;

  areaSelect.addEventListener('change', () => {
    filterDepartmentsBySelectedAreas();
    // Also filter teams when areas change (teams in area's departments are covered)
    filterTeamsBySelectedDepartmentsAndAreas();
  });

  console.info('[AdminForm] Area-Department filter setup complete');
}

// ===== DEPARTMENT → TEAM FILTER LOGIC =====

/**
 * Get all department IDs that are covered by selected areas
 * These are departments that have area_id matching any selected area
 */
function getDepartmentsCoveredByAreas(): string[] {
  const areaSelect = document.getElementById(ADMIN_FORM_ELEMENT_IDS.AREAS_SELECT) as HTMLSelectElement | null;
  const deptSelect = document.getElementById(ADMIN_FORM_ELEMENT_IDS.DEPARTMENTS_SELECT) as HTMLSelectElement | null;

  if (areaSelect === null || deptSelect === null) return [];

  const selectedAreaIds = Array.from(areaSelect.selectedOptions).map((opt) => opt.value);
  if (selectedAreaIds.length === 0) return [];

  // Find departments whose area_id is in selectedAreaIds
  const coveredDeptIds: string[] = [];
  Array.from(deptSelect.options).forEach((option) => {
    const deptAreaId = option.dataset['areaId'];
    if (deptAreaId !== undefined && selectedAreaIds.includes(deptAreaId)) {
      coveredDeptIds.push(option.value);
    }
  });

  return coveredDeptIds;
}

/**
 * Filter teams in multi-select based on selected departments AND areas
 * Teams are hidden if:
 * - Their department is directly selected, OR
 * - Their department belongs to a selected area (area inheritance)
 */
export function filterTeamsBySelectedDepartmentsAndAreas(): void {
  const deptSelect = document.getElementById(ADMIN_FORM_ELEMENT_IDS.DEPARTMENTS_SELECT) as HTMLSelectElement | null;
  const teamSelect = document.getElementById(ADMIN_FORM_ELEMENT_IDS.TEAMS_SELECT) as HTMLSelectElement | null;

  if (deptSelect === null || teamSelect === null) return;

  // Get directly selected department IDs
  const selectedDeptIds = Array.from(deptSelect.selectedOptions).map((opt) => opt.value);

  // Get departments covered by selected areas
  const areaCoveredDeptIds = getDepartmentsCoveredByAreas();

  // Combine: all departments that cover teams
  const allCoveredDeptIds = [...new Set([...selectedDeptIds, ...areaCoveredDeptIds])];

  // Filter team options
  Array.from(teamSelect.options).forEach((option) => {
    const teamDeptId = option.dataset['departmentId'];

    if (teamDeptId !== undefined && allCoveredDeptIds.includes(teamDeptId)) {
      // Team belongs to a covered department → hide/disable
      option.disabled = true;
      option.hidden = true;
      option.selected = false;
    } else {
      // Team does NOT belong to covered department → show/enable
      option.disabled = false;
      option.hidden = false;
    }
  });

  console.info('[AdminForm] Filtered teams by departments/areas:', allCoveredDeptIds);
}

/**
 * Setup event listener on department select to filter teams dynamically
 * When departments change, teams belonging to those departments are hidden
 */
export function setupDepartmentTeamFilter(): void {
  const deptSelect = document.getElementById(ADMIN_FORM_ELEMENT_IDS.DEPARTMENTS_SELECT) as HTMLSelectElement | null;
  if (deptSelect === null) return;

  deptSelect.addEventListener('change', () => {
    filterTeamsBySelectedDepartmentsAndAreas();
  });

  console.info('[AdminForm] Department-Team filter setup complete');
}
