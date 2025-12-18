/**
 * KVP API Service
 * Handles all API communications for KVP functionality using v2 API
 */

import { ApiClient } from '../../utils/api-client';
import type {
  KvpSuggestion,
  KvpCategory,
  Department,
  StatsResponse,
  User,
  UserMeResponse,
  TeamResponse,
} from './types';

export class KvpApiService {
  private apiClient: ApiClient;

  constructor() {
    this.apiClient = ApiClient.getInstance();
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      // Get full user data including departmentId
      const userData = await this.apiClient.get<User & { departmentId?: number }>('/users/me');
      console.log('User data from /users/me:', userData);
      return userData;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  async loadCategories(): Promise<KvpCategory[]> {
    try {
      return await this.apiClient.get<KvpCategory[]>('/kvp/categories');
    } catch (error) {
      console.error('Error loading categories:', error);
      return [];
    }
  }

  async loadDepartments(): Promise<Department[]> {
    try {
      return await this.apiClient.get<Department[]>('/departments');
    } catch (error) {
      console.error('Error loading departments:', error);
      return [];
    }
  }

  async fetchSuggestions(params: URLSearchParams): Promise<KvpSuggestion[]> {
    try {
      // API returns { suggestions: [...], pagination: {...} }
      const response = await this.apiClient.get<{ suggestions: KvpSuggestion[]; pagination: unknown }>(
        `/kvp?${params}`,
      );
      return response.suggestions;
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      throw error; // Re-throw for caller to handle
    }
  }

  async shareSuggestion(id: number): Promise<void> {
    try {
      await this.apiClient.post(`/kvp/${id}/share`, {});
    } catch (error) {
      console.error('Error sharing suggestion:', error);
      throw error; // Re-throw for caller to handle
    }
  }

  async unshareSuggestion(id: number): Promise<void> {
    try {
      await this.apiClient.post(`/kvp/${id}/unshare`, {});
    } catch (error) {
      console.error('Error unsharing suggestion:', error);
      throw error; // Re-throw for caller to handle
    }
  }

  async fetchStatistics(): Promise<unknown> {
    try {
      return await this.apiClient.get('/kvp/dashboard/stats');
    } catch (error) {
      console.error('Error fetching statistics:', error);
      throw error; // Re-throw for caller to handle
    }
  }

  normalizeStatsData(statsData: unknown): StatsResponse {
    const rawData = statsData as StatsResponse;
    return rawData.company
      ? rawData
      : {
          company: {
            total: rawData.total ?? 0,
            byStatus: rawData.byStatus ?? {},
            totalSavings: rawData.totalSavings ?? 0,
          },
        };
  }

  async submitSuggestion(data: Record<string, unknown>): Promise<number> {
    try {
      const result = await this.apiClient.post<{ id: number }>('/kvp', data);
      return result.id;
    } catch (error) {
      console.error('Error submitting suggestion:', error);
      throw error; // Re-throw for caller to handle
    }
  }

  async uploadPhotos(suggestionId: number, photos: File[]): Promise<void> {
    console.info('Uploading photos:', photos.length, 'photos for suggestion', suggestionId);

    const formData = new FormData();
    photos.forEach((photo, index) => {
      console.info(`Adding photo ${index}:`, photo.name, photo.size, photo.type);
      formData.append('files', photo);
    });

    try {
      console.info('Sending photo upload request to v2 API');
      await this.apiClient.upload(`/kvp/${suggestionId}/attachments`, formData);
    } catch (error) {
      console.error('Error uploading photos:', error);
      throw error;
    }
  }

  async fetchUserInfo(): Promise<UserMeResponse> {
    return await this.apiClient.get<UserMeResponse>('/users/me');
  }

  async fetchTeams(): Promise<TeamResponse[]> {
    return await this.apiClient.get<TeamResponse[]>('/teams');
  }
}
