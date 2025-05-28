/**
 * Application Constants
 * Central place for all constant values
 */

module.exports = {
  // User Roles
  ROLES: {
    ROOT: 'root',
    ADMIN: 'admin',
    EMPLOYEE: 'employee',
  },

  // HTTP Status Codes
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    SERVER_ERROR: 500,
  },

  // File Upload
  UPLOAD: {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
    ALLOWED_DOCUMENT_TYPES: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
  },

  // Pagination
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
  },

  // Token
  TOKEN: {
    EXPIRES_IN: '24h',
    REFRESH_EXPIRES_IN: '7d',
  },

  // Feature Categories
  FEATURE_CATEGORIES: {
    BASIC: 'basic',
    PREMIUM: 'premium',
    ENTERPRISE: 'enterprise',
  },

  // Survey Status
  SURVEY_STATUS: {
    DRAFT: 'draft',
    ACTIVE: 'active',
    CLOSED: 'closed',
    ARCHIVED: 'archived',
  },

  // KVP Status
  KVP_STATUS: {
    SUBMITTED: 'eingereicht',
    IN_REVIEW: 'in_pruefung',
    APPROVED: 'genehmigt',
    REJECTED: 'abgelehnt',
    IMPLEMENTED: 'umgesetzt',
  },

  // Shift Types
  SHIFT_TYPES: {
    MORNING: 'morning',
    AFTERNOON: 'afternoon',
    NIGHT: 'night',
    FLEXIBLE: 'flexible',
  },
};
