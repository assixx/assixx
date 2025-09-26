// Admin Management Data Layer - API and Types
import { ApiClient } from '../../../utils/api-client';
import { mapUsers, type MappedUser, type UserAPIResponse } from '../../../utils/api-mappers';

// ===== INTERFACES & TYPES =====
export interface Admin extends MappedUser {
  tenantName?: string;
  notes?: string;
  lastLogin?: string;
  departments?: Department[];
  hasAllAccess?: boolean;
}

export interface Department {
  id: number;
  name: string;
  description?: string;
  can_read?: boolean;
  can_write?: boolean;
  can_delete?: boolean;
}

export interface Tenant {
  id: number;
  name?: string;
  company_name?: string;
  subdomain: string;
}

export interface AdminFormData {
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

// Load admin permissions
export async function loadAdminPermissions(
  adminId: number,
): Promise<{ departments: Department[]; hasAllAccess: boolean }> {
  try {
    const response = await apiClient.request<{
      permissions?: { departments?: Department[] };
      departments?: Department[];
      hasAllAccess?: boolean;
    }>(`/admin-permissions/${String(adminId)}`, { method: 'GET' }, { version: 'v2' });

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

    // Map the API response to ensure consistent field names
    // API v2 returns { admins: [...] }
    const adminData =
      typeof data === 'object' && 'admins' in data
        ? (data as { admins: UserAPIResponse[] }).admins
        : Array.isArray(data)
          ? data
          : [];
    const loadedAdmins = mapUsers(adminData as UserAPIResponse[]) as Admin[];
    console.info('Loaded admins:', loadedAdmins);

    // Load permissions for each admin
    for (const admin of loadedAdmins) {
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
