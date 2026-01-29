/**
 * Pagination Types
 *
 * Shared pagination request parameters.
 */

/** Pagination query parameters for list endpoints */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  limit?: number;
}
