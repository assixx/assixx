/**
 * Utility Types for Frontend
 * 1:1 Copy from frontend/src/types/utils.types.ts
 */

// =============================================================================
// TYPE UTILITIES
// =============================================================================

/** Make all properties optional recursively */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? DeepPartial<U>[]
    : T[P] extends object
      ? DeepPartial<T[P]>
      : T[P];
};

/** Extract array element type */
export type ArrayElement<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

/** Omit multiple properties */
export type OmitMultiple<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

/** Make specific properties required */
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/** Make specific properties optional */
export type PartialFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// =============================================================================
// FORM TYPES
// =============================================================================

export interface FormField<T = string> {
  value: T;
  error?: string | undefined;
  touched?: boolean | undefined;
  required?: boolean | undefined;
}

export interface FormState<T extends Record<string, unknown>> {
  fields: {
    [K in keyof T]: FormField<T[K]>;
  };
  isSubmitting: boolean;
  isValid: boolean;
  errors: string[];
}

// =============================================================================
// PAGINATION TYPES
// =============================================================================

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string | undefined;
  sortOrder?: 'asc' | 'desc' | undefined;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// =============================================================================
// FILTER TYPES
// =============================================================================

export interface FilterOption {
  label: string;
  value: string | number;
  count?: number | undefined;
}

export interface FilterGroup {
  name: string;
  key: string;
  options: FilterOption[];
  multiple?: boolean | undefined;
}

// =============================================================================
// TABLE TYPES
// =============================================================================

export interface TableColumn<T = unknown> {
  key: keyof T | string;
  label: string;
  sortable?: boolean | undefined;
  width?: string | undefined;
  align?: 'left' | 'center' | 'right' | undefined;
  render?: ((value: unknown, row: T) => string) | undefined;
}

// =============================================================================
// NAVIGATION TYPES
// =============================================================================

export interface NavItem {
  id: string;
  label: string;
  icon?: string | undefined;
  url?: string | undefined;
  section?: string | undefined;
  badge?: string | undefined;
  badgeId?: string | undefined;
  children?: NavItem[] | undefined;
  hasSubmenu?: boolean | undefined;
  submenu?: NavItem[] | undefined;
  roles?: string[] | undefined;
}

// =============================================================================
// NOTIFICATION TYPES
// =============================================================================

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string | undefined;
  duration?: number | undefined;
  actions?: NotificationAction[] | undefined;
}

export interface NotificationAction {
  label: string;
  handler: () => void;
}

// =============================================================================
// CHART TYPES (for Chart.js)
// =============================================================================

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[] | undefined;
  borderColor?: string | string[] | undefined;
  borderWidth?: number | undefined;
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar';
  labels: string[];
  datasets: ChartDataset[];
}

// =============================================================================
// FILE UPLOAD TYPES
// =============================================================================

export interface UploadFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  progress?: number | undefined;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string | undefined;
  url?: string | undefined;
}

// =============================================================================
// WEBSOCKET TYPES
// =============================================================================

export interface WSMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp: number;
}

// =============================================================================
// STORAGE TYPES
// =============================================================================

export interface StorageItem<T = unknown> {
  key: string;
  value: T;
  expiry?: number | undefined;
}

// =============================================================================
// SVELTE-SPECIFIC TYPES
// =============================================================================

/** Toast notification for Svelte store */
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number | undefined;
}

/** Breadcrumb item */
export interface BreadcrumbItem {
  label: string;
  href?: string | undefined;
  icon?: string | undefined;
}

/** Modal state */
export interface ModalState {
  isOpen: boolean;
  title?: string | undefined;
  message?: string | undefined;
  confirmLabel?: string | undefined;
  cancelLabel?: string | undefined;
  onConfirm?: (() => void) | undefined;
  onCancel?: (() => void) | undefined;
}
