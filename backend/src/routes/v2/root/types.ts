/**
 * Root API v2 Types
 * Type definitions for root user management and tenant administration
 */

// Admin User Types
// REMOVED: company column dropped (2025-11-27)
// UPDATED: isArchived removed, using is_active status (2025-12-02)
export interface AdminUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  notes?: string;
  position?: string;
  employeeNumber?: string;
  isActive: number; // Status: 0=inactive, 1=active, 3=archived, 4=deleted
  tenantId: number;
  tenantName?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}

/**
 * Create Admin Request
 * IMPORTANT: username is optional and IGNORED - will be set to email (lowercase) in service
 * REMOVED: company column dropped (2025-11-27)
 */
export interface CreateAdminRequest {
  username?: string; // Optional and IGNORED - will be set to email (lowercase) in service
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  notes?: string;
  employeeNumber?: string;
  position?: string;
}

/**
 * Update Admin Request
 * IMPORTANT: username is optional and IGNORED - when email changes, username is auto-synced
 * REMOVED: company column dropped (2025-11-27)
 * UPDATED: isArchived removed, using isActive status (2025-12-02)
 */
export interface UpdateAdminRequest {
  username?: string; // Optional and IGNORED - will be synced from email in service
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  notes?: string;
  isActive?: number; // Status: 0=inactive, 1=active, 3=archived, 4=deleted
  employeeNumber?: string;
  position?: string;
}

// Root User Types
// UPDATED: isActive changed to number for unified status (2025-12-12)
export interface RootUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  position?: string;
  notes?: string;
  employeeNumber?: string;
  departmentId?: number;
  isActive: number; // Status: 0=inactive, 1=active, 3=archived, 4=deleted
  employeeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create Root User Request
 * IMPORTANT: username is optional and will be set to email (lowercase) in service
 * N:M REFACTORING: departmentId removed - root users have has_full_access=1
 * UPDATED: isActive changed to number for unified status (2025-12-12)
 */
export interface CreateRootUserRequest {
  username?: string; // Optional - will be set to email (lowercase) in service
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  position?: string;
  notes?: string;
  employeeNumber?: string;
  isActive?: number; // Status: 0=inactive, 1=active, 3=archived, 4=deleted (default: 1)
}

/**
 * Update Root User Request
 * IMPORTANT: When email changes, username is also updated (username = email, lowercase)
 * N:M REFACTORING: departmentId removed - root users have has_full_access=1
 * UPDATED: isActive changed to number for unified status (2025-12-12)
 */
export interface UpdateRootUserRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  position?: string;
  notes?: string;
  employeeNumber?: string;
  isActive?: number; // Status: 0=inactive, 1=active, 3=archived, 4=deleted
}

// Tenant Types
export interface Tenant {
  id: number;
  companyName: string;
  subdomain: string;
  currentPlan?: string;
  status: 'active' | 'inactive' | 'suspended' | 'deleted';
  maxUsers?: number;
  maxAdmins?: number;
  industry?: string;
  country?: string;
  createdAt: Date;
  updatedAt: Date;
  adminCount?: number;
  employeeCount?: number;
  storageUsed?: number;
}

export interface TenantDeletionRequest {
  reason?: string;
}

export interface TenantDeletionStatus {
  queueId: number;
  tenantId: number;
  status:
    | 'pending'
    | 'pending_approval'
    | 'approved'
    | 'executing'
    | 'completed'
    | 'failed'
    | 'cancelled'
    | 'stopped';
  requestedBy: number;
  requestedByName?: string;
  requestedAt: Date;
  approvedBy?: number;
  approvedAt?: Date;
  scheduledFor?: Date;
  reason?: string;
  errorMessage?: string;
  coolingOffHours: number;
  canCancel: boolean;
  canApprove: boolean;
}

export interface DeletionApproval {
  queueId: number;
  tenantId: number;
  companyName: string;
  subdomain: string;
  requesterId: number;
  requesterName: string;
  requesterEmail: string;
  requestedAt: Date;
  reason?: string;
  status: string;
}

// Dashboard Types
export interface DashboardStats {
  adminCount: number;
  employeeCount: number;
  totalUsers: number;
  tenantCount?: number;
  activeFeatures?: string[];
  systemHealth?: {
    database: 'healthy' | 'degraded' | 'down';
    storage: 'healthy' | 'degraded' | 'down';
    services: 'healthy' | 'degraded' | 'down';
  };
}

export interface StorageInfo {
  used: number;
  total: number;
  percentage: number;
  plan: string;
  breakdown?: {
    documents: number;
    attachments: number;
    logs: number;
    backups: number;
  };
}

// Admin Logs Types
export interface AdminLog {
  id: number;
  userId: number;
  action: string;
  entityType: string;
  entityId?: number;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// Request/Response Types
export interface RootApiFilters {
  status?: string;
  isActive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface RootApiResponse<T> {
  data: T;
  message?: string;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
  };
}

// Dry Run Report
export interface DeletionDryRunReport {
  tenantId: number;
  companyName: string;
  estimatedDuration: string;
  affectedRecords: {
    users: number;
    documents: number;
    departments: number;
    teams: number;
    shifts: number;
    kvpSuggestions: number;
    surveys: number;
    logs: number;
    total: number;
  };
  storageToFree: number;
  warnings: string[];
  canProceed: boolean;
}

// MySQL Error Type
export interface MySQLError extends Error {
  code?: string;
  errno?: number;
  sql?: string;
  sqlState?: string;
  sqlMessage?: string;
  fieldCount?: number;
  affectedRows?: number;
  insertId?: number;
}
