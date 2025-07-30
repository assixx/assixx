// Utility Types for Frontend

// Make all properties optional recursively
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[] ? DeepPartial<U>[] : T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Extract array element type
export type ArrayElement<ArrayType extends readonly unknown[]> = ArrayType extends readonly (infer ElementType)[]
  ? ElementType
  : never;

// Omit multiple properties
export type OmitMultiple<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

// Make specific properties required
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Make specific properties optional
export type PartialFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Form Data Types
export interface FormField<T = string> {
  value: T;
  error?: string;
  touched?: boolean;
  required?: boolean;
}

export interface FormState<T extends Record<string, unknown>> {
  fields: {
    [K in keyof T]: FormField<T[K]>;
  };
  isSubmitting: boolean;
  isValid: boolean;
  errors: string[];
}

// Pagination Types
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Filter Types
export interface FilterOption {
  label: string;
  value: string | number;
  count?: number;
}

export interface FilterGroup {
  name: string;
  key: string;
  options: FilterOption[];
  multiple?: boolean;
}

// Table Types
export interface TableColumn<T = unknown> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: unknown, row: T) => string;
}

// Navigation Types
export interface NavItem {
  id: string;
  label: string;
  icon?: string;
  url?: string;
  section?: string;
  badge?: string;
  badgeId?: string;
  children?: NavItem[];
  hasSubmenu?: boolean;
  submenu?: NavItem[];
  roles?: string[];
}

// Notification Types
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  handler: () => void;
}

// Chart Types (for Chart.js)
export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar';
  labels: string[];
  datasets: ChartDataset[];
}

// File Upload Types
export interface UploadFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  progress?: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  url?: string;
}

// WebSocket Types
export interface WSMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp: number;
}

// Storage Types
export interface StorageItem<T = unknown> {
  key: string;
  value: T;
  expiry?: number;
}
