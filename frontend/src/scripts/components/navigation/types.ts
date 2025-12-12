/**
 * Navigation Types
 * Interfaces and type definitions for the unified navigation component
 */

import type { User, Tenant } from '../../../types/api.types';

/**
 * JWT Token payload structure
 */
export interface TokenPayload {
  id: number;
  username: string;
  role: Role;
  tenantId?: number | null;
  email?: string;
  activeRole?: string;
  isRoleSwitched?: boolean;
  exp?: number;
  iat?: number;
}

/**
 * Navigation item structure for sidebar menu
 */
export interface NavItem {
  id: string;
  icon?: string;
  label: string;
  url?: string;
  section?: string;
  badge?: string;
  badgeId?: string;
  hasSubmenu?: boolean;
  submenu?: NavItem[];
  children?: NavItem[];
}

/**
 * Navigation items organized by role
 */
export interface NavigationItems {
  admin: NavItem[];
  employee: NavItem[];
  root: NavItem[];
}

/**
 * User profile response from API
 */
export interface UserProfileResponse extends User {
  user?: User;
  companyName?: string;
  subdomain?: string;
  data?: {
    firstName?: string;
    lastName?: string;
    profilePicture?: string;
    employeeNumber?: string;
    position?: string;
  };
  tenant?: Tenant;
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  employeeNumber?: string;
}

/**
 * Role switch message for BroadcastChannel
 */
export interface RoleSwitchMessage {
  type: string;
  newRole?: string;
  token?: string;
}

/**
 * User role types
 */
export type Role = 'admin' | 'employee' | 'root';

/**
 * Storage information for root users
 */
export interface StorageInfo {
  used: number;
  total: number;
  percentage: number;
  plan: string;
  breakdown?: {
    documents: number;
    attachments: number;
    logs: number;
    backups: number;
  };
}

/**
 * Badge configuration
 */
export interface BadgeConfig {
  className: string;
  id: string;
}

/**
 * Navigation state
 */
export interface NavigationState {
  currentRole: Role;
  isCollapsed: boolean;
  openSubmenu: string | null;
  currentUser: TokenPayload | null;
}
