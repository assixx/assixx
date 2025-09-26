/**
 * KVP API Service
 * Handles all API communications for KVP functionality with v1/v2 compatibility
 */

import { ApiClient } from '../../utils/api-client';
import { getAuthToken } from '../auth';
import type {
  KvpSuggestion,
  KvpCategory,
  Department,
  V1Suggestion,
  StatsResponse,
  User,
  UserMeResponse,
  TeamResponse,
} from './kvp-types';

export class KvpApiService {
  private apiClient: ApiClient;
  public readonly useV2API: boolean;

  constructor() {
    this.apiClient = ApiClient.getInstance();
    // Feature flags removed - always use v2
    this.useV2API = true;
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      if (this.useV2API) {
        // Get full user data including departmentId
        const userData = await this.apiClient.get<User & { departmentId?: number }>('/users/me');
        console.log('User data from /users/me:', userData);
        return userData;
      } else {
        // v1 fallback
        const token = getAuthToken();
        const response = await fetch('/api/users/me', {
          headers: {
            Authorization: `Bearer ${token ?? ''}`,
          },
        });

        if (!response.ok) throw new Error('Failed to get user info');

        interface V1UserResponse {
          user: User & {
            tenant_id?: number;
            department_id?: number;
          };
        }
        const data = (await response.json()) as V1UserResponse;
        // Convert snake_case to camelCase for v1
        return {
          ...data.user,
          tenantId: (data.user as { tenant_id?: number }).tenant_id ?? data.user.tenantId,
          departmentId: (data.user as { department_id?: number }).department_id ?? data.user.departmentId,
        };
      }
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  async loadCategories(): Promise<KvpCategory[]> {
    try {
      if (this.useV2API) {
        // v2 API
        return await this.apiClient.get<KvpCategory[]>('/kvp/categories');
      } else {
        // v1 fallback
        const token = getAuthToken();
        const response = await fetch('/api/kvp/categories', {
          headers: {
            Authorization: `Bearer ${token ?? ''}`,
          },
        });

        if (!response.ok) throw new Error('Failed to load categories');

        const data = (await response.json()) as { categories?: KvpCategory[] };
        return data.categories ?? [];
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      return [];
    }
  }

  async loadDepartments(): Promise<Department[]> {
    try {
      if (this.useV2API) {
        // v2 API
        return await this.apiClient.get<Department[]>('/departments');
      } else {
        // v1 fallback
        const token = getAuthToken();
        const response = await fetch('/api/departments', {
          headers: {
            Authorization: `Bearer ${token ?? ''}`,
          },
        });

        if (!response.ok) throw new Error('Failed to load departments');

        const data = (await response.json()) as { departments?: Department[] };
        return data.departments ?? [];
      }
    } catch (error) {
      console.error('Error loading departments:', error);
      return [];
    }
  }

  async fetchSuggestions(params: URLSearchParams): Promise<KvpSuggestion[]> {
    if (this.useV2API) {
      return await this.apiClient.get<KvpSuggestion[]>(`/kvp?${params}`);
    }

    return await this.fetchV1Suggestions(params);
  }

  private async fetchV1Suggestions(params: URLSearchParams): Promise<KvpSuggestion[]> {
    const token = getAuthToken();
    const response = await fetch(`/api/kvp?${params}`, {
      headers: {
        Authorization: `Bearer ${token ?? ''}`,
      },
    });

    if (!response.ok) throw new Error('Failed to load suggestions');

    const data = (await response.json()) as { suggestions?: KvpSuggestion[] };
    return (data.suggestions ?? []).map((s) => this.convertSuggestionToCamelCase(s));
  }

  private convertSuggestionToCamelCase(suggestion: unknown): KvpSuggestion {
    const s = suggestion as V1Suggestion;
    return this.mapV1ToKvpSuggestion(s);
  }

  private mapV1ToKvpSuggestion(s: V1Suggestion): KvpSuggestion {
    // Helper to get value from snake_case or camelCase
    const getVal = <T>(snake: T | undefined, camel: T | undefined, def: T): T => snake ?? camel ?? def;

    return {
      id: s.id,
      title: s.title,
      description: s.description,
      status: s.status as KvpSuggestion['status'],
      priority: s.priority as KvpSuggestion['priority'],
      orgLevel: getVal(s.org_level, s.orgLevel, 'department') as KvpSuggestion['orgLevel'],
      orgId: getVal(s.org_id, s.orgId, 0),
      departmentId: getVal(s.department_id, s.departmentId, 0),
      departmentName: getVal(s.department_name, s.departmentName, ''),
      submittedBy: getVal(s.submitted_by, s.submittedBy, 0),
      submittedByName: getVal(s.submitted_by_name, s.submittedByName, ''),
      submittedByLastname: getVal(s.submitted_by_lastname, s.submittedByLastname, ''),
      categoryId: getVal(s.category_id, s.categoryId, 0),
      categoryName: getVal(s.category_name, s.categoryName, ''),
      categoryIcon: getVal(s.category_icon, s.categoryIcon, ''),
      categoryColor: getVal(s.category_color, s.categoryColor, ''),
      sharedBy: s.shared_by ?? s.sharedBy,
      sharedByName: s.shared_by_name ?? s.sharedByName,
      sharedAt: s.shared_at ?? s.sharedAt,
      createdAt: getVal(s.created_at, s.createdAt, ''),
      expectedBenefit: s.expected_benefit ?? s.expectedBenefit,
      estimatedCost: s.estimated_cost ?? s.estimatedCost,
      actualSavings: s.actual_savings ?? s.actualSavings,
      attachmentCount: s.attachment_count ?? s.attachmentCount,
      roi: s.roi,
    };
  }

  async shareSuggestion(id: number): Promise<void> {
    if (this.useV2API) {
      // v2 API
      await this.apiClient.post(`/kvp/${id}/share`, {});
    } else {
      // v1 fallback
      const token = getAuthToken();
      const response = await fetch(`/api/kvp/${id}/share`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token ?? ''}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to share suggestion');
    }
  }

  async unshareSuggestion(id: number): Promise<void> {
    if (this.useV2API) {
      // v2 API
      await this.apiClient.post(`/kvp/${id}/unshare`, {});
    } else {
      // v1 fallback
      const token = getAuthToken();
      const response = await fetch(`/api/kvp/${id}/unshare`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token ?? ''}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to unshare suggestion');
    }
  }

  async fetchStatistics(): Promise<unknown> {
    if (this.useV2API) {
      return await this.apiClient.get('/kvp/dashboard/stats');
    }

    const token = getAuthToken();
    const response = await fetch('/api/kvp/stats', {
      headers: { Authorization: `Bearer ${token ?? ''}` },
    });
    if (!response.ok) throw new Error('Failed to load statistics');
    return await response.json();
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
    if (this.useV2API) {
      return await this.submitV2Suggestion(data);
    }
    return await this.submitV1Suggestion(data);
  }

  private async submitV2Suggestion(data: Record<string, unknown>): Promise<number> {
    const result = await this.apiClient.post<{ id: number }>('/kvp', data);
    return result.id;
  }

  private async submitV1Suggestion(data: Record<string, unknown>): Promise<number> {
    const token = getAuthToken();
    const response = await fetch('/api/kvp', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = (await response.json()) as { message?: string };
      throw new Error(error.message ?? 'Fehler beim Erstellen des Vorschlags');
    }

    const result = (await response.json()) as { suggestion: { id: number } };
    return result.suggestion.id;
  }

  async uploadPhotos(suggestionId: number, photos: File[]): Promise<void> {
    console.info('Uploading photos:', photos.length, 'photos for suggestion', suggestionId);

    const formData = new FormData();
    photos.forEach((photo, index) => {
      console.info(`Adding photo ${index}:`, photo.name, photo.size, photo.type);
      formData.append('files', photo);
    });

    try {
      if (this.useV2API) {
        // v2 API
        console.info('Sending photo upload request to v2 API');
        await this.apiClient.upload(`/kvp/${suggestionId}/attachments`, formData);
      } else {
        // v1 fallback
        const token = getAuthToken();
        console.info('Sending photo upload request to:', `/api/kvp/${suggestionId}/attachments`);
        const response = await fetch(`/api/kvp/${suggestionId}/attachments`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token ?? ''}`,
          },
          body: formData,
        });

        console.info('Upload response status:', response.status);
        const responseData = (await response.json()) as { message?: string };
        console.info('Upload response data:', responseData);

        if (!response.ok) {
          console.error('Fehler beim Hochladen der Fotos:', responseData);
          throw new Error(responseData.message ?? 'Upload fehlgeschlagen');
        }
      }
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
