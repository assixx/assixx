/**
 * Employee Dashboard - Type Definitions
 * @module employee-dashboard/_lib/types
 */

/** User data from parent layout (matches +layout.server.ts return type) */
export interface LayoutUser {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'root' | 'admin' | 'employee';
  employeeNumber?: string;
  profilePicture?: string;
  position?: string;
  tenantId: number;
  hasFullAccess: boolean;
  teamIds?: number[];
  teamNames?: string[];
  teamDepartmentId?: number;
  teamDepartmentName?: string;
  teamAreaId?: number;
  teamAreaName?: string;
}

/** Employee info from user data */
export interface EmployeeInfo {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  teamAreaName?: string;
  teamDepartmentName?: string;
  teamName?: string;
  profilePicture?: string;
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

/** Formatted event date for display */
export interface FormattedEventDate {
  day: string;
  month: string;
  time: string;
}

/** Org level type */
export type OrgLevel = 'company' | 'department' | 'team' | 'area' | 'personal';
