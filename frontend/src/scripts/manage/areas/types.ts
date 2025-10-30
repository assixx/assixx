/**
 * Types and Interfaces for Areas Management
 * Shared type definitions used across areas management modules
 */

export interface Area {
  id: number;
  name: string;
  description?: string | null;
  type: 'building' | 'warehouse' | 'office' | 'production' | 'outdoor' | 'other';
  capacity?: number | null;
  address?: string | null;
  parent_id?: number | null;
  parentName?: string;
  is_active: 0 | 1;
  employee_count?: number;
  created_at?: string;
  updated_at?: string;
  tenant_id?: number;
  created_by?: number;
}

export type AreaStatusFilter = 'all' | 'active' | 'inactive';

export interface WindowWithAreaHandlers extends Window {
  editArea?: (id: number) => Promise<void>;
  deleteArea?: (id: number) => void;
  showAreaModal?: () => void;
  closeAreaModal?: () => void;
  saveArea?: () => Promise<void>;
}
