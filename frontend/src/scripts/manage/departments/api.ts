/**
 * Department Management - API Layer
 */

import type { ApiClient } from '../../../utils/api-client';
import type { Department, Area, AdminUser } from './types';
import { showSuccessAlert, showErrorAlert } from '../../utils/alerts';
import { loadAndPopulateAreas, loadAndPopulateDepartmentLeads } from './forms';

/**
 * API wrapper for department operations
 */
export class DepartmentAPI {
  constructor(private readonly apiClient: ApiClient) {}

  /**
   * Fetch all departments
   */
  async fetchAll(): Promise<Department[]> {
    try {
      const response = await this.apiClient.request<Department[]>('/departments', {
        method: 'GET',
      });
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error('Error loading departments:', error);
      showErrorAlert('Fehler beim Laden der Abteilungen');
      return [];
    }
  }

  /**
   * Create new department
   */
  async create(data: Partial<Department>): Promise<Department> {
    const cleanedData = { ...data };
    if (cleanedData.areaId === null || cleanedData.areaId === undefined || cleanedData.areaId === 0) {
      delete cleanedData.areaId;
    }

    const response = await this.apiClient.request<Department>('/departments', {
      method: 'POST',
      body: JSON.stringify(cleanedData),
    });

    showSuccessAlert('Abteilung erfolgreich erstellt');
    return response;
  }

  /**
   * Update existing department
   */
  async update(id: number, data: Partial<Department>): Promise<Department> {
    try {
      const response = await this.apiClient.request<Department>(`/departments/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      showSuccessAlert('Abteilung erfolgreich aktualisiert');
      return response;
    } catch (error) {
      console.error('Error updating department:', error);
      showErrorAlert('Fehler beim Aktualisieren der Abteilung');
      throw error;
    }
  }

  /**
   * Delete department
   * @param id - The department ID
   * @param force - If true, removes all dependencies before deleting
   */
  async delete(id: number, force: boolean = false): Promise<void> {
    try {
      const url = force ? `/departments/${id}?force=true` : `/departments/${id}`;
      await this.apiClient.request(url, {
        method: 'DELETE',
      });

      // Don't show success alert here - let the caller handle it
      // (different messages for normal vs force delete)
    } catch (error) {
      console.error('Error deleting department:', error);
      // Don't show error alert here - let the caller handle specific error cases
      throw error;
    }
  }

  /**
   * Get department details by ID
   */
  async getDetails(id: number): Promise<Department | null> {
    try {
      return await this.apiClient.request<Department>(`/departments/${id}`, {
        method: 'GET',
      });
    } catch (error) {
      console.error('Error getting department details:', error);
      showErrorAlert('Fehler beim Laden der Abteilungsdetails');
      return null;
    }
  }

  /**
   * Load areas for dropdown
   */
  async loadAreas(): Promise<Area[]> {
    try {
      const response = await this.apiClient.request<Area[]>('/areas', {
        method: 'GET',
      });

      const areas = Array.isArray(response) ? response : [];
      loadAndPopulateAreas(areas);
      return areas;
    } catch (error) {
      console.error('Error loading areas:', error);
      return [];
    }
  }

  /**
   * Load admin/root users for department lead dropdown
   * Fetches all users with role 'admin' or 'root'
   */
  async loadDepartmentLeads(): Promise<AdminUser[]> {
    try {
      // Fetch admins and roots separately (API may not support multiple role filter)
      const [adminsResponse, rootsResponse] = await Promise.all([
        this.apiClient.request<AdminUser[]>('/users?role=admin', { method: 'GET' }),
        this.apiClient.request<AdminUser[]>('/users?role=root', { method: 'GET' }),
      ]);

      const admins = Array.isArray(adminsResponse) ? adminsResponse : [];
      const roots = Array.isArray(rootsResponse) ? rootsResponse : [];

      // Combine and deduplicate by id
      const combined = [...roots, ...admins];
      const uniqueUsers = combined.filter((user, index, self) => index === self.findIndex((u) => u.id === user.id));

      loadAndPopulateDepartmentLeads(uniqueUsers);
      return uniqueUsers;
    } catch (error) {
      console.error('Error loading department leads:', error);
      return [];
    }
  }
}
