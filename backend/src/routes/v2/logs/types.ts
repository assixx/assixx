// Logs API v2 Types

export interface LogsResponse {
  id: number;
  tenantId: number;
  tenantName?: string;
  userId: number;
  userName?: string;
  userEmail?: string;
  userRole?: string;
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
