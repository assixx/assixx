/**
 * Central Request Type Definitions
 * These types extend Express Request with authentication and file upload support
 */

import { Request, ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';
import { TenantInfo } from './tenant.types';

// User object that gets attached to authenticated requests
export interface AuthUser {
  id: number;
  userId: number; // Alias for id
  username: string;
  email: string;
  role: string;
  tenantId: number;
  tenantName?: string;
  first_name?: string;
  last_name?: string;
  department_id?: number | null;
  position?: string | null;
}

// Base authenticated request
export interface AuthenticatedRequest extends Request {
  user: AuthUser;
  tenant?: TenantInfo | null;
  tenantId?: number | null;
  subdomain?: string;
  userId?: number; // Convenience property
}

// Use Express.Multer.File from express.d.ts
// Using global Express namespace
export interface FileUploadRequest extends AuthenticatedRequest {
  // file and files are already defined in Express.Request
}

// Paginated request
export interface PaginatedRequest extends AuthenticatedRequest {
  query: {
    page?: string;
    limit?: string;
    offset?: string;
    sort?: string;
    order?: 'asc' | 'desc';
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
export interface BodyRequest<T = any> extends AuthenticatedRequest {
  body: T;
}

// Request with typed query
export interface QueryRequest<T extends ParsedQs = ParsedQs>
  extends AuthenticatedRequest {
  query: T;
}

// Combined request types
export interface FullRequest<
  TBody = any,
  TQuery extends ParsedQs = ParsedQs,
  TParams extends ParamsDictionary = ParamsDictionary,
> extends AuthenticatedRequest {
  body: TBody;
  query: TQuery;
  params: TParams;
}

// Chat-specific request types
export interface ChatUsersRequest extends AuthenticatedRequest {
  // No additional properties needed
}

export interface GetConversationsRequest extends AuthenticatedRequest {
  // No additional properties needed
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
