// API Request and Response Type Definitions

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Authentication Types
export interface LoginRequest {
  username: string;
  password: string;
  subdomain?: string;
}

export interface SignupRequest {
  // Company Info
  companyName: string;
  subdomain: string;
  email: string;
  phone: string;

  // Admin User
  firstName: string;
  lastName: string;
  username: string;
  password: string;

  // Features
  features: string[];
}

export interface AuthResponse {
  token: string;
  user: {
    id: number;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    tenantId: number | null;
    tenantName?: string;
  };
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
}

// User Management Types
export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "admin" | "employee";
  departmentId?: number;
  position?: string;
  phoneNumber?: string;
}

export interface UpdateUserRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
  departmentId?: number;
  position?: string;
  phoneNumber?: string;
  isActive?: boolean;
}

export interface UpdatePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// Document Types
export interface DocumentUploadRequest {
  category: string;
  description?: string;
  tags?: string[];
  targetUsers?: number[];
}

export interface DocumentSearchParams {
  category?: string;
  search?: string;
  tags?: string[];
  page?: number;
  limit?: number;
}

// Feature Management
export interface FeatureToggleRequest {
  featureKey: string;
  enabled: boolean;
  config?: any;
}

// Department & Team Types
export interface CreateDepartmentRequest {
  name: string;
  description?: string;
}

export interface CreateTeamRequest {
  name: string;
  description?: string;
  departmentId: number;
  leaderId?: number;
}

// Blackboard Types
export interface CreateBlackboardEntryRequest {
  title: string;
  content: string;
  isPinned?: boolean;
  expiresAt?: string;
  tags?: string[];
  color?: string;
}

// Calendar Types
export interface CreateCalendarEventRequest {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  allDay?: boolean;
  location?: string;
  type?: string;
  departmentId?: number;
  isRecurring?: boolean;
  recurringPattern?: any;
}

// Chat Types
export interface SendMessageRequest {
  roomId: string;
  content: string;
  type?: "text" | "file" | "image";
  attachmentUrl?: string;
}

// KVP Types
export interface CreateKvpSuggestionRequest {
  title: string;
  description: string;
  category: string;
  priority?: "low" | "medium" | "high";
  attachments?: string[];
}

export interface ReviewKvpSuggestionRequest {
  status: "approved" | "rejected" | "in_review";
  reviewNotes?: string;
}

// Shift Types
export interface CreateShiftRequest {
  employeeId: number;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  departmentId: number;
  notes?: string;
}

export interface ApproveShiftRequest {
  shiftIds: number[];
  approved: boolean;
}

// Survey Types
export interface CreateSurveyRequest {
  title: string;
  description?: string;
  departmentId?: number;
  isAnonymous?: boolean;
  startsAt: string;
  endsAt?: string;
  questions: Array<{
    type: "text" | "radio" | "checkbox" | "rating" | "scale";
    question: string;
    required?: boolean;
    options?: string[];
    minValue?: number;
    maxValue?: number;
  }>;
}

export interface SubmitSurveyResponseRequest {
  surveyId: number;
  answers: Array<{
    questionId: string;
    answer: any;
  }>;
}

// Search & Filter Types
export interface SearchParams {
  q?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
}

export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

// Error Types
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  code?: string;
  statusCode: number;
  errors?: ValidationError[];
}
