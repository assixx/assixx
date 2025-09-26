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

// Cache TTL in milliseconds
const CACHE_TTL = 30000; // 30 seconds

// Global cache for API data to prevent duplicate calls
interface ApiCache {
  departments?: { data: Department[]; timestamp: number };
  teams?: { data: Team[]; timestamp: number };
  employees?: { data: User[]; timestamp: number };
  documents?: { data: Document[]; timestamp: number };
}

const apiCache: ApiCache = {};

// Helper to check if cache is valid
function isCacheValid(timestamp: number | undefined): boolean {
  if (timestamp === undefined || timestamp === 0) return false;
  return Date.now() - timestamp < CACHE_TTL;
}

/**
 * Service for handling dashboard statistics
 */
export class DashboardService {
  // DashboardService only uses cached data, no direct API calls

  loadStats(): DashboardStats {
    const authToken = getAuthToken();
    if (authToken === null || authToken === '') {
      throw new Error('No authentication token');
    }

    // Use cached data counts instead of making separate API calls
    return {
      employeeCount: this.getEmployeeCount(),
      documentCount: this.getDocumentCount(),
      departmentCount: this.getDepartmentCount(),
      teamCount: this.getTeamCount(),
    };
  }

  private getEmployeeCount(): number {
    // Check if we have valid cached employees data
    if (apiCache.employees !== undefined && isCacheValid(apiCache.employees.timestamp)) {
      return apiCache.employees.data.length;
    }
    // Data will be loaded by EmployeeService.loadAllEmployees()
    return 0;
  }

  private getDocumentCount(): number {
    // Check if we have valid cached documents data
    if (apiCache.documents !== undefined && isCacheValid(apiCache.documents.timestamp)) {
      return apiCache.documents.data.length;
    }
    // Data will be loaded by DocumentService.loadAllDocuments()
    return 0;
  }

  private getDepartmentCount(): number {
    // Check if we have valid cached departments data
    if (apiCache.departments !== undefined && isCacheValid(apiCache.departments.timestamp)) {
      return apiCache.departments.data.length;
    }
    // Data will be loaded by DepartmentService.loadDepartments()
    return 0;
  }

  private getTeamCount(): number {
    // Check if we have valid cached teams data
    if (apiCache.teams !== undefined && isCacheValid(apiCache.teams.timestamp)) {
      return apiCache.teams.data.length;
    }
    // Data will be loaded by TeamService.loadTeams()
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
      // First ensure we have all employees loaded and cached
      await this.loadAllEmployees();

      // Return the most recent employees from cache
      if (apiCache.employees !== undefined && isCacheValid(apiCache.employees.timestamp)) {
        const recentEmployees = apiCache.employees.data.slice(0, limit);
        return mapUsers(recentEmployees);
      }

      return [];
    } catch {
      return [];
    }
  }

  async loadAllEmployees(): Promise<User[]> {
    // Check cache first
    if (apiCache.employees !== undefined && isCacheValid(apiCache.employees.timestamp)) {
      return apiCache.employees.data;
    }

    try {
      // Capture timestamp before async operation
      const fetchStartTime = Date.now();
      const employees = await this.apiClient.get<User[]>('/users?role=employee');

      // Only update cache if it wasn't updated by another operation while we were fetching
      if (apiCache.employees === undefined || apiCache.employees.timestamp < fetchStartTime) {
        apiCache.employees = {
          data: employees,
          timestamp: Date.now(),
        };
      }

      return employees;
    } catch (error) {
      console.error('Error loading employees:', error);
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
    // Check cache first
    if (apiCache.departments !== undefined && isCacheValid(apiCache.departments.timestamp)) {
      return apiCache.departments.data;
    }

    try {
      // Capture timestamp before async operation
      const fetchStartTime = Date.now();
      const departments = await this.apiClient.get<Department[]>('/departments');

      // Only update cache if it wasn't updated by another operation while we were fetching
      if (apiCache.departments === undefined || apiCache.departments.timestamp < fetchStartTime) {
        apiCache.departments = {
          data: departments,
          timestamp: Date.now(),
        };
      }

      return departments;
    } catch (error) {
      console.error('Error loading departments:', error);
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
    // Clear cache after creating new department
    delete apiCache.departments;
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
    // Check cache first
    if (apiCache.teams !== undefined && isCacheValid(apiCache.teams.timestamp)) {
      return apiCache.teams.data;
    }

    try {
      // Capture timestamp before async operation
      const fetchStartTime = Date.now();
      const teams = await this.apiClient.get<Team[]>('/teams');

      // Only update cache if it wasn't updated by another operation while we were fetching
      if (apiCache.teams === undefined || apiCache.teams.timestamp < fetchStartTime) {
        apiCache.teams = {
          data: teams,
          timestamp: Date.now(),
        };
      }

      return teams;
    } catch (error) {
      console.error('Error loading teams:', error);
      return [];
    }
  }

  async createTeam(data: { name: string; departmentId: number; description?: string }): Promise<void> {
    await this.apiClient.post('/teams', data);
    // Clear cache after creating new team
    delete apiCache.teams;
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
      // First ensure we have all documents loaded and cached
      await this.loadAllDocuments();

      // Return the most recent documents from cache
      if (apiCache.documents !== undefined && isCacheValid(apiCache.documents.timestamp)) {
        return apiCache.documents.data.slice(0, limit);
      }

      return [];
    } catch {
      return [];
    }
  }

  async loadAllDocuments(): Promise<Document[]> {
    // Check cache first
    if (apiCache.documents !== undefined && isCacheValid(apiCache.documents.timestamp)) {
      return apiCache.documents.data;
    }

    try {
      // Capture timestamp before async operation
      const fetchStartTime = Date.now();
      const response = await this.apiClient.get<{ documents: Document[] }>('/documents');
      const documents = response.documents;

      // Only update cache if it wasn't updated by another operation while we were fetching
      if (apiCache.documents === undefined || apiCache.documents.timestamp < fetchStartTime) {
        apiCache.documents = {
          data: documents,
          timestamp: Date.now(),
        };
      }

      return documents;
    } catch (error) {
      console.error('Error loading documents:', error);
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
