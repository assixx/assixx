/**
 * Department Management - API Layer
 */

import type { ApiClient } from '../../../utils/api-client';
import type { Department, Area } from './types';
import { showSuccessAlert, showErrorAlert } from '../../utils/alerts';
import { loadAndPopulateAreas } from './forms';

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
   */
  async delete(id: number): Promise<void> {
    try {
      await this.apiClient.request(`/departments/${id}`, {
        method: 'DELETE',
      });

      showSuccessAlert('Abteilung erfolgreich gelöscht');
    } catch (error) {
      console.error('Error deleting department:', error);
      showErrorAlert('Fehler beim Löschen der Abteilung');
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
}
