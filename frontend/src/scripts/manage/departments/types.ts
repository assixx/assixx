/**
 * Department Management - Type Definitions
 */

export interface Department {
  id: number;
  name: string;
  description?: string | null;
  managerId?: number | null;
  managerName?: string;
  areaId?: number | null;
  areaName?: string;
  parentId?: number | null;
  parentName?: string;
  status: 'active' | 'inactive' | 'restructuring';
  visibility?: 'public' | 'private';
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

export interface Area {
  id: number;
  name: string;
  type?: string;
  description?: string;
}

export type DepartmentStatusFilter = 'all' | 'active' | 'inactive';

export interface WindowWithDepartmentHandlers extends Window {
  editDepartment?: (id: number) => Promise<void>;
  deleteDepartment?: (id: number) => Promise<void>;
  showDepartmentModal?: () => void;
  hideDepartmentModal?: () => void;
  saveDepartment?: () => Promise<void>;
}
