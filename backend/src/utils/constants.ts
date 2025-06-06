/**
 * Application Constants
 * Central place for all constant values
 */

// User Roles
export const ROLES = {
  ROOT: "root",
  ADMIN: "admin",
  EMPLOYEE: "employee",
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SERVER_ERROR: 500,
} as const;

// File Upload
export const UPLOAD = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/gif"] as const,
  ALLOWED_DOCUMENT_TYPES: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ] as const,
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

// Token
export const TOKEN = {
  EXPIRES_IN: "24h",
  REFRESH_EXPIRES_IN: "7d",
} as const;

// Feature Categories
export const FEATURE_CATEGORIES = {
  BASIC: "basic",
  PREMIUM: "premium",
  ENTERPRISE: "enterprise",
} as const;

// Survey Status
export const SURVEY_STATUS = {
  DRAFT: "draft",
  ACTIVE: "active",
  CLOSED: "closed",
  ARCHIVED: "archived",
} as const;

// KVP Status
export const KVP_STATUS = {
  SUBMITTED: "eingereicht",
  IN_REVIEW: "in_pruefung",
  APPROVED: "genehmigt",
  REJECTED: "abgelehnt",
  IMPLEMENTED: "umgesetzt",
} as const;

// Shift Types
export const SHIFT_TYPES = {
  MORNING: "morning",
  AFTERNOON: "afternoon",
  NIGHT: "night",
  FLEXIBLE: "flexible",
} as const;

// Type definitions for better type safety
export type Role = (typeof ROLES)[keyof typeof ROLES];
export type HttpStatus = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];
export type FeatureCategory =
  (typeof FEATURE_CATEGORIES)[keyof typeof FEATURE_CATEGORIES];
export type SurveyStatus = (typeof SURVEY_STATUS)[keyof typeof SURVEY_STATUS];
export type KvpStatus = (typeof KVP_STATUS)[keyof typeof KVP_STATUS];
export type ShiftType = (typeof SHIFT_TYPES)[keyof typeof SHIFT_TYPES];

// Default export for backward compatibility
const constants = {
  ROLES,
  HTTP_STATUS,
  UPLOAD,
  PAGINATION,
  TOKEN,
  FEATURE_CATEGORIES,
  SURVEY_STATUS,
  KVP_STATUS,
  SHIFT_TYPES,
};

export default constants;
