/**
 * Areas API v2 Types
 * Types and interfaces for area/location management
 */

export interface Area {
  id: number;
  tenant_id: number;
  name: string;
  description?: string;
  type: 'building' | 'warehouse' | 'office' | 'production' | 'outdoor' | 'other';
  capacity?: number;
  parent_id?: number;
  address?: string;
  is_active: boolean;
  created_by: number;
  created_at: Date;
  updated_at: Date;
  // Virtual fields from joins
  parent?: Area;
  children?: Area[];
  employee_count?: number;
}

export interface CreateAreaRequest {
  name: string;
  description?: string;
  type?: 'building' | 'warehouse' | 'office' | 'production' | 'outdoor' | 'other';
  capacity?: number;
  parentId?: number;
  address?: string;
}

export interface UpdateAreaRequest {
  name?: string;
  description?: string;
  type?: 'building' | 'warehouse' | 'office' | 'production' | 'outdoor' | 'other';
  capacity?: number;
  parentId?: number | null;
  address?: string;
  isActive?: boolean;
}

export interface AreaFilters {
  type?: string;
  isActive?: boolean;
  parentId?: number | null;
  search?: string;
}

export interface AreaWithStats extends Area {
  employeeCount: number;
  machineCount?: number;
  childrenCount: number;
}
