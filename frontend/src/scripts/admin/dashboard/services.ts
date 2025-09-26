/**
 * Service classes for Admin Dashboard
 */

// eslint-disable-next-line max-classes-per-file
import type { User, Document } from '../../../types/api.types';
import { ApiClient } from '../../../utils/api-client';
import { mapUsers, type MappedUser } from '../../../utils/api-mappers';
import { getAuthToken, showSuccess } from '../../auth';
import type { DashboardStats, Department, Team, EmployeeFormData, BlackboardEntryExtended } from './types';

// Constants - No longer needed as we only use v2 APIs via apiClient

/**
 * Service for handling dashboard statistics
 */
export class DashboardService {
  private apiClient: ApiClient;

  constructor() {
    this.apiClient = ApiClient.getInstance();
  }

  async loadStats(): Promise<DashboardStats> {
    const authToken = getAuthToken();
    if (authToken === null || authToken === '') {
      throw new Error('No authentication token');
    }

    // Always use v2 APIs - load stats individually
    return await this.loadStatsIndividually();
  }

  private async loadStatsIndividually(): Promise<DashboardStats> {
    const [employeeCount, documentCount, departmentCount, teamCount] = await Promise.all([
      this.getEmployeeCount(),
      this.getDocumentCount(),
      this.getDepartmentCount(),
      this.getTeamCount(),
    ]);

    return {
      employeeCount,
      documentCount,
      departmentCount,
      teamCount,
    };
  }

  private async getEmployeeCount(): Promise<number> {
    try {
      const users = await this.apiClient.get<User[]>('/users?role=employee');
      return users.length;
    } catch (error) {
      console.error('Error loading employee count:', error);
    }
    return 0;
  }

  private async getDocumentCount(): Promise<number> {
    try {
      const response = await this.apiClient.get<{ documents: Document[] }>('/documents');
      return response.documents.length;
    } catch {
      /* Error */
    }
    return 0;
  }

  private async getDepartmentCount(): Promise<number> {
    try {
      const departments = await this.apiClient.get<Department[]>('/departments');
      return departments.length;
    } catch {
      /* Error */
    }
    return 0;
  }

  private async getTeamCount(): Promise<number> {
    try {
      const teams = await this.apiClient.get<Team[]>('/teams');
      return teams.length;
    } catch {
      /* Error */
    }
    return 0;
  }
}

/**
 * Service for handling employee operations
 */
export class EmployeeService {
  private apiClient: ApiClient;

  constructor() {
    this.apiClient = ApiClient.getInstance();
  }

  async loadRecentEmployees(limit = 5): Promise<MappedUser[]> {
    try {
      const employees = await this.apiClient.get<User[]>(`/users?role=employee&limit=${String(limit)}`);
      return mapUsers(employees);
    } catch {
      return [];
    }
  }

  async createEmployee(formData: EmployeeFormData): Promise<void> {
    const userData = {
      username: formData.email.split('@')[0],
      email: formData.email,
      password: formData.password,
      firstName: formData.firstName,
      lastName: formData.lastName,
      employeeId: formData.employeeId,
      departmentId: formData.departmentId ?? null,
      phone: formData.phone ?? '',
      birthDate: formData.birthDate ?? null,
      startDate: formData.startDate ?? null,
      street: formData.street ?? '',
      houseNumber: formData.houseNumber ?? '',
      postalCode: formData.postalCode ?? '',
      city: formData.city ?? '',
      role: 'employee' as const,
    };

    await this.apiClient.post('/users', userData);
    showSuccess('Mitarbeiter erfolgreich erstellt!');
  }
}

/**
 * Service for handling department operations
 */
export class DepartmentService {
  private apiClient: ApiClient;

  constructor() {
    this.apiClient = ApiClient.getInstance();
  }

  async loadDepartments(): Promise<Department[]> {
    try {
      return await this.apiClient.get<Department[]>('/departments');
    } catch {
      return [];
    }
  }

  async createDepartment(data: {
    name: string;
    description?: string;
    status?: string;
    visibility?: string;
  }): Promise<void> {
    await this.apiClient.post('/departments', data);
    showSuccess('Abteilung erfolgreich erstellt');
  }
}

/**
 * Service for handling team operations
 */
export class TeamService {
  private apiClient: ApiClient;

  constructor() {
    this.apiClient = ApiClient.getInstance();
  }

  async loadTeams(): Promise<Team[]> {
    try {
      return await this.apiClient.get<Team[]>('/teams');
    } catch {
      return [];
    }
  }

  async createTeam(data: { name: string; departmentId: number; description?: string }): Promise<void> {
    await this.apiClient.post('/teams', data);
    showSuccess('Team erfolgreich erstellt');
  }
}

/**
 * Service for handling document operations
 */
export class DocumentService {
  private apiClient: ApiClient;

  constructor() {
    this.apiClient = ApiClient.getInstance();
  }

  async loadRecentDocuments(limit = 5): Promise<Document[]> {
    try {
      const response = await this.apiClient.get<{ documents: Document[] }>(`/documents?limit=${String(limit)}`);
      return response.documents;
    } catch {
      return [];
    }
  }
}

/**
 * Service for handling blackboard operations
 */
export class BlackboardService {
  private apiClient: ApiClient;

  constructor() {
    this.apiClient = ApiClient.getInstance();
  }

  async loadPreview(limit = 3): Promise<BlackboardEntryExtended[]> {
    try {
      const authToken = getAuthToken();
      if (authToken === null || authToken === '') {
        throw new Error('No auth token');
      }

      return await this.apiClient.get<BlackboardEntryExtended[]>(
        `/blackboard/entries?limit=${String(limit)}&sortBy=created_at&sortDir=DESC`,
      );
    } catch {
      return [];
    }
  }

  async loadWidget(limit = 3): Promise<BlackboardEntryExtended[]> {
    try {
      const authToken = getAuthToken();
      if (authToken === null || authToken === '') {
        throw new Error('No auth token');
      }

      return await this.apiClient.get<BlackboardEntryExtended[]>(`/blackboard/dashboard?limit=${String(limit)}`);
    } catch {
      return [];
    }
  }

  getPriorityLabel(priority: string): string {
    if (priority === 'urgent') return 'Dringend';
    if (priority === 'high') return 'Hoch';
    if (priority === 'normal') return 'Normal';
    if (priority === 'low') return 'Niedrig';
    if (priority === 'critical') return 'Kritisch';
    if (priority === 'medium') return 'Mittel';
    return 'Normal';
  }
}
