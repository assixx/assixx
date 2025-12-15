/**
 * Area Management - API Layer
 */

import type { ApiClient } from '../../../utils/api-client';
import type { Area, Department, AdminUser } from './types';
import { showSuccessAlert, showErrorAlert } from '../../utils/alerts';
import { loadAndPopulateAreaLeads } from './forms';

/**
 * API wrapper for area operations
 */
export class AreaAPI {
  constructor(private readonly apiClient: ApiClient) {}

  /**
   * Fetch all areas
   */
  async fetchAll(): Promise<Area[]> {
    try {
      const response = await this.apiClient.request<Area[] | { success: boolean; data: Area[]; message: string }>(
        '/areas',
        {
          method: 'GET',
        },
      );

      // Handle both response formats (direct array or wrapped)
      if (Array.isArray(response)) {
        return response;
      } else if (typeof response === 'object' && 'data' in response) {
        const typedResponse = response as { success: boolean; data: Area[]; message: string };
        return Array.isArray(typedResponse.data) ? typedResponse.data : [];
      }

      console.error('Invalid response structure:', response);
      return [];
    } catch (error) {
      console.error('Error loading areas:', error);
      showErrorAlert('Fehler beim Laden der Bereiche');
      return [];
    }
  }

  /**
   * Create new area
   * NOTE: parent_id removed (2025-11-29) - areas are now flat (non-hierarchical)
   */
  async create(data: Partial<Area>): Promise<Area> {
    const response = await this.apiClient.post<Area>('/areas', data);

    showSuccessAlert('Bereich erfolgreich erstellt');
    return response;
  }

  /**
   * Update existing area
   */
  async update(id: number, data: Partial<Area>): Promise<Area> {
    try {
      const response = await this.apiClient.put<Area>(`/areas/${id}`, data);

      showSuccessAlert('Bereich erfolgreich aktualisiert');
      return response;
    } catch (error) {
      console.error('Error updating area:', error);
      showErrorAlert('Fehler beim Aktualisieren des Bereichs');
      throw error;
    }
  }

  /**
   * Delete area
   * @param id - The area ID
   * @param force - If true, removes all dependencies before deleting
   */
  async delete(id: number, force: boolean = false): Promise<void> {
    try {
      const url = force ? `/areas/${id}?force=true` : `/areas/${id}`;
      await this.apiClient.delete(url);

      // Don't show success alert here - let the caller handle it
      // (different messages for normal vs force delete)
    } catch (error) {
      console.error('Error deleting area:', error);
      // Don't show error alert here - let the caller handle specific error cases
      throw error;
    }
  }

  /**
   * Get area details by ID
   */
  async getDetails(id: number): Promise<Area | null> {
    try {
      return await this.apiClient.request<Area>(`/areas/${id}`, {
        method: 'GET',
      });
    } catch (error) {
      console.error('Error getting area details:', error);
      showErrorAlert('Fehler beim Laden der Bereichsdetails');
      return null;
    }
  }

  /**
   * Fetch all departments (for multi-select dropdown)
   */
  async fetchAllDepartments(): Promise<Department[]> {
    try {
      const response = await this.apiClient.request<Department[] | { success: boolean; data: Department[] }>(
        '/departments',
        { method: 'GET' },
      );

      if (Array.isArray(response)) {
        return response;
      } else if (typeof response === 'object' && 'data' in response) {
        return Array.isArray(response.data) ? response.data : [];
      }

      return [];
    } catch (error) {
      console.error('Error loading departments:', error);
      return [];
    }
  }

  /**
   * Assign departments to an area (bulk update)
   * Sets area_id for selected departments, clears area_id for unselected
   * @param areaId - The area ID to assign departments to
   * @param departmentIds - Array of department IDs to assign
   */
  async assignDepartments(areaId: number, departmentIds: number[]): Promise<void> {
    try {
      await this.apiClient.post(`/areas/${areaId}/departments`, { departmentIds });
    } catch (error) {
      console.error('Error assigning departments:', error);
      showErrorAlert('Fehler beim Zuweisen der Abteilungen');
      throw error;
    }
  }

  /**
   * Load admin/root users for area lead dropdown
   * Fetches all users with role 'admin' or 'root'
   */
  async loadAreaLeads(): Promise<AdminUser[]> {
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

      loadAndPopulateAreaLeads(uniqueUsers);
      return uniqueUsers;
    } catch (error) {
      console.error('Error loading area leads:', error);
      return [];
    }
  }
}
