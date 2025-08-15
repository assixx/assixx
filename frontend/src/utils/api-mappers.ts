/**
 * API Field Mappers for handling v1/v2 API differences
 * Uses the generated types from Swagger
 */

import type { components } from '../generated/api-types';

// Type from our generated Swagger types
export type SwaggerUser = components['schemas']['User'];

// Union type for API responses that might have snake_case or camelCase
export interface UserAPIResponse {
  id: number;
  username?: string;
  email?: string;
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
  role?: 'root' | 'admin' | 'employee';
  tenant_id?: number;
  tenantId?: number;
  department_id?: number | null;
  departmentId?: number | null;
  department_name?: string;
  departmentName?: string;
  department?: string;
  team_id?: number | null;
  teamId?: number | null;
  team_name?: string;
  teamName?: string;
  position?: string;
  employee_number?: string;
  employeeNumber?: string;
  is_active?: boolean;
  isActive?: boolean;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

// Extended User type with both snake_case and camelCase fields for compatibility
export interface MappedUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: 'root' | 'admin' | 'employee';
  tenantId: number;
  departmentId: number | null;
  departmentName?: string;
  teamId?: number | null;
  teamName?: string;
  position?: string;
  employeeNumber?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Maps a user from API response (v1 or v2) to our unified MappedUser type
 * Handles both snake_case (v1) and camelCase (v2) field names
 */
export function mapUser(user: UserAPIResponse): MappedUser {
  // Handle both v1 (snake_case) and v2 (camelCase) field names
  const firstName = user.first_name ?? user.firstName ?? '';
  const lastName = user.last_name ?? user.lastName ?? '';

  return {
    id: user.id,
    username: user.username ?? '',
    email: user.email ?? '',
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    role: user.role ?? 'employee',
    tenantId: user.tenant_id ?? user.tenantId ?? 0,
    departmentId: user.department_id ?? user.departmentId ?? null,
    departmentName: user.department_name ?? user.departmentName ?? 'Keine Abteilung',
    teamId: user.team_id ?? user.teamId ?? null,
    teamName: user.team_name ?? user.teamName ?? 'Kein Team',
    position: user.position ?? 'Mitarbeiter',
    employeeNumber: user.employee_number ?? user.employeeNumber ?? '',
    isActive: user.is_active ?? user.isActive ?? true,
    createdAt: user.created_at ?? user.createdAt,
    updatedAt: user.updated_at ?? user.updatedAt,
  };
}

/**
 * Maps an array of users
 */
export function mapUsers(users: UserAPIResponse[]): MappedUser[] {
  return users.map(mapUser);
}

// Department mapping
export interface MappedDepartment {
  id: number;
  name: string;
  description?: string;
  memberCount: number;
  createdAt?: string;
  updatedAt?: string;
}

// Department API response type
export interface DepartmentAPIResponse {
  id: number;
  name?: string;
  description?: string;
  member_count?: number;
  memberCount?: number;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

export function mapDepartment(dept: DepartmentAPIResponse): MappedDepartment {
  return {
    id: dept.id,
    name: dept.name ?? '',
    description: dept.description ?? '',
    memberCount: dept.member_count ?? dept.memberCount ?? 0,
    createdAt: dept.created_at ?? dept.createdAt,
    updatedAt: dept.updated_at ?? dept.updatedAt,
  };
}

// Document mapping
export interface MappedDocument {
  id: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: string;
  uploadedBy: number;
  uploadedByName?: string;
  uploadDate: string;
  isPublic: boolean;
}

// Document API response type
export interface DocumentAPIResponse {
  id: number;
  file_name?: string;
  fileName?: string;
  file_size?: number;
  fileSize?: number;
  mime_type?: string;
  mimeType?: string;
  category?: string;
  uploaded_by?: number;
  uploadedBy?: number;
  uploaded_by_name?: string;
  uploadedByName?: string;
  upload_date?: string;
  uploadDate?: string;
  is_public?: boolean;
  isPublic?: boolean;
}

export function mapDocument(doc: DocumentAPIResponse): MappedDocument {
  return {
    id: doc.id,
    fileName: doc.file_name ?? doc.fileName ?? '',
    fileSize: doc.file_size ?? doc.fileSize ?? 0,
    mimeType: doc.mime_type ?? doc.mimeType ?? '',
    category: doc.category ?? '',
    uploadedBy: doc.uploaded_by ?? doc.uploadedBy ?? 0,
    uploadedByName: doc.uploaded_by_name ?? doc.uploadedByName,
    uploadDate: doc.upload_date ?? doc.uploadDate ?? new Date().toISOString(),
    isPublic: doc.is_public ?? doc.isPublic ?? false,
  };
}
