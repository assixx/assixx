/**
 * Root Module — Shared Types
 *
 * All interfaces, DB row types, and request types used across root sub-services.
 * Centralised here to avoid circular imports between facade and sub-services.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default storage limit in GB (ADR-033: no more plan-based limits) */
export const DEFAULT_STORAGE_LIMIT_GB = 100;

// ============================================================================
// DATABASE ROW TYPES
// ============================================================================

export interface DbUserRow {
  id: number;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  position: string | null;
  notes: string | null;
  employee_number: string;
  employee_id: string | null;
  department_id?: number | null;
  is_active: number;
  tenant_id: number;
  last_login?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface DbTenantRow {
  id: number;
  company_name: string;
  subdomain: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface DbTenantStorageRow {
  storage_limit_gb: number;
  storage_used_gb: number;
}

/**
 * PostgreSQL COUNT(*) returns bigint which pg driver serializes as STRING!
 * ALWAYS use Number() when using this value in arithmetic operations.
 */
export interface DbCountRow {
  count: string | number; // pg returns string for bigint, but might be number in tests
}

/**
 * PostgreSQL SUM() returns numeric which pg driver may serialize as STRING.
 * ALWAYS use Number() when using this value in arithmetic operations.
 */
export interface DbStorageTotalRow {
  total: string | number;
}

export interface DbAddonCodeRow {
  code: string;
}

export interface DbRootLogRow {
  id: number;
  user_id: number;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  details: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

export interface DbDeletionQueueRow {
  id: number;
  tenant_id: number;
  status: string;
  created_by: number;
  created_at: Date;
  approved_by: number | null;
  approved_at: Date | null;
  scheduled_for: Date | null;
  reason: string;
  error_message: string | null;
  cooling_off_hours: number;
  company_name: string;
  requested_by_name: string;
}

export interface DbDeletionRequestRow {
  id: number;
  tenant_id: number;
  company_name: string;
  subdomain: string;
  created_by: number;
  requester_name: string;
  requester_email: string;
  created_at: Date;
  reason: string;
  status: string;
}

export interface DbIdRow {
  id: number;
}

export interface DbSubdomainRow {
  subdomain: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  notes?: string;
  position?: string;
  employeeNumber?: string;
  profilePicture?: string | null;
  isActive: number;
  tenantId: number;
  tenantName?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}

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
  isActive: number;
  employeeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tenant {
  id: number;
  companyName: string;
  subdomain: string;
  status: 'active' | 'inactive' | 'suspended' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
  adminCount?: number | undefined;
  employeeCount?: number | undefined;
  storageUsed?: number | undefined;
}

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

export interface DashboardStats {
  adminCount: number;
  employeeCount: number;
  totalUsers: number;
  tenantCount?: number;
  activeAddons?: string[];
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
  storageLimitGb: number;
  breakdown?: {
    documents: number;
    attachments: number;
    logs: number;
    backups: number;
  };
}

export interface TenantDeletionStatus {
  queueId: number;
  tenantId: number;
  status: string;
  requestedBy: number;
  requestedByName?: string | undefined;
  requestedAt: Date;
  approvedBy?: number | undefined;
  approvedAt?: Date | undefined;
  scheduledFor?: Date | undefined;
  reason?: string | undefined;
  errorMessage?: string | undefined;
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

// ============================================================================
// REQUEST TYPES
// ============================================================================

export interface CreateAdminRequest {
  email: string;
  password: string;
  firstName?: string | undefined;
  lastName?: string | undefined;
  notes?: string | undefined;
  employeeNumber?: string | undefined;
  position?: string | undefined;
  positionIds?: string[] | undefined;
}

export interface UpdateUserRequest {
  email?: string | undefined;
  password?: string | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
  notes?: string | undefined;
  isActive?: number | undefined;
  employeeNumber?: string | undefined;
  position?: string | undefined;
  positionIds?: string[] | undefined;
  role?: string | undefined;
}

export interface CreateRootUserRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  position?: string | undefined;
  positionIds?: string[] | undefined;
  notes?: string | undefined;
  employeeNumber?: string | undefined;
  isActive?: number | undefined;
}
