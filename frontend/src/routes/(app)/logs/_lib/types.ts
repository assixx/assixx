/**
 * Logs Page Types
 * TypeScript interfaces for system logs
 */

// ============================================================================
// Log Entry Types
// ============================================================================

export interface LogEntry {
  id: number;
  userId: number;
  userName: string;
  userRole: string;
  userFirstName?: string;
  userLastName?: string;
  employeeNumber?: string;
  action: string;
  entityType?: string;
  entityId?: number;
  oldValues?: unknown;
  newValues?: unknown;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// ============================================================================
// Pagination Types
// ============================================================================

export interface PaginationInfo {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

// ============================================================================
// Filter Types
// ============================================================================

export interface Filters {
  user?: string;
  action?: string;
  entityType?: string;
  timerange?: string;
}

// ============================================================================
// Dropdown Option Type
// ============================================================================

export interface DropdownOption {
  value: string;
  text: string;
}

// ============================================================================
// Pagination Page Item
// ============================================================================

export type PaginationPageItem =
  | { type: 'page'; value: number; active?: boolean }
  | { type: 'ellipsis' };

// ============================================================================
// API Response Types
// ============================================================================

export interface LogsApiResponse {
  logs?: LogEntry[];
  pagination?: PaginationInfo;
}

export interface DeleteLogsBody {
  confirmPassword: string;
  search?: string;
  action?: string;
  entityType?: string;
  olderThanDays?: number;
}
