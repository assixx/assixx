// Core Database Models Type Definitions

export interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "admin" | "employee" | "root";
  tenantId: number | null;
  departmentId: number | null;
  isActive: boolean;
  isArchived: boolean;
  profilePicture: string | null;
  phoneNumber: string | null;
  position: string | null;
  hireDate: Date | null;
  birthDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  availabilityStatus?: 'available' | 'unavailable' | 'vacation' | 'sick';
}

export interface DatabaseUser {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: string;
  tenant_id: number | null;
  department_id: number | null;
  is_active: boolean;
  is_archived: boolean;
  profile_picture: string | null;
  phone_number: string | null;
  position: string | null;
  hire_date: Date | null;
  birth_date: Date | null;
  created_at: Date;
  updated_at: Date;
  availability_status?: 'available' | 'unavailable' | 'vacation' | 'sick';
}

export interface Tenant {
  id: number;
  name: string;
  subdomain: string;
  email: string;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  features: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DatabaseTenant {
  id: number;
  name: string;
  company_name: string;
  subdomain: string;
  email: string;
  phone: string | null;
  address: string | null;
  is_active: boolean;
  status: "active" | "trial" | "suspended" | "cancelled";
  current_plan: string | null;
  features: string;
  created_at: Date;
  updated_at: Date;
}

export interface Document {
  id: number;
  filename: string;
  originalName: string;
  category: string;
  uploadedBy: number;
  tenantId: number;
  fileSize: number;
  mimeType: string;
  description: string | null;
  tags: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatabaseDocument {
  id: number;
  filename: string;
  original_name: string;
  category: string;
  uploaded_by: number;
  tenant_id: number;
  file_size: number;
  mime_type: string;
  description: string | null;
  tags: string | null;
  is_archived: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Feature {
  id: number;
  key: string;
  name: string;
  description: string;
  category: string;
  isActive: boolean;
  isPremium: boolean;
  price: number;
  config: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface Department {
  id: number;
  name: string;
  description: string | null;
  tenantId: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Team {
  id: number;
  name: string;
  description: string | null;
  departmentId: number;
  leaderId: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BlackboardEntry {
  id: number;
  title: string;
  content: string;
  authorId: number;
  tenantId: number;
  isPinned: boolean;
  expiresAt: Date | null;
  tags: string | null;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CalendarEvent {
  id: number;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  location: string | null;
  type: string;
  createdBy: number;
  tenantId: number;
  departmentId: number | null;
  isRecurring: boolean;
  recurringPattern: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: number;
  roomId: string;
  senderId: number;
  content: string;
  type: "text" | "file" | "image" | "system";
  attachmentUrl: string | null;
  isEdited: boolean;
  isDeleted: boolean;
  readBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface KvpSuggestion {
  id: number;
  title: string;
  description: string;
  category: string;
  submittedBy: number;
  tenantId: number;
  status: "pending" | "in_review" | "approved" | "rejected" | "implemented";
  priority: "low" | "medium" | "high";
  attachments: string | null;
  reviewedBy: number | null;
  reviewNotes: string | null;
  implementationDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Shift {
  id: number;
  employeeId: number;
  date: Date;
  startTime: string;
  endTime: string;
  type: string;
  departmentId: number;
  notes: string | null;
  createdBy: number;
  isApproved: boolean;
  approvedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Survey {
  id: number;
  title: string;
  description: string | null;
  createdBy: number;
  tenantId: number;
  departmentId: number | null;
  isActive: boolean;
  isAnonymous: boolean;
  startsAt: Date;
  endsAt: Date | null;
  questions: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface SurveyResponse {
  id: number;
  surveyId: number;
  respondentId: number | null;
  answers: any;
  completedAt: Date;
  createdAt: Date;
}

export interface EmployeeAvailability {
  id: number;
  employeeId: number;
  tenantId: number;
  status: 'available' | 'unavailable' | 'vacation' | 'sick' | 'training' | 'other';
  startDate: Date | string;
  endDate: Date | string;
  reason?: string;
  notes?: string;
  createdBy?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DatabaseEmployeeAvailability {
  id: number;
  employee_id: number;
  tenant_id: number;
  status: 'available' | 'unavailable' | 'vacation' | 'sick' | 'training' | 'other';
  start_date: Date | string;
  end_date: Date | string;
  reason?: string;
  notes?: string;
  created_by?: number;
  created_at?: Date;
  updated_at?: Date;
}
