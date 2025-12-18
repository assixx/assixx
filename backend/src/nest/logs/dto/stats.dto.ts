/**
 * Logs Stats DTO
 *
 * Response types for log statistics endpoint.
 */

/**
 * Response type for log statistics
 */
export interface LogsStatsResponseData {
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
