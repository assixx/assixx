// Central export for all type definitions

export * from './models';
export * from './api';
export * from './express';

// Additional utility types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type AsyncFunction<T = void> = () => Promise<T>;

// Database query result types
export interface QueryResult<T> {
  rows: T[];
  fields?: any[];
  affectedRows?: number;
  insertId?: number;
}

// Common response patterns
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  message?: string;
}

// Role types
export type UserRole = 'admin' | 'employee' | 'root';
export type FeatureCategory =
  | 'basic'
  | 'communication'
  | 'productivity'
  | 'management'
  | 'analytics';

// Status types
export type DocumentCategory =
  | 'general'
  | 'hr'
  | 'finance'
  | 'technical'
  | 'legal'
  | 'other';
export type KvpStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'implemented';
export type MessageType = 'text' | 'file' | 'image' | 'system';

// Helper types for strict typing
export type StringKeys<T> = Extract<keyof T, string>;
export type RequireAtLeastOne<T> = {
  [K in keyof T]-?: Required<Pick<T, K>> &
    Partial<Pick<T, Exclude<keyof T, K>>>;
}[keyof T];
export type RequireOnlyOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> &
  {
    [K in Keys]-?: Required<Pick<T, K>> &
      Partial<Record<Exclude<Keys, K>, undefined>>;
  }[Keys];
