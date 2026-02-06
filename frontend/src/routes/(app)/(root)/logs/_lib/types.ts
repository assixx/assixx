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

// ============================================================================
// Export Types (ADR-009)
// ============================================================================

/** Export format options */
export type ExportFormat = 'json' | 'csv' | 'txt';

/** Export source options */
export type ExportSource = 'audit_trail' | 'root_logs' | 'all';

/** Export request parameters */
export interface ExportLogsParams {
  dateFrom: string;
  dateTo: string;
  format: ExportFormat;
  source: ExportSource;
  action?: string;
  userId?: number;
  entityType?: string;
}

/** Export status for UI feedback */
export interface ExportStatus {
  loading: boolean;
  error: string | null;
  rateLimitedUntil: Date | null;
}

// ============================================================================
// Quick Timerange Presets (for Export)
// ============================================================================

/** Quick timerange preset values for export date filter */
export type ExportQuickTimerange =
  | '5min'
  | '15min'
  | '1hour'
  | '24hours'
  | '3days'
  | '1week'
  | 'custom';

/** Quick timerange option for dropdown/buttons */
export interface QuickTimerangeOption {
  value: ExportQuickTimerange;
  text: string;
  minutes: number; // Duration in minutes (0 for custom)
}
