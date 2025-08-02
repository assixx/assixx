/**
 * Unified Navigation Component für alle Dashboards
 * Verwendet rolle-basierte Menüs mit Glassmorphismus-Design
 */

// Import types
import type { User } from '../../../../backend/src/types/models';
import type { NavItem } from '../../types/utils.types';
// Import role switch function
import { loadUserInfo as loadUserInfoFromAuth } from '../auth';
import { switchRoleForRoot } from '../role-switch';

// Declare global type for window
declare global {
  interface Window {
    UnifiedNavigation: typeof UnifiedNavigation;
    unifiedNav: UnifiedNavigation;
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

interface UserProfileResponse {
  user?: User;
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  birthdate?: string;
  profile_picture?: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  profilePicture?: string;
  company_name?: string;
  subdomain?: string;
  employee_number?: string;
  employeeNumber?: string;
}

interface UnreadCountResponse {
  unreadCount?: number;
}

interface PendingCountResponse {
  pendingCount?: number;
}

// Access Control Map - Definiert welche Rollen auf welche Seiten zugreifen dürfen
const accessControlMap: Record<string, Array<'root' | 'admin' | 'employee'>> = {
  // Root-only pages
  '/root-dashboard': ['root'],
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
  '/admin-dashboard': ['admin', 'root'],
  '/pages/admin-dashboard': ['admin', 'root'],
  '/manage-admins': ['admin', 'root'],
  '/pages/manage-admins': ['admin', 'root'],
  '/manage-users': ['admin', 'root'],
  '/pages/manage-users': ['admin', 'root'],
  '/departments': ['admin', 'root'],
  '/pages/departments': ['admin', 'root'],
  '/manage-department-groups': ['admin', 'root'],
  '/pages/manage-department-groups': ['admin', 'root'],
  '/blackboard': ['admin', 'root'],
  '/pages/blackboard': ['admin', 'root'],
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
  '/employee-dashboard': ['employee', 'admin', 'root'],
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
  '/salary-documents': ['employee', 'admin', 'root'],
  '/pages/salary-documents': ['employee', 'admin', 'root'],
  '/employee-documents': ['employee', 'admin', 'root'],
  '/pages/employee-documents': ['employee', 'admin', 'root'],
  '/account-settings': ['employee', 'admin', 'root'],
  '/pages/account-settings': ['employee', 'admin', 'root'],
};

class UnifiedNavigation {
  private currentUser: TokenPayload | null = null;
  private currentRole: 'admin' | 'employee' | 'root' | null = null;
  private navigationItems: NavigationItems;
  private isCollapsed: boolean = false;
  private userProfileData: UserProfileResponse | null = null;
  private lastKvpClickTimestamp: number | null = null;
  private lastKnownKvpCount: number = 0;

  constructor() {
    this.navigationItems = this.getNavigationItems();
    // Load last KVP click timestamp and count from localStorage
    const savedTimestamp = localStorage.getItem('lastKvpClickTimestamp');
    this.lastKvpClickTimestamp = savedTimestamp ? parseInt(savedTimestamp, 10) : null;
    const savedCount = localStorage.getItem('lastKnownKvpCount');
    this.lastKnownKvpCount = savedCount ? parseInt(savedCount, 10) : 0;
    this.init();
  }

  /**
   * Prüft ob eine Rolle auf eine bestimmte Seite zugreifen darf
   */
  public canAccessPage(path: string, role: 'admin' | 'employee' | 'root'): boolean {
    // Normalisiere den Pfad (entferne Query-Parameter und Hash)
    const normalizedPath = path.split('?')[0].split('#')[0];

    // Prüfe exakten Pfad
    const allowedRoles = accessControlMap[normalizedPath];
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
        return '/root-dashboard';
      case 'admin':
        return '/admin-dashboard';
      case 'employee':
        return '/employee-dashboard';
      default:
        return '/employee-dashboard';
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

    console.log(`[UnifiedNav] Checking access: Role '${activeRole}' accessing '${currentPath}'`);

    if (!this.canAccessPage(currentPath, activeRole)) {
      console.warn(`[UnifiedNav] Access denied: Role '${activeRole}' cannot access '${currentPath}'`);
      const dashboard = this.getDashboardForRole(activeRole);
      console.log(`[UnifiedNav] Redirecting to dashboard: ${dashboard}`);
      window.location.href = dashboard;
    } else {
      console.log(`[UnifiedNav] Access granted: Role '${activeRole}' can access '${currentPath}'`);
    }
  }

  private init(): void {
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
    // Don't attach event listeners here - they will be attached after navigation is injected

    // Fix logo navigation after DOM is ready
    setTimeout(() => {
      this.fixLogoNavigation();
    }, 100);

    // Update badge counts
    setTimeout(() => {
      void this.updateUnreadMessages();
      void this.updatePendingSurveys();
      void this.updateUnreadDocuments();
      void this.updateNewKvpSuggestions();
    }, 1000);

    // Update badges every 30 seconds
    setInterval(() => {
      void this.updateUnreadMessages();
      void this.updatePendingSurveys();
      void this.updateUnreadDocuments();
      void this.updateNewKvpSuggestions();
    }, 30000);

    // Listen for BroadcastChannel messages to update navigation
    const roleChannel = new BroadcastChannel('role_switch_channel');
    roleChannel.onmessage = (event) => {
      if (event.data.type === 'ROLE_SWITCHED') {
        console.log('[UnifiedNav] Received role switch notification from another tab');

        // Update local storage with new role data
        if (event.data.newRole) {
          localStorage.setItem('activeRole', event.data.newRole);
        }
        if (event.data.token) {
          localStorage.setItem('token', event.data.token);
        }

        // Refresh the entire navigation with new role
        this.refresh();
      }
    };

    // Debounce timer for redirects to prevent loops
    let redirectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isRedirecting = false;

    // Listen for storage events from other tabs
    window.addEventListener('storage', (event) => {
      if (event.key === 'activeRole' && event.newValue !== event.oldValue) {
        console.log('[UnifiedNav] Storage event: activeRole changed from', event.oldValue, 'to', event.newValue);

        // Clear any pending redirects
        if (redirectTimeout) {
          clearTimeout(redirectTimeout);
        }

        // Debounce the redirect to prevent rapid fire changes
        redirectTimeout = setTimeout(() => {
          // Prevent multiple redirects
          if (isRedirecting) {
            console.log('[UnifiedNav] Redirect already in progress, skipping...');
            return;
          }

          // Check if we need to redirect based on current page
          const currentPath = window.location.pathname;
          const userRole = localStorage.getItem('userRole');
          const newActiveRole = event.newValue;

          // Helper function to get dashboard path for role
          const getDashboardPath = (role: string | null): string => {
            switch (role) {
              case 'root':
                return '/root-dashboard';
              case 'admin':
                return '/admin-dashboard';
              case 'employee':
                return '/employee-dashboard';
              default:
                return '/';
            }
          };

          const targetPath = getDashboardPath(newActiveRole);

          // Only redirect if we're not already on the correct dashboard
          if (targetPath && !currentPath.includes(targetPath)) {
            // Check if user has permission for the target role
            if (newActiveRole === 'root' && userRole !== 'root') {
              console.log('[UnifiedNav] User does not have root permission, skipping redirect');
              return;
            }

            console.log(`[UnifiedNav] Redirecting to ${targetPath} due to role change`);
            isRedirecting = true;

            // Use replace to avoid adding to browser history
            window.location.replace(targetPath);
          } else {
            console.log('[UnifiedNav] Already on correct dashboard, refreshing navigation only');
            // Just refresh navigation if we're already on the right page
            this.refresh();
          }
        }, 300); // 300ms delay to batch rapid changes
      }
    });
  }

  private loadUserInfo(): void {
    // User-Info aus Token oder Session laden
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1])) as TokenPayload & {
          activeRole?: string;
          isRoleSwitched?: boolean;
        };
        this.currentUser = payload;

        // Determine role based on current dashboard page
        const currentPath = window.location.pathname;
        const storedUserRole = localStorage.getItem('userRole');

        // If we're on a specific dashboard, that determines the active role
        if (currentPath.includes('/root-dashboard')) {
          this.currentRole = 'root';
          // Only root users can access root dashboard
          if (storedUserRole === 'root') {
            localStorage.setItem('activeRole', 'root');
          }
        } else if (currentPath.includes('/admin-dashboard')) {
          this.currentRole = 'admin';
          // Root or admin can access admin dashboard
          if (storedUserRole === 'root' || storedUserRole === 'admin') {
            localStorage.setItem('activeRole', 'admin');
          }
        } else if (currentPath.includes('/employee-dashboard')) {
          this.currentRole = 'employee';
          localStorage.setItem('activeRole', 'employee');
        } else {
          // Not on a dashboard page, use token or localStorage
          if (payload.activeRole) {
            this.currentRole = payload.activeRole as 'root' | 'admin' | 'employee';
          } else {
            const activeRole = localStorage.getItem('activeRole');
            if (activeRole && ['root', 'admin', 'employee'].includes(activeRole)) {
              this.currentRole = activeRole as 'root' | 'admin' | 'employee';
            } else {
              this.currentRole = payload.role;
            }
          }
        }

        console.log('[UnifiedNav] Role determined:', {
          currentPath,
          storedUserRole,
          tokenRole: payload.role,
          activeRole: localStorage.getItem('activeRole'),
          finalRole: this.currentRole,
        });

        // Also try to load full user profile
        void this.loadFullUserProfile();
      } catch (error) {
        console.error('Error parsing token:', error);
      }
    }
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
      if (!token || token === 'test-mode') return;

      // Use cached loadUserInfo from auth module instead of making a separate call
      console.info('[UnifiedNav] Using cached loadUserInfo');
      const userData = (await loadUserInfoFromAuth()) as UserProfileResponse & { data?: UserProfileResponse };
      if (userData) {
        const user = userData.user ?? userData;

        // Update company info (new)
        const companyElement = document.getElementById('sidebar-company-name');
        if (companyElement) {
          const companyName = userData.company_name ?? userData.data?.company_name ?? 'Firmenname';
          companyElement.textContent = companyName;
        }

        const domainElement = document.getElementById('sidebar-domain');
        if (domainElement) {
          const subdomain = userData.subdomain ?? userData.data?.subdomain ?? 'demo';
          domainElement.textContent = `${subdomain}.assixx.de`;
        }

        // Update user info card with full details
        const sidebarUserName = document.getElementById('sidebar-user-name');
        if (sidebarUserName) {
          const email = userData.email ?? userData.data?.email ?? user.email ?? this.currentUser?.email ?? 'User';
          sidebarUserName.textContent = email;
        }

        const sidebarFullName = document.getElementById('sidebar-user-fullname');
        if (sidebarFullName) {
          const firstName =
            userData.first_name ?? userData.data?.first_name ?? userData.firstName ?? ((user as User).firstName || '');
          const lastName =
            userData.last_name ?? userData.data?.last_name ?? userData.lastName ?? ((user as User).lastName || '');
          if (firstName || lastName) {
            const fullName = `${firstName} ${lastName}`.trim();
            sidebarFullName.textContent = fullName;
          }
        }

        // Birthdate removed as requested

        // Update employee number
        const sidebarEmployeeNumber = document.getElementById('sidebar-employee-number');
        if (sidebarEmployeeNumber) {
          const employeeNumber =
            userData.employee_number ??
            userData.data?.employee_number ??
            userData.employeeNumber ??
            ((user as User).employeeNumber || '');
          if (employeeNumber && employeeNumber !== '000001') {
            sidebarEmployeeNumber.textContent = `Personalnummer: ${employeeNumber}`;
          } else if (employeeNumber === '000001') {
            sidebarEmployeeNumber.textContent = 'Personalnummer: Temporär';
            sidebarEmployeeNumber.style.color = 'var(--warning-color)';
          }
        }

        // Update header user name with full name
        const headerUserName = document.getElementById('user-name');
        if (headerUserName) {
          // Same logic as sidebar-user-fullname which works correctly
          const firstName =
            userData.first_name ?? userData.data?.first_name ?? userData.firstName ?? ((user as User).firstName || '');
          const lastName =
            userData.last_name ?? userData.data?.last_name ?? userData.lastName ?? ((user as User).lastName || '');
          console.log('[UnifiedNav] Updating header user name:', { firstName, lastName, userData });

          if (firstName || lastName) {
            const fullName = `${firstName} ${lastName}`.trim();
            headerUserName.textContent = fullName;
            console.log('[UnifiedNav] Set header name to:', fullName);
          } else {
            // Fallback auf Email oder Username wenn keine Namen vorhanden
            const email = userData.email ?? userData.data?.email ?? user.email ?? this.currentUser?.email;
            const username = userData.username ?? user.username ?? this.currentUser?.username;
            headerUserName.textContent = email ?? username ?? 'User';
            console.log('[UnifiedNav] Fallback to email/username:', email ?? username);
          }
        }

        // Update avatar if we have profile picture
        const sidebarAvatar = document.getElementById('sidebar-user-avatar');
        if (sidebarAvatar) {
          const profilePic =
            userData.profile_picture ??
            userData.data?.profile_picture ??
            userData.profilePicture ??
            (user as User).profilePicture ??
            null;
          const firstName =
            userData.first_name ?? userData.data?.first_name ?? userData.firstName ?? ((user as User).firstName || '');
          const lastName =
            userData.last_name ?? userData.data?.last_name ?? userData.lastName ?? ((user as User).lastName || '');
          this.updateAvatarElement(sidebarAvatar, profilePic, firstName, lastName);
        }

        // Also update header avatar
        const headerAvatar = document.getElementById('user-avatar');
        if (headerAvatar) {
          const profilePic =
            userData.profile_picture ??
            userData.data?.profile_picture ??
            userData.profilePicture ??
            (user as User).profilePicture ??
            null;
          const firstName =
            userData.first_name ?? userData.data?.first_name ?? userData.firstName ?? ((user as User).firstName || '');
          const lastName =
            userData.last_name ?? userData.data?.last_name ?? userData.lastName ?? ((user as User).lastName || '');
          this.updateAvatarElement(headerAvatar, profilePic, firstName, lastName);
        }

        // Store profile data
        this.userProfileData = userData;
      }
    } catch (error) {
      console.error('Error loading full user profile:', error);
    }
  }

  private getNavigationItems(): NavigationItems {
    return {
      // Admin Navigation (14 Items)
      admin: [
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
              url: this.getSectionUrl('employees'),
              section: 'employees',
            },
          ],
        },
        {
          id: 'departments',
          icon: this.getSVGIcon('building'),
          label: 'Abteilungen',
          url: '/departments',
          children: [
            {
              id: 'departments-all',
              label: 'Alle Abteilungen',
              url: '/departments',
            },
          ],
        },
        {
          id: 'teams',
          icon: this.getSVGIcon('team'),
          label: 'Teams',
          url: this.getSectionUrl('teams'),
          section: 'teams',
        },
        {
          id: 'documents',
          icon: this.getSVGIcon('document'),
          label: 'Dokumente',
          hasSubmenu: true,
          submenu: [
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
          ],
        },
        {
          id: 'calendar',
          icon: this.getSVGIcon('calendar'),
          label: 'Kalender',
          url: '/calendar',
        },
        {
          id: 'lean-management',
          icon: this.getSVGIcon('lean'),
          label: 'LEAN-Management',
          hasSubmenu: true,
          badge: 'lean-management-parent',
          submenu: [
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
              url: '/survey-admin',
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
          ],
        },
        {
          id: 'shifts',
          icon: this.getSVGIcon('clock'),
          label: 'Schichtplanung',
          url: '/shifts',
        },
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
      ],

      // Employee Navigation (7 Items with LEAN submenu)
      employee: [
        {
          id: 'dashboard',
          icon: this.getSVGIcon('home'),
          label: 'Dashboard',
          url: '/employee-dashboard',
        },
        {
          id: 'documents',
          icon: this.getSVGIcon('document'),
          label: 'Dokumente',
          hasSubmenu: true,
          badge: 'unread-documents',
          submenu: [
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
          ],
        },
        {
          id: 'calendar',
          icon: this.getSVGIcon('calendar'),
          label: 'Kalender',
          url: '/calendar',
        },
        {
          id: 'lean-management',
          icon: this.getSVGIcon('lean'),
          label: 'LEAN-Management',
          hasSubmenu: true,
          badge: 'lean-management-parent',
          submenu: [
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
              url: '/survey-employee',
              badge: 'pending-surveys',
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
          ],
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
      ],

      // Root Navigation (erweitert)
      root: [
        {
          id: 'dashboard',
          icon: this.getSVGIcon('home'),
          label: 'Root Dashboard',
          url: '/root-dashboard',
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
        {
          id: 'departments',
          icon: this.getSVGIcon('building'),
          label: 'Abteilungen',
          url: '/departments',
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
      ],
    };
  }

  private getSVGIcon(name: string): string {
    const icons: Record<string, string> = {
      home: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>',
      users:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
      user: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
      document:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/></svg>',
      blackboard:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>',
      calendar:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7v-5z"/></svg>',
      clock:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>',
      chat: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>',
      lightbulb:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17h8v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7z"/></svg>',
      money:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>',
      building:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12,3L1,9V21H23V9M21,19H3V10.53L12,5.68L21,10.53M8,15H10V19H8M12,15H14V19H12M16,15H18V19H16Z"/></svg>',
      team: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>',
      'folder-tree':
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3,3H9V7H3V3M15,10H21V14H15V10M15,17H21V21H15V17M13,13H11V18H13V20H11V21H9V20H7V18H9V11H7V9H9V3H11V9H13V11H15V13H13Z"/></svg>',
      settings:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>',
      feature:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19,8L15,12H18C18,15.31 15.31,18 12,18C10.99,18 10.03,17.75 9.2,17.3L7.74,18.76C8.97,19.54 10.43,20 12,20C16.42,20 20,16.42 20,12H23M6,12C6,8.69 8.69,6 12,6C13.01,6 13.97,6.25 14.8,6.7L16.26,5.24C15.03,4.46 13.57,4 12,4C7.58,4 4,7.58 4,12H1L5,16L9,12"/></svg>',
      admin:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10V11H9.2V10C9.2,8.6 10.6,7 12,7M8.2,16V13H15.8V16H8.2Z"/></svg>',
      'user-shield':
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,5A3,3 0 0,1 15,8A3,3 0 0,1 12,11A3,3 0 0,1 9,8A3,3 0 0,1 12,5M17.13,17C15.92,18.85 14.11,20.24 12,20.92C9.89,20.24 8.08,18.85 6.87,17C6.53,16.5 6.24,16 6,15.47C6,13.82 8.71,12.47 12,12.47C15.29,12.47 18,13.79 18,15.47C17.76,16 17.47,16.5 17.13,17Z"/></svg>',
      poll: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3,22V8H7V22H3M10,22V2H14V22H10M17,22V14H21V22H17Z"/></svg>',
      lean: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/></svg>',
      wrench:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M22.7,19L13.6,9.9C14.5,7.6 14,4.9 12.1,3C10.1,1 7.1,0.6 4.7,1.7L9,6L6,9L1.6,4.7C0.4,7.1 0.9,10.1 2.9,12.1C4.8,14 7.5,14.5 9.8,13.6L18.9,22.7C19.3,23.1 19.9,23.1 20.3,22.7L22.6,20.4C23.1,20 23.1,19.3 22.7,19Z"/></svg>',
      star: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z"/></svg>',
      checklist:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9,5V9H21V5M9,19H21V15H9M9,14H21V10H9M4,9H8V5H4M4,19H8V15H4M4,14H8V10H4V14Z"/></svg>',
      search:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5,14h-0.79l-0.28-0.27C15.41,12.59,16,11.11,16,9.5 C16,5.91,13.09,3,9.5,3S3,5.91,3,9.5S5.91,16,9.5,16c1.61,0,3.09-0.59,4.23-1.57l0.27,0.28v0.79l5,4.99L20.49,19L15.5,14z M9.5,14C7.01,14,5,11.99,5,9.5S7.01,5,9.5,5S14,7.01,14,9.5S11.99,14,9.5,14z"/></svg>',
      sitemap:
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3,3H9V7H3V3M15,10H21V14H15V10M15,17H21V21H15V17M13,13H11V18H11C11,19.66 9.66,21 8,21H6C4.34,21 3,19.66 3,18V10H8V12L10,10H13V7H11V3H16C17.66,3 19,4.34 19,6V8C19,9.66 17.66,11 16,11H13V13Z"/></svg>',
      logs: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M8,15.5H16V17H8V15.5M8,11.5H16V13H8V11.5Z"/></svg>',
      'trash-clock':
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M15,16H19V18H15V16M15,8H19V10H15V8M15,12H19V14H15V12M5,12V9L9,5L13,9V13A2,2 0 0,1 11,15H7A2,2 0 0,1 5,13M9,3A1,1 0 0,0 8,4A1,1 0 0,0 9,5A1,1 0 0,0 10,4A1,1 0 0,0 9,3M2,17V20H11.67C11.24,19.09 11,18.07 11,17H2M6,8V10H8V8H6M6,11V13H8V11H6M16.5,3C13.46,3 11,5.46 11,8.5V9H13V8.5C13,6.57 14.57,5 16.5,5C18.43,5 20,6.57 20,8.5C20,10.43 18.43,12 16.5,12H16V14H16.5C19.54,14 22,11.54 22,8.5C22,5.46 19.54,3 16.5,3Z"/></svg>',
    };
    return icons[name] ?? icons.home;
  }

  private getNavigationForRole(role: 'admin' | 'employee' | 'root' | null): NavItem[] {
    if (!role) return [];
    return this.navigationItems[role] ?? [];
  }

  private getInitials(firstName?: string, lastName?: string): string {
    const firstInitial = firstName ? firstName.charAt(0).toUpperCase() : '';
    const lastInitial = lastName ? lastName.charAt(0).toUpperCase() : '';
    return `${firstInitial}${lastInitial}` || 'U';
  }

  private updateAvatarElement(
    element: HTMLElement,
    profilePicUrl: string | null,
    firstName?: string,
    lastName?: string,
  ): void {
    if (!element) return;

    // Clear existing content
    element.innerHTML = '';

    if (profilePicUrl) {
      // Show profile picture
      const img = document.createElement('img');
      img.src = profilePicUrl;
      img.alt = 'Avatar';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.style.borderRadius = 'inherit';
      element.appendChild(img);
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
    const navigationContainer = document.getElementById('navigation-container');
    if (navigationContainer) {
      // Create full navigation structure with header and sidebar
      const fullNavigation = this.createFullNavigationStructure();
      navigationContainer.innerHTML = fullNavigation;

      // Re-attach event listeners after inserting HTML
      setTimeout(() => {
        console.log('[UnifiedNav] Re-attaching event listeners for navigation-container');
        this.attachEventListeners();
        void this.updateUnreadMessages();
        void this.updatePendingSurveys();
        void this.updateUnreadDocuments();
        void this.updateNewKvpSuggestions();
      }, 100);

      return;
    }

    // Suche nach bestehender Sidebar und ersetze sie
    const existingSidebar = document.querySelector('.sidebar');
    if (existingSidebar) {
      existingSidebar.innerHTML = navigation;
    } else {
      // Erstelle neue Sidebar falls keine existiert
      this.createSidebarStructure();
    }
  }

  private createFullNavigationStructure(): string {
    // Get the actual user role from localStorage
    const storedUserRole = localStorage.getItem('userRole');
    const activeRole = localStorage.getItem('activeRole') ?? storedUserRole;

    // Use the actual stored role for determining which UI elements to show
    const userRole = storedUserRole ?? 'employee';

    const userName = this.userProfileData?.username ?? this.currentUser?.username ?? 'User';
    const firstName = this.userProfileData?.first_name ?? this.userProfileData?.firstName ?? '';
    const lastName = this.userProfileData?.last_name ?? this.userProfileData?.lastName ?? '';
    const displayName = firstName && lastName ? `${firstName} ${lastName}` : userName;
    const profilePicture = this.userProfileData?.profile_picture ?? this.userProfileData?.profilePicture ?? null;

    // Determine dashboard URL - ROOT users ALWAYS go to root dashboard
    const dashboardUrl =
      storedUserRole === 'root'
        ? 'root-dashboard'
        : userRole === 'admin'
          ? 'admin-dashboard?section=dashboard'
          : 'employee-dashboard';

    // Determine which logo to use based on sidebar collapsed state
    const logoSrc = this.isCollapsed ? '/assets/images/logo_collapsed.png' : '/assets/images/logo.png';

    // Check if user has switched roles and banner hasn't been dismissed
    const isRoleSwitched = storedUserRole !== activeRole && activeRole !== null;
    const bannerDismissedKey = `roleSwitchBannerDismissed_${activeRole}`;
    const isBannerDismissed = localStorage.getItem(bannerDismissedKey) === 'true';

    const warningBanner =
      isRoleSwitched && !isBannerDismissed
        ? `
      <!-- Role Switch Warning Banner -->
      <div class="role-switch-banner" id="role-switch-warning-banner">
        <div class="role-switch-banner-content">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px;">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <span>Sie agieren derzeit als <strong>${activeRole === 'employee' ? 'Mitarbeiter' : activeRole === 'admin' ? 'Admin' : 'Root'}</strong>. Ihre ursprüngliche Rolle ist <strong>${storedUserRole === 'root' ? 'Root' : storedUserRole === 'admin' ? 'Admin' : 'Mitarbeiter'}</strong>.</span>
          <button class="role-switch-banner-close" onclick="window.dismissRoleSwitchBanner();" title="Banner schließen">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      </div>
    `
        : '';

    return `
      <!-- Header -->
      <header class="header">
        <button class="sidebar-toggle" id="sidebar-toggle" title="Sidebar ein-/ausklappen">
          <svg class="toggle-icon" width="30" height="30" viewBox="0 0 24 24" fill="white">
            <path class="toggle-icon-path" d="${this.isCollapsed ? 'M4,6H20V8H4V6M4,11H15V13H4V11M4,16H20V18H4V16Z' : 'M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z'}"></path>
          </svg>
        </button>
        <a href="${dashboardUrl}" class="logo-container">
          <img src="${logoSrc}" alt="Assixx Logo" class="logo" id="header-logo" />
        </a>
        <div class="header-content">
          <div class="header-actions">
            ${
              userRole === 'root'
                ? `
              <!-- Role Switch Custom Dropdown for Root -->
              <div class="custom-dropdown role-switch-dropdown">
                <div class="dropdown-display" id="roleSwitchDisplay">
                  <span>${activeRole === 'root' ? 'Root-Ansicht' : activeRole === 'admin' ? 'Admin-Ansicht' : 'Mitarbeiter-Ansicht'}</span>
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
            `
                : userRole === 'admin'
                  ? `
              <!-- Role Switch Dropdown for Admin -->
              <div class="custom-dropdown role-switch-dropdown">
                <div class="dropdown-display" id="roleSwitchDisplay">
                  <span>${activeRole === 'admin' ? 'Admin-Ansicht' : 'Mitarbeiter-Ansicht'}</span>
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
            `
                  : ''
            }

            <div id="user-info">
              <div id="user-avatar" class="user-avatar ${profilePicture ? '' : 'avatar-initials'}">${
                profilePicture
                  ? `<img src="${profilePicture}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit;" />`
                  : this.getInitials(firstName, lastName)
              }</div>
              <span id="user-name">${this.escapeHtml(displayName)}</span>
            </div>

            <button id="logout-btn" class="btn-logout btn btn-secondary">
              <i class="fas fa-sign-out-alt"></i>

            </button>
          </div>
        </div>
      </header>

      ${warningBanner}

      <!-- Sidebar -->
      <aside class="sidebar ${this.isCollapsed ? 'collapsed' : ''}">
        ${this.createNavigationHTML()}
      </aside>
    `;
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
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
      sidebar.innerHTML = this.createNavigationHTML();

      const mainContent = document.createElement('main');
      mainContent.className = 'main-content';
      if (container) {
        mainContent.appendChild(container);
      }

      layoutContainer.appendChild(sidebar);
      layoutContainer.appendChild(mainContent);

      if (header) {
        body.insertBefore(layoutContainer, header.nextSibling);
      } else {
        body.appendChild(layoutContainer);
      }
    }
  }

  private createNavigationHTML(): string {
    const menuItems = this.getNavigationForRole(this.currentRole);

    // Storage Widget nur für Root User
    const storageWidget = this.currentRole === 'root' ? this.createStorageWidget() : '';

    return `
            <nav class="sidebar-nav">
                <button class="sidebar-title blackboard-button" onclick="window.location.href='/blackboard'" title="Zum Schwarzen Brett">
                    <span class="title-icon pinned-icon">
                        <span class="pin-head"></span>
                        <span class="pin-needle"></span>
                    </span>
                    <span class="title-content">
                        <span class="title-text">Schwarzes Brett</span>
                    </span>
                </button>
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
                <ul class="sidebar-menu">
                    ${menuItems.map((item, index) => this.createMenuItem(item, index === 0)).join('')}
                </ul>
                ${storageWidget}
            </nav>
        `;
  }

  private createMenuItem(item: NavItem, isActive: boolean = false): string {
    const activeClass = isActive ? 'active' : '';
    const hasChildren = item.children && item.children.length > 0;
    const hasSubmenu = item.hasSubmenu && item.submenu && item.submenu.length > 0;
    // Remove onclick handler - use normal navigation instead
    const clickHandler = '';

    // Badge für ungelesene Nachrichten oder offene Umfragen
    let badgeHtml = '';
    if (item.badge === 'unread-messages') {
      badgeHtml = `<span class="nav-badge" id="chat-unread-badge" style="display: none; position: absolute; top: 8px; right: 10px; background: #ff4444; color: white; font-size: 0.7rem; padding: 2px 6px; border-radius: 10px; font-weight: bold; min-width: 18px; text-align: center;">0</span>`;
    } else if (item.badge === 'pending-surveys') {
      badgeHtml = `<span class="nav-badge" id="surveys-pending-badge" style="display: none; position: absolute; top: 8px; right: 15px; background: rgba(255, 152, 0, 0.15); backdrop-filter: blur(10px); border: 1px solid rgba(255, 152, 0, 0.3); color: #ff9800; font-size: 0.75rem; padding: 3px 8px; border-radius: 12px; font-weight: 600; min-width: 20px; text-align: center;">0</span>`;
    } else if (item.badge === 'unread-documents') {
      badgeHtml = `<span class="nav-badge" id="documents-unread-badge" style="display: none; position: absolute; top: 8px; right: 10px; background: #2196f3; color: white; font-size: 0.7rem; padding: 2px 6px; border-radius: 10px; font-weight: bold; min-width: 18px; text-align: center;">0</span>`;
    } else if (item.badge === 'new-kvp-suggestions') {
      badgeHtml = `<span class="nav-badge" id="kvp-badge" style="display: none; position: absolute; top: 8px; right: 10px; background: #4caf50; color: white; font-size: 0.7rem; padding: 2px 6px; border-radius: 10px; font-weight: bold; min-width: 18px; text-align: center;">0</span>`;
    } else if (item.badge === 'lean-management-parent') {
      badgeHtml = `<span class="nav-badge" id="lean-management-badge" style="display: none; position: absolute; top: 8px; right: 40px; background: rgba(255, 152, 0, 0.15); backdrop-filter: blur(10px); border: 1px solid rgba(255, 152, 0, 0.3); color: #ff9800; font-size: 0.75rem; padding: 3px 8px; border-radius: 12px; font-weight: 600; min-width: 20px; text-align: center;">0</span>`;
    }

    // If has submenu, create a dropdown
    if (hasSubmenu) {
      const submenuItems =
        item.submenu && item.submenu.length > 0
          ? item.submenu
              .map((child) => {
                // Support both badgeId and badge properties
                let childBadgeHtml = '';
                if (child.badgeId) {
                  childBadgeHtml = `<span class="nav-badge" id="${child.badgeId}" style="display: none; position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: #ff5722; color: white; font-size: 0.7rem; padding: 2px 6px; border-radius: 10px; font-weight: bold; min-width: 18px; text-align: center;">0</span>`;
                } else if (child.badge === 'pending-surveys') {
                  childBadgeHtml = `<span class="nav-badge" id="surveys-pending-badge" style="display: none; position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: rgba(255, 152, 0, 0.15); backdrop-filter: blur(10px); border: 1px solid rgba(255, 152, 0, 0.3); color: #ff9800; font-size: 0.75rem; padding: 3px 8px; border-radius: 12px; font-weight: 600; min-width: 20px; text-align: center;">0</span>`;
                } else if (child.badge === 'new-kvp-suggestions') {
                  childBadgeHtml = `<span class="nav-badge" id="kvp-badge" style="display: none; position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: #4caf50; color: white; font-size: 0.7rem; padding: 2px 6px; border-radius: 10px; font-weight: bold; min-width: 18px; text-align: center;">0</span>`;
                }

                return `
              <li class="submenu-item" style="position: relative;">
                <a href="${child.url}" class="submenu-link" data-nav-id="${child.id}">
                  <span class="submenu-label">${child.label}</span>
                  ${childBadgeHtml}
                </a>
              </li>
            `;
              })
              .join('')
          : '';

      return `
        <li class="sidebar-item has-submenu ${activeClass}" style="position: relative;">
          <a href="#" class="sidebar-link" onclick="toggleSubmenu(event, '${item.id}')" data-nav-id="${item.id}">
            <span class="icon">${item.icon}</span>
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

    // If has children, create a dropdown (old style)
    if (hasChildren) {
      const submenuItems =
        item.children && item.children.length > 0
          ? item.children
              .map(
                (child) => `
        <li class="submenu-item">
          <a href="${child.url}" class="submenu-link" data-nav-id="${child.id}">
            <span class="submenu-label">${child.label}</span>
          </a>
        </li>
      `,
              )
              .join('')
          : '';

      return `
        <li class="sidebar-item has-submenu ${activeClass}" style="position: relative;">
          <a href="#" class="sidebar-link" onclick="toggleSubmenu(event, '${item.id}')" data-nav-id="${item.id}">
            <span class="icon">${item.icon}</span>
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

    return `
            <li class="sidebar-item ${activeClass}" style="position: relative;">
                <a href="${item.url}" class="sidebar-link" ${clickHandler} data-nav-id="${item.id}">
                    <span class="icon">${item.icon}</span>
                    <span class="label">${item.label}</span>
                    <span class="nav-indicator"></span>
                    ${badgeHtml}
                </a>
            </li>
        `;
  }

  // Removed unused method getUserInitials

  private attachEventListeners(): void {
    // Navigation Link Clicks
    document.addEventListener('click', (e: MouseEvent) => {
      const navLink = (e.target as HTMLElement).closest('.sidebar-link:not([onclick])') as HTMLElement;
      if (navLink) {
        this.handleNavigationClick(navLink, e);
      }

      // Submenu Link Clicks
      const submenuLink = (e.target as HTMLElement).closest('.submenu-link') as HTMLElement;
      if (submenuLink) {
        // Store the parent submenu state
        const parentSubmenu = submenuLink.closest('.submenu');
        const parentItem = parentSubmenu?.closest('.sidebar-item');
        if (parentItem) {
          const parentId = parentItem.querySelector('.sidebar-link')?.getAttribute('data-nav-id');
          if (parentId) {
            localStorage.setItem('openSubmenu', parentId);
          }
        }

        // Check if admin/root clicked on KVP submenu item
        const submenuNavId = submenuLink.getAttribute('data-nav-id');
        if (submenuNavId === 'kvp' && (this.currentRole === 'admin' || this.currentRole === 'root')) {
          void this.resetKvpBadge();
        }
      }

      // Logout Button Click - Check both button and its children
      const target = e.target as HTMLElement;
      const logoutBtn = target.closest('#logout-btn');
      if (logoutBtn) {
        e.preventDefault();
        e.stopPropagation(); // Stop event from bubbling
        this.handleLogout().catch((error) => {
          console.error('Logout error:', error);
          // Fallback: redirect to login even if logout fails
          window.location.href = '/login';
        });
      }
    });

    // Sidebar Toggle
    this.attachSidebarToggle();

    // Update active state on page load
    this.updateActiveNavigation();

    // Initialize role switch functionality
    this.initializeRoleSwitch();
  }

  private attachSidebarToggle(): void {
    const toggleBtn = document.getElementById('sidebar-toggle');

    // Debug: Check how many sidebars exist
    const allSidebars = document.querySelectorAll('.sidebar');
    console.log('[UnifiedNav] Number of sidebars found:', allSidebars.length);
    allSidebars.forEach((sb, index) => {
      console.log(`[UnifiedNav] Sidebar ${index}:`, sb);
      console.log(`[UnifiedNav] Sidebar ${index} parent:`, sb.parentElement);
    });

    // Try to find the navigation sidebar specifically
    const navContainer = document.getElementById('navigation-container');
    const sidebar = navContainer
      ? (navContainer.querySelector('.sidebar') as HTMLElement)
      : (document.querySelector('.sidebar') as HTMLElement);
    const mainContent = document.querySelector('.main-content') as HTMLElement;
    const chatMain = document.querySelector('.chat-main') as HTMLElement;
    const chatSidebar = document.querySelector('.chat-sidebar') as HTMLElement;

    console.log('[UnifiedNav] Toggle button:', toggleBtn);
    console.log('[UnifiedNav] Sidebar:', sidebar);
    console.log('[UnifiedNav] Sidebar ID:', sidebar?.id);
    console.log('[UnifiedNav] Sidebar class:', sidebar?.className);
    console.log('[UnifiedNav] Main content:', mainContent);

    if (!toggleBtn || !sidebar) {
      console.error('[UnifiedNav] Toggle button or sidebar not found!');
      return;
    }

    // Check localStorage for saved state
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) {
      sidebar.classList.add('collapsed');
      mainContent?.classList.add('sidebar-collapsed');
      chatMain?.classList.add('sidebar-collapsed');
      chatSidebar?.classList.add('sidebar-collapsed');
      sidebar.style.setProperty('width', '68px', 'important');
      this.updateToggleIcon();
    } else {
      sidebar.style.setProperty('width', '280px', 'important');
    }

    // Toggle click handler
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      console.log('[UnifiedNav] Toggle clicked!');
      console.log('[UnifiedNav] Sidebar classes before:', sidebar.className);
      console.log('[UnifiedNav] Sidebar computed width:', window.getComputedStyle(sidebar).width);

      const isCurrentlyCollapsed = sidebar.classList.contains('collapsed');
      const newState = !isCurrentlyCollapsed;

      sidebar.classList.toggle('collapsed');
      mainContent?.classList.toggle('sidebar-collapsed');
      chatMain?.classList.toggle('sidebar-collapsed');
      chatSidebar?.classList.toggle('sidebar-collapsed');

      // Set width directly as inline style to override any CSS
      console.log('[UnifiedNav] Setting width for collapsed state:', newState);
      if (newState) {
        sidebar.style.width = '70px';
        sidebar.style.setProperty('width', '70px', 'important');
        console.log('[UnifiedNav] Set width to 70px, actual style:', sidebar.getAttribute('style'));

        // Check if there's a CSS rule overriding
        const computedStyle = window.getComputedStyle(sidebar);
        console.log('[UnifiedNav] Width source:', computedStyle.getPropertyPriority('width'));
      } else {
        sidebar.style.width = '280px';
        sidebar.style.setProperty('width', '280px', 'important');
        console.log('[UnifiedNav] Set width to 280px, actual style:', sidebar.getAttribute('style'));
      }

      // Force browser to recalculate styles
      void sidebar.offsetWidth;

      // Save state
      localStorage.setItem('sidebarCollapsed', newState.toString());
      this.isCollapsed = newState;

      // Update icon
      this.updateToggleIcon();

      // Update logo based on collapsed state
      const headerLogo = document.getElementById('header-logo') as HTMLImageElement;
      if (headerLogo) {
        headerLogo.src = newState ? '/assets/images/logo_collapsed.png' : '/assets/images/logo.png';
      }

      console.log('[UnifiedNav] Sidebar collapsed state:', newState);
      console.log('[UnifiedNav] Sidebar classes after:', sidebar.className);
      console.log('[UnifiedNav] Sidebar computed width after:', window.getComputedStyle(sidebar).width);
    });

    // Hover effect for toggle button
    toggleBtn.addEventListener('mouseenter', () => {
      const isCollapsed = sidebar.classList.contains('collapsed');
      const iconPath = toggleBtn.querySelector('.toggle-icon-path');
      if (iconPath) {
        if (isCollapsed) {
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

    // Add tooltips for collapsed sidebar items
    this.addCollapsedTooltips();
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
      const label = item.querySelector('.label')?.textContent;
      if (label) {
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
    // Use the logout function from auth module which logs the action
    const { logout } = await import('../auth.js');
    await logout();
  }

  private initializeRoleSwitch(): void {
    const userRole = localStorage.getItem('userRole');

    // Handle root users with custom dropdown
    if (userRole === 'root') {
      const dropdownDisplay = document.getElementById('roleSwitchDisplay');
      const dropdownOptions = document.getElementById('roleSwitchDropdown');

      // Check if already initialized
      if (dropdownDisplay?.hasAttribute('data-initialized')) {
        console.log('[UnifiedNav] Role switch dropdown already initialized, skipping');
        return;
      }

      console.log('[UnifiedNav] Looking for dropdown elements for root user');
      console.log('[UnifiedNav] dropdownDisplay:', dropdownDisplay);
      console.log('[UnifiedNav] dropdownOptions:', dropdownOptions);

      if (dropdownDisplay && dropdownOptions) {
        console.log('[UnifiedNav] Initializing role switch dropdown for root user');
        console.log('[UnifiedNav] Dropdown elements found:', { dropdownDisplay, dropdownOptions });

        // Mark as initialized
        dropdownDisplay.setAttribute('data-initialized', 'true');

        // Toggle dropdown on click
        dropdownDisplay.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          console.log('[UnifiedNav] Dropdown clicked');
          console.log('[UnifiedNav] Current classes:', dropdownDisplay.className, dropdownOptions.className);

          const isActive = dropdownDisplay.classList.contains('active');

          if (isActive) {
            dropdownDisplay.classList.remove('active');
            dropdownOptions.classList.remove('active');
            console.log('[UnifiedNav] Dropdown closed');
          } else {
            dropdownDisplay.classList.add('active');
            dropdownOptions.classList.add('active');
            console.log('[UnifiedNav] Dropdown opened');
          }
        });

        // Handle option selection
        const options = dropdownOptions.querySelectorAll('.dropdown-option');
        options.forEach((option) => {
          option.addEventListener('click', (e) => {
            void (async () => {
              e.stopPropagation();

              const selectedRole = (e.target as HTMLElement).getAttribute('data-value') as
                | 'root'
                | 'admin'
                | 'employee';
              console.log('[UnifiedNav] Role switch dropdown changed to:', selectedRole);

              // Update display text
              const displayText = dropdownDisplay.querySelector('span');
              if (displayText) {
                displayText.textContent = (e.target as HTMLElement).textContent ?? '';
              }

              // Close dropdown
              dropdownDisplay.classList.remove('active');
              dropdownOptions.classList.remove('active');

              // Update hidden input
              const hiddenInput = document.getElementById('role-switch-value') as HTMLInputElement;
              if (hiddenInput) {
                hiddenInput.value = selectedRole;
              }

              // Call the role switch function from role-switch module
              // This will handle the toast notification
              console.log('[UnifiedNav] Calling switchRoleForRoot with role:', selectedRole);
              await switchRoleForRoot(selectedRole);
            })();
          });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
          // Don't close if clicking on the dropdown itself
          if (!dropdownDisplay.contains(e.target as Node) && !dropdownOptions.contains(e.target as Node)) {
            dropdownDisplay.classList.remove('active');
            dropdownOptions.classList.remove('active');
          }
        });
      }
    }

    // Handle admin users with dropdown (same as root)
    if (userRole === 'admin') {
      const dropdownDisplay = document.getElementById('roleSwitchDisplay');
      const dropdownOptions = document.getElementById('roleSwitchDropdown');

      // Check if already initialized
      if (dropdownDisplay?.hasAttribute('data-initialized')) {
        console.log('[UnifiedNav] Role switch dropdown already initialized, skipping');
        return;
      }

      console.log('[UnifiedNav] Looking for dropdown elements for admin user');
      console.log('[UnifiedNav] dropdownDisplay:', dropdownDisplay);
      console.log('[UnifiedNav] dropdownOptions:', dropdownOptions);

      if (dropdownDisplay && dropdownOptions) {
        console.log('[UnifiedNav] Initializing role switch dropdown for admin user');

        // Mark as initialized
        dropdownDisplay.setAttribute('data-initialized', 'true');

        // Toggle dropdown on click
        dropdownDisplay.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          console.log('[UnifiedNav] Dropdown clicked');

          const isActive = dropdownDisplay.classList.contains('active');

          if (isActive) {
            dropdownDisplay.classList.remove('active');
            dropdownOptions.classList.remove('active');
            console.log('[UnifiedNav] Dropdown closed');
          } else {
            dropdownDisplay.classList.add('active');
            dropdownOptions.classList.add('active');
            console.log('[UnifiedNav] Dropdown opened');
          }
        });

        // Handle option selection
        const options = dropdownOptions.querySelectorAll('.dropdown-option');
        options.forEach((option) => {
          option.addEventListener('click', (e) => {
            void (async () => {
              e.stopPropagation();
              const selectedRole = (option as HTMLElement).dataset.value;
              if (selectedRole) {
                console.log('[UnifiedNav] Admin switching to role:', selectedRole);

                // Close dropdown
                dropdownDisplay.classList.remove('active');
                dropdownOptions.classList.remove('active');

                // Switch role for admin (different API endpoints than root)
                if (selectedRole === 'admin' || selectedRole === 'employee') {
                  // Admin uses different API endpoints
                  const token = localStorage.getItem('token');
                  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
                  // const currentRole = localStorage.getItem('activeRole') ?? 'admin';

                  // Determine endpoint based on target role
                  const endpoint =
                    selectedRole === 'employee' ? '/api/role-switch/to-employee' : '/api/role-switch/to-admin';

                  try {
                    const response = await fetch(endpoint, {
                      method: 'POST',
                      headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken,
                      },
                      credentials: 'include',
                    });

                    if (!response.ok) {
                      throw new Error('Rollenwechsel fehlgeschlagen');
                    }

                    const data = await response.json();

                    // Update token and storage
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('activeRole', data.user.activeRole);

                    // Also update sessionStorage for compatibility
                    if (data.user.activeRole === 'employee') {
                      sessionStorage.setItem('roleSwitch', 'employee');
                    } else {
                      sessionStorage.removeItem('roleSwitch');
                    }

                    // Clear role switch banner dismissal states
                    ['admin', 'employee'].forEach((role) => {
                      localStorage.removeItem(`roleSwitchBannerDismissed_${role}`);
                    });

                    // Show success message with toast
                    const message =
                      selectedRole === 'employee'
                        ? 'Wechsel zur Mitarbeiter-Ansicht...'
                        : 'Wechsel zur Admin-Ansicht...';

                    // Create and show toast notification
                    this.showToast(message, 'success');

                    // Redirect to appropriate dashboard
                    setTimeout(() => {
                      if (data.user.activeRole === 'admin') {
                        window.location.href = '/admin-dashboard';
                      } else {
                        window.location.href = '/employee-dashboard';
                      }
                    }, 1000);
                  } catch (error) {
                    console.error('Role switch error:', error);
                    // Re-enable dropdown on error
                    dropdownDisplay.style.pointerEvents = '';
                    dropdownDisplay.style.opacity = '';
                  }
                }
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
    document.querySelectorAll('.sidebar-item').forEach((item) => {
      item.classList.remove('active');
    });
    link.closest('.sidebar-item')?.classList.add('active');

    // Store active navigation
    const navId = link.dataset.navId;
    if (navId) {
      localStorage.setItem('activeNavigation', navId);

      // If user clicked on documents, mark all as read
      if (navId === 'documents' && this.currentRole === 'employee') {
        void this.markAllDocumentsAsRead();
      }

      // If admin/root clicked on KVP, reset the badge
      if (navId === 'kvp' && (this.currentRole === 'admin' || this.currentRole === 'root')) {
        this.resetKvpBadge().catch((error) => console.error('Error resetting KVP badge:', error));
      }
    }

    // Add navigation animation
    this.animateNavigation(link);
  }

  private updateActiveNavigation(): void {
    const activeNav = localStorage.getItem('activeNavigation');
    const currentPath = window.location.pathname;

    // Remove all active states
    document.querySelectorAll('.sidebar-item').forEach((item) => {
      item.classList.remove('active');
    });

    // Check if we just logged in or on main dashboard page
    const isMainDashboard =
      currentPath.includes('admin-dashboard') ||
      currentPath.includes('employee-dashboard') ||
      currentPath.includes('root-dashboard');

    // Check if we have a hash in URL (for section navigation)
    const currentHash = window.location.hash.substring(1); // Remove #

    // If on dashboard page
    if (isMainDashboard) {
      if (currentHash && currentHash !== 'dashboard') {
        // Use hash to determine active section
        const hashLink = document.querySelector(`[data-nav-id="${currentHash}"]`);
        if (hashLink) {
          hashLink.closest('.sidebar-item')?.classList.add('active');
        }
      } else if (!activeNav || activeNav === 'dashboard') {
        // Default to overview only if no hash and no stored nav
        const dashboardLink = document.querySelector('[data-nav-id="dashboard"]');
        if (dashboardLink) {
          dashboardLink.closest('.sidebar-item')?.classList.add('active');
        }
        // Clear any stored navigation to prevent last selected from being active
        localStorage.removeItem('activeNavigation');
      }
    } else if (activeNav && activeNav !== 'dashboard') {
      // Only use stored navigation if it's not the dashboard
      const activeLink = document.querySelector(`[data-nav-id="${activeNav}"]`);
      if (activeLink) {
        activeLink.closest('.sidebar-item')?.classList.add('active');
      }
    } else {
      // For other pages, auto-detect or default to dashboard
      const detected = this.autoDetectActivePage(currentPath);
      if (!detected) {
        // If no match found, default to dashboard
        const dashboardLink = document.querySelector('[data-nav-id="dashboard"]');
        if (dashboardLink) {
          dashboardLink.closest('.sidebar-item')?.classList.add('active');
        }
      }
    }

    // Handle submenu states
    this.updateSubmenuStates();
  }

  private updateSubmenuStates(): void {
    const currentPath = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);
    const section = urlParams.get('section');
    let foundActiveSubmenu = false;

    // First, ensure all submenus are closed and remove all submenu active states
    document.querySelectorAll('.submenu').forEach((submenu) => {
      const submenuElement = submenu as HTMLElement;
      submenuElement.style.display = 'none';
      submenu.closest('.sidebar-item')?.classList.remove('open');
    });

    // Remove active class from all submenu items
    document.querySelectorAll('.submenu-item').forEach((item) => {
      item.classList.remove('active');
    });

    // Remove active class from all submenu links
    document.querySelectorAll('.submenu-link').forEach((link) => {
      link.classList.remove('active');
    });

    // Check if we're on a dashboard page with a section that has a submenu
    const isDashboard = currentPath.includes('dashboard');
    if (isDashboard && section) {
      // Check if this section corresponds to a menu item with submenu
      const menuItems = this.getNavigationForRole(this.currentRole);
      const menuItem = menuItems.find((item) => item.id === section);

      if (menuItem && (menuItem.hasSubmenu || menuItem.children)) {
        // Open the submenu for this section
        const submenu = document.getElementById(`submenu-${section}`);
        const parentItem = submenu?.closest('.sidebar-item.has-submenu');

        if (submenu && parentItem) {
          submenu.style.display = 'block';
          parentItem.classList.add('open');
          localStorage.setItem('openSubmenu', section);
          foundActiveSubmenu = true;

          // For sections like employees that have children, mark the first child as active
          if (menuItem.children && menuItem.children.length > 0) {
            const firstChildLink = submenu.querySelector('.submenu-link');
            if (firstChildLink) {
              firstChildLink.classList.add('active');
              const submenuItem = firstChildLink.closest('.submenu-item');
              if (submenuItem) {
                submenuItem.classList.add('active');
              }
            }
          }
        }
      }
    }

    // If not handled by section parameter, check for direct submenu pages
    if (!foundActiveSubmenu && !isDashboard) {
      // Check all submenu links to find if we're on a submenu page
      document.querySelectorAll('.submenu-link').forEach((link) => {
        const linkElement = link as HTMLAnchorElement;
        try {
          const linkPath = new URL(linkElement.href, window.location.origin).pathname;

          // Check if current path matches this submenu link exactly
          if (currentPath === linkPath) {
            foundActiveSubmenu = true;

            // Mark the submenu item and link as active
            link.classList.add('active');
            const submenuItem = link.closest('.submenu-item');
            if (submenuItem) {
              submenuItem.classList.add('active');
            }

            // Find and open the parent submenu
            const submenu = link.closest('.submenu') as HTMLElement;
            const parentItem = submenu?.closest('.sidebar-item.has-submenu');

            if (submenu && parentItem) {
              submenu.style.display = 'block';
              parentItem.classList.add('open');
              parentItem.classList.add('active');

              // Store the open submenu state
              const parentId = parentItem.querySelector('.sidebar-link')?.getAttribute('data-nav-id');
              if (parentId) {
                localStorage.setItem('openSubmenu', parentId);
              }
            }
          }
        } catch {
          // Skip invalid URLs
          console.warn('Invalid submenu URL:', linkElement.href);
        }
      });
    }

    // If we're not on any submenu page and not in a section with submenu, clear the stored state
    if (!foundActiveSubmenu) {
      localStorage.removeItem('openSubmenu');
    }

    // Restore previously open submenu if we're still on the same parent section
    const storedSubmenu = localStorage.getItem('openSubmenu');
    if (storedSubmenu && !foundActiveSubmenu) {
      const submenu = document.getElementById(`submenu-${storedSubmenu}`);
      const parentItem = submenu?.closest('.sidebar-item.has-submenu');

      if (submenu && parentItem) {
        // Only restore if the parent item is active
        if (parentItem.classList.contains('active')) {
          submenu.style.display = 'block';
          parentItem.classList.add('open');
        }
      }
    }
  }

  private autoDetectActivePage(currentPath: string): boolean {
    const menuItems = this.getNavigationForRole(this.currentRole);
    const matchingItem = menuItems.find((item) => {
      if (!item.url || item.url.startsWith('#')) return false;
      return currentPath.includes(item.url.replace('/', ''));
    });

    if (matchingItem) {
      const link = document.querySelector(`[data-nav-id="${matchingItem.id}"]`);
      if (link) {
        link.closest('.sidebar-item')?.classList.add('active');
        return true;
      }
    }
    return false;
  }

  private animateNavigation(link: HTMLElement): void {
    // Add ripple effect
    const ripple = document.createElement('span');
    ripple.className = 'nav-ripple';
    link.appendChild(ripple);

    setTimeout(() => {
      if (ripple.parentNode) {
        ripple.parentNode.removeChild(ripple);
      }
    }, 600);
  }

  // Public method to refresh navigation
  public refresh(): void {
    console.log('[UnifiedNav] Refreshing navigation');

    // Reload user info from token
    this.loadUserInfo();

    // Get the navigation container
    const navigationContainer = document.getElementById('navigation-container');
    if (navigationContainer) {
      // Clear and recreate entire navigation structure
      const fullNavigation = this.createFullNavigationStructure();
      navigationContainer.innerHTML = fullNavigation;

      // Re-attach event listeners after DOM update
      setTimeout(() => {
        this.attachEventListeners();
        this.updateActiveNavigation();
        void this.updateUnreadMessages();
        void this.updatePendingSurveys();
        void this.updateUnreadDocuments();
        void this.updateNewKvpSuggestions();

        // Restore sidebar state
        const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        if (isCollapsed) {
          const sidebar = navigationContainer.querySelector('.sidebar');
          const mainContent = document.querySelector('.main-content');
          sidebar?.classList.add('collapsed');
          mainContent?.classList.add('sidebar-collapsed');
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
      if (!token || token === 'test-mode') return;

      const response = await fetch('/api/chat/unread-count', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data: UnreadCountResponse = await response.json();
        const badge = document.getElementById('chat-unread-badge');
        if (badge) {
          const count = data.unreadCount ?? 0;
          if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count.toString();
            badge.style.display = 'inline-block';
          } else {
            badge.style.display = 'none';
          }
        }
      }
    } catch (error) {
      console.error('Error updating unread messages:', error);
    }
  }

  // Update KVP new suggestions count (for admin/root only)
  public async updateNewKvpSuggestions(): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token || token === 'test-mode') return;

      // Only show badge for admin/root users
      if (this.currentRole !== 'admin' && this.currentRole !== 'root') {
        const badge = document.getElementById('kvp-badge');
        if (badge) badge.style.display = 'none';
        return;
      }

      const response = await fetch('/api/kvp/stats', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const badge = document.getElementById('kvp-badge');
        if (badge && data.company) {
          const currentCount = data.company.byStatus?.new ?? 0;

          // Check if user has clicked on KVP before
          const hasClickedKvp = this.lastKvpClickTimestamp !== null;

          // Only show badge if:
          // 1. There are new suggestions AND
          // 2. Either the user has never clicked on KVP OR the count has increased since last click
          if (currentCount > 0 && (!hasClickedKvp || currentCount > this.lastKnownKvpCount)) {
            badge.textContent = currentCount > 99 ? '99+' : currentCount.toString();
            badge.style.display = 'inline-block';
            console.log('[UnifiedNav] KVP badge shown - count:', currentCount, 'lastKnown:', this.lastKnownKvpCount);
          } else {
            badge.style.display = 'none';
            console.log('[UnifiedNav] KVP badge hidden - count:', currentCount, 'lastKnown:', this.lastKnownKvpCount);
          }

          // Update the last known count if it has changed
          if (currentCount !== this.lastKnownKvpCount && !hasClickedKvp) {
            this.lastKnownKvpCount = currentCount;
            localStorage.setItem('lastKnownKvpCount', currentCount.toString());
          }
        }
      }
    } catch (error) {
      console.error('Error updating KVP suggestions count:', error);
    }
  }

  // Offene Umfragen aktualisieren
  public async updatePendingSurveys(): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      console.log('[UnifiedNav] updatePendingSurveys - Token exists:', !!token);
      if (!token || token === 'test-mode') return;

      // Nur für Employees
      const role = localStorage.getItem('userRole');
      console.log('[UnifiedNav] updatePendingSurveys - User role:', role);
      if (role !== 'employee') {
        console.log('[UnifiedNav] updatePendingSurveys - Skipping, not an employee');
        return;
      }

      console.log('[UnifiedNav] updatePendingSurveys - Fetching pending count...');
      // Auf allen Seiten ausführen, da Badge in Sidebar immer sichtbar ist

      const response = await fetch('/api/surveys/pending-count', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('[UnifiedNav] updatePendingSurveys - Response status:', response.status);

      if (response.ok) {
        const data: PendingCountResponse = await response.json();
        console.log('[UnifiedNav] updatePendingSurveys - Pending count data:', data);
        const badge = document.getElementById('surveys-pending-badge');
        const parentBadge = document.getElementById('lean-management-badge');
        console.log('[UnifiedNav] updatePendingSurveys - Badge element found:', !!badge);
        console.log('[UnifiedNav] updatePendingSurveys - Parent badge element found:', !!parentBadge);

        const count = data.pendingCount ?? 0;

        // Update child badge (in submenu)
        if (badge) {
          if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count.toString();
            badge.style.display = 'inline-block';
            console.log('[UnifiedNav] updatePendingSurveys - Badge shown with count:', count);
          } else {
            badge.style.display = 'none';
            console.log('[UnifiedNav] updatePendingSurveys - Badge hidden, count is 0');
          }
        }

        // Update parent badge (on LEAN-Management)
        if (parentBadge) {
          if (count > 0) {
            parentBadge.textContent = count > 99 ? '99+' : count.toString();
            parentBadge.style.display = 'inline-block';
            console.log('[UnifiedNav] updatePendingSurveys - Parent badge shown with count:', count);
          } else {
            parentBadge.style.display = 'none';
            console.log('[UnifiedNav] updatePendingSurveys - Parent badge hidden, count is 0');
          }
        }
      } else if (response.status === 404) {
        console.log('[UnifiedNav] updatePendingSurveys - 404 error, endpoint not found');
        // API endpoint doesn't exist yet - hide badge silently
        const badge = document.getElementById('surveys-pending-badge');
        if (badge) {
          badge.style.display = 'none';
        }
      } else {
        console.log('[UnifiedNav] updatePendingSurveys - Error response:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('[UnifiedNav] updatePendingSurveys - Exception:', error);
      // Silently handle errors for pending surveys
      const badge = document.getElementById('surveys-pending-badge');
      if (badge) {
        badge.style.display = 'none';
      }
    }
  }

  // Ungelesene Dokumente aktualisieren
  public async updateUnreadDocuments(): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token || token === 'test-mode') return;

      // Für Employees und Admins
      const role = localStorage.getItem('userRole') ?? this.currentRole;
      if (role !== 'employee' && role !== 'admin') return;

      // Fetch all documents with unread status
      const response = await fetch('/api/v2/documents', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        // Backend returns {data: {documents: Document[], pagination: {...}}}
        const documents = result.data?.documents ?? result.documents ?? [];

        // Count unread documents by category
        const unreadCounts = {
          company: 0,
          department: 0,
          team: 0,
          personal: 0,
          payroll: 0,
          total: 0,
        };

        interface DocumentResponse {
          is_read?: boolean;
          category?: string;
          scope?: 'company' | 'department' | 'team' | 'personal';
        }

        documents.forEach((doc: DocumentResponse) => {
          if (!doc.is_read) {
            unreadCounts.total++;

            // Special case for payroll documents
            if (doc.category === 'salary') {
              unreadCounts.payroll++;
            } else if (doc.scope) {
              // Count by scope
              unreadCounts[doc.scope as keyof typeof unreadCounts]++;
            }
          }
        });

        // Update main documents badge
        const mainBadge = document.getElementById('documents-unread-badge');
        if (mainBadge) {
          if (unreadCounts.total > 0) {
            mainBadge.textContent = unreadCounts.total > 99 ? '99+' : unreadCounts.total.toString();
            mainBadge.style.display = 'inline-block';
          } else {
            mainBadge.style.display = 'none';
          }
        }

        // Update individual category badges
        const updateBadge = (badgeId: string, count: number) => {
          const badge = document.getElementById(badgeId);
          if (badge) {
            if (count > 0) {
              badge.textContent = count > 99 ? '99+' : count.toString();
              badge.style.display = 'inline-block';
            } else {
              badge.style.display = 'none';
            }
          }
        };

        updateBadge('badge-docs-company', unreadCounts.company);
        updateBadge('badge-docs-department', unreadCounts.department);
        updateBadge('badge-docs-team', unreadCounts.team);
        updateBadge('badge-docs-personal', unreadCounts.personal);
        updateBadge('badge-docs-payroll', unreadCounts.payroll);
      }
    } catch (error) {
      console.error('Error updating unread documents:', error);
    }
  }

  // Mark all documents as read
  private async markAllDocumentsAsRead(): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token || token === 'test-mode') return;

      const response = await fetch('/api/employee/documents/mark-all-read', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Hide the badge immediately
        const badge = document.getElementById('documents-unread-badge');
        if (badge) {
          badge.style.display = 'none';
        }
      }
    } catch (error) {
      console.error('Error marking documents as read:', error);
    }
  }

  // Reset KVP badge when admin/root clicks on KVP
  private async resetKvpBadge(): Promise<void> {
    console.log('[UnifiedNav] Resetting KVP badge');
    const badge = document.getElementById('kvp-badge');
    if (badge) {
      badge.style.display = 'none';
      badge.textContent = '0';
      console.log('[UnifiedNav] KVP badge hidden');
    }

    // Save the timestamp of when the user clicked on KVP
    this.lastKvpClickTimestamp = Date.now();
    localStorage.setItem('lastKvpClickTimestamp', this.lastKvpClickTimestamp.toString());

    // Get the current count from the API to save as baseline
    try {
      const token = localStorage.getItem('token');
      if (token && token !== 'test-mode') {
        const response = await fetch('/api/kvp/stats', {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.company) {
            this.lastKnownKvpCount = data.company.byStatus?.new ?? 0;
            localStorage.setItem('lastKnownKvpCount', this.lastKnownKvpCount.toString());
            console.log('[UnifiedNav] KVP baseline count saved:', this.lastKnownKvpCount);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching KVP count for baseline:', error);
    }
  }

  // Fix logo navigation based on user role
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

  // CSS injection method
  private injectCSS(): void {
    if (!document.querySelector('#unified-navigation-styles')) {
      console.log('[UnifiedNav] Injecting CSS styles in init');
      const styleSheet = document.createElement('style');
      styleSheet.id = 'unified-navigation-styles';
      styleSheet.textContent = unifiedNavigationCSS;
      document.head.appendChild(styleSheet);

      // Force style recalculation
      void document.body.offsetHeight;
    } else {
      console.log('[UnifiedNav] CSS styles already present');
    }
  }

  // Storage Widget erstellen (nur für Root User)
  private createStorageWidget(): string {
    return `
      <div class="storage-widget" id="storage-widget">
        <div class="storage-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
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
        <button class="storage-upgrade-btn" onclick="window.location.href='/storage-upgrade'">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
          </svg>
          Speicher erweitern
        </button>
      </div>
    `;
  }

  // Storage-Informationen aktualisieren
  public async updateStorageInfo(): Promise<void> {
    if (this.currentRole !== 'root') return;

    try {
      const token = localStorage.getItem('token');
      if (!token || token === 'test-mode') return;

      const response = await fetch('/api/root/storage-info', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const { used, total, percentage } = data;

        // Update UI
        const usedElement = document.getElementById('storage-used');
        const totalElement = document.getElementById('storage-total');
        const progressBar = document.getElementById('storage-progress-bar') as HTMLElement;
        const percentageElement = document.getElementById('storage-percentage');

        if (usedElement) usedElement.textContent = this.formatBytes(used);
        if (totalElement) totalElement.textContent = this.formatBytes(total);
        if (progressBar) {
          progressBar.style.width = `${percentage}%`;

          // Farbe basierend auf Nutzung
          if (percentage >= 90) {
            progressBar.style.backgroundColor = 'var(--error-color)';
          } else if (percentage >= 70) {
            progressBar.style.backgroundColor = 'var(--warning-color)';
          } else {
            progressBar.style.backgroundColor = 'var(--success-color)';
          }
        }
        if (percentageElement) percentageElement.textContent = `${percentage}% belegt`;
      }
    } catch (error) {
      console.error('Error updating storage info:', error);
    }
  }

  // Bytes in lesbare Form konvertieren
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 GB';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  // Toast notification helper
  private showToast(message: string, type: 'success' | 'error' = 'success'): void {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      padding: 16px 24px;
      background: ${type === 'success' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)'};
      border: 1px solid ${type === 'success' ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)'};
      color: ${type === 'success' ? 'rgba(76, 175, 80, 0.9)' : 'rgba(244, 67, 54, 0.9)'};
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      font-size: 14px;
      font-weight: 500;
      backdrop-filter: blur(10px);
      animation: slideInRight 0.3s ease-out;
      display: flex;
      align-items: center;
      gap: 12px;
    `;

    // Add icon
    const icon = document.createElement('span');
    icon.innerHTML =
      type === 'success'
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
    toast.prepend(icon);

    // Add animation styles if not already added
    if (!document.getElementById('toast-animations')) {
      const style = document.createElement('style');
      style.id = 'toast-animations';
      style.textContent = `
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    // Remove after delay
    setTimeout(() => {
      toast.style.animation = 'slideOutRight 0.3s ease-in';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// CSS Styles für die Unified Navigation
const unifiedNavigationCSS = `
    /* Header Base Styles */
    .header {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 60px;
        background: rgba(255, 255, 255, 0.02);
        backdrop-filter: blur(20px) saturate(180%);
        box-shadow: var(--shadow-sm);
        display: flex;
        align-items: center;
        padding: 0 20px;
        z-index: 1000;
    }

    .header .header-content {
        flex: 1;
        display: flex;
        justify-content: flex-end;
    }

    .header .logo-container {
        display: flex;
        align-items: center;
        text-decoration: none;
        margin-right: var(--spacing-lg);
        margin-bottom: -3px;
    }

    .header .logo {
        height: 50px;
        width: auto;
        margin-left: -13px;
    }

    .header .header-actions {
        display: flex;
        align-items: center;
        gap: calc(var(--spacing-lg) + 8px);
    }

    .header .header-actions #user-info {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        /*background: rgba(255, 255, 255, 0.1);*/
        padding: var(--spacing-xs) var(--spacing-sm);
        border-radius: 20px;
        border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .header .header-actions #user-name {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 200px;
    }

    .header .header-actions #user-info::before {
        content: "";
        width: 32px;
        height: 32px;
        border-radius: 50%;
        /*background: linear-gradient(135deg, var(--primary-color), var(--primary-light));*/
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 600;
        font-size: 0.9rem;
    }

    /* Role Switch Warning Banner */
    .role-switch-banner {
        position: fixed;
        top: 60px; /* Unter der Navigation */
        left: 0;
        right: 0;
        background: rgba(255, 193, 7, 0.1);
        backdrop-filter: blur(10px);
        border-bottom: 1px solid rgba(255, 193, 7, 0.3);
        padding: 8px 20px;
        z-index: 999;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 10px rgba(255, 193, 7, 0.2);
    }

    .role-switch-banner-content {
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ff9800;
        font-size: 14px;
        max-width: 1200px;
        width: 100%;
        position: relative;
    }

    .role-switch-banner-content strong {
        color: #ffb74d;
        font-weight: 600;
    }

    .role-switch-banner-close {
        position: absolute;
        right: 0;
        background: none;
        border: none;
        color: #ff9800;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        /* transition: all 0.2s ease; */
    }

    .role-switch-banner-close:hover {
        background: rgba(255, 193, 7, 0.2);
        color: #ffb74d;
    }

    /* Adjust sidebar and main content when banner is visible */
    .role-switch-banner:not([style*="display: none"]) ~ .sidebar {
        top: 100px !important; /* 60px header + 40px banner */
        height: calc(100vh - 100px) !important;
    }

    .sidebar {
        width: 280px !important;
        background: rgba(255, 255, 255, 0);
        backdrop-filter: blur(20px);
        /*border-right: 1px solid rgba(255, 255, 255, 0.1);*/
        height: calc(100vh - 60px);
        position: fixed;
        left: 0;
        top: 60px;
        overflow-y: auto;
        overflow-x: hidden;
        /* transition: all .3s ease; */
    }

    /* Scrollbar Styling */
    .sidebar::-webkit-scrollbar {
        width: 6px;
    }

    .sidebar::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
    }

    .sidebar::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
    }

    .sidebar::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
    }

    .sidebar-nav {
        padding: var(--spacing-md);
        min-height: 100%;
        display: flex;
        flex-direction: column;
        overflow: visible;
        position: relative;
    }

    .sidebar-title {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.825rem;
        font-weight: 600;
        color: #ffd83e;
        padding: var(--spacing-sm) var(--spacing-md);
        background:rgba(234, 187, 0, 0);
        border-radius: 5px;
        border: 1.3px solid rgb(255, 203, 0);
        /* transition: all 0.3s ease; */
        cursor: pointer;
        width: 98%;
        margin-left: 1%;
        margin-right: 1%;
        text-align: center;
        position: relative;
        overflow: visible;
        /*transform: rotate(-3deg);*/
        margin-top: 23px;
    }

    /* Sticky Note folded corner - inner fold */
    .sidebar-title::after {
        content: '';
        position: absolute;
        bottom: -4px;
        right: -0.6px;
        width: 20px;
        height: 20px;
        background: linear-gradient(45deg, transparent 50%, rgba(0, 0, 0, 0.1) 50%);
        transform: rotate(45deg);
        transform-origin: bottom right;
    }

    .sidebar-title::before {
        content: '';
        position: absolute;
        bottom: -5px;
        right: -2px;
        width: 0;
        height: 0;
        border-style: solid;
        border-width: 13px 10px 4px 3px;
        border-color: #fff #00060a #0000 transparent;
        z-index: 1;
    }

    .sidebar-title:hover {
        transform: rotate(-1deg) translateY(-2px);
        box-shadow:
            0 5px 10px rgba(0, 0, 0, 0.25),
            0 2px 4px rgba(0, 0, 0, 0.15);
    }

    .sidebar-title:hover .pin-head {
        opacity: 0;
    }

    .sidebar-title:hover .pin-needle {
        opacity: 1;
        top: -18px;
    }

    .sidebar-title:active {
        transform: rotate(-1deg) translateY(0);
    }

    /* Pinned icon styles */
    .pinned-icon {
        position: absolute;
        top: -10px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 2;
    }

    /* Pin head (only the head visible - like pushed in) */
    .pin-head {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #d32f2f;
        display: block;
        position: relative;
        box-shadow:
            0 3px 6px rgba(0, 0, 0, 0.4),
            inset -2px -2px 3px rgba(0, 0, 0, 0.3),
            inset 2px 2px 3px rgba(255, 255, 255, 0.4);
        /* transition: all 0.2s ease; */
    }

    .pin-head::after {
        content: '';
        position: absolute;
        top: 4px;
        left: 4px;
        width: 6px;
        height: 6px;
        border-radius: 50%;
    }

    /* Pin needle (appears on hover - full pushpin) */
    .pin-needle {
        position: absolute;
        top: -10px;
        left: 50%;
        transform: translateX(-50%);
        opacity: 0;
        /* transition: all 0.3s ease; */
        z-index: 2;
    }

    /* Pin needle head */
    .pin-needle::before {
        content: '';
        position: absolute;
        top: -10px;
        left: 50%;
        transform: translateX(-50%);
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #d32f2f;
        box-shadow:
            0 3px 6px rgba(0, 0, 0, 0.4),
            inset -2px -2px 3px rgba(0, 0, 0, 0.3),
            inset 2px 2px 3px rgba(255, 255, 255, 0.4);
    }

    /* Pin needle shaft */
    .pin-needle::after {
        content: '';
        position: absolute;
        top: 7px;  /* Von 17px auf 8px reduziert um Lücke zu schließen */
        left: 50%;
        transform: translateX(-50%);
        width: 2px;
        height: 22px;
        background: linear-gradient(to bottom,
            #aaa 0%,
            #888 50%,
            #666 100%);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    }

    .title-content {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--spacing-sm);
        width: 100%;
        min-width: 0;
    }

    .title-text {
        /* transition: opacity 0.3s ease, width 0.3s ease; */
        white-space: nowrap;
        overflow: hidden;
    }

    /* Toggle button im Header */
    .header .sidebar-toggle {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 8px;
        cursor: pointer;
        /* transition: all 0.3s ease; */
        color: white;
        margin-right: 15px;
        margin-left: -6px;
    }

    .header .sidebar-toggle:hover {
        background: rgba(255, 255, 255, 0.09);
        transform: scale(1.05);
    }

    .sidebar-toggle:hover .toggle-icon {
        opacity: 0.8;
    }

    .toggle-icon {
        /* transition: transform 0.3s ease; */
    }

    /* Collapsed Sidebar Styles */
    .sidebar.collapsed {
        width: 100px !important;
    }

    /* Logo size adjustment when sidebar is collapsed */
    body:has(.sidebar.collapsed) .header .logo {
        height: 24px;
        width: auto;
        margin-left: -4px;
        margin-bottom: 7px;
    }

    .sidebar.collapsed .sidebar-title {
        padding: var(--spacing-sm);
        justify-content: center;
        width: calc(100% - 8px);
        font-size: 0;
        transform: rotate(-2deg);
        background: #e6b800;
        min-height: 25px;
        margin-left: 4px;
    }

    .sidebar.collapsed .title-text {
        opacity: 0;
        width: 0;
        display: none;
    }

    .sidebar.collapsed .title-content {
        gap: 0;
        justify-content: center;
    }


    .sidebar.collapsed .pinned-icon {
        top: -7px;
    }

    .sidebar.collapsed .pin-head {
        width: 16px;
        height: 16px;
    }

    .sidebar.collapsed .pin-head::after {
        width: 5px;
        height: 5px;
        top: 3px;
        left: 3px;
    }

    .sidebar.collapsed .user-info-card {
        padding: 17px;
        flex-direction: column;
        align-items: center;
        min-height: auto;
        margin-top: 20px;
        margin-bottom: 20px;
    }

    .sidebar.collapsed .user-details {
        display: none;
    }


    /* Im collapsed state NUR Label verstecken - sonst KEINE Änderungen! */
    .sidebar.collapsed .sidebar-link .label {
        display: none;
    }

    /* Collapsed state: Hover/Active NUR auf Icon */
    .sidebar.collapsed .sidebar-link {
        background: transparent;
    }

    .sidebar.collapsed .sidebar-link .icon {
        position: relative;
    }

    /* Active state - immer sichtbar mit primary color */
    .sidebar.collapsed .sidebar-item.active .sidebar-link .icon {
        color: var(--primary-color);
    }
    
    .sidebar.collapsed .sidebar-item.active .sidebar-link .icon::before {
        content: '';
        position: absolute;
        inset: -7px;
        background: linear-gradient(135deg, rgba(33, 150, 243, 0.15), rgba(33, 150, 243, 0.08));
        border-radius: 50%;
        z-index: -1;
    }

    /* Hover - Icon wird primary color */
    .sidebar.collapsed .sidebar-link:hover .icon {
        color: var(--primary-color);
    }
    
    /* Hover nur bei NICHT active */
    .sidebar.collapsed .sidebar-item:not(.active) .sidebar-link:hover .icon::before {
        content: '';
        position: absolute;
        inset: -7px;
        background: rgba(33, 150, 243, 0.1);
        border-radius: 50%;
        z-index: -1;
    }

    /* Active + Hover = stärkerer active effect */
    .sidebar.collapsed .sidebar-item.active .sidebar-link:hover .icon::before {
        background: linear-gradient(135deg, rgba(33, 150, 243, 0.25), rgba(33, 150, 243, 0.15));
    }

    .sidebar.collapsed .submenu-arrow {
        display: none;
    }

    .sidebar.collapsed .submenu {
        display: none !important;
    }

    .sidebar.collapsed .storage-widget {
        display: none;
    }

    .sidebar.collapsed .sidebar-menu {
        margin-top: 131.9px;
    }


    /* Main content adjustment for collapsed sidebar */
    .main-content.sidebar-collapsed {
        margin-left: 70px;
    }

    /* Container full width when sidebar collapsed */
    .main-content.sidebar-collapsed .container {
        max-width: none;
    }

    /* Content sections full width when sidebar collapsed */
    .main-content.sidebar-collapsed .content-section {
        max-width: none;
        width: 100%;
    }

    /* Cards inside collapsed layout use more space */
    .main-content.sidebar-collapsed .card {
        max-width: none;
    }


    /* Tooltip styles for collapsed items */
    .sidebar.collapsed .sidebar-link,
    .sidebar.collapsed .sidebar-title {
        position: relative;
    }

    .sidebar.collapsed .sidebar-link:hover::after,
    .sidebar.collapsed .sidebar-title:hover::after {
        content: attr(title);
        position: absolute;
        left: 100%;
        top: 50%;
        transform: translateY(-50%);
        margin-left: 10px;
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        border-radius: 6px;
        font-size: 14px;
        white-space: nowrap;
        z-index: 1000;
        pointer-events: none;
        opacity: 0;
        /*animation: tooltipFadeIn 0.3s ease forwards;*/
    }

    @keyframes tooltipFadeIn {
        to {
            opacity: 1;
        }
    }

    /* Badge adjustments for collapsed sidebar */
    .sidebar.collapsed .nav-badge {
        position: absolute !important;
        top: 4px !important;
        right: 4px !important;
        left: auto !important;
        font-size: 0.6rem !important;
        padding: 1px 4px !important;
        min-width: 14px !important;
    }

    /* Smooth transitions */
    .sidebar,
    .main-content,
    .sidebar-link,
    .sidebar-link .label,
    .title-text,
    .user-details,
    .storage-widget {
        /*transition: all 0.3s ease;*/
    }



    .user-info-card {
        /*display: flex;*/
        align-items: center;
        /*ap: 15px;*/
        padding: 14px 10px 15px 40px;
        background: rgba(255, 255, 255, 0.02);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        /*border: 1px solid rgba(115, 115, 115, 0.36);*/
        border-radius: var(--radius-md);
        margin-bottom: 20px;
        position: relative;
        overflow: hidden;
        /*transition: all 0.3s ease;*/
        box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        min-height: 100px;
        /*animation: fadeInUp 0.6s ease-out;*/
        margin-top: 20px;
    }

    /* Welcome hero style gradient backgrounds */
    .user-info-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background:
            radial-gradient(circle at 20% 80%, rgba(255, 255, 255, 0.06) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.06) 0%, transparent 50%);
        opacity: 1;
        z-index: 0;
    }

    .user-info-card::after {
        content: '';
        position: absolute;
        top: -50%;
        right: -20%;
        width: 200px;
        height: 200px;

        border-radius: 50%;
        z-index: 0;
    }

    .user-info-card > * {
        position: relative;
        z-index: 1;
    }

    .user-info-card:hover {
        background: rgba(255, 255, 255, 0.03);
        /*transform: translateY(-5px);*/
        border-color: rgba(33, 150, 243, 0.3);
        box-shadow:
            0 12px 40px rgba(0, 0, 0, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.15),
            0 0 40px rgba(33, 150, 243, 0.1);
    }

    /* Avatar Styles - Ohne Border */
    #sidebar-user-avatar,
    .sidebar .user-avatar,
    .user-info-card .user-avatar,
    #user-avatar {
        /*display: block !important;*/
        width: 31px !important;
        height: 31px !important;
        border-radius: 50% !important;
        object-fit: cover !important;
        border: none !important;
        flex-shrink: 0 !important;
        /* transition: all 0.3s ease; */
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        margin-left: 0px;
        overflow: hidden;
        position: relative;
    }

    /* Header avatar specific size */
    #user-avatar {
        width: 24px !important;
        height: 24px !important;
    }

    /* Avatar with initials */
    .avatar-initials {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        background: linear-gradient(135deg, #2196F3, #42a5f5) !important;
        color: white !important;
        font-weight: 600 !important;
        font-size: 0.85rem !important;
        text-transform: uppercase !important;
    }

    /* Avatar padding when sidebar is collapsed */
    .sidebar.collapsed .user-avatar {
        padding: 3px;
    }

    /* Avatar margin adjustment when sidebar is collapsed */
    .sidebar.collapsed #sidebar-user-avatar,
    .sidebar.collapsed .user-avatar,
    .sidebar.collapsed .user-info-card .user-avatar {
        margin-left: -14px !important;
    }

    .user-info-card:hover .user-avatar {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .user-details {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        align-items: flex-start;
    }

    .company-info {
        display: flex;
        align-items: baseline;
        gap: 6px;
        margin-bottom: 4px;
    }

    .company-name {
        font-weight: 600;
        color: var(--primary-light);
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        text-shadow: 0 0 20px rgba(33, 150, 243, 0.5);
        white-space: normal;
        margin-top: 8px;
    }

    .company-domain {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.5);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .user-name {
        font-weight: 500;
        color: var(--text-primary);
        font-size: 15px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.2;
    }

    .user-full-name {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.6);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .role-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 8px;
        font-size: 10px;
        font-weight: 500;
        /* transition: all 0.2s ease; */
        margin: 6px 0 0 0;
        width: fit-content;
        text-transform: uppercase;
        letter-spacing: 2px;
    }

    /* Role-specific badge colors - Exact match from logs */
    .role-badge.root {
        background: rgba(156, 39, 176, 0.15);
        color: #9C27B0;
        border: 1px solid rgba(156, 39, 176, 0.9);
        margin-left: -2px;
    }

    .role-badge.admin {
        background: rgba(3, 169, 244, 0.15);
        color: #03A9F4;
        border: 1px solid rgba(3, 169, 244, 0.9);
        margin-left: -2px;
    }

    .role-badge.employee {
        background: rgba(96, 125, 139, 0.15);
        color: #607D8B;
        border: 1px solid rgba(96, 125, 139, 0.9);
        margin-left: -2px;
    }

    /* Hover effects for role badges */
    .user-info-card:hover .role-badge.root {
        background: rgba(156, 39, 176, 0.2);
        border-color: rgba(156, 39, 176, 0.4);
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(156, 39, 176, 0.25);
    }

    .user-info-card:hover .role-badge.admin {
        background: rgba(3, 169, 244, 0.2);
        border-color: rgba(3, 169, 244, 0.4);
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(3, 169, 244, 0.25);
    }

    .user-info-card:hover .role-badge.employee {
        background: rgba(96, 125, 139, 0.2);
        border-color: rgba(96, 125, 139, 0.4);
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(96, 125, 139, 0.25);
    }

    /* Role Switch Dropdown - Using styles from dashboard-theme.css */
    /* Only adding the specific margin that's different */
    .role-switch-dropdown {
        margin-right: 12px;
    }

    .sidebar-menu {
        list-style: none;
        padding: 0;
        margin: 0;
        flex: 1;
    }

    /* .sidebar-item - Using styles from dashboard-theme.css */

    .sidebar-link {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        padding: var(--spacing-sm);
        color: var(--text-secondary);
        text-decoration: none;
        border-radius: 18px;
        position: relative;
        overflow: hidden;
        border: 1px solid transparent;
        font-size: 0.9rem;
        margin-bottom: 6px;
        height: 36px;
        box-sizing: border-box;
    }

    /* Hover/Active nur wenn NICHT collapsed */
    .sidebar:not(.collapsed) .sidebar-link:hover {
        background: rgba(33, 150, 243, 0.1);
        color: var(--primary-color);
    }

    .sidebar:not(.collapsed) .sidebar-item.active .sidebar-link {
        background: linear-gradient(135deg, rgba(33, 150, 243, 0.15), rgba(33, 150, 243, 0.08));
        color: var(--primary-color);
    }

    .sidebar-link .icon {
        min-width: 20px;
        width: 20px;
        height: 20px;
        text-align: center;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        margin-left: 0;
        /* transition: all 0.3s ease; */
    }

    .sidebar-link .label {
        font-weight: 500;
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .nav-indicator {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: transparent;
        /* transition: all 0.3s ease; */
    }

    /*.sidebar-item.active .nav-indicator {
        background: var(--primary-color);
        box-shadow: 0 0 6px rgba(33, 150, 243, 0.6);
    }*/

    .nav-ripple {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 0;
        height: 0;
        border-radius: 50%;
        background: rgba(33, 150, 243, 0.3);
        transform: translate(-50%, -50%);
        /* animation: ripple 0.6s ease-out; */
    }

    @keyframes ripple {
        to {
            width: 200px;
            height: 200px;
            opacity: 0;
        }
    }

    /* Submenu Styles */
    .sidebar-item {
        margin: 0;
        padding: 0;
    }

    .sidebar-item.has-submenu .sidebar-link {
        position: relative;
    }

    .submenu-arrow {
        margin-left: auto;
        /* transition: transform 0.3s ease; */
        opacity: 0.6;
    }

    .sidebar-item.has-submenu.open .submenu-arrow {
        transform: rotate(180deg);
    }

    .submenu {
        margin-left: 32px;
        margin-top: 4px;
        margin-bottom: 6px;
        list-style: none;
        padding: 0;
        overflow: hidden;
        /* transition: all 0.3s ease; */
    }

    .submenu-item {
        margin-bottom: 2px;
    }

    .submenu-link {
        display: inline flow-root list-item;
        padding: 8px 45px 8px 16px;
        color: var(--text-secondary);
        text-decoration: none;
        font-size: 0.85rem;
        border-radius: 12px;
        /* transition: all 0.2s ease; */
        transform: translateX(6px);
        position: relative;
    }

    .submenu-link:hover {
        background: rgba(33, 150, 243, 0.08);
        border-color: rgba(33, 150, 243, 0.15);
        transform: translateX(20px);
    }

    .submenu-link.active,
    .submenu-item.active .submenu-link {
        background: rgba(33, 150, 243, 0.08);
        color: var(--primary-color);
        border-color: rgba(33, 150, 243, 0.15);
        transform: translateX(20px);
        font-weight: 600;
    }

    /* Layout adjustments */
    .layout-container {
        display: flex;
        min-height: 100vh;
        padding-top: 87px; /* Space for fixed header */
    }

    .main-content {
        flex: 1;
        margin-left: 280px;
        padding: var(--spacing-xl);
        background: var(--background-primary);
        min-height: calc(100vh - 60px);
    }

    /* Storage Widget - Glassmorphismus Style */
    .storage-widget {
        /*position: sticky;*/
        bottom: 0;
        margin: var(--spacing-md);
        /*margin-top: auto;*/
        margin-top: 40px;
        background: rgba(255, 255, 255, 0.03);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        border: 1px solid hsla(0,0%,100%,.1);
        border-radius: var(--radius-md);
        padding: var(--spacing-md);
        box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        /* transition: all 0.3s ease; */
    }

    .storage-widget:hover {
        background: rgba(255, 255, 255, 0.05);
        transform: translateY(-2px);
        box-shadow:
            0 10px 40px rgba(33, 150, 243, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
    }

    .storage-header {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        margin-bottom: var(--spacing-md);
        color: var(--primary-color);
        font-weight: 600;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .storage-info {
        margin-bottom: var(--spacing-md);
    }

    .storage-usage-text {
        font-size: 13px;
        color: var(--text-secondary);
        margin-bottom: var(--spacing-sm);
    }

    .storage-usage-text span {
        color: var(--text-primary);
        font-weight: 600;
    }

    .storage-progress {
        width: 100%;
        height: 8px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: var(--spacing-xs);
        box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
    }

    .storage-progress-bar {
        height: 100%;
        background: var(--success-color);
        border-radius: 4px;
        /* transition: width 0.5s ease, background-color 0.3s ease; */
        position: relative;
        overflow: hidden;
    }

    .storage-progress-bar::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        right: 0;
        background: linear-gradient(
            45deg,
            transparent 25%,
            rgba(255, 255, 255, 0.2) 25%,
            rgba(255, 255, 255, 0.2) 50%,
            transparent 50%,
            transparent 75%,
            rgba(255, 255, 255, 0.2) 75%,
            rgba(255, 255, 255, 0.2)
        );
        background-size: 20px 20px;
        /* animation: progress-stripes 1s linear infinite; */
    }

    @keyframes progress-stripes {
        0% {
            background-position: 0 0;
        }
        100% {
            background-position: 20px 20px;
        }
    }

    .storage-percentage {
        font-size: 12px;
        color: var(--text-secondary);
        text-align: right;
    }

    .storage-upgrade-btn {
        width: 100%;
        padding: var(--spacing-sm) var(--spacing-md);
        background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
        color: white;
        border: none;
        border-radius: var(--radius-sm);
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        /* transition: all 0.3s ease; */
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--spacing-xs);
        box-shadow:
            0 2px 8px rgba(33, 150, 243, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
    }

    .storage-upgrade-btn:hover {
        transform: translateY(-2px);
        box-shadow:
            0 6px 20px rgba(33, 150, 243, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
    }

    /* Responsive Design */
    @media (max-width: 768px) {
        .sidebar {
            width: 100%;
            transform: translateX(-100%);
            top: 60px;
        }

        .sidebar.mobile-open {
            transform: translateX(0);
        }

        .main-content {
            margin-left: 0;
        }

        .layout-container {
            flex-direction: column;
        }

        .storage-widget {
            position: relative;
            bottom: auto;
            left: auto;
            right: auto;
            margin-top: var(--spacing-lg);
        }
    }
`;

// CSS automatisch einbinden
if (!document.querySelector('#unified-navigation-styles')) {
  console.log('[UnifiedNav] Injecting CSS styles');
  const styleSheet = document.createElement('style');
  styleSheet.id = 'unified-navigation-styles';
  styleSheet.textContent = unifiedNavigationCSS;
  document.head.appendChild(styleSheet);
} else {
  console.log('[UnifiedNav] CSS styles already present');
}

// Export to window for backwards compatibility

// Global function for submenu toggle
interface NavigationWindow extends Window {
  toggleSubmenu: (event: Event, itemId: string) => void;
}

(window as unknown as NavigationWindow).toggleSubmenu = function (event: Event, itemId: string) {
  event.preventDefault();
  event.stopPropagation();

  const submenu = document.getElementById(`submenu-${itemId}`);
  const parentItem = submenu?.closest('.sidebar-item');

  if (submenu && parentItem) {
    const isOpen = submenu.style.display === 'block';

    // Close all other submenus
    document.querySelectorAll('.submenu').forEach((menu) => {
      if (menu !== submenu) {
        (menu as HTMLElement).style.display = 'none';
        menu.closest('.sidebar-item')?.classList.remove('open');
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
const setupPeriodicUpdates = () => {
  // Ungelesene Nachrichten beim Start und periodisch aktualisieren
  if (window.unifiedNav && typeof window.unifiedNav.updateUnreadMessages === 'function') {
    void window.unifiedNav.updateUnreadMessages();
    setInterval(() => {
      void window.unifiedNav?.updateUnreadMessages();
    }, 30000); // Alle 30 Sekunden
  }

  // Offene Umfragen beim Start und periodisch aktualisieren
  if (
    window.unifiedNav &&
    'updatePendingSurveys' in window.unifiedNav &&
    typeof window.unifiedNav.updatePendingSurveys === 'function'
  ) {
    void window.unifiedNav.updatePendingSurveys();
    setInterval(() => {
      void window.unifiedNav?.updatePendingSurveys?.();
    }, 30000); // Alle 30 Sekunden
  }

  // Storage-Informationen für Root User beim Start und periodisch aktualisieren
  if (
    window.unifiedNav &&
    'updateStorageInfo' in window.unifiedNav &&
    typeof window.unifiedNav.updateStorageInfo === 'function'
  ) {
    void window.unifiedNav.updateStorageInfo();
    setInterval(() => {
      void window.unifiedNav?.updateStorageInfo?.();
    }, 60000); // Alle 60 Sekunden
  }
};

// Call setup after initialization
setTimeout(setupPeriodicUpdates, 100);

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
  const banner = document.getElementById('role-switch-warning-banner');
  if (banner) {
    banner.style.display = 'none';

    // Save dismissal state
    const activeRole = localStorage.getItem('activeRole');
    if (activeRole) {
      const bannerDismissedKey = `roleSwitchBannerDismissed_${activeRole}`;
      localStorage.setItem(bannerDismissedKey, 'true');
    }

    // Reset sidebar position
    const sidebar = document.querySelector('.sidebar') as HTMLElement;
    if (sidebar) {
      sidebar.style.top = '';
      sidebar.style.height = '';
    }
  }
};

// Export for ES modules
export default UnifiedNavigation;
