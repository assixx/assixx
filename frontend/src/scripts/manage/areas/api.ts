/**
 * Area Management - API Layer
 */

import type { ApiClient } from '../../../utils/api-client';
import type { Area } from './types';
import { showSuccessAlert, showErrorAlert } from '../../utils/alerts';

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
   */
  async create(data: Partial<Area>): Promise<Area> {
    const cleanedData = { ...data };

    // Clean up empty values
    if (cleanedData.parent_id === null || cleanedData.parent_id === undefined || cleanedData.parent_id === 0) {
      delete cleanedData.parent_id;
    }

    const response = await this.apiClient.post<Area>('/areas', cleanedData);

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
}
