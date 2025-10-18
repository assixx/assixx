/**
 * Root User Management - Data Layer
 * API calls, data fetching, and state management
 */

import { ApiClient } from '../../../utils/api-client';

// Interfaces
export interface RootUser {
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

export interface FormValues {
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

// Module-level state
export let currentEditId: number | null = null;
export let allRootUsers: RootUser[] = []; // Cache for all root users

// API client instance
const apiClient = ApiClient.getInstance();

/**
 * Set current edit ID
 */
export function setCurrentEditId(id: number | null): void {
  currentEditId = id;
}

/**
 * Load all root users from API
 */
export async function loadRootUsers(): Promise<RootUser[]> {
  const data = await apiClient.request<{ users: RootUser[] }>('/root/users', { method: 'GET' }, { version: 'v2' });

  // Get current user ID to exclude from list
  const currentUserId = getCurrentUserId();

  // Cache all users (excluding current user)
  allRootUsers = data.users.filter((user) => user.id !== currentUserId);

  return allRootUsers;
}

/**
 * Load departments for dropdown
 */
export async function loadDepartments(): Promise<{ id: number; name: string }[]> {
  return await apiClient.request<{ id: number; name: string }[]>('/departments', { method: 'GET' }, { version: 'v2' });
}

/**
 * Delete root user by ID
 */
export async function deleteRootUserAPI(userId: number): Promise<void> {
  await apiClient.request(`/root/users/${userId}`, { method: 'DELETE' }, { version: 'v2' });
}

/**
 * Save root user (create or update)
 */
export async function saveRootUser(
  userData: Partial<FormValues>,
  isEdit: boolean,
  editId: number | null,
): Promise<void> {
  const endpoint = isEdit && editId !== null ? `/root/users/${editId}` : '/root/users';
  const method = isEdit ? 'PUT' : 'POST';

  await apiClient.request(endpoint, { method, body: JSON.stringify(userData) }, { version: 'v2' });
}

/**
 * Get current user ID from localStorage
 * Tries userId first, then decodes from token as fallback
 */
function getCurrentUserId(): number | null {
  const userId = localStorage.getItem('userId');
  if (userId !== null && userId !== '') {
    return Number.parseInt(userId, 10);
  }

  // Fallback: decode from token
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
}
