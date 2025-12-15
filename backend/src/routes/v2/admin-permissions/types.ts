/**
 * Admin Permissions API v2 Type Definitions
 * Handles department and group permissions for admin users
 */

// Request Types
export interface SetPermissionsRequest {
  adminId: number;
  areaIds?: number[];
  departmentIds?: number[];
  groupIds?: number[];
  permissions?: PermissionSet;
  hasFullAccess?: boolean;
}

export interface SetAreaPermissionsRequest {
  userId: number;
  areaIds: number[];
  permissions?: PermissionSet;
}

export interface BulkPermissionsRequest {
  adminIds: number[];
  operation: 'assign' | 'remove';
  departmentIds?: number[];
  groupIds?: number[];
  permissions?: PermissionSet;
}

// Response Types
export interface AdminArea {
  id: number;
  name: string;
  description?: string;
  departmentCount: number;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

export interface AdminDepartment {
  id: number;
  name: string;
  description?: string;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

export interface AdminGroup {
  id: number;
  name: string;
  description?: string;
  departmentCount: number;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

export interface AdminPermissionsResponse {
  areas: AdminArea[];
  departments: AdminDepartment[];
  groups: AdminGroup[];
  hasFullAccess: boolean; // has_full_access flag from users table (single source of truth)
  totalAreas: number;
  totalDepartments: number;
  assignedAreas: number;
  assignedDepartments: number;
}

export interface BulkOperationResult {
  successCount: number;
  totalCount: number;
  errors?: string[];
}

// Shared Types
export interface PermissionSet {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

export type PermissionLevel = 'read' | 'write' | 'delete';

// Service Layer Types
export interface PermissionCheckResult {
  hasAccess: boolean;
  source?: 'direct' | 'area' | 'group' | 'full_access';
  permissions?: PermissionSet;
}

export interface PermissionLogEntry {
  action: 'grant' | 'revoke';
  adminId: number;
  targetId: number;
  targetType: 'department' | 'group';
  permissions: PermissionSet;
  changedBy: number;
  changedAt: Date;
}
