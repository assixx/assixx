/**
 * Unified Navigation Component für alle Dashboards
 * Verwendet rolle-basierte Menüs mit Glassmorphismus-Design
 */

// Import types
import type { User, Tenant, Document } from '../../types/api.types';
import type { NavItem } from '../../types/utils.types';
// Import role switch function
import { apiClient } from '../../utils/api-client';
import { $$, setHTML } from '../../utils/dom-utils';
import { switchRoleForRoot, switchRoleForAdmin } from '../auth/role-switch';
import { SSEClient } from '../utils/sse-client';
import { loadUserInfo as loadUserInfoFromAuth } from '../auth/index';

// Declare global type for window
declare global {
  interface Window {
    UnifiedNavigation: typeof UnifiedNavigation;
    unifiedNav?: UnifiedNavigation;
  }
}

interface NavigationItems {
  admin: NavItem[];
  employee: NavItem[];
  root: NavItem[];
}

interface TokenPayload {
  id: number;
  username: string;
  role: 'admin' | 'employee' | 'root';
  tenantId?: number | null;
  email?: string;
}

interface RoleSwitchMessage {
  type: string;
  newRole?: string;
  token?: string;
}

interface UserProfileResponse extends User {
  user?: User;
  // Company/Tenant related properties
  companyName?: string;
  subdomain?: string;
  // API v2 returns camelCase fields
  firstName?: string;
  lastName?: string;
  employeeId?: string;
  employeeNumber?: string;
  profilePicture?: string;
  profilePictureUrl?: string;
  tenantId?: number;
  // Additional user properties that may come from API but aren't in base User type
  data?: {
    first_name?: string;
    last_name?: string;
    profile_picture?: string;
    employee_number?: string;
    birthdate?: string;
    firstName?: string;
    lastName?: string;
    employeeId?: string;
    employeeNumber?: string;
    profilePicture?: string;
  };
  // Tenant information
  tenant?: Tenant;
}

// Removed unused interfaces

// Dashboard URL constants
const EMPLOYEE_DASHBOARD_URL = '/employee-dashboard';
const ADMIN_DASHBOARD_URL = '/admin-dashboard';
const ROOT_DASHBOARD_URL = '/root-dashboard';

// CSS selector constants
const SIDEBAR_ITEM_SELECTOR = '.sidebar-item';
const SIDEBAR_COLLAPSED_CLASS = 'sidebar-collapsed';
const DISPLAY_INLINE_BLOCK = 'inline-block';

// Access Control Map - Definiert welche Rollen auf welche Seiten zugreifen dürfen
const accessControlData: Record<string, ('root' | 'admin' | 'employee')[]> = {
  // Root-only pages
  [ROOT_DASHBOARD_URL]: ['root'],
  '/pages/root-dashboard': ['root'],
  '/manage-root-users': ['root'],
  '/pages/manage-root-users': ['root'],
  '/root-features': ['root'],
  '/pages/root-features': ['root'],
  '/root-profile': ['root'],
  '/pages/root-profile': ['root'],
  '/tenant-deletion-status': ['root'],
  '/pages/tenant-deletion-status': ['root'],
  '/storage-upgrade': ['root'],
  '/pages/storage-upgrade': ['root'],
  '/logs': ['root'],
  '/pages/logs': ['root'],

  // Admin and Root pages
  [ADMIN_DASHBOARD_URL]: ['admin', 'root'],
  '/pages/admin-dashboard': ['admin', 'root'],
  '/manage-admins': ['admin', 'root'],
  '/pages/manage-admins': ['admin', 'root'],
  '/manage-users': ['admin', 'root'],
  '/pages/manage-users': ['admin', 'root'],
  '/manage-departments': ['admin', 'root'],
  '/pages/manage-departments': ['admin', 'root'],
  '/manage-department-groups': ['admin', 'root'],
  '/pages/manage-department-groups': ['admin', 'root'],
  '/manage-areas': ['admin', 'root'],
  '/pages/manage-areas': ['admin', 'root'],
  '/manage-teams': ['admin', 'root'],
  '/pages/manage-teams': ['admin', 'root'],
  '/manage-machines': ['admin', 'root'],
  '/pages/manage-machines': ['admin', 'root'],
  '/manage-employees': ['admin', 'root'],
  '/pages/manage-employees': ['admin', 'root'],
  '/blackboard': ['employee', 'admin', 'root'],
  '/pages/blackboard': ['employee', 'admin', 'root'],
  '/document-upload': ['admin', 'root'],
  '/pages/document-upload': ['admin', 'root'],
  '/survey-admin': ['admin', 'root'],
  '/pages/survey-admin': ['admin', 'root'],
  '/survey-create': ['admin', 'root'],
  '/pages/survey-create': ['admin', 'root'],
  '/survey-details': ['admin', 'root'],
  '/pages/survey-details': ['admin', 'root'],
  '/survey-results': ['admin', 'root'],
  '/pages/survey-results': ['admin', 'root'],
  '/archived-employees': ['admin', 'root'],
  '/pages/archived-employees': ['admin', 'root'],
  '/admin-profile': ['admin', 'root'],
  '/pages/admin-profile': ['admin', 'root'],

  // Employee pages (accessible by all)
  [EMPLOYEE_DASHBOARD_URL]: ['employee', 'admin', 'root'],
  '/pages/employee-dashboard': ['employee', 'admin', 'root'],
  '/profile': ['employee', 'admin', 'root'],
  '/pages/profile': ['employee', 'admin', 'root'],
  '/employee-profile': ['employee', 'admin', 'root'],
  '/pages/employee-profile': ['employee', 'admin', 'root'],
  '/kvp': ['employee', 'admin', 'root'],
  '/pages/kvp': ['employee', 'admin', 'root'],
  '/kvp-detail': ['employee', 'admin', 'root'],
  '/pages/kvp-detail': ['employee', 'admin', 'root'],
  '/calendar': ['employee', 'admin', 'root'],
  '/pages/calendar': ['employee', 'admin', 'root'],
  '/shifts': ['employee', 'admin', 'root'],
  '/pages/shifts': ['employee', 'admin', 'root'],
  '/chat': ['employee', 'admin', 'root'],
  '/pages/chat': ['employee', 'admin', 'root'],
  '/survey-employee': ['employee', 'admin', 'root'],
  '/pages/survey-employee': ['employee', 'admin', 'root'],
  '/documents': ['employee', 'admin', 'root'],
  '/pages/documents': ['employee', 'admin', 'root'],
  '/documents-search': ['employee', 'admin', 'root'],
  '/pages/documents-search': ['employee', 'admin', 'root'],
  '/documents-company': ['employee', 'admin', 'root'],
  '/pages/documents-company': ['employee', 'admin', 'root'],
  '/documents-department': ['employee', 'admin', 'root'],
  '/pages/documents-department': ['employee', 'admin', 'root'],
  '/documents-team': ['employee', 'admin', 'root'],
  '/pages/documents-team': ['employee', 'admin', 'root'],
  '/documents-personal': ['employee', 'admin', 'root'],
  '/pages/documents-personal': ['employee', 'admin', 'root'],
  '/documents-payroll': ['employee', 'admin', 'root'],
  '/pages/documents-payroll': ['employee', 'admin', 'root'],
  '/account-settings': ['employee', 'admin', 'root'],
  '/pages/account-settings': ['employee', 'admin', 'root'],
};

// Convert to Map for safer access (prevents object injection)
const accessControlMap = new Map<string, ('root' | 'admin' | 'employee')[]>(Object.entries(accessControlData));

class UnifiedNavigation {
  private currentUser: TokenPayload | null = null;
  private currentRole: 'admin' | 'employee' | 'root' | null = null;
  private navigationItems: NavigationItems;
  private isCollapsed = false;
  private userProfileData: UserProfileResponse | null = null;
  private lastKvpClickTimestamp: number | null = null;
  private lastKnownKvpCount = 0;
  private sseClient: SSEClient | null = null;

  constructor() {
    this.navigationItems = this.getNavigationItems();
    // Load last KVP click timestamp and count from localStorage
    const savedTimestamp = localStorage.getItem('lastKvpClickTimestamp');
    this.lastKvpClickTimestamp = savedTimestamp !== null ? Number.parseInt(savedTimestamp, 10) : null;
    const savedCount = localStorage.getItem('lastKnownKvpCount');
    this.lastKnownKvpCount = savedCount !== null ? Number.parseInt(savedCount, 10) : 0;
    this.init();
  }

  /**
   * Prüft ob eine Rolle auf eine bestimmte Seite zugreifen darf
   */
  public canAccessPage(path: string, role: 'admin' | 'employee' | 'root'): boolean {
    // Normalisiere den Pfad (entferne Query-Parameter und Hash)
    const normalizedPath = path.split('?')[0].split('#')[0];

    // Prüfe ob der Pfad in der Map existiert (Map ist sicher gegen Object Injection)
    const allowedRoles = accessControlMap.get(normalizedPath);
    if (allowedRoles) {
      return allowedRoles.includes(role);
    }

    // Wenn Seite nicht in der Map ist, erlaube Zugriff für alle
    // (für öffentliche Seiten wie Login, etc.)
    return true;
  }

  /**
   * Gibt die passende Dashboard-URL für eine Rolle zurück
   */
  public getDashboardForRole(role: 'admin' | 'employee' | 'root'): string {
    switch (role) {
      case 'root':
        return ROOT_DASHBOARD_URL;
      case 'admin':
        return ADMIN_DASHBOARD_URL;
      case 'employee':
        return EMPLOYEE_DASHBOARD_URL;
      default:
        return EMPLOYEE_DASHBOARD_URL;
    }
  }

  /**
   * Prüft die aktuelle Seite und leitet bei fehlendem Zugriff weiter
   */
  public enforcePageAccess(): void {
    const currentPath = window.location.pathname;
    const activeRole = (localStorage.getItem('activeRole') ?? localStorage.getItem('userRole') ?? 'employee') as
      | 'admin'
      | 'employee'
      | 'root';

    console.info(`[UnifiedNav] Checking access: Role '${activeRole}' accessing '${currentPath}'`);

    if (!this.canAccessPage(currentPath, activeRole)) {
      console.warn(`[UnifiedNav] Access denied: Role '${activeRole}' cannot access '${currentPath}'`);
      const dashboard = this.getDashboardForRole(activeRole);
      console.info(`[UnifiedNav] Redirecting to dashboard: ${dashboard}`);
      window.location.href = dashboard;
    } else {
      console.info(`[UnifiedNav] Access granted: Role '${activeRole}' can access '${currentPath}'`);
    }
  }

  private init(): void {
    this.setupInitialState();
    this.setupEventHandlers();
    this.initializeSSE();
    this.setupBadgeUpdates();
    this.setupRoleSwitchListener();
    this.setupStorageListener();
  }

  private setupInitialState(): void {
    // Inject CSS styles first
    this.injectCSS();

    // Load collapsed state from localStorage
    this.isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';

    // Clear any stale submenu state on init if we're on a dashboard
    const currentPath = window.location.pathname;
    if (currentPath.includes('dashboard')) {
      localStorage.removeItem('openSubmenu');
    }

    // Enforce page access based on current role
    this.enforcePageAccess();
    this.loadUserInfo();
    this.injectNavigationHTML();
  }

  private setupEventHandlers(): void {
    // Initialize event delegation for all navigation actions
    this.initializeEventDelegation();

    // Fix logo navigation after DOM is ready
    setTimeout(() => {
      this.fixLogoNavigation();
      // Initialize role switch after navigation is injected
      this.initializeRoleSwitch();
      this.initializeRoleSwitchForAdmin();
    }, 100);
  }

  private setupBadgeUpdates(): void {
    // Initial badge updates (once after 1 second)
    setTimeout(() => {
      void this.updateUnreadMessages();
      void this.updateUnreadDocuments();
      void this.updateNewKvpSuggestions();
      void this.updateUnreadCalendarEvents();
    }, 1000);

    // REMOVED: 10-minute polling for surveys - replaced by SSE
    // Only keep polling for Chat messages (until WebSocket covers all events)
    setInterval(() => {
      void this.updateUnreadMessages(); // Keep for now (WebSocket only covers direct messages)
      // void this.updatePendingSurveys(); // REMOVED - handled by SSE
      void this.updateUnreadDocuments(); // Keep for now (not yet in SSE)
      void this.updateNewKvpSuggestions(); // Keep for now (not yet in SSE)
      void this.updateUnreadCalendarEvents(); // Keep for now (not yet in SSE)
    }, 600000);
  }

  private setupRoleSwitchListener(): void {
    // Listen for BroadcastChannel messages to update navigation
    const roleChannel = new BroadcastChannel('role_switch_channel');
    roleChannel.onmessage = (event: MessageEvent<RoleSwitchMessage>) => {
      if (event.data.type === 'ROLE_SWITCHED') {
        console.info('[UnifiedNav] Received role switch notification from another tab');

        // Update local storage with new role data
        if (event.data.newRole !== undefined) {
          localStorage.setItem('activeRole', event.data.newRole);
        }
        if (event.data.token !== undefined) {
          localStorage.setItem('token', event.data.token);
        }

        // Refresh the entire navigation with new role
        this.refresh();
      }
    };
  }

  private setupStorageListener(): void {
    // Debounce timer for redirects to prevent loops
    let redirectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isRedirecting = false;

    // Listen for storage events from other tabs
    window.addEventListener('storage', (event) => {
      if (event.key === 'activeRole' && event.newValue !== event.oldValue) {
        console.info('[UnifiedNav] Storage event: activeRole changed from', event.oldValue, 'to', event.newValue);

        // Clear any pending redirects
        if (redirectTimeout) {
          clearTimeout(redirectTimeout);
        }

        // Debounce the redirect to prevent rapid fire changes
        redirectTimeout = setTimeout(() => {
          this.handleRoleChangeRedirect(event.newValue, isRedirecting);
        }, 300); // 300ms delay to batch rapid changes
      }
    });
  }

  private handleRoleChangeRedirect(newActiveRole: string | null, isRedirecting: boolean): void {
    // Prevent multiple redirects
    if (isRedirecting) {
      console.info('[UnifiedNav] Redirect already in progress, skipping...');
      return;
    }

    // Check if we need to redirect based on current page
    const currentPagePath = window.location.pathname;
    const userRole = localStorage.getItem('userRole');

    // Helper function to get dashboard path for role
    const getDashboardPath = (role: string | null): string => {
      switch (role) {
        case 'root':
          return ROOT_DASHBOARD_URL;
        case 'admin':
          return ADMIN_DASHBOARD_URL;
        case 'employee':
          return EMPLOYEE_DASHBOARD_URL;
        default:
          return '/';
      }
    };

    const targetPath = getDashboardPath(newActiveRole);

    // Only redirect if we're not already on the correct dashboard
    if (targetPath !== '' && !currentPagePath.includes(targetPath)) {
      // Check if user has permission for the target role
      if (newActiveRole === 'root' && userRole !== 'root') {
        console.info('[UnifiedNav] User does not have root permission, skipping redirect');
        return;
      }

      console.info(`[UnifiedNav] Redirecting to ${targetPath} due to role change`);
      // Use replace to avoid adding to browser history
      window.location.replace(targetPath);
    } else {
      console.info('[UnifiedNav] Already on correct dashboard, refreshing navigation only');
      // Just refresh navigation if we're already on the right page
      this.refresh();
    }
  }

  private parseTokenPayload():
    | (TokenPayload & {
        activeRole?: string;
        isRoleSwitched?: boolean;
      })
    | null {
    const token = localStorage.getItem('token');
    if (token === null || token === '') {
      return null;
    }

    try {
      return JSON.parse(atob(token.split('.')[1])) as TokenPayload & {
        activeRole?: string;
        isRoleSwitched?: boolean;
      };
    } catch (error) {
      console.error('Error parsing token:', error);
      return null;
    }
  }

  private getDashboardTypeFromPath(path: string): 'root' | 'admin' | 'employee' | null {
    if (path.includes(ROOT_DASHBOARD_URL)) {
      return 'root';
    }
    if (path.includes(ADMIN_DASHBOARD_URL)) {
      return 'admin';
    }
    if (path.includes(EMPLOYEE_DASHBOARD_URL)) {
      return 'employee';
    }
    return null;
  }

  private determineActiveRole(
    dashboardType: 'root' | 'admin' | 'employee' | null,
    payload: TokenPayload & { activeRole?: string },
  ): 'root' | 'admin' | 'employee' {
    // Dashboard type takes precedence
    if (dashboardType !== null) {
      return dashboardType;
    }

    // Use payload activeRole if available
    if (payload.activeRole !== undefined) {
      return payload.activeRole as 'root' | 'admin' | 'employee';
    }

    // Check localStorage
    const activeRole = localStorage.getItem('activeRole');
    if (activeRole !== null && ['root', 'admin', 'employee'].includes(activeRole)) {
      return activeRole as 'root' | 'admin' | 'employee';
    }

    // Default to token role
    return payload.role;
  }

  private updateActiveRoleInStorage(
    dashboardType: 'root' | 'admin' | 'employee' | null,
    storedUserRole: string | null,
  ): void {
    if (dashboardType === 'root' && storedUserRole === 'root') {
      localStorage.setItem('activeRole', 'root');
    } else if (dashboardType === 'admin' && (storedUserRole === 'root' || storedUserRole === 'admin')) {
      localStorage.setItem('activeRole', 'admin');
    } else if (dashboardType === 'employee') {
      localStorage.setItem('activeRole', 'employee');
    }
  }

  private loadUserInfo(): void {
    const payload = this.parseTokenPayload();
    if (payload === null) {
      return;
    }

    this.currentUser = payload;

    const currentPath = window.location.pathname;
    const dashboardType = this.getDashboardTypeFromPath(currentPath);
    const storedUserRole = localStorage.getItem('userRole');

    this.currentRole = this.determineActiveRole(dashboardType, payload);
    this.updateActiveRoleInStorage(dashboardType, storedUserRole);

    console.info('[UnifiedNav] Role determined:', {
      currentPath,
      storedUserRole,
      tokenRole: payload.role,
      activeRole: localStorage.getItem('activeRole'),
      finalRole: this.currentRole,
    });

    void this.loadFullUserProfile();
  }

  private getSectionUrl(section: string): string {
    // Check if we're on admin-dashboard page
    const isOnAdminDashboard = window.location.pathname.includes('admin-dashboard');

    if (isOnAdminDashboard) {
      // If we're already on admin dashboard, use simple query parameter
      return `?section=${section}`;
    } else {
      // If we're on another page, navigate to admin dashboard with section parameter
      return `/admin-dashboard?section=${section}`;
    }
  }

  private async loadFullUserProfile(): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (token === null || token === 'test-mode') return;

      console.info('[UnifiedNav] Fetching full user profile with company data');
      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_AUTH ?? window.FEATURE_FLAGS?.USE_API_V2_USERS;
      console.info('[UnifiedNav] useV2 flag:', useV2);

      if (useV2 === true) {
        await this.loadV2UserProfile();
      }
      // eslint-disable-next-line max-lines
    } catch (error) {
      console.error('[UnifiedNav] Error loading full user profile:', error);
    }
  }

  private async loadV2UserProfile(): Promise<void> {
    try {
      // Use cached user data from auth.js to prevent duplicate API calls
      console.info('[UnifiedNav] Using cached user data from auth.js');
      const userData = (await loadUserInfoFromAuth()) as UserProfileResponse;
      console.info('[UnifiedNav] Full user data from cache:', userData);

      this.updateCompanyInfo(userData);
      this.updateUserInfo(userData);
      this.updateEmployeeNumber(userData);
      this.updateHeaderUserName(userData);
      this.updateAvatars(userData);

      this.userProfileData = userData;
    } catch (error) {
      console.error('[UnifiedNav] Error loading user data:', error);
    }
  }

  private updateCompanyInfo(userData: UserProfileResponse): void {
    const companyElement = $$('#sidebar-company-name');
    const companyName = userData.tenant?.company_name ?? userData.companyName;
    if (companyElement && companyName !== undefined) {
      console.info('[UnifiedNav] Setting company name to:', companyName);
      companyElement.textContent = companyName;
    }

    const domainElement = $$('#sidebar-domain');
    const subdomain = userData.tenant?.subdomain ?? userData.subdomain;
    if (domainElement && subdomain !== undefined) {
      domainElement.textContent = `${subdomain}.assixx.de`;
    }
  }

  private updateUserInfo(userData: UserProfileResponse): void {
    const sidebarUserName = $$('#sidebar-user-name');
    if (sidebarUserName) {
      sidebarUserName.textContent = userData.email;
    }

    const sidebarFullName = $$('#sidebar-user-fullname');
    if (sidebarFullName) {
      const firstName = userData.firstName ?? userData.data?.firstName ?? '';
      const lastName = userData.lastName ?? userData.data?.lastName ?? '';
      if (firstName !== '' || lastName !== '') {
        const fullName = `${firstName} ${lastName}`.trim();
        sidebarFullName.textContent = fullName;
      }
    }
  }

  private updateEmployeeNumber(userData: UserProfileResponse): void {
    const sidebarEmployeeNumber = $$('#sidebar-employee-number');
    if (!sidebarEmployeeNumber) return;

    interface UserDataWithEmployeeNumber extends UserProfileResponse {
      employee_number?: string;
      data?: {
        employeeNumber?: string;
        employee_number?: string;
      };
    }
    const userDataTyped = userData as UserDataWithEmployeeNumber;
    const employeeNumber =
      userData.employeeNumber ??
      userDataTyped.employee_number ??
      userData.data?.employeeNumber ??
      userDataTyped.data?.employee_number;

    if (employeeNumber !== undefined) {
      console.info('[UnifiedNav] Setting employee number to:', employeeNumber);
      if (employeeNumber !== '000001') {
        sidebarEmployeeNumber.textContent = `Personalnummer: ${employeeNumber}`;
      } else {
        sidebarEmployeeNumber.textContent = 'Personalnummer: Temporär';
        sidebarEmployeeNumber.style.color = 'var(--warning-color)';
      }
    }
  }

  private updateHeaderUserName(userData: UserProfileResponse): void {
    const headerUserName = $$('#user-name');
    if (!headerUserName) return;

    const firstName = userData.firstName ?? userData.data?.firstName ?? '';
    const lastName = userData.lastName ?? userData.data?.lastName ?? '';
    console.info('[UnifiedNav] Updating header user name:', { firstName, lastName, userData });

    if (firstName !== '' || lastName !== '') {
      const fullName = `${firstName} ${lastName}`.trim();
      headerUserName.textContent = fullName;
      console.info('[UnifiedNav] Set header name to:', fullName);
    } else {
      headerUserName.textContent = userData.email;
      console.info('[UnifiedNav] Fallback to email:', userData.email);
    }
  }

  private updateAvatars(userData: UserProfileResponse): void {
    const profilePic = this.extractProfilePicture(userData);
    const firstName = userData.firstName ?? userData.data?.firstName ?? '';
    const lastName = userData.lastName ?? userData.data?.lastName ?? '';

    const sidebarAvatar = $$('#sidebar-user-avatar');
    if (sidebarAvatar) {
      this.updateAvatarElement(sidebarAvatar, profilePic, firstName, lastName);
    }

    const headerAvatar = $$('#user-avatar');
    if (headerAvatar) {
      this.updateAvatarElement(headerAvatar, profilePic, firstName, lastName);
    }
  }

  private extractProfilePicture(userData: UserProfileResponse): string | null {
    return (
      userData.profilePictureUrl ??
      userData.profilePicture ??
      userData.data?.profilePicture ??
      userData.data?.profile_picture ??
      null
    );
  }

  private getNavigationItems(): NavigationItems {
    return {
      admin: this.getAdminNavigationItems(),
      employee: this.getEmployeeNavigationItems(),
      root: this.getRootNavigationItems(),
    };
  }

  private getAdminNavigationItems(): NavItem[] {
    return [...this.getAdminCoreItems(), ...this.getAdminContentItems(), ...this.getAdminCommunicationItems()];
  }

  private getAdminCoreItems(): NavItem[] {
    return [
      {
        id: 'dashboard',
        icon: this.getSVGIcon('home'),
        label: 'Übersicht',
        url: this.getSectionUrl('dashboard'),
        section: 'dashboard',
      },
      {
        id: 'employees',
        icon: this.getSVGIcon('users'),
        label: 'Mitarbeiter',
        url: this.getSectionUrl('employees'),
        section: 'employees',
        children: [
          {
            id: 'employees-list',
            label: 'Mitarbeiterliste',
            url: '/manage-employees',
            section: 'employees',
          },
        ],
      },
      {
        id: 'areas',
        icon: this.getSVGIcon('sitemap'),
        label: 'Bereiche',
        url: '/manage-areas',
        section: 'areas',
      },
      {
        id: 'departments',
        icon: this.getSVGIcon('building'),
        label: 'Abteilungen',
        url: '/manage-departments',
        children: [
          {
            id: 'departments-all',
            label: 'Alle Abteilungen',
            url: '/manage-departments',
          },
        ],
      },
      {
        id: 'teams',
        icon: this.getSVGIcon('team'),
        label: 'Teams',
        url: '/manage-teams',
        section: 'teams',
      },
      {
        id: 'machines',
        icon: this.getSVGIcon('generator'),
        label: 'Maschinen',
        url: '/manage-machines',
        section: 'machines',
      },
    ];
  }

  private getAdminContentItems(): NavItem[] {
    return [
      {
        id: 'documents',
        icon: this.getSVGIcon('document'),
        label: 'Dokumente',
        hasSubmenu: true,
        submenu: this.getDocumentSubmenu(),
      },
      {
        id: 'calendar',
        icon: this.getSVGIcon('calendar'),
        label: 'Kalender',
        url: '/calendar',
        badge: 'unread-calendar-events',
      },
      {
        id: 'lean-management',
        icon: this.getSVGIcon('lean'),
        label: 'LEAN-Management',
        hasSubmenu: true,
        badge: 'lean-management-parent',
        submenu: this.getLeanManagementSubmenu(true),
      },
      {
        id: 'shifts',
        icon: this.getSVGIcon('clock'),
        label: 'Schichtplanung',
        url: '/shifts',
      },
    ];
  }

  private getAdminCommunicationItems(): NavItem[] {
    return [
      {
        id: 'chat',
        icon: this.getSVGIcon('chat'),
        label: 'Chat',
        url: '/chat',
        badge: 'unread-messages',
      },
      {
        id: 'settings',
        icon: this.getSVGIcon('settings'),
        label: 'Einstellungen',
        url: '#settings',
        section: 'settings',
      },
      /*
      {
        id: 'features',
        icon: this.getSVGIcon('feature'),
        label: 'Feature Management',
        url: '/feature-management',
      },
      */
      {
        id: 'profile',
        icon: this.getSVGIcon('user'),
        label: 'Mein Profil',
        url: '/admin-profile',
      },
    ];
  }

  private getEmployeeNavigationItems(): NavItem[] {
    return [
      {
        id: 'dashboard',
        icon: this.getSVGIcon('home'),
        label: 'Dashboard',
        url: EMPLOYEE_DASHBOARD_URL,
      },
      {
        id: 'documents',
        icon: this.getSVGIcon('document'),
        label: 'Dokumente',
        hasSubmenu: true,
        badge: 'unread-documents',
        submenu: this.getDocumentSubmenu(),
      },
      {
        id: 'calendar',
        icon: this.getSVGIcon('calendar'),
        label: 'Kalender',
        url: '/calendar',
        badge: 'unread-calendar-events',
      },
      {
        id: 'lean-management',
        icon: this.getSVGIcon('lean'),
        label: 'LEAN-Management',
        hasSubmenu: true,
        badge: 'lean-management-parent',
        submenu: this.getLeanManagementSubmenu(false),
      },
      {
        id: 'chat',
        icon: this.getSVGIcon('chat'),
        label: 'Chat',
        url: '/chat',
        badge: 'unread-messages',
      },
      {
        id: 'shifts',
        icon: this.getSVGIcon('clock'),
        label: 'Schichtplanung',
        url: '/shifts',
      },
      {
        id: 'profile',
        icon: this.getSVGIcon('user'),
        label: 'Mein Profil',
        url: '/profile',
      },
    ];
  }

  private getRootNavigationItems(): NavItem[] {
    return [...this.getRootUserManagementItems(), ...this.getRootOrganizationItems(), ...this.getRootSystemItems()];
  }

  private getRootUserManagementItems(): NavItem[] {
    return [
      {
        id: 'dashboard',
        icon: this.getSVGIcon('home'),
        label: 'Root Dashboard',
        url: ROOT_DASHBOARD_URL,
      },
      {
        id: 'root-users',
        icon: this.getSVGIcon('user-shield'),
        label: 'Root User',
        url: '/manage-root-users',
      },
      {
        id: 'admins',
        icon: this.getSVGIcon('admin'),
        label: 'Administratoren',
        url: '/manage-admins',
      },
    ];
  }

  private getRootOrganizationItems(): NavItem[] {
    return [
      {
        id: 'areas',
        icon: this.getSVGIcon('sitemap'),
        label: 'Bereiche',
        url: '/manage-areas',
        section: 'areas',
      },
      {
        id: 'departments',
        icon: this.getSVGIcon('building'),
        label: 'Abteilungen',
        url: '/manage-departments',
      },
      {
        id: 'department-groups',
        icon: this.getSVGIcon('folder-tree'),
        label: 'Abteilungsgruppen',
        url: '/manage-department-groups',
      },
      {
        id: 'chat',
        icon: this.getSVGIcon('chat'),
        label: 'Chat',
        url: '/chat',
        badge: 'unread-messages',
      },
    ];
  }

  private getRootSystemItems(): NavItem[] {
    return [
      {
        id: 'features',
        icon: this.getSVGIcon('feature'),
        label: 'Features',
        url: '/root-features',
      },
      {
        id: 'logs',
        icon: this.getSVGIcon('logs'),
        label: 'System-Logs',
        url: '/logs',
      },
      {
        id: 'profile',
        icon: this.getSVGIcon('user'),
        label: 'Mein Profil',
        url: '/root-profile',
      },
      {
        id: 'system',
        icon: this.getSVGIcon('settings'),
        label: 'System',
        hasSubmenu: true,
        submenu: [
          {
            id: 'account-settings',
            icon: this.getSVGIcon('user-shield'),
            label: 'Kontoeinstellungen',
            url: '/account-settings',
          },
        ],
      },
    ];
  }

  private getDocumentSubmenu(): NavItem[] {
    return [
      {
        id: 'documents-search',
        icon: this.getSVGIcon('search'),
        label: 'Dokumente suchen',
        url: '/documents-search',
      },
      {
        id: 'documents-company',
        icon: this.getSVGIcon('building'),
        label: 'Firmendokumente',
        url: '/documents-company',
        badgeId: 'badge-docs-company',
      },
      {
        id: 'documents-department',
        icon: this.getSVGIcon('sitemap'),
        label: 'Abteilungsdokumente',
        url: '/documents-department',
        badgeId: 'badge-docs-department',
      },
      {
        id: 'documents-team',
        icon: this.getSVGIcon('team'),
        label: 'Teamdokumente',
        url: '/documents-team',
        badgeId: 'badge-docs-team',
      },
      {
        id: 'documents-personal',
        icon: this.getSVGIcon('user'),
        label: 'Persönliche Dokumente',
        url: '/documents-personal',
        badgeId: 'badge-docs-personal',
      },
      {
        id: 'documents-payroll',
        icon: this.getSVGIcon('money'),
        label: 'Gehaltsabrechnungen',
        url: '/documents-payroll',
        badgeId: 'badge-docs-payroll',
      },
    ];
  }

  private getLeanManagementSubmenu(isAdmin: boolean): NavItem[] {
    return [
      {
        id: 'kvp',
        icon: this.getSVGIcon('lightbulb'),
        label: 'KVP System',
        url: '/kvp',
        badge: 'new-kvp-suggestions',
      },
      {
        id: 'surveys',
        icon: this.getSVGIcon('poll'),
        label: 'Umfragen',
        url: isAdmin ? '/survey-admin' : '/survey-employee',
        badge: isAdmin ? undefined : 'pending-surveys',
      },
      {
        id: 'tpm',
        icon: this.getSVGIcon('wrench'),
        label: 'TPM',
        url: this.getSectionUrl('tpm'),
        section: 'tpm',
      },
      {
        id: '5s',
        icon: this.getSVGIcon('star'),
        label: '5S',
        url: this.getSectionUrl('5s'),
        section: '5s',
      },
      {
        id: 'standards',
        icon: this.getSVGIcon('checklist'),
        label: 'Standards',
        url: this.getSectionUrl('standards'),
        section: 'standards',
      },
    ];
  }

  private getSVGIcon(name: string): string {
    const iconsData: Record<string, string> = {
      home: '<i class="fas fa-home"></i>',
      users:
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
      user: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
      document:
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/></svg>',
      blackboard:
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>',
      calendar:
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7v-5z"/></svg>',
      clock:
        '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>',
      chat: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>',
      lightbulb:
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17h8v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7z"/></svg>',
      money:
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>',
      building:
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12,3L1,9V21H23V9M21,19H3V10.53L12,5.68L21,10.53M8,15H10V19H8M12,15H14V19H12M16,15H18V19H16Z"/></svg>',
      team: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>',
      'folder-tree':
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3,3H9V7H3V3M15,10H21V14H15V10M15,17H21V21H15V17M13,13H11V18H13V20H11V21H9V20H7V18H9V11H7V9H9V3H11V9H13V11H15V13H13Z"/></svg>',
      settings:
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>',
      feature:
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19,8L15,12H18C18,15.31 15.31,18 12,18C10.99,18 10.03,17.75 9.2,17.3L7.74,18.76C8.97,19.54 10.43,20 12,20C16.42,20 20,16.42 20,12H23M6,12C6,8.69 8.69,6 12,6C13.01,6 13.97,6.25 14.8,6.7L16.26,5.24C15.03,4.46 13.57,4 12,4C7.58,4 4,7.58 4,12H1L5,16L9,12"/></svg>',
      admin:
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6,14.8,10V11H9.2V10C9.2,8.6 10.6,7 12,7M8.2,16V13H15.8V16H8.2Z"/></svg>',
      'user-shield':
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,5A3,3 0 0,1 15,8A3,3 0 0,1 12,11A3,3 0 0,1 9,8A3,3 0 0,1 12,5M17.13,17C15.92,18.85 14.11,20.24 12,20.92C9.89,20.24 8.08,18.85 6.87,17C6.53,16.5 6.24,16 6,15.47C6,13.82 8.71,12.47 12,12.47C15.29,12.47 18,13.79 18,15.47C17.76,16 17.47,16.5 17.13,17Z"/></svg>',
      poll: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3,22V8H7V22H3M10,22V2H14V22H10M17,22V14H21V22H17Z"/></svg>',
      lean: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/></svg>',
      wrench:
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.7,19L13.6,9.9C14.5,7.6 14,4.9 12.1,3C10.1,1 7.1,0.6 4.7,1.7L9,6L6,9L1.6,4.7C0.4,7.1 0.9,10.1 2.9,12.1C4.8,14 7.5,14.5 9.8,13.6L18.9,22.7C19.3,23.1 19.9,23.1 20.3,22.7L22.6,20.4C23.1,20 23.1,19.3 22.7,19Z"/></svg>',
      star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z"/></svg>',
      checklist:
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9,5V9H21V5M9,19H21V15H9M9,14H21V10H9M4,9H8V5H4M4,19H8V15H4M4,14H8V10H4V14Z"/></svg>',
      search:
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5,14h-0.79l-0.28-0.27C15.41,12.59,16,11.11,16,9.5 C16,5.91,13.09,3,9.5,3S3,5.91,3,9.5S5.91,16,9.5,16c1.61,0,3.09-0.59,4.23-1.57l0.27,0.28v0.79l5,4.99L20.49,19L15.5,14z M9.5,14C7.01,14,5,11.99,5,9.5S7.01,5,9.5,5S14,7.01,14,9.5S11.99,14,9.5,14z"/></svg>',
      sitemap:
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.19 21C14.12 19.43 13 17.36 13 15.5C13 13.67 13.96 12 15.4 11H15V9H17V10.23C17.5 10.09 18 10 18.5 10C18.67 10 18.84 10 19 10.03V3H5V21H11V17.5H13V21H15.19M15 5H17V7H15V5M9 19H7V17H9V19M9 15H7V13H9V15M9 11H7V9H9V11M9 7H7V5H9V7M11 5H13V7H11V5M11 9H13V11H11V9M11 15V13H13V15H11M18.5 12C16.6 12 15 13.61 15 15.5C15 18.11 18.5 22 18.5 22S22 18.11 22 15.5C22 13.61 20.4 12 18.5 12M18.5 16.81C17.8 16.81 17.3 16.21 17.3 15.61C17.3 14.91 17.9 14.41 18.5 14.41S19.7 15 19.7 15.61C19.8 16.21 19.2 16.81 18.5 16.81Z"/></svg>',
      logs: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M8,15.5H16V17H8V15.5M8,11.5H16V13H8V11.5Z"/></svg>',
      'trash-clock':
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15,16H19V18H15V16M15,8H19V10H15V8M15,12H19V14H15V12M5,12V9L9,5L13,9V13A2,2 0 0,1 11,15H7A2,2 0 0,1 5,13M9,3A1,1 0 0,0 8,4A1,1 0 0,0 9,5A1,1 0 0,0 10,4A1,1 0 0,0 9,3M2,17V20H11.67C11.24,19.09 11,18.07 11,17H2M6,8V10H8V8H6M6,11V13H8V11H6M16.5,3C13.46,3 11,5.46 11,8.5V9H13V8.5C13,6.57 14.57,5 16.5,5C18.43,5 20,6.57 20,8.5C20,10.43 18.43,12 16.5,12H16V14H16.5C19.54,14 22,11.54 22,8.5C22,5.46 19.54,3 16.5,3Z"/></svg>',
      generator:
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 2C5.9 2 5 2.9 5 4V6H4C2.9 6 2 6.9 2 8V20H4V21C4 21.55 4.45 22 5 22H6C6.55 22 7 21.55 7 21V20H17V21C17 21.55 17.45 22 18 22H19C19.55 22 20 21.55 20 21V20H22V8C22 6.9 21.11 6 20 6H19V4C19 2.9 18.11 2 17 2H7M14 10V8H20V10H14M14 14V12H20V14H14M7 4H17V6H7V4M7 8V12H9L6 18V14H4L7 8Z"/></svg>',
      cog: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/></svg>',
    };
    const icons = new Map(Object.entries(iconsData));
    return icons.get(name) ?? icons.get('home') ?? '';
  }

  private getNavigationForRole(role: 'admin' | 'employee' | 'root' | null): NavItem[] {
    if (role === null) return [];
    // Safe access - role is typed to known values only
    switch (role) {
      case 'admin':
        return this.navigationItems.admin;
      case 'employee':
        return this.navigationItems.employee;
      case 'root':
        return this.navigationItems.root;
      default:
        return [];
    }
  }

  private getInitials(firstName?: string, lastName?: string): string {
    const firstInitial = firstName !== undefined && firstName !== '' ? firstName.charAt(0).toUpperCase() : '';
    const lastInitial = lastName !== undefined && lastName !== '' ? lastName.charAt(0).toUpperCase() : '';
    const initials = `${firstInitial}${lastInitial}`;
    return initials !== '' ? initials : 'U';
  }

  private updateAvatarElement(
    element: HTMLElement,
    profilePicUrl: string | null,
    firstName?: string,
    lastName?: string,
  ): void {
    // Clear existing content
    element.textContent = '';

    if (profilePicUrl !== null && profilePicUrl !== '') {
      // Show profile picture
      const img = document.createElement('img');
      img.src = profilePicUrl;
      img.alt = 'Avatar';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.style.borderRadius = 'inherit';
      element.append(img);
      element.classList.remove('avatar-initials');
    } else {
      // Show initials
      const initials = this.getInitials(firstName, lastName);
      element.textContent = initials;
      element.classList.add('avatar-initials');
    }
  }

  private injectNavigationHTML(): void {
    const navigation = this.createNavigationHTML();

    // Check for navigation-container first (new approach)
    const navigationContainer = document.querySelector('#navigation-container');
    if (navigationContainer) {
      // Create header and insert it directly into body as first element
      const existingHeader = document.querySelector('.header');
      if (!existingHeader) {
        const headerHTML = this.createHeaderOnly();
        // eslint-disable-next-line no-unsanitized/method -- Safe: headerHTML is internally generated, not user input
        document.body.insertAdjacentHTML('afterbegin', headerHTML);
      }

      // Create modals and banner for navigation-container
      const modalsAndBanner = this.createModalsAndBanner();
      setHTML(navigationContainer as HTMLElement, modalsAndBanner);

      // Now inject sidebar into layout-container
      this.injectSidebarIntoLayout();

      // Re-attach event listeners after inserting HTML
      setTimeout(() => {
        // Only re-attach if not already attached
        if (!this.isEventListenerAttached) {
          this.attachEventListeners();
        }
        // Badge updates removed - handled by initial load after 1 second
      }, 100);

      return;
    }

    // Suche nach bestehender Sidebar und ersetze sie
    const existingSidebar = document.querySelector('.sidebar');
    if (existingSidebar) {
      setHTML(existingSidebar as HTMLElement, navigation);
    } else {
      // Erstelle neue Sidebar falls keine existiert
      this.createSidebarStructure();
    }
  }

  private injectSidebarIntoLayout(): void {
    // Find or create layout-container
    let layoutContainer = document.querySelector('.layout-container');

    if (!layoutContainer) {
      // Create layout-container if it doesn't exist
      layoutContainer = document.createElement('div');
      layoutContainer.className = 'layout-container';

      // Move main-content into layout-container if it exists outside
      const mainContent = document.querySelector('.main-content');
      if (mainContent !== null && mainContent.parentElement?.classList.contains('layout-container') !== true) {
        document.body.append(layoutContainer);
        layoutContainer.append(mainContent);
      }
    }

    // Check if sidebar already exists in layout-container
    let sidebar = layoutContainer.querySelector('.sidebar');

    if (!sidebar) {
      // Create sidebar element
      sidebar = document.createElement('aside');
      sidebar.className = `sidebar ${this.isCollapsed ? 'collapsed' : ''}`;

      // Insert sidebar as first child of layout-container
      layoutContainer.insertBefore(sidebar, layoutContainer.firstChild);
    }

    // Set sidebar content
    setHTML(sidebar as HTMLElement, this.createNavigationHTML());
  }

  // Unused method - kept for potential future use
  // private _createFullNavigationStructure(): string {
  //   const { storedUserRole, activeRole, userRole } = this.getUserRoles();
  //   const { displayName, firstName, lastName, profilePicture } = this.getUserDisplayInfo();
  //   const dashboardUrl = this.getDashboardUrl(storedUserRole, userRole);
  //   const logoSrc = this.getLogoSrc();
  //   const warningBanner = this.createRoleSwitchBanner(storedUserRole, activeRole);
  //   const roleSwitchDropdown = this.createRoleSwitchDropdown(userRole, activeRole);
  //   const userAvatar = this.createUserAvatar(profilePicture, firstName, lastName);

  //   return `
  //     ${this.createHeader(dashboardUrl, logoSrc, roleSwitchDropdown, userAvatar, displayName)}
  //     ${this.createLogoutModal()}
  //     ${warningBanner}
  //   `;
  // }

  private createHeaderOnly(): string {
    const { storedUserRole, userRole } = this.getUserRoles();
    const { displayName, firstName, lastName, profilePicture } = this.getUserDisplayInfo();
    const dashboardUrl = this.getDashboardUrl(storedUserRole, userRole);
    const logoSrc = this.getLogoSrc();
    const { activeRole } = this.getUserRoles();
    const roleSwitchDropdown = this.createRoleSwitchDropdown(userRole, activeRole);
    const userAvatar = this.createUserAvatar(profilePicture, firstName, lastName);

    return this.createHeader(dashboardUrl, logoSrc, roleSwitchDropdown, userAvatar, displayName);
  }

  private createModalsAndBanner(): string {
    const { storedUserRole, activeRole } = this.getUserRoles();
    const warningBanner = this.createRoleSwitchBanner(storedUserRole, activeRole);

    return `
      ${this.createLogoutModal()}
      ${warningBanner}
    `;
  }

  private getUserRoles(): { storedUserRole: string | null; activeRole: string | null; userRole: string } {
    const storedUserRole = localStorage.getItem('userRole');
    const activeRole = localStorage.getItem('activeRole') ?? storedUserRole;
    const userRole = storedUserRole ?? 'employee';
    return { storedUserRole, activeRole, userRole };
  }

  private getUserDisplayInfo(): {
    displayName: string;
    firstName: string;
    lastName: string;
    profilePicture: string | null;
  } {
    const userName = this.userProfileData?.username ?? this.currentUser?.username ?? 'User';
    const firstName = this.userProfileData?.firstName ?? this.userProfileData?.first_name ?? '';
    const lastName = this.userProfileData?.lastName ?? this.userProfileData?.last_name ?? '';
    const displayName = firstName !== '' && lastName !== '' ? `${firstName} ${lastName}` : userName;

    let profilePicture =
      this.userProfileData?.profilePictureUrl ??
      this.userProfileData?.profilePicture ??
      this.userProfileData?.profile_picture ??
      null;

    if (profilePicture === '') {
      profilePicture = null;
    }

    return { displayName, firstName, lastName, profilePicture };
  }

  private getDashboardUrl(storedUserRole: string | null, userRole: string): string {
    return storedUserRole === 'root'
      ? 'root-dashboard'
      : userRole === 'admin'
        ? 'admin-dashboard?section=dashboard'
        : 'employee-dashboard';
  }

  private getLogoSrc(): string {
    return this.isCollapsed ? '/assets/images/logo_collapsed.png' : '/assets/images/logo.png';
  }

  private createRoleSwitchBanner(storedUserRole: string | null, activeRole: string | null): string {
    const isRoleSwitched = storedUserRole !== activeRole && activeRole !== null;
    const bannerDismissedKey =
      activeRole !== null ? `roleSwitchBannerDismissed_${activeRole}` : 'roleSwitchBannerDismissed_default';
    const isBannerDismissed = localStorage.getItem(bannerDismissedKey) === 'true';

    if (!isRoleSwitched || isBannerDismissed) {
      return '';
    }

    const currentRoleText = activeRole === 'employee' ? 'Mitarbeiter' : activeRole === 'admin' ? 'Admin' : 'Root';
    const originalRoleText = storedUserRole === 'root' ? 'Root' : storedUserRole === 'admin' ? 'Admin' : 'Mitarbeiter';

    return `
      <!-- Role Switch Warning Banner -->
      <div class="role-switch-banner" id="role-switch-warning-banner">
        <div class="role-switch-banner-content">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px;">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <span>Sie agieren derzeit als <strong>${currentRoleText}</strong>. Ihre ursprüngliche Rolle ist <strong>${originalRoleText}</strong>.</span>
          <button class="role-switch-banner-close" data-action="dismiss-role-banner" title="Banner schließen">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  private createRoleSwitchDropdown(userRole: string, activeRole: string | null): string {
    if (userRole === 'root') {
      return this.createRootRoleSwitchDropdown(activeRole);
    }
    if (userRole === 'admin') {
      return this.createAdminRoleSwitchDropdown(activeRole);
    }
    return '';
  }

  private createRootRoleSwitchDropdown(activeRole: string | null): string {
    const currentView =
      activeRole === 'root' ? 'Root-Ansicht' : activeRole === 'admin' ? 'Admin-Ansicht' : 'Mitarbeiter-Ansicht';
    return `
      <!-- Role Switch Custom Dropdown for Root -->
      <div class="custom-dropdown role-switch-dropdown">
        <div class="dropdown-display" id="roleSwitchDisplay">
          <span>${currentView}</span>
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
            <path d="M1 1L6 6L11 1" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </div>
        <div class="dropdown-options" id="roleSwitchDropdown">
          <div class="dropdown-option ${activeRole === 'root' ? 'active' : ''}" data-value="root">Root-Ansicht</div>
          <div class="dropdown-option ${activeRole === 'admin' ? 'active' : ''}" data-value="admin">Admin-Ansicht</div>
          <div class="dropdown-option ${activeRole === 'employee' ? 'active' : ''}" data-value="employee">Mitarbeiter-Ansicht</div>
        </div>
        <input type="hidden" id="role-switch-value" value="${activeRole ?? 'root'}" />
      </div>
    `;
  }

  private createAdminRoleSwitchDropdown(activeRole: string | null): string {
    const currentView = activeRole === 'admin' ? 'Admin-Ansicht' : 'Mitarbeiter-Ansicht';
    return `
      <!-- Role Switch Dropdown for Admin -->
      <div class="custom-dropdown role-switch-dropdown">
        <div class="dropdown-display" id="roleSwitchDisplay">
          <span>${currentView}</span>
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
            <path d="M1 1L6 6L11 1" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </div>
        <div class="dropdown-options" id="roleSwitchDropdown">
          <div class="dropdown-option ${activeRole === 'admin' ? 'active' : ''}" data-value="admin">Admin-Ansicht</div>
          <div class="dropdown-option ${activeRole === 'employee' ? 'active' : ''}" data-value="employee">Mitarbeiter-Ansicht</div>
        </div>
        <input type="hidden" id="role-switch-value" value="${activeRole ?? 'admin'}" />
      </div>
    `;
  }

  private createUserAvatar(profilePicture: string | null, firstName: string, lastName: string): string {
    const avatarClass = profilePicture !== null && profilePicture !== '' ? '' : 'avatar-initials';
    const content =
      profilePicture !== null && profilePicture !== ''
        ? `<img src="${profilePicture}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit;" />`
        : this.getInitials(firstName, lastName);

    return `<div id="user-avatar" class="user-avatar ${avatarClass}">${content}</div>`;
  }

  private createHeader(
    dashboardUrl: string,
    logoSrc: string,
    roleSwitchDropdown: string,
    userAvatar: string,
    displayName: string,
  ): string {
    const togglePath = this.isCollapsed
      ? 'M4,6H20V8H4V6M4,11H15V13H4V11M4,16H20V18H4V16Z'
      : 'M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z';

    return `
      <!-- Header -->
      <header class="header">
        <button class="sidebar-toggle" id="sidebar-toggle" title="Sidebar ein-/ausklappen">
          <svg class="toggle-icon" width="30" height="30" viewBox="0 0 24 24" fill="white">
            <path class="toggle-icon-path" d="${togglePath}"></path>
          </svg>
        </button>
        <a href="${dashboardUrl}" class="logo-container">
          <img src="${logoSrc}" alt="Assixx Logo" class="logo" id="header-logo" />
        </a>
        <div class="header-content">
          <div class="header-actions">
            ${roleSwitchDropdown}
            <div id="user-info">
              ${userAvatar}
              <span id="user-name">${this.escapeHtml(displayName)}</span>
            </div>
            <button id="logout-btn" class="btn-logout">
              <i class="fas fa-sign-out-alt"></i>
            </button>
          </div>
        </div>
      </header>
    `;
  }

  private createLogoutModal(): string {
    return `
      <!-- Logout Confirmation Modal -->
      <div id="logoutModal" class="modal" style="display: none;">
        <div class="modal-overlay"></div>
        <div class="logout-modal">
          <div class="logout-modal-header">
            <h2>Abmeldung bestätigen</h2>
          </div>
          <div class="logout-modal-body">
            <div class="logout-info">
              <i class="fas fa-info-circle"></i>
              <span>Alle ungespeicherten Änderungen gehen verloren.</span>
            </div>
            <p class="logout-message">Möchten Sie sich wirklich abmelden?</p>
          </div>
          <div class="logout-modal-footer">
            <button class="btn btn-secondary" id="cancelLogout">
              <i class="fas fa-times"></i>
              Abbrechen
            </button>
            <button class="btn btn-danger" id="confirmLogout">
              <i class="fas fa-sign-out-alt"></i>
              Abmelden
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private escapeHtml(text: string): string {
    const escapeMap = new Map([
      ['&', '&amp;'],
      ['<', '&lt;'],
      ['>', '&gt;'],
      ['"', '&quot;'],
      ["'", '&#039;'],
    ]);
    return text.replace(/["&'<>]/g, (m) => escapeMap.get(m) ?? m);
  }

  private createSidebarStructure(): void {
    const body = document.body;
    const existingLayout = document.querySelector('.layout-container');

    if (!existingLayout) {
      // Erstelle Layout-Container falls nicht vorhanden
      const header = document.querySelector('.header');
      const container = document.querySelector('.container');

      const layoutContainer = document.createElement('div');
      layoutContainer.className = 'layout-container';

      const sidebar = document.createElement('aside');
      sidebar.className = 'sidebar';
      setHTML(sidebar, this.createNavigationHTML());

      const mainContent = document.createElement('main');
      mainContent.className = 'main-content';
      if (container) {
        mainContent.append(container);
      }

      layoutContainer.append(sidebar);
      layoutContainer.append(mainContent);

      if (header) {
        body.insertBefore(layoutContainer, header.nextSibling);
      } else {
        body.append(layoutContainer);
      }
    }
  }

  private createNavigationHTML(): string {
    const menuItems = this.getNavigationForRole(this.currentRole);

    // Storage Widget nur für Root User
    const storageWidget = this.currentRole === 'root' ? this.createStorageWidget() : '';

    return `
            <nav class="sidebar-nav">
             <ul class="sidebar-menu">
                    ${menuItems.map((item, index) => this.createMenuItem(item, index === 0)).join('')}
                </ul>
                ${storageWidget}
            </nav>

                <div class="user-info-card" id="sidebar-user-info-card">
                    <div id="sidebar-user-avatar" class="user-avatar avatar-initials">${this.getInitials('', '')}</div>
                    <div class="user-details">
                        <div class="company-info">
                            <div class="company-name" id="sidebar-company-name">Firmennamen lädt...</div>
                        </div>
                        <div class="user-name" id="sidebar-user-name">${this.currentUser?.email ?? 'User'}</div>
                        <div class="user-full-name" id="sidebar-user-fullname"></div>
                        <div class="user-employee-number" id="sidebar-employee-number" style="font-size: 13px; color: rgba(255, 255, 255, 0.6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></div>
                        <span id="role-indicator" class="role-badge ${this.currentRole ?? ''}">${this.currentRole === 'admin' ? 'Admin' : this.currentRole === 'root' ? 'Root' : 'Mitarbeiter'}</span>
                    </div>
                </div>
                <button class="sidebar-title blackboard-button" data-action="navigate-blackboard" title="Zum Schwarzen Brett">
                    <span class="title-icon pinned-icon">
                        <span class="pin-head"></span>
                        <span class="pin-needle"></span>
                    </span>
                    <span class="title-content">
                        <span class="title-text">Schwarzes Brett</span>
                    </span>
                </button>

        `;
  }

  private createMenuItem(item: NavItem, isActive = false): string {
    const activeClass = isActive ? 'active' : '';
    const hasChildren = item.children && item.children.length > 0;
    const hasSubmenu = item.hasSubmenu === true && item.submenu !== undefined && item.submenu.length > 0;
    const badgeHtml = this.createBadgeHtml(item.badge);

    if (hasSubmenu) {
      return this.createSubmenuItem(item, activeClass, badgeHtml);
    }

    if (hasChildren === true) {
      return this.createChildrenItem(item, activeClass, badgeHtml);
    }

    return this.createSimpleMenuItem(item, activeClass, badgeHtml);
  }

  private createBadgeHtml(badge?: string): string {
    if (badge === undefined || badge === '') return '';

    // Use Map to avoid object injection vulnerability
    const badgeMap = new Map<string, { className: string; id: string }>([
      ['unread-messages', { className: 'nav-badge', id: 'chat-unread-badge' }],
      ['pending-surveys', { className: 'nav-badge nav-badge-surveys', id: 'surveys-pending-badge' }],
      ['unread-documents', { className: 'nav-badge nav-badge-documents', id: 'documents-unread-badge' }],
      ['new-kvp-suggestions', { className: 'nav-badge nav-badge-kvp', id: 'kvp-badge' }],
      ['lean-management-parent', { className: 'nav-badge nav-badge-lean-parent', id: 'lean-management-badge' }],
      ['unread-calendar-events', { className: 'nav-badge', id: 'calendar-unread-badge' }],
    ]);

    const config = badgeMap.get(badge);
    if (config === undefined) {
      return '';
    }
    return `<span class="${config.className}" id="${config.id}" style="display: none;">0</span>`;
  }

  private createChildBadgeHtml(child: NavItem): string {
    if (child.badgeId !== undefined) {
      return `<span class="nav-badge nav-badge-child nav-badge-child-default" id="${child.badgeId}" style="display: none;">0</span>`;
    }
    if (child.badge === 'pending-surveys') {
      return `<span class="nav-badge nav-badge-child nav-badge-surveys" id="surveys-pending-badge" style="display: none;">0</span>`;
    }
    if (child.badge === 'new-kvp-suggestions') {
      return `<span class="nav-badge nav-badge-child nav-badge-kvp" id="kvp-badge" style="display: none;">0</span>`;
    }
    return '';
  }

  private createSubmenuItem(item: NavItem, activeClass: string, badgeHtml: string): string {
    const submenuItems = this.createSubmenuItems(item.submenu);
    return `
      <li class="sidebar-item has-submenu ${activeClass}" style="position: relative;">
        <a href="#" class="sidebar-link" data-action="toggle-submenu" data-nav-id="${item.id}">
          <span class="icon">${item.icon ?? ''}</span>
          <span class="label">${item.label}</span>
          <span class="nav-indicator"></span>
          <span class="submenu-arrow">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 10l5 5 5-5z"/>
            </svg>
          </span>
          ${badgeHtml}
        </a>
        <ul class="submenu" id="submenu-${item.id}" style="display: none;">
          ${submenuItems}
        </ul>
      </li>
    `;
  }

  private createSubmenuItems(submenu?: NavItem[]): string {
    if (!submenu || submenu.length === 0) return '';
    return submenu
      .map((child) => {
        const childBadgeHtml = this.createChildBadgeHtml(child);
        return `
          <li class="submenu-item">
            <a href="${child.url ?? '#'}" class="submenu-link" data-nav-id="${child.id}" style="position: relative; display: block;">
              <span class="submenu-label">${child.label}</span>
              ${childBadgeHtml}
            </a>
          </li>
        `;
      })
      .join('');
  }

  private createChildrenItem(item: NavItem, activeClass: string, badgeHtml: string): string {
    const submenuItems = this.createChildrenItems(item.children);
    return `
      <li class="sidebar-item has-submenu ${activeClass}" style="position: relative;">
        <a href="#" class="sidebar-link" data-action="toggle-submenu" data-nav-id="${item.id}">
          <span class="icon">${item.icon ?? ''}</span>
          <span class="label">${item.label}</span>
          <span class="nav-indicator"></span>
          <span class="submenu-arrow">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 10l5 5 5-5z"/>
            </svg>
          </span>
          ${badgeHtml}
        </a>
        <ul class="submenu" id="submenu-${item.id}" style="display: none;">
          ${submenuItems}
        </ul>
      </li>
    `;
  }

  private createChildrenItems(children?: NavItem[]): string {
    if (!children || children.length === 0) return '';
    return children
      .map(
        (child) => `
          <li class="submenu-item">
            <a href="${child.url ?? '#'}" class="submenu-link" data-nav-id="${child.id}">
              <span class="submenu-label">${child.label}</span>
            </a>
          </li>
        `,
      )
      .join('');
  }

  private createSimpleMenuItem(item: NavItem, activeClass: string, badgeHtml: string): string {
    const clickHandler = '';
    return `
      <li class="sidebar-item ${activeClass}" style="position: relative;">
        <a href="${item.url ?? '#'}" class="sidebar-link" ${clickHandler} data-nav-id="${item.id}">
          <span class="icon">${item.icon ?? ''}</span>
          <span class="label">${item.label}</span>
          <span class="nav-indicator"></span>
          ${badgeHtml}
        </a>
      </li>
    `;
  }

  // Removed unused method getUserInitials

  // Store the click handlers as bound methods so we can remove them
  private documentClickHandler?: (e: MouseEvent) => void;
  private dropdownClickHandler?: (e: Event) => void;
  private isEventListenerAttached = false;

  private handleNavLinkClick(e: MouseEvent): void {
    const navLink = (e.target as HTMLElement).closest('.sidebar-link:not([onclick])');
    if (navLink) {
      this.handleNavigationClick(navLink as HTMLElement, e);
    }
  }

  private handleSubmenuLinkClick(e: MouseEvent): void {
    const submenuLink = (e.target as HTMLElement).closest('.submenu-link');
    if (!(submenuLink instanceof HTMLElement)) {
      return;
    }

    this.storeParentSubmenuState(submenuLink);
    this.checkKvpSubmenuClick(submenuLink);
  }

  private storeParentSubmenuState(submenuLink: HTMLElement): void {
    const parentSubmenu = submenuLink.closest('.submenu');
    const parentItem = parentSubmenu?.closest(SIDEBAR_ITEM_SELECTOR);
    if (!parentItem) {
      return;
    }

    const parentLink = parentItem.querySelector<HTMLElement>('.sidebar-link');
    const parentId = parentLink?.dataset.navId;
    if (parentId !== undefined) {
      localStorage.setItem('openSubmenu', parentId);
    }
  }

  private checkKvpSubmenuClick(submenuLink: HTMLElement): void {
    const submenuNavId = submenuLink.dataset.navId;
    if (submenuNavId === 'kvp' && (this.currentRole === 'admin' || this.currentRole === 'root')) {
      void this.resetKvpBadge();
    }
  }

  private handleLogoutClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    const logoutBtn = target.closest('#logout-btn');

    if (!logoutBtn) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    void (async () => {
      try {
        await this.handleLogout();
      } catch (error: unknown) {
        console.error('Logout error:', error);
        window.location.href = '/login';
      }
    })();
  }

  private attachEventListeners(): void {
    // Remove existing listener if present
    if (this.documentClickHandler) {
      document.removeEventListener('click', this.documentClickHandler);
      this.isEventListenerAttached = false;
    }

    // Create and store the new handler
    this.documentClickHandler = (e: MouseEvent): void => {
      this.handleNavLinkClick(e);
      this.handleSubmenuLinkClick(e);
      this.handleLogoutClick(e);
    };

    // Add the new listener
    document.addEventListener('click', this.documentClickHandler);
    this.isEventListenerAttached = true;

    // Add direct listener as fallback for logout button
    const logoutBtnCheck = $$('#logout-btn');
    if (logoutBtnCheck) {
      logoutBtnCheck.onclick = (e: MouseEvent): void => {
        e.preventDefault();
        e.stopPropagation();
        void (async () => {
          try {
            await this.handleLogout();
          } catch (error: unknown) {
            console.error('Logout error from direct listener:', error);
            window.location.href = '/login';
          }
        })();
      };
    }

    // Sidebar Toggle
    this.attachSidebarToggle();

    // Update active state on page load
    this.updateActiveNavigation();

    // Initialize role switch functionality
    this.initializeRoleSwitch();
  }

  private attachSidebarToggle(): void {
    const toggleBtn = $$('#sidebar-toggle');
    const sidebar = $$('.layout-container .sidebar') ?? $$('.sidebar');
    const mainContent = $$('.main-content');
    const chatMain = $$('.chat-main');
    const chatSidebar = $$('.chat-sidebar');

    this.debugSidebarInfo(sidebar, toggleBtn, mainContent);

    if (!toggleBtn || !sidebar) {
      console.error('[UnifiedNav] Toggle button or sidebar not found!');
      return;
    }

    this.applySavedCollapsedState(sidebar, mainContent, chatMain, chatSidebar);
    this.setupToggleClickHandler(toggleBtn, sidebar, mainContent, chatMain, chatSidebar);
    this.setupHoverEffects(toggleBtn, sidebar);
    this.addCollapsedTooltips();
  }

  private debugSidebarInfo(sidebar: Element | null, toggleBtn: Element | null, mainContent: Element | null): void {
    const allSidebars = document.querySelectorAll('.sidebar');
    console.info('[UnifiedNav] Number of sidebars found:', allSidebars.length);
    allSidebars.forEach((sb, index) => {
      console.info(`[UnifiedNav] Sidebar ${index}:`, sb);
      console.info(`[UnifiedNav] Sidebar ${index} parent:`, sb.parentElement);
    });

    console.info('[UnifiedNav] Toggle button:', toggleBtn);
    console.info('[UnifiedNav] Sidebar:', sidebar);
    console.info('[UnifiedNav] Sidebar ID:', sidebar?.id);
    console.info('[UnifiedNav] Sidebar class:', sidebar?.className);
    console.info('[UnifiedNav] Main content:', mainContent);
  }

  private applySavedCollapsedState(
    sidebar: Element,
    mainContent: Element | null,
    chatMain: Element | null,
    chatSidebar: Element | null,
  ): void {
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) {
      sidebar.classList.add('collapsed');
      mainContent?.classList.add(SIDEBAR_COLLAPSED_CLASS);
      chatMain?.classList.add(SIDEBAR_COLLAPSED_CLASS);
      chatSidebar?.classList.add(SIDEBAR_COLLAPSED_CLASS);
      this.updateToggleIcon();
    }
  }

  private setupToggleClickHandler(
    toggleBtn: Element,
    sidebar: Element,
    mainContent: Element | null,
    chatMain: Element | null,
    chatSidebar: Element | null,
  ): void {
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      console.info('[UnifiedNav] Toggle clicked!');
      console.info('[UnifiedNav] Sidebar classes before:', sidebar.className);
      console.info('[UnifiedNav] Sidebar computed width:', window.getComputedStyle(sidebar).width);

      const isCurrentlyCollapsed = sidebar.classList.contains('collapsed');
      const newState = !isCurrentlyCollapsed;

      // Remove any inline width styles - let CSS handle it
      (sidebar as HTMLElement).style.removeProperty('width');

      sidebar.classList.toggle('collapsed');
      mainContent?.classList.toggle(SIDEBAR_COLLAPSED_CLASS);
      chatMain?.classList.toggle(SIDEBAR_COLLAPSED_CLASS);
      chatSidebar?.classList.toggle(SIDEBAR_COLLAPSED_CLASS);

      // Force browser to recalculate styles
      void (sidebar as HTMLElement).offsetWidth;

      // Save state
      localStorage.setItem('sidebarCollapsed', newState.toString());
      this.isCollapsed = newState;

      // Update icon
      this.updateToggleIcon();

      // Update logo based on collapsed state
      const headerLogo = $$('#header-logo') as HTMLImageElement | null;
      if (headerLogo !== null) {
        headerLogo.src = newState ? '/assets/images/logo_collapsed.png' : '/assets/images/logo.png';
      }

      console.info('[UnifiedNav] Sidebar collapsed state:', newState);
      console.info('[UnifiedNav] Sidebar classes after:', sidebar.className);
      console.info('[UnifiedNav] Sidebar computed width after:', window.getComputedStyle(sidebar).width);
    });
  }

  private setupHoverEffects(toggleBtn: Element, sidebar: Element): void {
    toggleBtn.addEventListener('mouseenter', () => {
      const isSidebarCollapsed = sidebar.classList.contains('collapsed');
      const iconPath = toggleBtn.querySelector('.toggle-icon-path');
      if (iconPath) {
        if (isSidebarCollapsed) {
          // Show menu-close icon (menu with arrow right) when collapsed
          iconPath.setAttribute(
            'd',
            'M3 6H13V8H3V6M3 16H13V18H3V16M3 11H15V13H3V11M16 7L14.58 8.39L18.14 12L14.58 15.61L16 17L21 12L16 7Z',
          );
        } else {
          // Show menu-open icon (menu with arrow left) when expanded
          iconPath.setAttribute(
            'd',
            'M21,15.61L19.59,17L14.58,12L19.59,7L21,8.39L17.44,12L21,15.61M3,6H16V8H3V6M3,13V11H13V13H3M3,18V16H16V18H3Z',
          );
        }
      }
    });

    toggleBtn.addEventListener('mouseleave', () => {
      const iconPath = toggleBtn.querySelector('.toggle-icon-path');
      if (iconPath) {
        // Reset to hamburger menu
        iconPath.setAttribute('d', 'M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z');
      }
    });
  }

  private updateToggleIcon(): void {
    const iconPath = document.querySelector('.toggle-icon-path');
    if (iconPath) {
      // Keep hamburger menu as default
      iconPath.setAttribute('d', 'M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z');
    }
  }

  private addCollapsedTooltips(): void {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    const navItems = sidebar.querySelectorAll('.sidebar-link');
    navItems.forEach((item) => {
      const labelElement = item.querySelector('.label');
      if (labelElement !== null && labelElement.textContent !== '') {
        const label = labelElement.textContent;
        item.setAttribute('title', '');

        // Show tooltip only when sidebar is collapsed
        item.addEventListener('mouseenter', () => {
          if (sidebar.classList.contains('collapsed')) {
            item.setAttribute('title', label);
          } else {
            item.setAttribute('title', '');
          }
        });
      }
    });
  }

  private async handleLogout(): Promise<void> {
    // Show logout confirmation modal instead of direct logout
    const modal = $$('#logoutModal');

    if (modal) {
      // Ensure modal is visible with proper z-index and positioning
      modal.style.display = 'block';
      modal.style.position = 'fixed';
      modal.style.zIndex = '999999';
      modal.style.top = '0';
      modal.style.left = '0';
      modal.style.width = '100%';
      modal.style.height = '100%';
      modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';

      // Also add active class if needed for CSS animations
      modal.classList.add('active');

      // Setup modal event handlers
      const confirmBtn = $$('#confirmLogout');
      const cancelBtn = $$('#cancelLogout');
      const overlay = modal.querySelector('.modal-overlay');

      const closeModal = () => {
        modal.style.display = 'none';
        modal.classList.remove('active');
      };

      const performLogout = async () => {
        // Use the logout function from auth module which logs the action
        const { logout } = await import('../auth/index.js');
        await logout();
      };

      // Add event listeners (remove old ones first to avoid duplicates)
      if (confirmBtn) {
        const newConfirmBtn = confirmBtn.cloneNode(true) as HTMLElement;
        confirmBtn.parentNode?.replaceChild(newConfirmBtn, confirmBtn);
        newConfirmBtn.addEventListener('click', () => {
          void performLogout();
        });
      }

      if (cancelBtn) {
        const newCancelBtn = cancelBtn.cloneNode(true) as HTMLElement;
        cancelBtn.parentNode?.replaceChild(newCancelBtn, cancelBtn);
        newCancelBtn.addEventListener('click', closeModal);
      }

      if (overlay) {
        const newOverlay = overlay.cloneNode(true) as HTMLElement;
        overlay.parentNode?.replaceChild(newOverlay, overlay);
        newOverlay.addEventListener('click', closeModal);
      }
    } else {
      // Fallback to direct logout if modal not found
      const { logout } = await import('../auth/index.js');
      await logout();
    }
  }

  private toggleDropdown(dropdownDisplay: HTMLElement, dropdownOptions: HTMLElement): void {
    const isActive = dropdownDisplay.classList.contains('active');

    if (isActive) {
      dropdownDisplay.classList.remove('active');
      dropdownOptions.classList.remove('active');
      console.info('[UnifiedNav] Dropdown closed');
    } else {
      dropdownDisplay.classList.add('active');
      dropdownOptions.classList.add('active');
      console.info('[UnifiedNav] Dropdown opened');
    }
  }

  private setupDropdownToggle(dropdownDisplay: HTMLElement, dropdownOptions: HTMLElement): void {
    dropdownDisplay.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      console.info('[UnifiedNav] Dropdown clicked');
      console.info('[UnifiedNav] Current classes:', dropdownDisplay.className, dropdownOptions.className);
      this.toggleDropdown(dropdownDisplay, dropdownOptions);
    });
  }

  private handleRoleSelection(e: Event, dropdownDisplay: HTMLElement, dropdownOptions: HTMLElement): void {
    e.stopPropagation();

    const selectedRole = (e.target as HTMLElement).dataset.value as 'root' | 'admin' | 'employee';
    console.info('[UnifiedNav] Role switch dropdown changed to:', selectedRole);

    // Update display text
    const displayText = dropdownDisplay.querySelector('span');
    if (displayText && e.target instanceof HTMLElement) {
      displayText.textContent = e.target.textContent;
    }

    // Close dropdown
    dropdownDisplay.classList.remove('active');
    dropdownOptions.classList.remove('active');

    // Update hidden input
    const hiddenInput = $$('#role-switch-value') as HTMLInputElement | null;
    if (hiddenInput !== null) {
      hiddenInput.value = selectedRole;
    }

    // Call the role switch function
    console.info('[UnifiedNav] Calling switchRoleForRoot with role:', selectedRole);
    void switchRoleForRoot(selectedRole);
  }

  private setupRoleSelectionHandlers(dropdownDisplay: HTMLElement, dropdownOptions: HTMLElement): void {
    const options = dropdownOptions.querySelectorAll('.dropdown-option');
    options.forEach((option) => {
      option.addEventListener('click', (e) => {
        this.handleRoleSelection(e, dropdownDisplay, dropdownOptions);
      });
    });
  }

  private setupOutsideClickHandler(dropdownDisplay: HTMLElement, dropdownOptions: HTMLElement): void {
    if (this.dropdownClickHandler) {
      document.removeEventListener('click', this.dropdownClickHandler);
    }

    this.dropdownClickHandler = (e: Event) => {
      if (!dropdownDisplay.contains(e.target as Node) && !dropdownOptions.contains(e.target as Node)) {
        dropdownDisplay.classList.remove('active');
        dropdownOptions.classList.remove('active');
      }
    };

    document.addEventListener('click', this.dropdownClickHandler);
  }

  private initializeRoleSwitch(): void {
    const userRole = localStorage.getItem('userRole');

    if (userRole !== 'root') {
      return;
    }

    const dropdownDisplay = $$('#roleSwitchDisplay');
    const dropdownOptions = $$('#roleSwitchDropdown');

    if (!dropdownDisplay || !dropdownOptions) {
      return;
    }

    // Check if already initialized
    if (Object.prototype.hasOwnProperty.call(dropdownDisplay.dataset, 'initialized')) {
      return;
    }

    // Mark as initialized
    dropdownDisplay.dataset.initialized = 'true';

    this.setupDropdownToggle(dropdownDisplay, dropdownOptions);
    this.setupRoleSelectionHandlers(dropdownDisplay, dropdownOptions);
    this.setupOutsideClickHandler(dropdownDisplay, dropdownOptions);
  }

  private initializeRoleSwitchForAdmin(): void {
    const userRole = localStorage.getItem('userRole');

    if (userRole === 'admin') {
      const dropdownDisplay = $$('#roleSwitchDisplay');
      const dropdownOptions = $$('#roleSwitchDropdown');

      if (dropdownDisplay && dropdownOptions) {
        // Check if already initialized
        if (Object.prototype.hasOwnProperty.call(dropdownDisplay.dataset, 'initialized')) {
          return;
        }

        // Mark as initialized
        dropdownDisplay.dataset.initialized = 'true';

        // Toggle dropdown on click
        dropdownDisplay.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          console.info('[UnifiedNav] Dropdown clicked');

          const isActive = dropdownDisplay.classList.contains('active');

          if (isActive) {
            dropdownDisplay.classList.remove('active');
            dropdownOptions.classList.remove('active');
            console.info('[UnifiedNav] Dropdown closed');
          } else {
            dropdownDisplay.classList.add('active');
            dropdownOptions.classList.add('active');
            console.info('[UnifiedNav] Dropdown opened');
          }
        });

        // Handle option selection
        const options = dropdownOptions.querySelectorAll('.dropdown-option');
        options.forEach((option) => {
          option.addEventListener('click', (e) => {
            void (async () => {
              e.stopPropagation();
              const roleValue = (option as HTMLElement).dataset.value;
              if (roleValue === 'root' || roleValue === 'admin' || roleValue === 'employee') {
                const selectedRole = roleValue;
                console.info('[UnifiedNav] Admin view switching to role:', selectedRole);

                // Close dropdown
                dropdownDisplay.classList.remove('active');
                dropdownOptions.classList.remove('active');

                // Admin users can only switch between admin and employee
                console.info('[UnifiedNav] Admin user, calling switchRoleForAdmin');
                await switchRoleForAdmin(selectedRole as 'admin' | 'employee');
              }
            })();
          });
        });
      }
    }
  }

  private handleNavigationClick(link: HTMLElement, _event: MouseEvent): void {
    // Don't handle clicks on submenu toggle links
    if (link.getAttribute('href') === '#') {
      return;
    }

    // Update active state
    document.querySelectorAll(SIDEBAR_ITEM_SELECTOR).forEach((item) => {
      item.classList.remove('active');
    });
    link.closest(SIDEBAR_ITEM_SELECTOR)?.classList.add('active');

    // Store active navigation
    const navId = link.dataset.navId;
    if (navId !== undefined && navId !== '') {
      localStorage.setItem('activeNavigation', navId);

      // If user clicked on documents, mark all as read
      if (navId === 'documents' && this.currentRole === 'employee') {
        void this.markAllDocumentsAsRead();
      }

      // If admin/root clicked on KVP, reset the badge
      if (navId === 'kvp' && (this.currentRole === 'admin' || this.currentRole === 'root')) {
        void (async () => {
          try {
            await this.resetKvpBadge();
          } catch (error: unknown) {
            console.error('Error resetting KVP badge:', error);
          }
        })();
      }
    }

    // Add navigation animation
    this.animateNavigation(link);
  }

  private clearAllActiveStates(): void {
    document.querySelectorAll(SIDEBAR_ITEM_SELECTOR).forEach((item) => {
      item.classList.remove('active');
    });
  }

  private isMainDashboardPage(path: string): boolean {
    return path.includes('admin-dashboard') || path.includes('employee-dashboard') || path.includes('root-dashboard');
  }

  private setActiveNavItem(selector: string, navId?: string): void {
    const element =
      navId !== undefined ? document.querySelector(`[data-nav-id="${navId}"]`) : document.querySelector(selector);

    if (element) {
      element.closest(SIDEBAR_ITEM_SELECTOR)?.classList.add('active');
    }
  }

  private handleDashboardNavigation(currentHash: string, activeNav: string | null): void {
    if (currentHash !== '' && currentHash !== 'dashboard') {
      // Use hash to determine active section
      this.setActiveNavItem('', currentHash);
      return;
    }

    if (activeNav === null || activeNav === '' || activeNav === 'dashboard') {
      // Default to overview
      this.setActiveNavItem('[data-nav-id="dashboard"]');
      localStorage.removeItem('activeNavigation');
    }
  }

  private handleNonDashboardNavigation(currentPath: string, activeNav: string | null): void {
    const detected = this.autoDetectActivePage(currentPath);

    if (detected) {
      localStorage.removeItem('activeNavigation');
      return;
    }

    // Fallback to localStorage or default
    if (activeNav !== null && activeNav !== '' && activeNav !== 'dashboard') {
      this.setActiveNavItem('', activeNav);
    } else {
      this.setActiveNavItem('[data-nav-id="dashboard"]');
    }
  }

  private updateActiveNavigation(): void {
    const activeNav = localStorage.getItem('activeNavigation');
    const currentPath = window.location.pathname;
    const currentHash = window.location.hash.substring(1);

    this.clearAllActiveStates();

    if (this.isMainDashboardPage(currentPath)) {
      this.handleDashboardNavigation(currentHash, activeNav);
    } else {
      this.handleNonDashboardNavigation(currentPath, activeNav);
    }

    this.updateSubmenuStates();
  }

  private updateSubmenuStates(): void {
    const currentPath = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);
    const section = urlParams.get('section');

    this.closeAllSubmenus();

    const isDashboard = currentPath.includes('dashboard');
    let foundActiveSubmenu = false;

    if (isDashboard && section !== null && section !== '') {
      foundActiveSubmenu = this.handleDashboardSection(section);
    }

    if (!foundActiveSubmenu && !isDashboard) {
      foundActiveSubmenu = this.handleDirectSubmenuPages(currentPath);
    }

    if (!foundActiveSubmenu) {
      localStorage.removeItem('openSubmenu');
    }

    this.restorePreviousSubmenu(foundActiveSubmenu);
  }

  private closeAllSubmenus(): void {
    document.querySelectorAll('.submenu').forEach((submenu) => {
      const submenuElement = submenu as HTMLElement;
      submenuElement.style.display = 'none';
      submenu.closest(SIDEBAR_ITEM_SELECTOR)?.classList.remove('open');
    });

    document.querySelectorAll('.submenu-item').forEach((item) => {
      item.classList.remove('active');
    });

    document.querySelectorAll('.submenu-link').forEach((link) => {
      link.classList.remove('active');
    });
  }

  private handleDashboardSection(section: string): boolean {
    const menuItems = this.getNavigationForRole(this.currentRole);
    const menuItem = menuItems.find((item) => item.id === section);

    if (!menuItem) {
      return false;
    }

    const hasSubmenu = menuItem.hasSubmenu === true;
    const hasChildren = menuItem.children !== undefined && menuItem.children.length > 0;

    if (!hasSubmenu && !hasChildren) {
      return false;
    }

    const submenu = document.querySelector(`#submenu-${section}`);
    const parentItem = submenu?.closest('.sidebar-item.has-submenu');

    if (!(submenu instanceof HTMLElement) || !parentItem) {
      return false;
    }

    submenu.style.display = 'block';
    parentItem.classList.add('open');
    localStorage.setItem('openSubmenu', section);

    if (menuItem.children && menuItem.children.length > 0) {
      this.activateFirstChild(submenu);
    }

    return true;
  }

  private activateFirstChild(submenu: HTMLElement): void {
    const firstChildLink = submenu.querySelector('.submenu-link');
    if (!firstChildLink) return;

    firstChildLink.classList.add('active');
    const submenuItem = firstChildLink.closest('.submenu-item');
    if (submenuItem) {
      submenuItem.classList.add('active');
    }
  }

  private handleDirectSubmenuPages(currentPath: string): boolean {
    let foundActiveSubmenu = false;

    document.querySelectorAll('.submenu-link').forEach((link) => {
      if (foundActiveSubmenu) return;

      const linkElement = link as HTMLAnchorElement;
      try {
        const linkPath = new URL(linkElement.href, window.location.origin).pathname;
        if (currentPath === linkPath) {
          foundActiveSubmenu = true;
          this.activateSubmenuLink(link);
        }
      } catch {
        console.warn('Invalid submenu URL:', linkElement.href);
      }
    });

    return foundActiveSubmenu;
  }

  private activateSubmenuLink(link: Element): void {
    link.classList.add('active');
    const submenuItem = link.closest('.submenu-item');
    if (submenuItem) {
      submenuItem.classList.add('active');
    }

    const submenu = link.closest('.submenu');
    const parentItem = submenu?.closest('.sidebar-item.has-submenu');

    if (submenu && parentItem) {
      (submenu as HTMLElement).style.display = 'block';
      parentItem.classList.add('open');
      parentItem.classList.add('active');

      const parentLink = parentItem.querySelector<HTMLElement>('.sidebar-link');
      const parentId = parentLink?.dataset.navId;
      if (parentId !== undefined && parentId !== '') {
        localStorage.setItem('openSubmenu', parentId);
      }
    }
  }

  private restorePreviousSubmenu(foundActiveSubmenu: boolean): void {
    if (foundActiveSubmenu) return;

    const storedSubmenu = localStorage.getItem('openSubmenu');
    if (storedSubmenu === null || storedSubmenu === '') return;

    const submenu = document.querySelector(`#submenu-${storedSubmenu}`);
    const parentItem = submenu?.closest('.sidebar-item.has-submenu');

    if (submenu instanceof HTMLElement && parentItem?.classList.contains('active') === true) {
      submenu.style.display = 'block';
      parentItem.classList.add('open');
    }
  }

  private isValidChildUrl(child: NavItem): boolean {
    return child.url !== undefined && child.url !== '' && !child.url.startsWith('#') && child.url.startsWith('/');
  }

  private markItemAndChildActive(parentId: string, childId?: string): void {
    const parentLink = document.querySelector(`[data-nav-id="${parentId}"]`);
    if (!parentLink) {
      return;
    }

    parentLink.closest(SIDEBAR_ITEM_SELECTOR)?.classList.add('active');

    if (childId !== undefined) {
      const childLink = document.querySelector(`[data-nav-id="${childId}"]`);
      childLink?.closest('.submenu-item')?.classList.add('active');
    }
  }

  private checkSubmenuItems(menuItems: NavItem[], currentPath: string): boolean {
    for (const item of menuItems) {
      if (item.children === undefined || item.children.length === 0) {
        continue;
      }

      for (const child of item.children) {
        if (this.isValidChildUrl(child) && currentPath === child.url) {
          this.markItemAndChildActive(item.id, child.id);
          return true;
        }
      }
    }
    return false;
  }

  private checkTopLevelItems(menuItems: NavItem[], currentPath: string): boolean {
    const matchingItem = menuItems.find((item) => {
      if (item.url === undefined || item.url === '' || item.url.startsWith('#')) {
        return false;
      }

      // For absolute URLs, do exact match
      if (item.url.startsWith('/')) {
        return currentPath === item.url;
      }

      // For relative URLs or query params, use includes
      return currentPath.includes(item.url.replace('/', ''));
    });

    if (matchingItem) {
      this.markItemAndChildActive(matchingItem.id);
      return true;
    }

    return false;
  }

  private autoDetectActivePage(currentPath: string): boolean {
    const menuItems = this.getNavigationForRole(this.currentRole);

    // First check children/submenu items for exact match
    if (this.checkSubmenuItems(menuItems, currentPath)) {
      return true;
    }

    // Then check top-level items
    return this.checkTopLevelItems(menuItems, currentPath);
  }

  private animateNavigation(link: HTMLElement): void {
    // Add ripple effect
    const ripple = document.createElement('span');
    ripple.className = 'nav-ripple';
    link.append(ripple);

    setTimeout(() => {
      if (ripple.parentNode) {
        ripple.remove();
      }
    }, 600);
  }

  // Public method to refresh navigation
  public refresh(): void {
    console.info('[UnifiedNav] Refreshing navigation');

    // Reload user info from token
    this.loadUserInfo();

    // Get the navigation container
    const navigationContainer = document.querySelector('#navigation-container');
    if (navigationContainer) {
      // Clear existing header and recreate it directly in body
      const existingHeader = document.querySelector('.header');
      if (existingHeader) {
        existingHeader.remove();
      }
      const headerHTML = this.createHeaderOnly();
      // eslint-disable-next-line no-unsanitized/method -- Safe: headerHTML is internally generated, not user input
      document.body.insertAdjacentHTML('afterbegin', headerHTML);

      // Create modals and banner for navigation-container
      const modalsAndBanner = this.createModalsAndBanner();
      setHTML(navigationContainer as HTMLElement, modalsAndBanner);

      // Inject sidebar into layout-container
      this.injectSidebarIntoLayout();

      // Re-attach event listeners after DOM update
      setTimeout(() => {
        // Only re-attach if not already attached
        if (!this.isEventListenerAttached) {
          this.attachEventListeners();
        }
        this.updateActiveNavigation();
        // Badge updates removed - handled by initial load after 1 second

        // Restore sidebar state
        const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        if (isCollapsed) {
          const sidebar = document.querySelector('.layout-container .sidebar');
          const mainContent = document.querySelector('.main-content');
          sidebar?.classList.add('collapsed');
          mainContent?.classList.add(SIDEBAR_COLLAPSED_CLASS);
        }
      }, 100);
    } else {
      // Fallback for pages without navigation-container
      this.injectNavigationHTML();
      this.updateActiveNavigation();
    }
  }

  // Public method to set active navigation
  public setActive(navId: string): void {
    localStorage.setItem('activeNavigation', navId);
    this.updateActiveNavigation();
  }

  // Ungelesene Chat-Nachrichten aktualisieren
  public async updateUnreadMessages(): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (token === null || token === '' || token === 'test-mode') return;

      // Use v2 API endpoint with camelCase response
      // Note: apiClient automatically adds /api/v2 prefix for v2 endpoints
      const data = await apiClient.get<{
        totalUnread: number;
        conversations: {
          conversationId: number;
          conversationName: string | null;
          unreadCount: number;
          lastMessageTime: Date;
        }[];
      }>('/chat/unread-count');

      const badge = $$('#chat-unread-badge');
      if (badge) {
        // v2 API uses totalUnread (camelCase)
        const count = data.totalUnread;
        if (count > 0) {
          badge.textContent = count > 99 ? '99+' : count.toString();
          badge.style.display = DISPLAY_INLINE_BLOCK;
        } else {
          badge.style.display = 'none';
        }
      }
    } catch (error) {
      console.error('Error updating unread messages:', error);
    }
  }

  // Update Calendar unread events count (Events mit ausstehender Statusanfrage)
  public async updateUnreadCalendarEvents(): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (token === null || token === '' || token === 'test-mode') return;

      const data = await apiClient.get<{
        totalUnread: number;
        eventsRequiringResponse: {
          id: number;
          title: string;
          startTime: string;
          requiresResponse: boolean;
        }[];
      }>('/calendar/unread-events');

      const badge = $$('#calendar-unread-badge');
      if (badge) {
        // Nur Events mit Statusanfrage zählen
        const count = data.totalUnread;
        if (count > 0) {
          badge.textContent = count > 99 ? '99+' : count.toString();
          badge.style.display = DISPLAY_INLINE_BLOCK;
        } else {
          badge.style.display = 'none';
        }
      }
    } catch (error) {
      console.error('Error updating unread calendar events:', error);
    }
  }

  private shouldSkipKvpUpdate(): boolean {
    const token = localStorage.getItem('token');
    return token === null || token === '' || token === 'test-mode';
  }

  private hideKvpBadgeForNonAdmins(): boolean {
    if (this.currentRole !== 'admin' && this.currentRole !== 'root') {
      const badge = $$('#kvp-badge');
      if (badge) badge.style.display = 'none';
      return true;
    }
    return false;
  }

  private shouldShowKvpBadge(currentCount: number, hasClickedKvp: boolean): boolean {
    return currentCount > 0 && (!hasClickedKvp || currentCount > this.lastKnownKvpCount);
  }

  private updateKvpBadgeDisplay(badge: HTMLElement, currentCount: number, show: boolean): void {
    if (show) {
      badge.textContent = currentCount > 99 ? '99+' : currentCount.toString();
      badge.style.display = DISPLAY_INLINE_BLOCK;
      console.info('[UnifiedNav] KVP badge shown - count:', currentCount, 'lastKnown:', this.lastKnownKvpCount);
    } else {
      badge.style.display = 'none';
      console.info('[UnifiedNav] KVP badge hidden - count:', currentCount, 'lastKnown:', this.lastKnownKvpCount);
    }
  }

  private updateLastKnownKvpCount(currentCount: number, hasClickedKvp: boolean): void {
    if (currentCount !== this.lastKnownKvpCount && !hasClickedKvp) {
      this.lastKnownKvpCount = currentCount;
      localStorage.setItem('lastKnownKvpCount', currentCount.toString());
    }
  }

  // Update KVP new suggestions count (for admin/root only)
  public async updateNewKvpSuggestions(): Promise<void> {
    try {
      if (this.shouldSkipKvpUpdate()) {
        return;
      }

      if (this.hideKvpBadgeForNonAdmins()) {
        return;
      }

      const data = await apiClient.get<{
        totalSuggestions: number;
        newSuggestions: number;
        inProgress: number;
        implemented: number;
        rejected: number;
        avgSavings: number | null;
      }>('/kvp/dashboard/stats');

      const badge = $$('#kvp-badge');
      if (badge === null) {
        return;
      }

      const currentCount = data.newSuggestions;
      const hasClickedKvp = this.lastKvpClickTimestamp !== null;
      const shouldShow = this.shouldShowKvpBadge(currentCount, hasClickedKvp);

      this.updateKvpBadgeDisplay(badge, currentCount, shouldShow);
      this.updateLastKnownKvpCount(currentCount, hasClickedKvp);
      this.updateLeanManagementParentBadge();
    } catch (error) {
      console.error('Error updating KVP suggestions count:', error);
    }
  }

  private getBadgeCount(badge: HTMLElement | null): number {
    if (!badge || badge.style.display !== DISPLAY_INLINE_BLOCK || badge.textContent === '') {
      return 0;
    }

    const count = Number.parseInt(badge.textContent, 10);
    return Number.isNaN(count) ? 0 : count;
  }

  private calculateTotalBadgeCount(): number {
    const kvpBadge = $$('#kvp-badge');
    const surveysBadge = $$('#surveys-pending-badge');

    const kvpCount = this.getBadgeCount(kvpBadge);
    const surveysCount = this.getBadgeCount(surveysBadge);

    return kvpCount + surveysCount;
  }

  private updateBadgeDisplay(badge: HTMLElement, count: number): void {
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count.toString();
      badge.style.display = DISPLAY_INLINE_BLOCK;
    } else {
      badge.style.display = 'none';
    }
  }

  // Update Lean Management parent badge based on child badges
  private updateLeanManagementParentBadge(): void {
    const leanBadge = $$('#lean-management-badge');
    if (!leanBadge) {
      return;
    }

    const totalCount = this.calculateTotalBadgeCount();
    this.updateBadgeDisplay(leanBadge, totalCount);
  }

  // Update pending surveys badge (called from SSE)
  public updatePendingSurveys(): void {
    try {
      // This gets called from SSE client when new survey arrives
      // The actual badge update logic should be here
      // For now, just update the parent badge
      this.updateLeanManagementParentBadge();
    } catch (error) {
      console.error('Error updating pending surveys:', error);
    }
  }

  // Offene Umfragen aktualisieren

  private shouldSkipDocumentUpdate(): boolean {
    const token = localStorage.getItem('token');
    if (token === null || token === '' || token === 'test-mode') {
      return true;
    }

    const role = localStorage.getItem('userRole') ?? this.currentRole;
    return role !== 'employee' && role !== 'admin';
  }

  private countUnreadDocuments(
    documents: {
      is_read?: boolean;
      category?: string;
      scope?: 'company' | 'department' | 'team' | 'personal';
    }[],
  ): Record<string, number> {
    const unreadCounts = {
      company: 0,
      department: 0,
      team: 0,
      personal: 0,
      payroll: 0,
      total: 0,
    };

    documents.forEach((doc) => {
      if (doc.is_read !== false) {
        return;
      }

      unreadCounts.total++;

      if (doc.category === 'salary') {
        unreadCounts.payroll++;
      } else if (doc.scope !== undefined) {
        unreadCounts[doc.scope as keyof typeof unreadCounts]++;
      }
    });

    return unreadCounts;
  }

  private updateDocumentBadge(badgeId: string, count: number): void {
    const badge = document.querySelector(`#${badgeId}`);
    if (badge instanceof HTMLElement) {
      this.updateBadgeDisplay(badge, count);
    }
  }

  private updateAllDocumentBadges(unreadCounts: Record<string, number>): void {
    // Update main badge
    const mainBadge = $$('#documents-unread-badge');
    if (mainBadge) {
      this.updateBadgeDisplay(mainBadge, unreadCounts.total);
    }

    // Update category badges
    this.updateDocumentBadge('badge-docs-company', unreadCounts.company);
    this.updateDocumentBadge('badge-docs-department', unreadCounts.department);
    this.updateDocumentBadge('badge-docs-team', unreadCounts.team);
    this.updateDocumentBadge('badge-docs-personal', unreadCounts.personal);
    this.updateDocumentBadge('badge-docs-payroll', unreadCounts.payroll);
  }

  // Ungelesene Dokumente aktualisieren
  public async updateUnreadDocuments(): Promise<void> {
    try {
      if (this.shouldSkipDocumentUpdate()) {
        return;
      }

      const result = await apiClient.get<{
        documents: Document[];
        pagination?: { total: number; page: number; perPage: number };
      }>('/documents');

      const documents = result.documents;
      if (documents.length === 0) {
        return;
      }

      const unreadCounts = this.countUnreadDocuments(
        documents as {
          is_read?: boolean;
          category?: string;
          scope?: 'company' | 'department' | 'team' | 'personal';
        }[],
      );
      this.updateAllDocumentBadges(unreadCounts);
    } catch (error) {
      console.error('Error updating unread documents:', error);
    }
  }

  // Mark all documents as read
  private async markAllDocumentsAsRead(): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (token === null || token === '' || token === 'test-mode') return;

      await apiClient.post('/documents/mark-all-read');

      // Hide the badge immediately
      const badge = $$('#documents-unread-badge');
      if (badge) {
        badge.style.display = 'none';
      }
    } catch (error) {
      console.error('Error marking documents as read:', error);
    }
  }

  // Reset KVP badge when admin/root clicks on KVP
  private async resetKvpBadge(): Promise<void> {
    console.info('[UnifiedNav] Resetting KVP badge');
    const badge = $$('#kvp-badge');
    if (badge) {
      badge.style.display = 'none';
      badge.textContent = '0';
      console.info('[UnifiedNav] KVP badge hidden');
    }

    // Save the timestamp of when the user clicked on KVP
    this.lastKvpClickTimestamp = Date.now();
    localStorage.setItem('lastKvpClickTimestamp', this.lastKvpClickTimestamp.toString());

    // Get the current count from the API to save as baseline
    try {
      const token = localStorage.getItem('token');
      if (token !== null && token !== '' && token !== 'test-mode') {
        const data = await apiClient.get<{
          totalSuggestions: number;
          newSuggestions: number;
          inProgress: number;
          implemented: number;
          rejected: number;
          avgSavings: number | null;
        }>('/kvp/dashboard/stats');
        // data is always returned from apiClient.get
        this.lastKnownKvpCount = data.newSuggestions;
        localStorage.setItem('lastKnownKvpCount', this.lastKnownKvpCount.toString());
        console.info('[UnifiedNav] KVP baseline count saved:', this.lastKnownKvpCount);
      }
    } catch (error) {
      console.error('Error fetching KVP count for baseline:', error);
    }
  }

  /**
   * Initialize event delegation for all navigation actions
   */
  private initializeEventDelegation(): void {
    // Event delegation for all navigation actions
    document.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const actionElement = target.closest<HTMLElement>('[data-action]');

      if (actionElement !== null) {
        const action = actionElement.dataset.action ?? '';

        switch (action) {
          case 'dismiss-role-banner':
            window.dismissRoleSwitchBanner();
            break;

          case 'navigate-blackboard':
            window.location.href = '/blackboard';
            break;

          case 'navigate-storage-upgrade':
            window.location.href = '/storage-upgrade';
            break;

          case 'toggle-submenu': {
            e.preventDefault();
            const navId = actionElement.dataset.navId ?? '';
            if (navId !== '') {
              (window as unknown as NavigationWindow).toggleSubmenu(e, navId);
            }
            break;
          }
        }
      }
    });
  }

  // Fix logo navigation based on user role
  private initializeSSE(): void {
    const token = localStorage.getItem('token');
    if (token === null || token === '' || token === 'test-mode') {
      console.info('[UnifiedNav] SSE not initialized - no valid token');
      return;
    }

    console.info('[UnifiedNav] Initializing SSE connection');

    // Connect to SSE endpoint
    this.sseClient = new SSEClient('/api/v2/notifications/stream');
    this.sseClient.connect();

    // Reconnect on visibility change
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.sseClient && !this.sseClient.isConnected()) {
        console.info('[UnifiedNav] Page visible - reconnecting SSE');
        this.sseClient.connect();
      }
    });
  }

  private fixLogoNavigation(): void {
    // Get user role (ROOT users should ALWAYS go to root dashboard)
    const userRole = localStorage.getItem('userRole');
    const activeRole = localStorage.getItem('activeRole');

    // For root users, ALWAYS use root role regardless of activeRole
    const currentRole = userRole === 'root' ? 'root' : (activeRole ?? userRole ?? this.currentRole);

    // Find all logo containers - expanded selector to catch all cases
    const logoContainers = document.querySelectorAll('.logo-container, a.logo-container, div.logo-container');

    logoContainers.forEach((container) => {
      // Determine the dashboard URL based on role
      let dashboardUrl = 'employee-dashboard'; // default
      switch (currentRole) {
        case 'employee':
          dashboardUrl = 'employee-dashboard';
          break;
        case 'admin':
          dashboardUrl = 'admin-dashboard?section=dashboard';
          break;
        case 'root':
          dashboardUrl = 'root-dashboard';
          break;
        default:
          console.warn('No user role found for logo navigation, defaulting to employee dashboard');
      }

      if (container instanceof HTMLAnchorElement) {
        // If it's already an anchor, update the href
        container.href = dashboardUrl;
        // Remove any onclick handlers that might interfere
        container.onclick = null;
        // Add event listener to prevent default if href is # or empty
        if (container.getAttribute('href') === '#' || container.getAttribute('href') === '') {
          container.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = dashboardUrl;
          });
        }
      } else {
        // If it's not an anchor (like a div), add click handler
        container.addEventListener('click', (e) => {
          e.preventDefault();
          window.location.href = dashboardUrl;
        });
        // Add cursor pointer style
        (container as HTMLElement).style.cursor = 'pointer';
      }
    });

    // Also fix logo when page visibility changes (tab switching)
    if (!this.visibilityListenerAdded) {
      this.visibilityListenerAdded = true;
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.fixLogoNavigation();
        }
      });
    }
  }

  private visibilityListenerAdded = false;

  // CSS injection method - DISABLED: CSS is now loaded statically via HTML
  private injectCSS(): void {
    // CSS is already loaded via <link> tags in HTML files
    // No dynamic injection needed anymore
    console.info('[UnifiedNav] CSS loaded via HTML link tags');
  }

  // Storage Widget erstellen (nur für Root User)
  private createStorageWidget(): string {
    return `
      <div class="storage-widget" id="storage-widget">
        <div class="storage-header">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19,11H5V9H19M19,7H5V5H19M5,15H11V13H5M3,21H21A2,2 0 0,1 19,19V3A2,2 0 0,1 21,1H3A2,2 0 0,1 5,3V19A2,2 0 0,1 3,21Z"/>
          </svg>
          <span>Speicherplatz</span>
        </div>
        <div class="storage-info">
          <div class="storage-usage-text">
            <span id="storage-used">0 GB</span> von <span id="storage-total">0 GB</span>
          </div>
          <div class="storage-progress">
            <div class="storage-progress-bar" id="storage-progress-bar" style="width: 0%"></div>
          </div>
          <div class="storage-percentage" id="storage-percentage">0% belegt</div>
        </div>
        <button class="storage-upgrade-btn" data-action="navigate-storage-upgrade">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
          </svg>
          Speicher erweitern
        </button>
      </div>
    `;
  }

  private shouldSkipStorageUpdate(): boolean {
    if (this.currentRole !== 'root') {
      return true;
    }

    const token = localStorage.getItem('token');
    return token === null || token === '' || token === 'test-mode';
  }

  private getProgressBarColor(percentage: number): string {
    if (percentage >= 90) {
      return 'var(--error-color)';
    }
    if (percentage >= 70) {
      return 'var(--warning-color)';
    }
    return 'var(--success-color)';
  }

  private updateStorageUI(used: number, total: number, percentage: number): void {
    const usedElement = $$('#storage-used');
    const totalElement = $$('#storage-total');
    const progressBar = $$('#storage-progress-bar');
    const percentageElement = $$('#storage-percentage');

    if (usedElement) {
      usedElement.textContent = this.formatBytes(used);
    }
    if (totalElement) {
      totalElement.textContent = this.formatBytes(total);
    }
    if (progressBar) {
      progressBar.style.width = `${percentage}%`;
      progressBar.style.backgroundColor = this.getProgressBarColor(percentage);
    }
    if (percentageElement) {
      percentageElement.textContent = `${percentage}% belegt`;
    }
  }

  // Storage-Informationen aktualisieren
  public async updateStorageInfo(): Promise<void> {
    try {
      if (this.shouldSkipStorageUpdate()) {
        return;
      }

      const data = await apiClient.get<{
        used: number;
        total: number;
        percentage: number;
        plan: string;
        breakdown?: { documents: number; attachments: number; logs: number; backups: number };
      }>('/root/storage');

      const { used, total, percentage } = data;
      this.updateStorageUI(used, total, percentage);
    } catch (error) {
      console.error('Error updating storage info:', error);
    }
  }

  // Bytes in lesbare Form konvertieren
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 GB';
    const k = 1024;
    const sizesMap = new Map([
      [0, 'B'],
      [1, 'KB'],
      [2, 'MB'],
      [3, 'GB'],
      [4, 'TB'],
    ]);
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), 4);
    const size = sizesMap.get(i) ?? 'B';
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${size}`;
  }

  // Toast notification helper - Removed as it was unused
  // If needed in future, consider using the showToast from role-switch.ts instead
}

// CSS automatisch einbinden
// CSS loading removed - now handled via static HTML link tags
console.info('[UnifiedNav] CSS loaded via HTML link tags');

// Export to window for backwards compatibility

// Global function for submenu toggle
interface NavigationWindow extends Window {
  toggleSubmenu: (event: Event, itemId: string) => void;
}

(window as unknown as NavigationWindow).toggleSubmenu = function (event: Event, itemId: string) {
  event.preventDefault();
  event.stopPropagation();

  const submenu = document.querySelector(`#submenu-${itemId}`);
  const parentItem = submenu?.closest(SIDEBAR_ITEM_SELECTOR);

  if (submenu instanceof HTMLElement && parentItem) {
    const isOpen = submenu.style.display === 'block';

    // Close all other submenus
    document.querySelectorAll('.submenu').forEach((menu) => {
      if (menu !== submenu) {
        (menu as HTMLElement).style.display = 'none';
        menu.closest(SIDEBAR_ITEM_SELECTOR)?.classList.remove('open');
      }
    });

    // Toggle current submenu
    if (!isOpen) {
      submenu.style.display = 'block';
      parentItem.classList.add('open');
      // Store the open submenu state
      localStorage.setItem('openSubmenu', itemId);
    } else {
      submenu.style.display = 'none';
      parentItem.classList.remove('open');
      // Clear stored submenu state when manually closing
      localStorage.removeItem('openSubmenu');
    }
  }
};

// Navigation automatisch initialisieren
// Prüfe ob DOM bereits geladen ist
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.unifiedNav = new UnifiedNavigation();
  });
} else {
  // DOM ist bereits geladen, initialisiere sofort
  window.unifiedNav = new UnifiedNavigation();
}

// Setup periodic updates
// REMOVED: setupPeriodicUpdates function and its call
// Duplicate interval calls were already handled in constructor (line 273-279)
// The main interval is set to 10 minutes (600000ms) in the constructor
// Initial updates are also already triggered in the constructor at line 265-270

// Extend Window interface for global functions
declare global {
  interface Window {
    UnifiedNavigation: typeof UnifiedNavigation;
    dismissRoleSwitchBanner: () => void;
  }
}

// Export to window for legacy support
window.UnifiedNavigation = UnifiedNavigation;

// Global function to dismiss role switch banner
window.dismissRoleSwitchBanner = function () {
  const banner = $$('#role-switch-warning-banner');
  if (banner) {
    banner.style.display = 'none';

    // Save dismissal state
    const activeRole = localStorage.getItem('activeRole');
    if (activeRole !== null && activeRole !== '') {
      const bannerDismissedKey = `roleSwitchBannerDismissed_${activeRole}`;
      localStorage.setItem(bannerDismissedKey, 'true');
    }

    // Reset sidebar position
    const sidebar = $$('.sidebar');
    if (sidebar) {
      sidebar.style.top = '';
      sidebar.style.height = '';
    }
  }
};

// Export for ES modules
export default UnifiedNavigation;
