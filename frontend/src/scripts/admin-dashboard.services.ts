/**
 * Service classes for Admin Dashboard
 */

// eslint-disable-next-line max-classes-per-file
import type { User, Document } from '../types/api.types';
import { ApiClient } from '../utils/api-client';
import { mapUsers, type MappedUser } from '../utils/api-mappers';
import { getAuthToken, showSuccess } from './auth';
import type {
  DashboardStats,
  Department,
  Team,
  EmployeeFormData,
  BlackboardEntryExtended,
} from './admin-dashboard.types';

// Constants
const API_V2_DEPARTMENTS = '/api/v2/departments';
const API_V1_DEPARTMENTS = '/api/departments';
const API_V1_TEAMS = '/api/teams';

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

    // Check if any v2 APIs are enabled
    const useV2Users = window.FEATURE_FLAGS?.USE_API_V2_USERS === true;
    const useV2Documents = window.FEATURE_FLAGS?.USE_API_V2_DOCUMENTS === true;
    const useV2Departments = window.FEATURE_FLAGS?.USE_API_V2_DEPARTMENTS === true;
    const useV2Teams = window.FEATURE_FLAGS?.USE_API_V2_TEAMS === true;

    // If any v2 API is enabled, load individually
    if (useV2Users || useV2Documents || useV2Departments || useV2Teams) {
      return await this.loadStatsIndividually();
    }

    // Try v1 admin stats endpoint
    try {
      const response = await fetch('/api/admin/dashboard-stats', {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        const data = (await response.json()) as DashboardStats | { data: DashboardStats };
        return 'data' in data ? data.data : data;
      }
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }

    // Fallback to individual loading
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
      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_USERS === true;
      if (useV2) {
        const users = await this.apiClient.get<User[]>('/users?role=employee');
        return users.length;
      }

      const authToken = getAuthToken();
      const response = await fetch('/api/admin/employees', {
        headers: { Authorization: `Bearer ${authToken ?? ''}` },
      });
      if (response.ok) {
        const employees = (await response.json()) as User[];
        return employees.length;
      }
    } catch (error) {
      console.error('Error loading employee count:', error);
    }
    return 0;
  }

  private async getDocumentCount(): Promise<number> {
    try {
      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_DOCUMENTS === true;
      if (useV2) {
        const response = await this.apiClient.get<{ documents: Document[] }>('/documents');
        return response.documents.length;
      }

      const authToken = getAuthToken();
      const response = await fetch('/api/admin/documents', {
        headers: { Authorization: `Bearer ${authToken ?? ''}` },
      });
      if (response.ok) {
        const documents = (await response.json()) as Document[];
        return documents.length;
      }
    } catch {
      /* Error */
    }
    return 0;
  }

  private async getDepartmentCount(): Promise<number> {
    try {
      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_DEPARTMENTS === true;
      const apiPath = useV2 ? API_V2_DEPARTMENTS : API_V1_DEPARTMENTS;
      const authToken = getAuthToken();

      const response = await fetch(apiPath, {
        headers: { Authorization: `Bearer ${authToken ?? ''}` },
      });

      if (response.ok) {
        const data = (await response.json()) as Department[] | { data: Department[] };
        const departments = useV2 && !Array.isArray(data) && 'data' in data ? data.data : (data as Department[]);
        return departments.length;
      }
    } catch {
      /* Error */
    }
    return 0;
  }

  private async getTeamCount(): Promise<number> {
    try {
      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_TEAMS === true;
      if (useV2) {
        const teams = await this.apiClient.get<Team[]>('/teams');
        return teams.length;
      }

      const authToken = getAuthToken();
      const response = await fetch(API_V1_TEAMS, {
        headers: { Authorization: `Bearer ${authToken ?? ''}` },
      });
      if (response.ok) {
        const teams = (await response.json()) as Team[];
        return teams.length;
      }
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
      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_USERS === true;
      let employees: User[] = [];

      if (useV2) {
        employees = await this.apiClient.get<User[]>(`/users?role=employee&limit=${String(limit)}`);
      } else {
        const authToken = getAuthToken();
        const response = await fetch(`/api/users?role=employee&limit=${String(limit)}`, {
          headers: { Authorization: `Bearer ${authToken ?? ''}` },
        });

        if (!response.ok) {
          throw new Error('Failed to load recent employees');
        }

        const data = (await response.json()) as User[] | { users?: User[]; employees?: User[] };
        employees = Array.isArray(data) ? data : (data.users ?? data.employees ?? []);
      }

      return mapUsers(employees);
    } catch {
      return [];
    }
  }

  async createEmployee(formData: EmployeeFormData): Promise<void> {
    const useV2 = window.FEATURE_FLAGS?.USE_API_V2_USERS === true;

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

    if (useV2) {
      await this.apiClient.post('/users', userData);
    } else {
      const authToken = getAuthToken();
      const response = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken ?? ''}`,
        },
        body: JSON.stringify({
          ...userData,
          first_name: userData.firstName,
          last_name: userData.lastName,
          employee_id: userData.employeeId,
          department_id: userData.departmentId,
          birth_date: userData.birthDate,
          start_date: userData.startDate,
          house_number: userData.houseNumber,
          postal_code: userData.postalCode,
        }),
      });

      if (!response.ok) {
        const error = (await response.json()) as { message?: string };
        throw new Error(error.message ?? 'Failed to create employee');
      }
    }

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
      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_DEPARTMENTS === true;
      const apiPath = useV2 ? API_V2_DEPARTMENTS : API_V1_DEPARTMENTS;
      const authToken = getAuthToken();

      const response = await fetch(apiPath, {
        headers: { Authorization: `Bearer ${authToken ?? ''}` },
      });

      if (!response.ok) {
        throw new Error('Failed to load departments');
      }

      const data = (await response.json()) as Department[] | { data: Department[] };
      return useV2 && !Array.isArray(data) && 'data' in data ? data.data : (data as Department[]);
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
    const useV2 = window.FEATURE_FLAGS?.USE_API_V2_DEPARTMENTS === true;

    if (useV2) {
      await this.apiClient.post('/departments', data);
    } else {
      const authToken = getAuthToken();
      const response = await fetch(API_V1_DEPARTMENTS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken ?? ''}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = (await response.json()) as { message?: string };
        throw new Error(error.message ?? 'Failed to create department');
      }
    }

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
      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_TEAMS === true;

      if (useV2) {
        return await this.apiClient.get<Team[]>('/teams');
      }

      const authToken = getAuthToken();
      const response = await fetch(API_V1_TEAMS, {
        headers: { Authorization: `Bearer ${authToken ?? ''}` },
      });

      if (!response.ok) {
        throw new Error('Failed to load teams');
      }

      return (await response.json()) as Team[];
    } catch {
      return [];
    }
  }

  async createTeam(data: { name: string; departmentId: number; description?: string }): Promise<void> {
    const useV2 = window.FEATURE_FLAGS?.USE_API_V2_TEAMS === true;

    if (useV2) {
      await this.apiClient.post('/teams', data);
    } else {
      const authToken = getAuthToken();
      const response = await fetch(API_V1_TEAMS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken ?? ''}`,
        },
        body: JSON.stringify({
          name: data.name,
          department_id: data.departmentId,
          description: data.description,
        }),
      });

      if (!response.ok) {
        const error = (await response.json()) as { message?: string };
        throw new Error(error.message ?? 'Failed to create team');
      }
    }

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
      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_DOCUMENTS === true;

      if (useV2) {
        const response = await this.apiClient.get<{ documents: Document[] }>(`/documents?limit=${String(limit)}`);
        return response.documents;
      }

      const authToken = getAuthToken();
      const response = await fetch(`/api/documents?limit=${String(limit)}`, {
        headers: { Authorization: `Bearer ${authToken ?? ''}` },
      });

      if (!response.ok) {
        throw new Error('Failed to load recent documents');
      }

      const data = (await response.json()) as Document[] | { documents?: Document[] };
      return Array.isArray(data) ? data : (data.documents ?? []);
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

      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_BLACKBOARD === true;

      if (useV2) {
        return await this.apiClient.get<BlackboardEntryExtended[]>(
          `/blackboard/entries?limit=${String(limit)}&sortBy=created_at&sortDir=DESC`,
        );
      }

      const response = await fetch(`/api/blackboard/entries?limit=${String(limit)}&sortBy=created_at&sortOrder=DESC`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) {
        throw new Error('Failed to load blackboard entries');
      }

      const data = (await response.json()) as {
        entries?: BlackboardEntryExtended[];
      };
      return data.entries ?? [];
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

      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_BLACKBOARD === true;

      if (useV2) {
        return await this.apiClient.get<BlackboardEntryExtended[]>(`/blackboard/dashboard?limit=${String(limit)}`);
      }

      const response = await fetch(`/api/blackboard/dashboard?limit=${String(limit)}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) {
        throw new Error('Failed to load blackboard widget');
      }

      return (await response.json()) as BlackboardEntryExtended[];
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
