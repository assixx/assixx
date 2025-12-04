/**
 * Types and Interfaces for Areas Management
 * Shared type definitions used across areas management modules
 */

/**
 * NOTE: parent_id/hierarchy removed (2025-11-29) - areas are now flat (non-hierarchical)
 * UPDATED: is_archived removed, using unified is_active status (2025-12-02)
 * Status: 0=inactive, 1=active, 3=archived, 4=deleted
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
  is_active: 0 | 1 | 3 | 4; // Status: 0=inactive, 1=active, 3=archived, 4=deleted
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
