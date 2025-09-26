// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// User Types
export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: 'admin' | 'employee' | 'root';
  tenant_id: number;
  profile_picture?: string;
  phone?: string;
  position?: string;
  birthdate?: string;
  is_active: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  // Additional fields that may exist
  employee_id?: string;
  department?: string;
  department_id?: number;
  team?: string;
  team_id?: number;
  hire_date?: string;
  street?: string;
  house_number?: string;
  postal_code?: string;
  city?: string;
  profile_picture_url?: string;
  tenant?: Tenant;
}

// Auth Types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface JWTPayload {
  id: number;
  username: string;
  role: string;
  activeRole?: string;
  tenant_id: number;
  iat: number;
  exp: number;
}

// Tenant Types
export interface Tenant {
  id: number;
  company_name: string;
  subdomain: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Feature Types
export interface Feature {
  code: string;
  name: string;
  description: string;
  category: string;
  base_price: number | string;
  max_users?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantFeature {
  tenant_id: number;
  feature_code: string;
  is_available: boolean;
  price_override?: number;
  config?: Record<string, unknown>;
  activated_at?: string;
  deactivated_at?: string;
}

// Document Types
export interface Document {
  id: number;
  tenant_id: number;
  uploaded_by: number;
  uploaded_by_name?: string;
  target_user_id?: number;
  target_department_id?: number;
  target_team_id?: number;
  category: string;
  scope: 'company' | 'department' | 'team' | 'personal';
  file_path: string;
  file_name: string;
  file_size: number;
  file_type: string;
  mime_type?: string;
  description?: string;
  tags?: string[];
  is_read?: boolean;
  is_archived?: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

// Blackboard Types
export interface BlackboardEntry {
  id: number;
  tenant_id: number;
  created_by: number;
  created_by_name?: string;
  title: string;
  content: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  tags?: string[];
  color?: string;
  is_pinned: boolean;
  is_active: boolean;
  valid_from?: string;
  valid_until?: string;
  created_at: string;
  updated_at: string;
}

// Chat Types
export interface ChatMessage {
  id: number;
  tenant_id: number;
  sender_id: number;
  receiver_id?: number;
  message: string;
  is_read: boolean;
  created_at: string;
  sender?: User;
  receiver?: User;
}

// Calendar Types
export interface CalendarEvent {
  id: number;
  tenant_id: number;
  created_by: number;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  all_day: boolean;
  location?: string;
  category: string;
  color?: string;
  recurring?: boolean;
  recurrence_pattern?: string;
  created_at: string;
  updated_at: string;
}

// Shift Types
export interface Shift {
  id: number;
  tenant_id: number;
  employee_id: number;
  start_time: string;
  end_time: string;
  break_duration: number;
  shift_type: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
  employee?: User;
}

// KVP Types
export interface KVPIdea {
  id: number;
  tenant_id: number;
  submitted_by: number;
  title: string;
  description: string;
  category: string;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'implemented';
  points_awarded?: number;
  implementation_date?: string;
  savings_amount?: number;
  created_at: string;
  updated_at: string;
  submitter?: User;
}

// Survey Types
export interface Survey {
  id: number;
  tenant_id: number;
  created_by: number;
  title: string;
  description?: string;
  category: string;
  is_anonymous: boolean;
  is_active: boolean;
  start_date: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
}

export interface SurveyQuestion {
  id: number;
  survey_id: number;
  question_text: string;
  question_type: 'multiple_choice' | 'text' | 'rating' | 'yes_no';
  options?: string[];
  is_required: boolean;
  order_position: number;
}
