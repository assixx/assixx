/**
 * Admin Dashboard - Type Definitions
 * @module admin-dashboard/_lib/types
 */

/** Dashboard statistics */
export interface DashboardStats {
  employeeCount: number;
  documentCount: number;
  departmentCount: number;
  teamCount: number;
}

/** Department entity */
export interface Department {
  id: number;
  name: string;
  description?: string;
  status?: string;
  visibility?: string;
  memberCount?: number;
}

/** Team entity */
export interface Team {
  id: number;
  name: string;
  departmentId: number;
  departmentName?: string;
  description?: string;
  memberCount?: number;
}

/** User entity */
export interface User {
  id: number;
  firstName?: string;
  lastName?: string;
  email: string;
  role?: string;
}

/** Document entity */
export interface Document {
  id: number;
  filename: string;
  title?: string;
}

/** Calendar event entity */
export interface CalendarEvent {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  allDay: boolean | number;
  location?: string;
  orgLevel?: string;
  areaId?: number | null;
  departmentId?: number | null;
  teamId?: number | null;
}

/** Blackboard entry entity */
export interface BlackboardEntry {
  id: number;
  uuid: string;
  title: string;
  content?: unknown;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  color: 'yellow' | 'pink' | 'blue' | 'green' | 'purple' | 'orange';
  orgLevel: 'company' | 'department' | 'team' | 'area';
  createdAt: string;
  expiresAt?: string | null;
  authorFullName?: string;
  authorName?: string;
  commentCount?: number;
  attachmentCount?: number;
  isConfirmed?: boolean;
  firstSeenAt?: string | null;
}

/** Formatted event date */
export interface FormattedEventDate {
  day: string;
  month: string;
  time: string;
}

/** Priority type */
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

/** Org level type */
export type OrgLevel = 'company' | 'department' | 'team' | 'area' | 'personal';

/** Blackboard org level type */
export type BlackboardOrgLevel = 'company' | 'department' | 'team' | 'area';
