/**
 * Department Management - Type Definitions
 */

export interface Department {
  id: number;
  name: string;
  description?: string | null;
  departmentLeadId?: number | null;
  departmentLeadName?: string | null;
  areaId?: number | null;
  areaName?: string | null;
  parentId?: number | null;
  parentName?: string | null;
  isActive: boolean;
  isArchived?: boolean;
  employeeCount?: number;
  employeeNames?: string;
  teamCount?: number;
  teamNames?: string;
  machineCount?: number;
  budget?: number;
  costCenter?: string;
  foundedDate?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  tenantId?: number;
  createdBy?: number;
}

/**
 * Admin/Root user for department lead dropdown
 */
export interface AdminUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: 'admin' | 'root';
}

export interface Area {
  id: number;
  name: string;
  type?: string;
  description?: string;
}

export type DepartmentStatusFilter = 'all' | 'active' | 'inactive' | 'archived';

export interface WindowWithDepartmentHandlers extends Window {
  editDepartment?: (id: number) => Promise<void>;
  deleteDepartment?: (id: number) => Promise<void>;
  showDepartmentModal?: () => void;
  hideDepartmentModal?: () => void;
  saveDepartment?: () => Promise<void>;
}
