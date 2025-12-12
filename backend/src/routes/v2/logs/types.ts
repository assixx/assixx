// Logs API v2 Types

// ===== CREATE LOG TYPES =====

/**
 * Data required to create a root log entry
 */
export interface RootLogCreateData {
  user_id: number;
  tenant_id: number;
  action: string;
  ip_address?: string | undefined;
  entity_type?: string | undefined;
  entity_id?: number | undefined;
  details?: string | undefined;
  old_values?: Record<string, unknown> | undefined;
  new_values?: Record<string, unknown> | undefined;
  user_agent?: string | undefined;
  was_role_switched?: boolean | undefined;
}

/**
 * Database representation of a root log entry
 */
export interface DbRootLog {
  id: number;
  tenant_id: number;
  user_id: number;
  action: string;
  entity_type?: string;
  entity_id?: number;
  details?: string;
  old_values?: string | Record<string, unknown> | null;
  new_values?: string | Record<string, unknown> | null;
  ip_address?: string;
  user_agent?: string;
  was_role_switched?: boolean;
  created_at: Date;
}

// ===== API RESPONSE TYPES =====

export interface LogsResponse {
  id: number;
  tenantId: number;
  tenantName?: string;
  userId: number;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  userFirstName?: string;
  userLastName?: string;
  employeeNumber?: string;
  // Organization context (for search results display)
  departmentName?: string;
  areaName?: string;
  teamName?: string;
  action: string;
  entityType?: string;
  entityId?: number;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  wasRoleSwitched: boolean;
  createdAt: string;
}

export interface LogsListResponse {
  logs: LogsResponse[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    offset: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface LogsFilterParams {
  page?: number;
  limit?: number;
  userId?: number;
  tenantId?: number;
  action?: string;
  entityType?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface LogsStatsResponse {
  totalLogs: number;
  todayLogs: number;
  uniqueUsers: number;
  uniqueTenants: number;
  topActions: {
    action: string;
    count: number;
  }[];
  topUsers: {
    userId: number;
    userName: string;
    count: number;
  }[];
}