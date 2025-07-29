/**
 * Central Request Type Definitions
 * These types extend Express Request with authentication and file upload support
 */

import { Request } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import { ParsedQs } from "qs";

import { TenantInfo } from "./tenant.types";

// User object that gets attached to authenticated requests
export interface AuthUser {
  id: number;
  userId: number; // Alias for id
  username: string;
  email: string;
  role: string;
  tenant_id: number;
  tenantName?: string;
  first_name?: string;
  last_name?: string;
  department_id?: number | null;
  position?: string | null;
  activeRole?: string; // For role switching functionality
  isRoleSwitched?: boolean; // Flag to indicate if role is switched
}

// Base authenticated request
export interface AuthenticatedRequest
  extends Request<ParamsDictionary, unknown, unknown, ParsedQs> {
  user: AuthUser;
  tenant?: TenantInfo | null;
  tenant_id?: number | null;
  tenantId?: number | null; // v2 API camelCase version
  subdomain?: string;
  userId?: number; // Convenience property
}

// Use Express.Multer.File from express-extensions.d.ts
// Using global Express namespace
// FileUploadRequest is removed - use AuthenticatedRequest directly
// since file and files are already defined in Express.Request

// Type alias for backward compatibility
export type AuthRequest = AuthenticatedRequest;

// Paginated request
export interface PaginatedRequest extends AuthenticatedRequest {
  query: {
    page?: string;
    limit?: string;
    offset?: string;
    sort?: string;
    order?: "asc" | "desc";
  };
  pagination?: {
    page: number;
    limit: number;
    offset: number;
  };
}

// Request with typed params
export interface ParamsRequest<T extends ParamsDictionary = ParamsDictionary>
  extends AuthenticatedRequest {
  params: T;
}

// Request with typed body
export interface BodyRequest<T = unknown> extends AuthenticatedRequest {
  body: T;
}

// Request with typed query
export interface QueryRequest<T extends ParsedQs = ParsedQs>
  extends AuthenticatedRequest {
  query: T;
}

// Combined request types
export interface FullRequest<
  TBody = unknown,
  TQuery extends ParsedQs = ParsedQs,
  TParams extends ParamsDictionary = ParamsDictionary,
> extends AuthenticatedRequest {
  body: TBody;
  query: TQuery;
  params: TParams;
}

// Document-specific request types
export interface DocumentRequest extends AuthenticatedRequest {
  document?: {
    id: number;
    filename: string;
    category?: string;
    tenant_id: number;
    [key: string]: unknown;
  }; // Will be typed properly when Document model is fully migrated
  params: {
    documentId: string;
  };
}

// Public Request (no authentication required)
export interface PublicRequest
  extends Request<ParamsDictionary, unknown, unknown, ParsedQs> {
  subdomain?: string;
  tenantId?: number | null;
}

// Optional Auth Request (authentication optional)
export interface OptionalAuthRequest
  extends Request<ParamsDictionary, unknown, unknown, ParsedQs> {
  user?: AuthUser;
  tenant?: TenantInfo | null;
  tenantId?: number | null;
  subdomain?: string;
}

// API Key Request
export interface ApiKeyRequest
  extends Request<ParamsDictionary, unknown, unknown, ParsedQs> {
  apiKey?: string;
  apiKeyPermissions?: string[];
  tenantId?: number;
}

// Chat-specific request types
export interface ChatUsersRequest extends AuthenticatedRequest {
  query: ParsedQs & {
    search?: string;
  };
}

export interface GetConversationsRequest extends AuthenticatedRequest {
  query: ParsedQs & {
    limit?: string;
    offset?: string;
  };
}

export interface CreateConversationRequest extends AuthenticatedRequest {
  body: {
    participant_ids: number[];
    is_group?: boolean;
    name?: string;
  };
}

export interface GetMessagesRequest extends AuthenticatedRequest {
  params: {
    id: string;
  };
  query: {
    limit?: string;
    offset?: string;
  };
}

export interface SendMessageRequest extends AuthenticatedRequest {
  params: {
    id: string;
  };
  body: {
    content: string;
    attachment_ids?: number[];
  };
}
