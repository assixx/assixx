/**
 * Admin Permissions API v2 Type Definitions
 * Handles department and group permissions for admin users
 */

// Request Types
export interface SetPermissionsRequest {
  adminId: number;
  departmentIds?: number[];
  groupIds?: number[];
  permissions?: PermissionSet;
}

export interface BulkPermissionsRequest {
  adminIds: number[];
  operation: "assign" | "remove";
  departmentIds?: number[];
  groupIds?: number[];
  permissions?: PermissionSet;
}

// Response Types
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
  departments: AdminDepartment[];
  groups: AdminGroup[];
  hasAllAccess: boolean;
  totalDepartments: number;
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

export type PermissionLevel = "read" | "write" | "delete";

// Service Layer Types
export interface PermissionCheckResult {
  hasAccess: boolean;
  source?: "direct" | "group";
  permissions?: PermissionSet;
}

export interface PermissionLogEntry {
  action: "grant" | "revoke";
  adminId: number;
  targetId: number;
  targetType: "department" | "group";
  permissions: PermissionSet;
  changedBy: number;
  changedAt: Date;
}
