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
  is_active: number; // Status: 0=inactive, 1=active, 3=archived, 4=deleted
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
  isActive?: number; // Status: 0=inactive, 1=active, 3=archived, 4=deleted
}

export interface AreaFilters {
  type?: string;
  isActive?: number; // Status: 0=inactive, 1=active, 3=archived, 4=deleted
  search?: string;
}

export interface AreaWithStats extends Area {
  employeeCount: number;
  machineCount?: number;
}
