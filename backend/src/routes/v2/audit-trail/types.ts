/**
 * Type definitions for Audit Trail API v2
 */

export interface AuditEntry {
  id: number;
  tenantId: number;
  userId: number;
  userName?: string;
  userRole?: string;
  action: string;
  resourceType: string;
  resourceId?: number;
  resourceName?: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failure';
  errorMessage?: string;
  createdAt: string;
}

export interface AuditFilter {
  tenantId: number;
  userId?: number;
  action?: string;
  resourceType?: string;
  resourceId?: number;
  status?: 'success' | 'failure';
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'created_at' | 'action' | 'user_id' | 'resource_type';
  sortOrder?: 'asc' | 'desc';
}

export interface AuditStats {
  totalEntries: number;
  byAction: Record<string, number>;
  byResourceType: Record<string, number>;
  byUser: { userId: number; userName: string; count: number }[];
  byStatus: { success: number; failure: number };
  timeRange: { from: string; to: string };
}

export interface ComplianceReport {
  tenantId: number;
  reportType: 'gdpr' | 'data_access' | 'data_changes' | 'user_activity';
  dateFrom: string;
  dateTo: string;
  entries: AuditEntry[];
  summary: {
    totalActions: number;
    uniqueUsers: number;
    dataAccessCount: number;
    dataModificationCount: number;
    dataDeletionCount: number;
  };
  generatedAt: string;
  generatedBy: number;
}

export interface CreateAuditEntryDto {
  action: string;
  resourceType: string;
  resourceId?: number;
  resourceName?: string;
  changes?: Record<string, unknown>;
  status: 'success' | 'failure';
  errorMessage?: string;
}

// Action types for consistent logging
export const AUDIT_ACTIONS = {
  // Auth actions
  LOGIN: 'login',
  LOGOUT: 'logout',
  PASSWORD_CHANGE: 'password_change',
  PASSWORD_RESET: 'password_reset',

  // CRUD actions
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',

  // Bulk actions
  BULK_CREATE: 'bulk_create',
  BULK_UPDATE: 'bulk_update',
  BULK_DELETE: 'bulk_delete',

  // Special actions
  EXPORT: 'export',
  IMPORT: 'import',
  APPROVE: 'approve',
  REJECT: 'reject',
  ASSIGN: 'assign',
  UNASSIGN: 'unassign',
  ACTIVATE: 'activate',
  DEACTIVATE: 'deactivate',

  // System actions
  SETTINGS_CHANGE: 'settings_change',
  PERMISSION_CHANGE: 'permission_change',
  ROLE_SWITCH: 'role_switch',
} as const;

// Resource types for consistent logging
export const RESOURCE_TYPES = {
  USER: 'user',
  DEPARTMENT: 'department',
  TEAM: 'team',
  SHIFT: 'shift',
  DOCUMENT: 'document',
  BLACKBOARD: 'blackboard',
  CALENDAR_EVENT: 'calendar_event',
  CHAT_MESSAGE: 'chat_message',
  KVP_SUGGESTION: 'kvp_suggestion',
  SURVEY: 'survey',
  MACHINE: 'machine',
  FEATURE: 'feature',
  PLAN: 'plan',
  SETTINGS: 'settings',
} as const;
