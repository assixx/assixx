/**
 * Department Groups Management - Type Definitions
 */

export interface DepartmentGroup {
  id: number;
  name: string;
  description?: string | null;
  parentGroupId?: number | null;
  parentName?: string;
  departments?: Department[];
  subgroups?: DepartmentGroup[];
  employeeCount?: number;
  departmentCount?: number;
  status?: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
  tenantId?: number;
  createdBy?: number;
}

export interface Department {
  id: number;
  name: string;
  description?: string | null;
  status?: 'active' | 'inactive';
}

export type GroupStatusFilter = 'all' | 'active' | 'inactive';

export interface WindowWithGroupHandlers extends Window {
  editGroup?: (id: number) => Promise<void>;
  deleteGroup?: (id: number) => Promise<void>;
  showGroupModal?: () => void;
  hideGroupModal?: () => void;
  saveGroup?: () => Promise<void>;
}
