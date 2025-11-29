/**
 * Areas API v2 Types
 * Types and interfaces for area/location management
 * NOTE: parent_id removed (2025-11-29) - areas are now flat (non-hierarchical)
 */

export interface Area {
  id: number;
  tenant_id: number;
  name: string;
  description?: string;
  area_lead_id?: number | null;
  type: 'building' | 'warehouse' | 'office' | 'production' | 'outdoor' | 'other';
  capacity?: number;
  address?: string;
  is_active: boolean;
  is_archived: boolean;
  created_by: number;
  created_at: Date;
  updated_at: Date;
  // Virtual fields from joins
  area_lead_name?: string | null;
  employee_count?: number;
  department_count?: number;
  department_names?: string | null;
}

export interface CreateAreaRequest {
  name: string;
  description?: string;
  areaLeadId?: number | null;
  type?: 'building' | 'warehouse' | 'office' | 'production' | 'outdoor' | 'other';
  capacity?: number;
  address?: string;
}

export interface UpdateAreaRequest {
  name?: string;
  description?: string;
  areaLeadId?: number | null;
  type?: 'building' | 'warehouse' | 'office' | 'production' | 'outdoor' | 'other';
  capacity?: number;
  address?: string;
  isActive?: boolean;
  isArchived?: boolean;
}

export interface AreaFilters {
  type?: string;
  isActive?: boolean;
  isArchived?: boolean;
  search?: string;
}

export interface AreaWithStats extends Area {
  employeeCount: number;
  machineCount?: number;
}
