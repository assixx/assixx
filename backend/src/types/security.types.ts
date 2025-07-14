/**
 * Security-specific Type Definitions
 * Types for authentication, authorization, and security middleware
 */

import { Request } from "express";

// Rate Limiter Configuration
export interface RateLimiterConfig {
  windowMs?: number;
  max?: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  points?: number;
  duration?: number;
  blockDuration?: number;
}

// Rate Limiter Types
export enum RateLimiterType {
  PUBLIC = "public",
  AUTH = "auth",
  AUTHENTICATED = "authenticated",
  ADMIN = "admin",
  API = "api",
  UPLOAD = "upload",
  DOWNLOAD = "download",
}

// Rate Limiter Options per Type
export interface RateLimiterOptions {
  [RateLimiterType.PUBLIC]: RateLimiterConfig;
  [RateLimiterType.AUTH]: RateLimiterConfig;
  [RateLimiterType.AUTHENTICATED]: RateLimiterConfig;
  [RateLimiterType.ADMIN]: RateLimiterConfig;
  [RateLimiterType.API]: RateLimiterConfig;
  [RateLimiterType.UPLOAD]: RateLimiterConfig;
  [RateLimiterType.DOWNLOAD]: RateLimiterConfig;
}

// CSRF Token Types
export interface CsrfTokenPair {
  token: string;
  hash: string;
}

// Session Types
export interface SessionData {
  userId: number;
  tenantId: number;
  role: string;
  createdAt: Date;
  lastActivity: Date;
  ipAddress: string;
  userAgent: string;
}

// Permission Types
export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, unknown>;
}

export interface RolePermissions {
  [role: string]: Permission[];
}

// Security Headers Configuration
export interface SecurityHeadersConfig {
  contentSecurityPolicy?: {
    directives: {
      [directive: string]: string[];
    };
  };
  hsts?: {
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  };
  noSniff?: boolean;
  xssFilter?: boolean;
  referrerPolicy?: string;
  permissionsPolicy?: {
    [feature: string]: string[];
  };
}

// Input Validation Types
export interface ValidationRule {
  field: string;
  rules: string[];
  message?: string;
}

export interface ValidationSchema {
  [endpoint: string]: ValidationRule[];
}

// API Key Types
export interface ApiKey {
  id: number;
  key: string;
  name: string;
  tenantId: number;
  permissions: string[];
  rateLimit?: number;
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
}

// Audit Log Types
export interface AuditLogEntry {
  id: number;
  userId: number;
  tenantId: number;
  action: string;
  resource: string;
  resourceId?: number | string;
  ipAddress: string;
  userAgent: string;
  status: "success" | "failure";
  details?: Record<string, unknown>;
  timestamp: Date;
}

// Two-Factor Authentication Types
export interface TwoFactorSecret {
  userId: number;
  secret: string;
  backupCodes: string[];
  enabled: boolean;
  createdAt: Date;
}

// Security Event Types
export enum SecurityEventType {
  LOGIN_SUCCESS = "login_success",
  LOGIN_FAILURE = "login_failure",
  LOGOUT = "logout",
  PASSWORD_CHANGE = "password_change",
  PERMISSION_DENIED = "permission_denied",
  RATE_LIMIT_EXCEEDED = "rate_limit_exceeded",
  SUSPICIOUS_ACTIVITY = "suspicious_activity",
  TOKEN_EXPIRED = "token_expired",
  TOKEN_INVALID = "token_invalid",
}

export interface SecurityEvent {
  type: SecurityEventType;
  userId?: number;
  tenantId?: number;
  ipAddress: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

// JWT Token Types (extending from auth.types.ts)
export interface ExtendedTokenPayload {
  userId: number;
  username: string;
  email: string;
  role: string;
  tenantId: number;
  permissions?: string[];
  sessionId?: string;
  issuedAt: number;
  expiresAt: number;
}

// Security Middleware Options
export interface SecurityMiddlewareOptions {
  rateLimiter?: RateLimiterType;
  requireAuth?: boolean;
  requireRole?: string | string[];
  requirePermission?: string | string[];
  validateInput?: boolean;
  auditLog?: boolean;
  csrfProtection?: boolean;
}

// Rate Limiter Middleware Type
export type RateLimitMiddleware = ReturnType<
  typeof import("express-rate-limit").default
>;

// Extended Rate Limiter with properties
export interface RateLimiterMiddleware {
  (type: RateLimiterType): RateLimitMiddleware;
  public: RateLimitMiddleware;
  auth: RateLimitMiddleware;
  authenticated: RateLimitMiddleware;
  admin: RateLimitMiddleware;
  api: RateLimitMiddleware;
  upload: RateLimitMiddleware;
  download: RateLimitMiddleware;
}

// Type Guards
export function isSecurityEvent(event: unknown): event is SecurityEvent {
  return (
    event !== null &&
    typeof event === "object" &&
    "type" in event &&
    "ipAddress" in event &&
    "timestamp" in event &&
    typeof event.type === "string" &&
    Object.values(SecurityEventType).includes(
      event.type as SecurityEventType,
    ) &&
    typeof event.ipAddress === "string" &&
    event.timestamp instanceof Date
  );
}

export function hasPermission(
  userPermissions: string[],
  requiredPermission: string,
): boolean {
  return (
    userPermissions.includes(requiredPermission) ||
    userPermissions.includes("*") ||
    userPermissions.some((p) => {
      const regex = new RegExp("^" + p.replace("*", ".*") + "$");
      return regex.test(requiredPermission);
    })
  );
}
