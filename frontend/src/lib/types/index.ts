/**
 * Types Barrel Export
 * 1:1 mirrored structure from frontend/src/types/
 *
 * Usage:
 * import type { User, ApiResponse, PaginatedResponse } from '$lib/types';
 */

// API Types
export type {
  // Base
  ApiResponse,
  JWTPayload,
  // User & Auth
  User,
  LoginRequest,
  LoginResponse,
  // Tenant
  Tenant,
  // Features
  Feature,
  TenantFeature,
  // Documents
  Document,
  // Blackboard
  BlackboardEntry,
  BlackboardAttachment,
  BlackboardComment,
  // Chat
  ChatMessage,
  // Calendar
  CalendarEvent,
  // Shifts
  Shift,
  // KVP
  KVPIdea,
  // Survey
  Survey,
  SurveyQuestion,
  // Activity
  ActivityLog,
  // Dashboard
  DashboardData,
} from './api.types';

// Utility Types
export type {
  // Type utilities
  DeepPartial,
  ArrayElement,
  OmitMultiple,
  RequireFields,
  PartialFields,
  // Form types
  FormField,
  FormState,
  // Pagination
  PaginationParams,
  PaginatedResponse,
  // Filters
  FilterOption,
  FilterGroup,
  // Table
  TableColumn,
  // Navigation
  NavItem,
  // Notifications
  Notification,
  NotificationAction,
  // Charts
  ChartDataset,
  ChartConfig,
  // File upload
  UploadFile,
  // WebSocket
  WSMessage,
  // Storage
  StorageItem,
  // Svelte-specific
  Toast,
  BreadcrumbItem,
  ModalState,
} from './utils.types';
