<script lang="ts">
  /**
   * App Layout - Dashboard Navigation
   * @module (app)/+layout
   *
   * SSR ARCHITECTURE:
   * - User/tenant data loaded ONCE in +layout.server.ts (no client-side fetch)
   * - Auth redirects handled server-side (no window.location)
   * - Client-side: token timer, session management, logout only
   */
  import { onDestroy, onMount, type Snippet } from 'svelte';

  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/stores';

  import Breadcrumb from '$lib/components/Breadcrumb.svelte';
  import NotificationBadge from '$lib/components/NotificationBadge.svelte';
  import RoleSwitch from '$lib/components/RoleSwitch.svelte';
  import { notificationStore } from '$lib/stores/notification.store.svelte';
  import { getApiClient } from '$lib/utils/api-client';
  import { getAvatarColorClass, getProfilePictureUrl } from '$lib/utils/avatar-helpers';
  import { createLogger } from '$lib/utils/logger';
  import { perf, logPageLoadTiming, logResourceTiming } from '$lib/utils/perf-logger';
  import { getRoleSyncManager, type RoleSyncManager } from '$lib/utils/role-sync.svelte';
  import { getSessionManager, type SessionManager } from '$lib/utils/session-manager';
  import { getTokenManager } from '$lib/utils/token-manager';
  import { clearUserCache } from '$lib/utils/user-service';

  import type { LayoutData } from './$types';

  import '../../styles/unified-navigation.css';

  const log = createLogger('AppLayout');

  /**
   * Resolve dynamic path with base prefix.
   * Type assertion needed for runtime-computed paths that can't be
   * statically typed by SvelteKit's route system.
   */
  function resolveDynamicPath(path: string): string {
    // Dynamic paths computed at runtime can't match SvelteKit's static route types.
    // This is intentional - we need to resolve paths from data/config, not just literals.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    return resolve(path as any, {});
  }

  const apiClient = getApiClient();

  // =============================================================================
  // SSR DATA - Loaded server-side in +layout.server.ts
  // User/tenant data is INSTANTLY available - no loading states!
  // Auth redirects already handled server-side - no window.location needed
  // =============================================================================

  interface Props {
    data: LayoutData;
    children: Snippet;
  }

  const { data, children }: Props = $props();

  // SSR provides isAuthenticated - if we reached this point, we're authenticated
  // (server-side redirect already happened if not authenticated)
  const isAuthenticated = $derived(data.isAuthenticated);

  // User from SSR (loaded once server-side, available instantly)
  const ssrUser = $derived(data.user ?? null);
  const ssrTenant = $derived(data.tenant ?? null);

  // User State - initialize from SSR data to prevent hydration FOUC
  // INTENTIONAL: We capture initial data.user to match SSR render.
  // Future updates are handled by $effect (line ~118) that syncs ssrUser → user.
  // svelte-ignore state_referenced_locally
  let user = $state<{
    id?: number;
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: 'root' | 'admin' | 'employee';
    employeeNumber?: string;
    profilePicture?: string;
    position?: string;
  } | null>(data.user ?? null);

  // Role Switch State (original role vs active role after switching)
  // INTENTIONAL: Capture initial SSR value to prevent hydration FOUC.
  // localStorage override for role-switching persistence happens in initializeFromSSR().
  // svelte-ignore state_referenced_locally
  let userRole = $state<'root' | 'admin' | 'employee'>(data.user?.role ?? 'employee');
  // svelte-ignore state_referenced_locally
  let activeRole = $state<'root' | 'admin' | 'employee'>(data.user?.role ?? 'employee');

  // Sidebar State
  let sidebarCollapsed = $state(false);
  let openSubmenu = $state<string | null>(null);

  // Token Timer State
  let tokenTimeLeft = $state('--:--');
  let tokenWarning = $state(false);
  let tokenExpired = $state(false);
  let tokenTimerUnsubscribe = $state<(() => void) | null>(null);

  // Logout Modal State
  let showLogoutModal = $state(false);

  // Tenant Info - initialize from SSR data to prevent hydration FOUC
  // INTENTIONAL: Capture initial SSR value. Updates via ssrTenant → effect sync.
  // svelte-ignore state_referenced_locally
  let tenant = $state<{ id?: number; companyName?: string } | null>(data.tenant ?? null);

  // Session Manager instance (for cleanup on destroy)
  let sessionManagerInstance = $state<SessionManager | null>(null);

  // Role Sync Manager instance (for cross-tab synchronization)
  let roleSyncManagerInstance = $state<RoleSyncManager | null>(null);

  // Current role for navigation (uses activeRole from role switch)
  // activeRole reflects the current view, which may differ from original userRole
  const currentRole = $derived(activeRole);

  // Sync SSR user data to local state on invalidateAll() / navigation
  // This ensures UI updates immediately after PATCH /users/me
  $effect(() => {
    if (ssrUser !== null) {
      user = ssrUser;
    }
  });

  // =============================================================================
  // NAVIGATION MENU CONFIG
  // =============================================================================

  /** Navigation item type */
  interface NavItem {
    id: string;
    icon?: string;
    label: string;
    url?: string;
    hasSubmenu?: boolean;
    submenu?: NavItem[];
    /** Badge type for real-time notification count */
    badgeType?: 'surveys' | 'documents' | 'kvp' | 'chat' | 'blackboard' | 'calendar';
  }

  const ICONS: Record<string, string> = {
    home: '<i class="fas fa-home"></i>',
    pin: '<i class="fas fa-thumbtack"></i>',
    users: '<i class="fas fa-users"></i>',
    team: '<i class="fas fa-user-friends"></i>',
    generator: '<i class="fas fa-cogs"></i>',
    document: '<i class="fas fa-file-alt"></i>',
    calendar: '<i class="fas fa-calendar-alt"></i>',
    lean: '<i class="fas fa-chart-line"></i>',
    clock: '<i class="fas fa-clock"></i>',
    chat: '<i class="fas fa-comments"></i>',
    settings: '<i class="fas fa-cog"></i>',
    user: '<i class="fas fa-user"></i>',
    'user-shield': '<i class="fas fa-user-shield"></i>',
    admin: '<i class="fas fa-user-tie"></i>',
    sitemap: '<i class="fas fa-sitemap"></i>',
    building: '<i class="fas fa-building"></i>',
    feature: '<i class="fas fa-puzzle-piece"></i>',
    logs: '<i class="fas fa-list-alt"></i>',
    folder: '<i class="fas fa-folder"></i>',
    lightbulb: '<i class="fas fa-lightbulb"></i>',
    poll: '<i class="fas fa-poll"></i>',
  };

  const rootMenuItems = $derived<NavItem[]>([
    { id: 'dashboard', icon: ICONS.home, label: 'Root Dashboard', url: '/root-dashboard' },
    {
      id: 'blackboard',
      icon: ICONS.pin,
      label: 'Schwarzes Brett',
      hasSubmenu: true,
      submenu: [
        {
          id: 'blackboard-main',
          label: 'Schwarzes Brett',
          url: '/blackboard',
          badgeType: 'blackboard',
        },
        {
          id: 'blackboard-archive',
          label: 'Archiv',
          url: '/blackboard/archived',
        },
      ],
    },
    { id: 'root-users', icon: ICONS['user-shield'], label: 'Root User', url: '/manage-root' },
    { id: 'admins', icon: ICONS.admin, label: 'Administratoren', url: '/manage-admins' },
    { id: 'areas', icon: ICONS.sitemap, label: 'Bereiche', url: '/manage-areas' },
    { id: 'departments', icon: ICONS.building, label: 'Abteilungen', url: '/manage-departments' },
    { id: 'chat', icon: ICONS.chat, label: 'Chat', url: '/chat', badgeType: 'chat' },
    { id: 'features', icon: ICONS.feature, label: 'Features', url: '/features' },
    { id: 'logs', icon: ICONS.logs, label: 'System-Logs', url: '/logs' },
    { id: 'profile', icon: ICONS.user, label: 'Mein Profil', url: '/root-profile' },
    {
      id: 'system',
      icon: ICONS.settings,
      label: 'System',
      hasSubmenu: true,
      submenu: [{ id: 'account-settings', label: 'Kontoeinstellungen', url: '/account-settings' }],
    },
  ]);

  const adminMenuItems = $derived<NavItem[]>([
    { id: 'dashboard', icon: ICONS.home, label: 'Übersicht', url: '/admin-dashboard' },
    {
      id: 'blackboard',
      icon: ICONS.pin,
      label: 'Schwarzes Brett',
      hasSubmenu: true,
      submenu: [
        {
          id: 'blackboard-main',
          label: 'Schwarzes Brett',
          url: '/blackboard',
          badgeType: 'blackboard',
        },
        {
          id: 'blackboard-archive',
          label: 'Archiv',
          url: '/blackboard/archived',
        },
      ],
    },
    { id: 'employees', icon: ICONS.users, label: 'Mitarbeiter', url: '/manage-employees' },
    { id: 'teams', icon: ICONS.team, label: 'Teams', url: '/manage-teams' },
    { id: 'machines', icon: ICONS.generator, label: 'Maschinen', url: '/manage-machines' },
    {
      id: 'documents',
      icon: ICONS.document,
      label: 'Dokumente',
      hasSubmenu: true,
      submenu: [
        {
          id: 'documents-explorer',
          label: 'Datei Explorer',
          url: '/documents-explorer',
          badgeType: 'documents',
        },
      ],
    },
    {
      id: 'calendar',
      icon: ICONS.calendar,
      label: 'Kalender',
      url: '/calendar',
      badgeType: 'calendar',
    },
    {
      id: 'lean-management',
      icon: ICONS.lean,
      label: 'LEAN-Management',
      hasSubmenu: true,
      submenu: [
        { id: 'kvp', label: 'KVP System', url: '/kvp', badgeType: 'kvp' },
        { id: 'surveys', label: 'Umfragen', url: '/survey-admin', badgeType: 'surveys' },
      ],
    },
    { id: 'shifts', icon: ICONS.clock, label: 'Schichtplanung', url: '/shifts' },
    { id: 'chat', icon: ICONS.chat, label: 'Chat', url: '/chat', badgeType: 'chat' },
    { id: 'settings', icon: ICONS.settings, label: 'Einstellungen', url: '#settings' },
    { id: 'profile', icon: ICONS.user, label: 'Mein Profil', url: '/admin-profile' },
  ]);

  const employeeMenuItems = $derived<NavItem[]>([
    { id: 'dashboard', icon: ICONS.home, label: 'Dashboard', url: '/employee-dashboard' },
    {
      id: 'blackboard',
      icon: ICONS.pin,
      label: 'Schwarzes Brett',
      url: '/blackboard',
      badgeType: 'blackboard',
    },
    {
      id: 'documents',
      icon: ICONS.document,
      label: 'Dokumente',
      hasSubmenu: true,
      submenu: [
        {
          id: 'documents-explorer',
          label: 'Datei Explorer',
          url: '/documents-explorer',
          badgeType: 'documents',
        },
      ],
    },
    {
      id: 'calendar',
      icon: ICONS.calendar,
      label: 'Kalender',
      url: '/calendar',
      badgeType: 'calendar',
    },
    {
      id: 'lean-management',
      icon: ICONS.lean,
      label: 'LEAN-Management',
      hasSubmenu: true,
      submenu: [
        { id: 'kvp', label: 'KVP System', url: '/kvp', badgeType: 'kvp' },
        { id: 'surveys', label: 'Umfragen', url: '/survey-employee', badgeType: 'surveys' },
      ],
    },
    { id: 'chat', icon: ICONS.chat, label: 'Chat', url: '/chat', badgeType: 'chat' },
    { id: 'shifts', icon: ICONS.clock, label: 'Schichtplanung', url: '/shifts' },
    { id: 'profile', icon: ICONS.user, label: 'Mein Profil', url: '/employee-profile' },
  ]);

  const menuItems = $derived<NavItem[]>(
    currentRole === 'root'
      ? rootMenuItems
      : currentRole === 'admin'
        ? adminMenuItems
        : employeeMenuItems,
  );

  // =============================================================================
  // HELPER FUNCTIONS
  // =============================================================================

  /** Get user initials for avatar */
  function getInitials(): string {
    if (!user) return 'U';
    const first = user.firstName?.charAt(0) ?? '';
    const last = user.lastName?.charAt(0) ?? '';
    return (first + last).toUpperCase() || 'U';
  }

  /** Get display name */
  function getDisplayName(): string {
    if (user === null) return 'User';
    const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    if (fullName !== '') return fullName;
    if (user.email !== undefined && user.email !== '') return user.email;
    return 'User';
  }

  /** Get role badge class */
  function getRoleBadgeClass(): string {
    if (currentRole === 'root') return 'badge--danger';
    if (currentRole === 'admin') return 'badge--warning';
    return 'badge--info';
  }

  /** Get role badge text */
  function getRoleBadgeText(): string {
    if (currentRole === 'root') return 'Root';
    if (currentRole === 'admin') return 'Admin';
    return 'Mitarbeiter';
  }

  /** Check if menu item is active */
  function isActive(item: NavItem): boolean {
    const currentPath = $page.url.pathname;
    if (item.url !== undefined && item.url !== '') {
      return currentPath === item.url || currentPath.startsWith(item.url + '/');
    }
    if (item.submenu !== undefined) {
      return item.submenu.some((sub) => {
        if (sub.url === undefined || sub.url === '') return false;
        return currentPath === sub.url || currentPath.startsWith(sub.url + '/');
      });
    }
    return false;
  }

  // =============================================================================
  // API FUNCTIONS
  // =============================================================================

  /**
   * Logout user
   * Uses goto() for client-side navigation (no window.location)
   */
  async function logout(): Promise<void> {
    try {
      // Call logout API first (while we still have a valid token)
      await apiClient.post('/auth/logout');
    } catch (err) {
      log.error({ err }, 'Logout API error (continuing with logout)');
    }

    // CRITICAL: Reset ALL Svelte state to prevent stale data on re-login
    user = null;
    userRole = 'employee';
    activeRole = 'employee';
    tenant = null;

    // Clear shared user cache (prevents stale data on re-login)
    clearUserCache();

    // Clear all tokens and role data from localStorage
    localStorage.removeItem('userRole');
    localStorage.removeItem('activeRole');
    localStorage.removeItem('token'); // Legacy token
    localStorage.removeItem('accessToken');
    // NOTE: refreshToken is in HttpOnly cookie, cleared by backend on /auth/logout
    localStorage.removeItem('tokenReceivedAt');
    localStorage.removeItem('user');

    // Note: TokenManager in-memory state will be stale, but page navigation
    // will reinitialize it. No need to call clearTokens() which would trigger
    // a window.location redirect that we want to avoid.

    // Use SvelteKit's goto() for client-side navigation (no full page reload)
    await goto('/login', { replaceState: true });
  }

  // =============================================================================
  // TOKEN TIMER
  // =============================================================================

  /**
   * Handle token timer update from TokenManager.
   * Uses TokenManager's relative time calculation (no clock skew!)
   */
  function handleTokenTimerUpdate(remainingSeconds: number): void {
    if (remainingSeconds <= 0) {
      tokenTimeLeft = '00:00';
      tokenExpired = true;
      tokenWarning = false;
      return;
    }

    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    tokenTimeLeft = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    tokenWarning = remainingSeconds <= 120; // 2 minutes warning
    tokenExpired = false;
  }

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  /** Toggle sidebar collapsed state */
  function toggleSidebar(): void {
    sidebarCollapsed = !sidebarCollapsed;
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
    // Close all submenus when collapsing sidebar
    if (sidebarCollapsed) {
      openSubmenu = null;
    }
  }

  /** Toggle submenu */
  function toggleSubmenu(itemId: string): void {
    // Don't open submenus when sidebar is collapsed
    if (sidebarCollapsed) return;
    openSubmenu = openSubmenu === itemId ? null : itemId;
  }

  /** Calculate aggregated badge count for all submenu items */
  function getSubmenuBadgeCount(submenu: NavItem[] | undefined): number {
    if (!submenu) return 0;
    return submenu.reduce((total, item) => {
      if (item.badgeType) {
        return total + notificationStore.counts[item.badgeType];
      }
      return total;
    }, 0);
  }

  /** Handle logout button click */
  function handleLogoutClick(): void {
    showLogoutModal = true;
  }

  /** Confirm logout */
  function confirmLogout(): void {
    showLogoutModal = false;
    void logout();
  }

  /** Cancel logout */
  function cancelLogout(): void {
    showLogoutModal = false;
  }

  // =============================================================================
  // LIFECYCLE
  // =============================================================================

  /**
   * Initialize client-side state from SSR data
   * SSR provides user/tenant data - we only need to:
   * 1. Sync SSR data to local state
   * 2. Load UI preferences from localStorage (sidebar, role switch)
   * 3. Start client-side services (token timer, session manager)
   */
  function initializeFromSSR(): void {
    // 1. Sync SSR user/tenant data to local state
    if (ssrUser) {
      user = ssrUser;
      tenant = ssrTenant;

      // Set role from SSR user data
      const role = ssrUser.role;
      userRole = role;

      // Check if activeRole was stored (for role switching persistence)
      const storedActiveRole = localStorage.getItem('activeRole');
      if (
        storedActiveRole === 'root' ||
        storedActiveRole === 'admin' ||
        storedActiveRole === 'employee'
      ) {
        activeRole = storedActiveRole;
      } else {
        activeRole = role;
      }

      // Persist role to localStorage for role switching component
      localStorage.setItem('userRole', role);
      if (storedActiveRole === null) {
        localStorage.setItem('activeRole', role);
      }
    }

    // 2. Load UI preferences from localStorage
    const savedCollapsed = localStorage.getItem('sidebarCollapsed');
    if (savedCollapsed === 'true') {
      sidebarCollapsed = true;
    }
  }

  onMount(() => {
    const endLayoutMount = perf.start('layout:mount:total');

    // Initialize state from SSR data
    perf.timeSync('layout:initializeFromSSR', () => {
      initializeFromSSR();
    });

    // Subscribe to TokenManager timer updates (uses relative time - no clock skew!)
    // Also handles token expiration events
    perf.timeSync('layout:tokenManager:init', () => {
      const tokenManager = getTokenManager();

      // Subscribe to timer updates (fires every second with remaining seconds)
      tokenTimerUnsubscribe = tokenManager.onTimerUpdate(handleTokenTimerUpdate);

      // Subscribe to token expiration events
      tokenManager.onTokenExpired(() => {
        log.warn({}, 'Token expired during session, redirecting to login');
        void goto('/login', { replaceState: true });
      });
    });

    // Initialize Session Manager (handles inactivity timeout + warning modal)
    perf.timeSync('layout:sessionManager:init', () => {
      sessionManagerInstance = getSessionManager();
    });

    // Initialize Role Sync Manager (handles cross-tab role synchronization)
    // When another tab switches role, this callback updates local state
    perf.timeSync('layout:roleSyncManager:init', () => {
      roleSyncManagerInstance = getRoleSyncManager();
      roleSyncManagerInstance.init((newRole: string, token?: string) => {
        log.warn({ newRole }, 'Role changed in another tab');

        // Update local state - the manager handles redirect/reload
        if (newRole === 'root' || newRole === 'admin' || newRole === 'employee') {
          activeRole = newRole;
        }

        // Update token if provided
        if (token !== undefined && token !== '') {
          localStorage.setItem('accessToken', token);
        }
      });
    });

    // Initialize notification counts from SSR data (0ms!) or fetch client-side (fallback)
    perf.timeSync('layout:notifications:init', () => {
      if (data.dashboardCounts !== null) {
        // SSR path: counts already fetched server-side, just sync to store
        notificationStore.initFromSSR(data.dashboardCounts);
      } else {
        // Fallback: fetch client-side if SSR didn't provide counts
        void notificationStore.loadInitialCounts();
      }
    });

    perf.timeSync('layout:sse:connect', () => {
      notificationStore.connect();
    });

    endLayoutMount();

    // Log page load timing after everything is mounted
    // Use setTimeout to ensure all resources are loaded
    setTimeout(() => {
      logPageLoadTiming();
      logResourceTiming('/api/');
      perf.logSummary();
    }, 100);
  });

  onDestroy(() => {
    // Unsubscribe from TokenManager timer updates
    if (tokenTimerUnsubscribe !== null) {
      tokenTimerUnsubscribe();
    }
    // Cleanup SessionManager
    if (sessionManagerInstance !== null) {
      sessionManagerInstance.destroy();
    }
    // Cleanup RoleSyncManager
    if (roleSyncManagerInstance !== null) {
      roleSyncManagerInstance.destroy();
    }
    // Disconnect SSE
    notificationStore.disconnect();
  });
</script>

<!-- =============================================================================
     SECURITY: AUTH GUARD - Block ALL content until authenticated
     CRITICAL: Prevents sensitive data flash on browser back navigation
     ============================================================================= -->
{#if isAuthenticated}
  <!-- Header -->
  <header class="header">
    <button
      type="button"
      class="sidebar-toggle"
      onclick={toggleSidebar}
      title="Sidebar ein-/ausklappen"
    >
      <svg class="toggle-icon" width="30" height="30" viewBox="0 0 24 24" fill="white">
        {#if sidebarCollapsed}
          <path d="M4,6H20V8H4V6M4,11H15V13H4V11M4,16H20V18H4V16Z"></path>
        {:else}
          <path d="M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z"></path>
        {/if}
      </svg>
    </button>

    <a href={resolveDynamicPath(`/${currentRole}-dashboard`)} class="logo-container">
      {#if sidebarCollapsed}
        <img src="/images/logo_collapsed.png" alt="Assixx Logo" class="logo" id="header-logo" />
      {:else}
        <img src="/images/logo.png" alt="Assixx Logo" class="logo" id="header-logo" />
      {/if}
    </a>

    <div class="header-content">
      <div class="header-actions">
        <!-- Role Switch Dropdown (only for root/admin users) -->
        {#if userRole === 'root' || userRole === 'admin'}
          <RoleSwitch {userRole} {activeRole} />
        {/if}

        <span
          class="token-timer"
          class:token-timer--warning={tokenWarning}
          class:token-timer--expired={tokenExpired}
        >
          {tokenTimeLeft}
        </span>

        <div id="user-info">
          {#if user?.profilePicture}
            <div class="avatar avatar--md">
              <img
                src={getProfilePictureUrl(user.profilePicture)}
                alt={getDisplayName()}
                class="avatar__image"
              />
            </div>
          {:else}
            <div class="avatar avatar--md {getAvatarColorClass(user?.id)}">
              <span class="avatar__initials">{getInitials()}</span>
            </div>
          {/if}
          <span id="user-name">{getDisplayName()}</span>
        </div>

        <button
          type="button"
          id="logout-btn"
          class="btn btn-danger"
          onclick={handleLogoutClick}
          title="Abmelden"
          aria-label="Abmelden"
        >
          <i class="fas fa-sign-out-alt"></i>
        </button>
      </div>
    </div>
  </header>

  <!-- Main Layout -->
  <div class="layout-container">
    <!-- Sidebar -->
    <aside class="sidebar" class:collapsed={sidebarCollapsed}>
      <nav class="sidebar-nav">
        <ul class="sidebar-menu">
          {#each menuItems as item (item.id)}
            {#if item.hasSubmenu === true && item.submenu !== undefined}
              <li
                class="sidebar-item has-submenu"
                class:active={isActive(item)}
                class:open={openSubmenu === item.id}
              >
                <button
                  type="button"
                  class="sidebar-link"
                  onclick={() => {
                    toggleSubmenu(item.id);
                  }}
                >
                  <span class="icon" style="position: relative;">
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -- Icons are hardcoded ICONS object, safe -->
                    {@html item.icon}
                    {#if openSubmenu !== item.id}
                      <NotificationBadge count={getSubmenuBadgeCount(item.submenu)} size="sm" />
                    {/if}
                  </span>
                  <span class="label">{item.label}</span>
                  <span class="submenu-arrow">
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7 10l5 5 5-5z" />
                    </svg>
                  </span>
                </button>
                <ul class="submenu" class:u-hidden={openSubmenu !== item.id}>
                  {#each item.submenu as subItem (subItem.id)}
                    <li class="submenu-item">
                      <a href={resolveDynamicPath(subItem.url ?? '')} class="submenu-link">
                        <span>{subItem.label}</span>
                        {#if subItem.badgeType && openSubmenu === item.id}
                          <NotificationBadge
                            count={notificationStore.counts[subItem.badgeType]}
                            size="sm"
                            position="inline"
                          />
                        {/if}
                      </a>
                    </li>
                  {/each}
                </ul>
              </li>
            {:else}
              <li class="sidebar-item" class:active={isActive(item)}>
                <a href={resolveDynamicPath(item.url ?? '')} class="sidebar-link">
                  <span class="icon" style="position: relative;">
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -- Hardcoded ICONS, safe -->
                    {@html item.icon}
                    {#if item.badgeType}
                      <NotificationBadge
                        count={notificationStore.counts[item.badgeType]}
                        size="sm"
                      />
                    {/if}
                  </span>
                  <span class="label">{item.label}</span>
                </a>
              </li>
            {/if}
          {/each}
        </ul>

      </nav>

      <!-- User Info Card -->
      <div class="user-info-card">
        {#if user?.profilePicture}
          <div class="avatar avatar--md">
            <img
              src={getProfilePictureUrl(user.profilePicture)}
              alt={getDisplayName()}
              class="avatar__image"
            />
          </div>
        {:else}
          <div class="avatar avatar--md {getAvatarColorClass(user?.id)}">
            <span class="avatar__initials">{getInitials()}</span>
          </div>
        {/if}
        <div class="user-details">
          <div class="company-info">
            <div class="company-name">{tenant?.companyName ?? 'Firma'}</div>
          </div>
          <div class="user-name">{getDisplayName()}</div>
          {#if user?.email}
            <div class="user-email">{user.email}</div>
          {/if}
          {#if user?.position}
            <div class="user-position">{user.position}</div>
          {/if}
          {#if user?.employeeNumber}
            <span class="employee-number__text">{user.employeeNumber}</span>
          {/if}
          <span class="badge badge--sm {getRoleBadgeClass()}">{getRoleBadgeText()}</span>
        </div>
      </div>

      <!-- Storage Widget (Root only) -->
      {#if currentRole === 'root'}
        <div class="storage-widget">
          <div class="storage-header">
            <i class="fas fa-database"></i>
            <span>Speicherplatz</span>
          </div>
          <div class="storage-info">
            <div class="storage-usage-text">
              <span>-- GB</span> von <span>-- GB</span>
            </div>
            <div class="storage-progress">
              <div class="storage-progress-bar" style="width: 0%"></div>
            </div>
            <div class="storage-percentage">0% belegt</div>
          </div>
        </div>
      {/if}
    </aside>

    <!-- Main Content (Child Routes) -->
    <main class="flex-1 min-h-[calc(100vh-60px)] p-4 bg-[var(--background-primary)]">
      <!-- Breadcrumb Navigation (wrapped for fullscreen CSS selector) -->
      <div id="breadcrumb-container">
        <Breadcrumb userRole={currentRole} />
      </div>

      <!-- Page Content -->
      {@render children()}
    </main>
  </div>

  <!-- Logout Confirmation Modal -->
  {#if showLogoutModal}
    <div class="modal-overlay modal-overlay--active">
      <div class="confirm-modal confirm-modal--info" style="bottom: 10%;">
        <div class="confirm-modal__icon">
          <i class="fas fa-sign-out-alt"></i>
        </div>
        <h3 class="confirm-modal__title">Abmeldung bestätigen</h3>
        <p class="confirm-modal__message">
          Möchten Sie sich wirklich abmelden?<br />
          <small
            ><i class="fas fa-info-circle"></i> Alle ungespeicherten Änderungen gehen verloren.</small
          >
        </p>
        <div class="confirm-modal__actions confirm-modal__actions--centered">
          <button
            type="button"
            class="confirm-modal__btn confirm-modal__btn--cancel confirm-modal__btn--wide"
            onclick={cancelLogout}
          >
            Abbrechen
          </button>
          <button
            type="button"
            class="btn btn-danger confirm-modal__btn--wide"
            onclick={confirmLogout}
          >
            Abmelden
          </button>
        </div>
      </div>
    </div>
  {/if}
{/if}
<!-- END: AUTH GUARD -->
