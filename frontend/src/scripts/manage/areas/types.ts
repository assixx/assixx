/**
 * Types and Interfaces for Areas Management
 * Shared type definitions used across areas management modules
 */

/**
 * NOTE: parent_id/hierarchy removed (2025-11-29) - areas are now flat (non-hierarchical)
 */
export interface Area {
  id: number;
  name: string;
  description?: string | null;
  area_lead_id?: number | null;
  area_lead_name?: string | null;
  type: 'building' | 'warehouse' | 'office' | 'production' | 'outdoor' | 'other';
  capacity?: number | null;
  address?: string | null;
  is_active: 0 | 1;
  is_archived: 0 | 1;
  employee_count?: number;
  department_count?: number;
  department_names?: string | null;
  created_at?: string;
  updated_at?: string;
  tenant_id?: number;
  created_by?: number;
}

/**
 * Admin/Root user for area lead dropdown
 */
export interface AdminUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: 'admin' | 'root';
}

export type AreaStatusFilter = 'all' | 'active' | 'inactive' | 'archived';

/**
 * Simplified Department type for multi-select dropdown
 */
export interface Department {
  id: number;
  name: string;
  area_id?: number | null;
}

export interface WindowWithAreaHandlers extends Window {
  editArea?: (id: number) => Promise<void>;
  deleteArea?: (id: number) => void;
  showAreaModal?: () => void;
  closeAreaModal?: () => void;
  saveArea?: () => Promise<void>;
}
