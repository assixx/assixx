/**
 * Helper Functions
 * Common utility functions used across the application
 */
import crypto from 'crypto';

import { PAGINATION } from './constants';

// Interfaces
interface QueryParams {
  page?: string | number;
  limit?: string | number;
  [key: string]: string | number | undefined;
}

interface PaginationResult {
  page: number;
  limit: number;
  offset: number;
}

interface PaginationResponse {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Generate a random string
 * @param length - Length of the string
 * @returns Random string
 */
export function generateRandomString(length = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Parse pagination parameters
 * @param query - Query parameters
 * @returns Parsed pagination object
 */
export function parsePagination(query: QueryParams): PaginationResult {
  const page = Number.parseInt(String(query.page)) || PAGINATION.DEFAULT_PAGE;
  const limit = Math.min(
    Number.parseInt(String(query.limit)) || PAGINATION.DEFAULT_LIMIT,
    PAGINATION.MAX_LIMIT,
  );
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Format pagination response
 * @param total - Total count
 * @param page - Current page
 * @param limit - Items per page
 * @returns Pagination metadata
 */
export function formatPaginationResponse(
  total: number,
  page: number,
  limit: number,
): PaginationResponse {
  const totalPages = Math.ceil(total / limit);

  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Sanitize user input
 * @param input - User input
 * @returns Sanitized input
 */
export function sanitizeInput(input: unknown): unknown {
  if (typeof input !== 'string') return input;

  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .slice(0, 1000); // Limit length
}

/**
 * Generate slug from string
 * @param text - Text to slugify
 * @returns Slug
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\s\w-]/g, '') // Remove special characters
    .replace(/[\s\-_]+/g, '-') // Replace spaces with -
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing -
}

/**
 * Format date for display
 * @param date - Date object
 * @returns Formatted date string
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (date == null) return '';

  const d = new Date(date);
  return d.toLocaleDateString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * Format datetime for display
 * @param date - Date object
 * @returns Formatted datetime string
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (date == null) return '';

  const d = new Date(date);
  return d.toLocaleDateString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Calculate percentage
 * @param value - Current value
 * @param total - Total value
 * @returns Percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (!total || total === 0) return 0;
  return Math.round((value / total) * 100);
}

/**
 * Deep clone object
 * @param obj - Object to clone
 * @returns Cloned object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

/**
 * Check if object is empty
 * @param obj - Object to check
 * @returns True if empty
 */
export function isEmpty(obj: object): boolean {
  return Object.keys(obj).length === 0;
}

/**
 * Group array by key
 * @param array - Array to group
 * @param key - Key to group by
 * @returns Grouped object
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result: Record<string, T[]>, item: T) => {
    const group = String(item[key]);
    result[group] ??= [];
    result[group].push(item);
    return result;
  }, {});
}

/**
 * Remove duplicate objects from array
 * @param array - Array with potential duplicates
 * @param key - Key to check for duplicates
 * @returns Array without duplicates
 */
export function removeDuplicates<T>(array: T[], key: keyof T): T[] {
  const seen = new Set();
  return array.filter((item: T) => {
    const value = item[key];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

// Default export for CommonJS compatibility
const helpers = {
  generateRandomString,
  parsePagination,
  formatPaginationResponse,
  sanitizeInput,
  generateSlug,
  formatDate,
  formatDateTime,
  calculatePercentage,
  deepClone,
  isEmpty,
  groupBy,
  removeDuplicates,
};

export default helpers;
