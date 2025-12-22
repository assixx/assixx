/**
 * API Response Types - API v2 Only (camelCase)
 * 1:1 Copy from frontend/src/types/api.types.ts
 *
 * MIGRATION: 2025-11-22
 * - Removed API v1 backward compatibility
 * - All fields are now camelCase only (backend uses fieldMapping)
 * - Backend delivers: dbToApi() converts snake_case → camelCase
 * - No fallback needed: user.firstName (NOT user.first_name)
 *
 * UPDATED: 2025-12-02
 * - isArchived removed, using unified isActive status
 * - Status: 0=inactive, 1=active, 3=archived, 4=deleted
 */

// Re-export JWTPayload from jwt-utils to avoid duplication
export type { JWTPayload } from '$lib/utils/jwt-utils';

// Base API Response
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T | undefined;
  error?: string | undefined;
  message?: string | undefined;
}

// User Types
// UPDATED: Using unified isActive status (2025-12-02)
// Status: 0=inactive, 1=active, 3=archived, 4=deleted
export interface User {
  id: number;
  username: string;
  email: string;
  firstName?: string | undefined;
  lastName?: string | undefined;
  role: 'admin' | 'employee' | 'root';
  tenantId: number;
  profilePicture?: string | undefined;
  phone?: string | undefined;
  position?: string | undefined;
  birthdate?: string | undefined;
  isActive: 0 | 1 | 3 | 4; // Status: 0=inactive, 1=active, 3=archived, 4=deleted
  createdAt: string;
  updatedAt: string;
  // Additional fields that may exist
  employeeId?: string | undefined;
  employeeNumber?: string | undefined;
  department?: string | undefined;
  departmentId?: number | undefined;
  departmentName?: string | undefined;
  team?: string | undefined;
  teamId?: number | undefined;
  teamName?: string | undefined;
  // INHERITANCE-FIX: Full inheritance chain from Team → Department → Area
  teamDepartmentId?: number | undefined;
  teamDepartmentName?: string | undefined;
  teamAreaId?: number | undefined;
  teamAreaName?: string | undefined;
  hasFullAccess?: boolean | number | undefined;
  hireDate?: string | undefined;
  street?: string | undefined;
  houseNumber?: string | undefined;
  postalCode?: string | undefined;
  city?: string | undefined;
  profilePictureUrl?: string | undefined;
  tenant?: Tenant | undefined;
  // Availability fields (used in shifts/employees modules)
  availabilityStatus?: string | undefined;
  availabilityStart?: string | undefined;
  availabilityEnd?: string | undefined;
  availabilityNotes?: string | undefined;
}

// Auth Types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken?: string | undefined;
  user: User;
}

// Tenant Types
export interface Tenant {
  id: number;
  companyName: string;
  subdomain: string;
  email: string;
  phone?: string | undefined;
  address?: string | undefined;
  city?: string | undefined;
  postalCode?: string | undefined;
  country?: string | undefined;
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
  maxUsers?: number | undefined;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantFeature {
  tenantId: number;
  featureCode: string;
  isAvailable: boolean;
  priceOverride?: number | undefined;
  config?: Record<string, unknown> | undefined;
  activatedAt?: string | undefined;
  deactivatedAt?: string | undefined;
}

// Document Types
export interface Document {
  id: number;
  tenantId: number;
  uploadedBy: number;
  uploadedByName?: string | undefined;
  uploaderName?: string | undefined;
  targetUserId?: number | undefined;
  targetDepartmentId?: number | undefined;
  targetTeamId?: number | undefined;
  category: string;
  scope?: 'company' | 'department' | 'team' | 'personal' | undefined;
  filePath: string;
  filename: string;
  storedFilename?: string | undefined;
  fileSize: number;
  fileType: string;
  mimeType?: string | undefined;
  description?: string | undefined;
  tags?: string[] | undefined;
  isRead?: boolean | undefined;
  isActive?: 0 | 1 | 3 | 4 | undefined;
  isDeleted?: boolean | undefined; // Legacy - prefer isActive=4
  recipientId?: number | undefined;
  downloadUrl?: string | undefined;
  previewUrl?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

// Blackboard Types (API v2)
export interface BlackboardEntry {
  id: number;
  uuid: string;
  tenantId: number;
  title: string;
  content: string;
  orgLevel: 'company' | 'department' | 'team' | 'area' | 'personal';
  orgId: number | null;
  authorId: number;
  expiresAt?: string | null | undefined;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  color: 'yellow' | 'blue' | 'green' | 'red' | 'orange' | 'pink';
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;

  // Extended fields from joins
  authorName?: string | undefined;
  authorFirstName?: string | undefined;
  authorLastName?: string | undefined;
  authorFullName?: string | undefined;
  departmentName?: string | undefined;
  teamName?: string | undefined;
  areaName?: string | undefined;
  isConfirmed?: boolean | undefined;
  confirmedAt?: string | null | undefined;
  attachmentCount?: number | undefined;
  tags?: string[] | undefined;
}

export interface BlackboardAttachment {
  id: number;
  entryId: number;
  fileUuid: string;
  filename: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: number;
  uploadedByName?: string | undefined;
  uploadedAt: string;
}

export interface BlackboardComment {
  id: number;
  entryId: number;
  userId: number;
  comment: string;
  isInternal: boolean;
  createdAt: string;
  firstName?: string | undefined;
  lastName?: string | undefined;
  role?: string | undefined;
  profilePicture?: string | null | undefined;
}

// Chat Types
export interface ChatMessage {
  id: number;
  tenantId: number;
  senderId: number;
  receiverId?: number | undefined;
  message: string;
  isRead: boolean;
  createdAt: string;
  sender?: User | undefined;
  receiver?: User | undefined;
}

// Calendar Types
export interface CalendarEvent {
  id: number;
  tenantId: number;
  createdBy: number;
  title: string;
  description?: string | undefined;
  startDate: string;
  endDate: string;
  allDay: boolean;
  location?: string | undefined;
  category: string;
  color?: string | undefined;
  recurring?: boolean | undefined;
  recurrencePattern?: string | undefined;
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
  notes?: string | undefined;
  createdAt: string;
  updatedAt: string;
  employee?: User | undefined;
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
  pointsAwarded?: number | undefined;
  implementationDate?: string | undefined;
  savingsAmount?: number | undefined;
  createdAt: string;
  updatedAt: string;
  submitter?: User | undefined;
}

// Survey Types
export interface Survey {
  id: number;
  tenantId: number;
  createdBy: number;
  title: string;
  description?: string | undefined;
  category: string;
  isAnonymous: boolean;
  isActive: boolean;
  startDate: string;
  endDate?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyQuestion {
  id: number;
  surveyId: number;
  questionText: string;
  questionType: 'multiple_choice' | 'text' | 'rating' | 'yes_no';
  options?: string[] | undefined;
  isRequired: boolean;
  orderPosition: number;
}

// Activity Log Types
export interface ActivityLog {
  id: number;
  action: string;
  userName?: string | undefined;
  userFirstName?: string | undefined;
  userLastName?: string | undefined;
  userRole?: string | undefined;
  employeeNumber?: string | undefined;
  createdAt: string;
}

// Dashboard Types
export interface DashboardData {
  adminCount: number;
  employeeCount: number;
  totalUsers: number;
}
