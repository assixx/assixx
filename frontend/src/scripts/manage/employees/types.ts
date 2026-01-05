/**
 * Types and Interfaces for Employee Management
 * Shared type definitions used across employee management modules
 */

import type { ApiClient } from '../../../utils/api-client';
import type { User } from '../../../types/api.types';

/**
 * Interface describing the EmployeesManager methods needed by data.ts and forms.ts
 * Avoids circular dependencies while maintaining type safety
 */
export interface IEmployeesManager {
  apiClient: ApiClient;
  employees: Employee[];
  currentEmployeeId: number | null;
  getEmployeeDetails(id: number): Promise<Employee | null>;
  deleteEmployee(id: number): Promise<void>;
  updateEmployee(id: number, data: Partial<Employee>): Promise<Employee>;
  createEmployee(data: Partial<Employee>): Promise<Employee>;
  loadEmployees(): Promise<void>;
  loadAreas(): Promise<Area[]>;
  loadDepartments(): Promise<Department[]>;
  loadTeams(): Promise<Team[]>;
  handleEmployeeSaveError(error: unknown): void;
  confirmDelete(employeeId: number): Promise<void>;
}

export interface Employee extends User {
  employeeId?: string | undefined;
  // employeeNumber inherited from User
  // N:M REFACTORING: Legacy single IDs (for backward compatibility)
  // departmentId inherited from User - DEPRECATED, use departmentIds
  departmentName?: string | undefined;
  // teamId inherited from User - DEPRECATED, use teamIds
  teamName?: string | undefined;
  // INHERITANCE-FIX: Full inheritance chain from Team → Department → Area
  teamDepartmentId?: number | undefined;
  teamDepartmentName?: string | undefined;
  teamAreaId?: number | undefined;
  teamAreaName?: string | undefined;
  // N:M REFACTORING: New array fields for multiple assignments
  areas?: Area[];
  departments?: Department[];
  teams?: Team[];
  areaIds?: number[];
  areaNames?: string[];
  departmentIds?: number[];
  departmentNames?: string[];
  teamIds?: number[];
  teamNames?: string[];
  hasFullAccess?: boolean | number; // 1 or true = full tenant access
  // position inherited from User
  hireDate?: string;
  dateOfBirth?: string; // Date of birth field for form
  status: 'active' | 'inactive' | 'vacation' | 'sick' | 'terminated';
  // Availability fields (availabilityStatus, availabilityStart, availabilityEnd, availabilityNotes inherited from User)
  availabilityReason?: string;
  availableFrom?: string;
  // firstName, lastName, isActive, phone inherited from User
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  availability?: 'available' | 'busy' | 'away' | 'offline';
  notes?: string;
  contractType?: 'permanent' | 'contract' | 'parttime' | 'intern';
  salary?: number;
  workingHours?: number;
  vacationDays?: number;
}

export interface Area {
  id: number;
  name: string;
  description?: string;
  departmentCount?: number;
}

export interface Department {
  id: number;
  name: string;
  areaId?: number;
  areaName?: string;
}

export interface Team {
  id: number;
  name: string;
  departmentId?: number;
  departmentName?: string;
}

export interface WindowWithEmployeeHandlers extends Window {
  loadEmployeesTable?: () => Promise<void>;
  editEmployee?: (id: number) => Promise<void>;
  deleteEmployee?: (id: number) => Promise<void>;
  showEmployeeModal?: () => void;
  hideEmployeeModal?: () => void;
  closeEmployeeModal?: () => void; // Alias for hideEmployeeModal
  saveEmployee?: () => Promise<void>;
  loadAreasForEmployeeSelect?: () => Promise<void>;
  loadDepartmentsForEmployeeSelect?: () => Promise<void>;
  loadTeamsForEmployeeSelect?: () => Promise<void>;
}
