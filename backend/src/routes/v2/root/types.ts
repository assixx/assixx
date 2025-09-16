/**
 * Root API v2 Types
 * Type definitions for root user management and tenant administration
 */

// Admin User Types
export interface AdminUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  company?: string;
  notes?: string;
  isActive: boolean;
  tenantId: number;
  tenantName?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}

export interface CreateAdminRequest {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  notes?: string;
  employeeNumber?: string;
  position?: string;
}

export interface UpdateAdminRequest {
  username?: string;
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  notes?: string;
  isActive?: boolean;
  employeeNumber?: string;
  position?: string;
}

// Root User Types
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
  isActive: boolean;
  employeeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRootUserRequest {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  position?: string;
  notes?: string;
  employeeNumber?: string;
  departmentId?: number;
  isActive?: boolean;
}

export interface UpdateRootUserRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  position?: string;
  notes?: string;
  employeeNumber?: string;
  departmentId?: number;
  isActive?: boolean;
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
