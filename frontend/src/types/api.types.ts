/**
 * API Response Types - API v2 Only (camelCase)
 *
 * MIGRATION: 2025-11-22
 * - Removed API v1 backward compatibility
 * - All fields are now camelCase only (backend uses fieldMapping)
 * - Backend delivers: dbToApi() converts snake_case → camelCase
 * - No fallback needed: user.firstName (NOT user.first_name)
 */

// Base API Response
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
  firstName?: string;
  lastName?: string;
  role: 'admin' | 'employee' | 'root';
  tenantId: number;
  profilePicture?: string;
  phone?: string;
  position?: string;
  birthdate?: string;
  isActive: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  // Additional fields that may exist
  employeeId?: string;
  employeeNumber?: string; // Employee number (used in some modules)
  department?: string;
  departmentId?: number;
  departmentName?: string;
  team?: string;
  teamId?: number;
  teamName?: string;
  hireDate?: string;
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
  profilePictureUrl?: string;
  tenant?: Tenant;
  // Availability fields (used in shifts/employees modules)
  availabilityStatus?: string;
  availabilityStart?: string;
  availabilityEnd?: string;
  availabilityNotes?: string;
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
  tenantId: number;
  iat: number;
  exp: number;
}

// Tenant Types
export interface Tenant {
  id: number;
  companyName: string;
  subdomain: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Feature Types
export interface Feature {
  code: string;
  name: string;
  description: string;
  category: string;
  basePrice: number | string;
  maxUsers?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantFeature {
  tenantId: number;
  featureCode: string;
  isAvailable: boolean;
  priceOverride?: number;
  config?: Record<string, unknown>;
  activatedAt?: string;
  deactivatedAt?: string;
}

// Document Types
export interface Document {
  id: number;
  tenantId: number;
  uploadedBy: number;
  uploadedByName?: string;
  uploaderName?: string;
  targetUserId?: number;
  targetDepartmentId?: number;
  targetTeamId?: number;
  category: string;
  scope?: 'company' | 'department' | 'team' | 'personal';
  filePath: string;
  filename: string;
  storedFilename?: string;
  fileSize: number;
  fileType: string;
  mimeType?: string;
  description?: string;
  tags?: string[];
  isRead?: boolean;
  isArchived?: boolean;
  isDeleted: boolean;
  recipientId?: number;
  downloadUrl?: string;
  previewUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// Blackboard Types
export interface BlackboardEntry {
  id: number;
  tenantId: number;
  createdBy: number;
  createdByName?: string;
  title: string;
  content: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  tags?: string[];
  color?: string;
  isPinned: boolean;
  isActive: boolean;
  validFrom?: string;
  validUntil?: string;
  createdAt: string;
  updatedAt: string;
}

// Chat Types
export interface ChatMessage {
  id: number;
  tenantId: number;
  senderId: number;
  receiverId?: number;
  message: string;
  isRead: boolean;
  createdAt: string;
  sender?: User;
  receiver?: User;
}

// Calendar Types
export interface CalendarEvent {
  id: number;
  tenantId: number;
  createdBy: number;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  location?: string;
  category: string;
  color?: string;
  recurring?: boolean;
  recurrencePattern?: string;
  createdAt: string;
  updatedAt: string;
}

// Shift Types
export interface Shift {
  id: number;
  tenantId: number;
  employeeId: number;
  startTime: string;
  endTime: string;
  breakDuration: number;
  shiftType: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  employee?: User;
}

// KVP Types
export interface KVPIdea {
  id: number;
  tenantId: number;
  submittedBy: number;
  title: string;
  description: string;
  category: string;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'implemented';
  pointsAwarded?: number;
  implementationDate?: string;
  savingsAmount?: number;
  createdAt: string;
  updatedAt: string;
  submitter?: User;
}

// Survey Types
export interface Survey {
  id: number;
  tenantId: number;
  createdBy: number;
  title: string;
  description?: string;
  category: string;
  isAnonymous: boolean;
  isActive: boolean;
  startDate: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyQuestion {
  id: number;
  surveyId: number;
  questionText: string;
  questionType: 'multiple_choice' | 'text' | 'rating' | 'yes_no';
  options?: string[];
  isRequired: boolean;
  orderPosition: number;
}
