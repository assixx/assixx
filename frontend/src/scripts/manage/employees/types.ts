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
  employee_id?: string; // Database field name
  employeeNumber?: string; // Employee Number field
  employee_number?: string; // snake_case version
  departmentId?: number;
  departmentName?: string;
  department_name?: string; // snake_case version
  teamId?: number;
  teamName?: string;
  team_name?: string; // snake_case version
  position?: string;
  hireDate?: string;
  birthday?: string; // Birthday field for form
  status: 'active' | 'inactive' | 'vacation' | 'sick' | 'terminated';
  // Availability fields - both snake_case and camelCase
  availabilityStatus?: string;
  availability_status?: string;
  availabilityReason?: string;
  availableFrom?: string;
  availabilityStart?: string;
  availability_start?: string;
  availabilityEnd?: string;
  availability_end?: string;
  availabilityNotes?: string;
  availability_notes?: string;
  // Add both snake_case and camelCase for compatibility
  first_name?: string;
  last_name?: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean | number; // API v2 camelCase (can be boolean or 0/1)
  phone?: string;
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
