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
  loadDepartments(): Promise<Department[]>;
  loadTeams(): Promise<Team[]>;
  handleEmployeeSaveError(error: unknown): void;
  confirmDelete(employeeId: number): Promise<void>;
}

export interface Employee extends User {
  employeeId?: string;
  // employeeNumber inherited from User
  // departmentId inherited from User
  departmentName?: string;
  // teamId inherited from User
  teamName?: string;
  // position inherited from User
  hireDate?: string;
  birthday?: string; // Birthday field for form
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

export interface Department {
  id: number;
  name: string;
  areaId?: number;
}

export interface Team {
  id: number;
  name: string;
  departmentId?: number;
}

export interface WindowWithEmployeeHandlers extends Window {
  loadEmployeesTable?: () => Promise<void>;
  editEmployee?: (id: number) => Promise<void>;
  deleteEmployee?: (id: number) => Promise<void>;
  showEmployeeModal?: () => void;
  hideEmployeeModal?: () => void;
  closeEmployeeModal?: () => void; // Alias for hideEmployeeModal
  saveEmployee?: () => Promise<void>;
  loadDepartmentsForEmployeeSelect?: () => Promise<void>;
  loadTeamsForEmployeeSelect?: () => Promise<void>;
}
