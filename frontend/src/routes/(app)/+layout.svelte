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
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import { notificationStore } from '$lib/stores/notification.store.svelte';
  import { getApiClient } from '$lib/utils/api-client';
  import {
    getAvatarColorClass,
    getProfilePictureUrl,
  } from '$lib/utils/avatar-helpers';
  import { createLogger } from '$lib/utils/logger';
  import {
    perf,
    logPageLoadTiming,
    logResourceTiming,
  } from '$lib/utils/perf-logger';
  import {
    getRoleSyncManager,
    type RoleSyncManager,
  } from '$lib/utils/role-sync.svelte';
  import {
    getSessionManager,
    type SessionManager,
  } from '$lib/utils/session-manager';
  import { getTokenManager } from '$lib/utils/token-manager';
  import { clearUserCache } from '$lib/utils/user-service';

  import {
    filterMenuByAccess,
    getMenuItemsForRole,
    type NavItem,
  } from './_lib/navigation-config';

  import type { LayoutData } from './$types';

  import '../../styles/unified-navigation.css';

  const log = createLogger('AppLayout');

  /**
   * Resolve dynamic path with base prefix.
   * Type assertion needed for runtime-computed paths that can't be
   * statically typed by SvelteKit's route system.
   */
  function resolveDynamicPath(path: string): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument -- Dynamic paths can't match SvelteKit's static route types
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

  // Immediate client-side init (hydration) - ensures role switch banner shows instantly
  const getStorageValue = (key: string): string | null =>
    typeof window === 'undefined' ? null : localStorage.getItem(key);

  const getInitialActiveRole = (): 'root' | 'admin' | 'employee' => {
    const stored = getStorageValue('activeRole');
    return stored === 'root' || stored === 'admin' || stored === 'employee' ?
        stored
      : (data.user?.role ?? 'employee');
  };

  const isBannerDismissed = (role: string): boolean =>
    getStorageValue(`roleSwitchBannerDismissed_${role}`) === 'true';

  // Role Switch State - activeRole read from localStorage IMMEDIATELY during hydration
  // svelte-ignore state_referenced_locally
  let userRole = $state<'root' | 'admin' | 'employee'>(
    data.user?.role ?? 'employee',
  );
  let activeRole = $state<'root' | 'admin' | 'employee'>(
    getInitialActiveRole(),
  );
  let sidebarCollapsed = $state(false);
  let openSubmenu = $state<string | null>(null);
  let openSubSubmenu = $state<string | null>(null);
  let roleSwitchBannerDismissed = $state(
    isBannerDismissed(getInitialActiveRole()),
  );

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
  let tenant = $state<{ id?: number; companyName?: string } | null>(
    data.tenant ?? null,
  );

  // Session Manager instance (for cleanup on destroy)
  let sessionManagerInstance = $state<SessionManager | null>(null);

  // Role Sync Manager instance (for cross-tab synchronization)
  let roleSyncManagerInstance = $state<RoleSyncManager | null>(null);

  // Current role for navigation (uses activeRole from role switch)
  // activeRole reflects the current view, which may differ from original userRole
  const currentRole = $derived(activeRole);

  // Role Switch Banner: Show when user is viewing as different role
  const isRoleSwitched = $derived(userRole !== activeRole);
  const showRoleSwitchBanner = $derived(
    isRoleSwitched && !roleSwitchBannerDismissed,
  );

  // Role display names for banner
  const roleDisplayNames: Record<'root' | 'admin' | 'employee', string> = {
    root: 'Root',
    admin: 'Administrator',
    employee: 'Mitarbeiter',
  };

  // Sync SSR user data to local state on invalidateAll() / navigation
  // This ensures UI updates immediately after PATCH /users/me
  $effect(() => {
    if (ssrUser !== null) {
      user = ssrUser;
    }
  });

  // Navigation menu items - filtered by has_full_access for admin users
  const hasFullAccess = $derived(
    data.user?.role === 'root' || Boolean(data.user?.hasFullAccess),
  );
  const menuItems = $derived<NavItem[]>(
    filterMenuByAccess(getMenuItemsForRole(currentRole), hasFullAccess),
  );

  // --- HELPER FUNCTIONS ---

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

  /** Role badge class derived from currentRole */
  const roleBadgeClass = $derived(
    currentRole === 'root' ? 'badge--danger'
    : currentRole === 'admin' ? 'badge--warning'
    : 'badge--info',
  );

  /** Role badge text derived from currentRole */
  const roleBadgeText = $derived(
    currentRole === 'root' ? 'Root'
    : currentRole === 'admin' ? 'Admin'
    : 'Mitarbeiter',
  );

  /** Check if menu item is active (recursive for nested submenus) */
  function isActive(item: NavItem): boolean {
    const currentPath = $page.url.pathname;
    if (item.url !== undefined && item.url !== '') {
      return currentPath === item.url || currentPath.startsWith(item.url + '/');
    }
    if (item.submenu !== undefined) {
      return item.submenu.some((sub) => isActive(sub));
    }
    return false;
  }

  // --- API FUNCTIONS ---

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

  // --- EVENT HANDLERS ---

  /** Toggle sidebar collapsed state */
  function toggleSidebar(): void {
    sidebarCollapsed = !sidebarCollapsed;
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
    // Close all submenus when collapsing sidebar
    if (sidebarCollapsed) {
      openSubmenu = null;
      openSubSubmenu = null;
    }
  }

  /** Toggle submenu */
  function toggleSubmenu(itemId: string): void {
    // Don't open submenus when sidebar is collapsed
    if (sidebarCollapsed) return;
    openSubmenu = openSubmenu === itemId ? null : itemId;
    // Close nested sub-submenu when switching top-level submenu
    openSubSubmenu = null;
  }

  /** Toggle nested sub-submenu */
  function toggleSubSubmenu(itemId: string): void {
    if (sidebarCollapsed) return;
    openSubSubmenu = openSubSubmenu === itemId ? null : itemId;
  }

  /** Calculate aggregated badge count for all submenu items (recursive) */
  function getSubmenuBadgeCount(submenu: NavItem[] | undefined): number {
    if (submenu === undefined) return 0;
    return submenu.reduce((total, item) => {
      let count = 0;
      if (item.badgeType !== undefined) {
        count += notificationStore.counts[item.badgeType];
      }
      if (item.submenu !== undefined) {
        count += getSubmenuBadgeCount(item.submenu);
      }
      return total + count;
    }, 0);
  }

  /** Dismiss role switch banner */
  function dismissRoleSwitchBanner(): void {
    roleSwitchBannerDismissed = true;
    localStorage.setItem(`roleSwitchBannerDismissed_${activeRole}`, 'true');
  }

  // --- LIFECYCLE ---

  onMount(() => {
    const endLayoutMount = perf.start('layout:mount:total');

    // Sync userRole from SSR + load UI preferences (user/tenant already synced via $effect)
    perf.timeSync('layout:initializeFromSSR', () => {
      if (ssrUser) {
        userRole = ssrUser.role;
        localStorage.setItem('userRole', ssrUser.role);
        if (localStorage.getItem('activeRole') === null) {
          localStorage.setItem('activeRole', ssrUser.role);
        }
      }
      if (localStorage.getItem('sidebarCollapsed') === 'true') {
        sidebarCollapsed = true;
      }
    });

    // Subscribe to TokenManager timer updates (uses relative time - no clock skew!)
    // NOTE: Token expiration redirect is handled by TokenManager.clearTokens() internally
    perf.timeSync('layout:tokenManager:init', () => {
      const tokenManager = getTokenManager();

      tokenTimerUnsubscribe = tokenManager.onTimerUpdate(
        handleTokenTimerUpdate,
      );
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
        if (
          newRole === 'root' ||
          newRole === 'admin' ||
          newRole === 'employee'
        ) {
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
    tokenTimerUnsubscribe?.();
    sessionManagerInstance?.destroy();
    roleSyncManagerInstance?.destroy();
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
      <svg
        class="toggle-icon"
        width="30"
        height="30"
        viewBox="0 0 24 24"
        fill="white"
      >
        {#if sidebarCollapsed}
          <path d="M4,6H20V8H4V6M4,11H15V13H4V11M4,16H20V18H4V16Z"></path>
        {:else}
          <path d="M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z"></path>
        {/if}
      </svg>
    </button>

    <a
      href={resolveDynamicPath(`/${currentRole}-dashboard`)}
      class="logo-container"
    >
      {#if sidebarCollapsed}
        <img
          src="/images/logo_collapsed.png"
          alt="Assixx Logo"
          class="logo"
          id="header-logo"
        />
      {:else}
        <img
          src="/images/logo.png"
          alt="Assixx Logo"
          class="logo"
          id="header-logo"
        />
      {/if}
    </a>

    <div class="header-content">
      <div class="header-actions">
        <!-- Role Switch Dropdown (only for root/admin users) -->
        {#if userRole === 'root' || userRole === 'admin'}
          <RoleSwitch
            {userRole}
            {activeRole}
          />
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

        <ThemeToggle />

        <button
          type="button"
          id="logout-btn"
          class="btn btn-danger"
          onclick={() => {
            showLogoutModal = true;
          }}
          title="Abmelden"
          aria-label="Abmelden"
        >
          <i class="fas fa-sign-out-alt"></i>
        </button>
      </div>
    </div>
  </header>

  <!-- Role Switch Warning Banner -->
  {#if showRoleSwitchBanner}
    <div
      class="role-switch-banner"
      id="role-switch-warning-banner"
    >
      <div class="role-switch-banner-content">
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="currentColor"
          class="mr-2"
        >
          <path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
          />
        </svg>
        <span>
          Sie agieren derzeit als <strong>{roleDisplayNames[activeRole]}</strong
          >. Ihre ursprüngliche Rolle ist
          <strong>{roleDisplayNames[userRole]}</strong>.
        </span>
        <button
          type="button"
          class="role-switch-banner-close"
          onclick={dismissRoleSwitchBanner}
          title="Banner schließen"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
            />
          </svg>
        </button>
      </div>
    </div>
  {/if}

  <!-- Main Layout -->
  <div class="layout-container">
    <!-- Sidebar -->
    <aside
      class="sidebar"
      class:collapsed={sidebarCollapsed}
    >
      <nav class="sidebar-nav">
        <ul class="sidebar-menu">
          {#each menuItems as item (item.id)}
            {#if item.submenu !== undefined}
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
                  <span
                    class="icon"
                    style="position: relative;"
                  >
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -- Icons are hardcoded ICONS object, safe -->
                    {@html item.icon}
                    {#if openSubmenu !== item.id}
                      <NotificationBadge
                        count={getSubmenuBadgeCount(item.submenu)}
                        size="sm"
                      />
                    {/if}
                  </span>
                  <span class="label">{item.label}</span>
                  <span class="submenu-arrow">
                    <svg
                      width="21"
                      height="21"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M7 10l5 5 5-5z" />
                    </svg>
                  </span>
                </button>
                <ul
                  class="submenu"
                  class:u-hidden={openSubmenu !== item.id}
                >
                  {#each item.submenu as subItem (subItem.id)}
                    {#if subItem.submenu !== undefined}
                      <li
                        class="submenu-item has-submenu"
                        class:active={isActive(subItem)}
                        class:open={openSubSubmenu === subItem.id}
                      >
                        <button
                          type="button"
                          class="submenu-link submenu-link--toggle"
                          class:active={isActive(subItem)}
                          onclick={() => {
                            toggleSubSubmenu(subItem.id);
                          }}
                        >
                          <span>{subItem.label}</span>
                          {#if openSubSubmenu !== subItem.id}
                            <NotificationBadge
                              count={getSubmenuBadgeCount(subItem.submenu)}
                              size="sm"
                              position="inline"
                            />
                          {/if}
                          <span class="submenu-arrow">
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M7 10l5 5 5-5z" />
                            </svg>
                          </span>
                        </button>
                        <ul
                          class="submenu submenu--nested"
                          class:u-hidden={openSubSubmenu !== subItem.id}
                        >
                          {#each subItem.submenu as nestedItem (nestedItem.id)}
                            <li
                              class="submenu-item"
                              class:active={isActive(nestedItem)}
                            >
                              <a
                                href={resolveDynamicPath(nestedItem.url ?? '')}
                                class="submenu-link"
                                class:active={isActive(nestedItem)}
                              >
                                <span>{nestedItem.label}</span>
                                {#if nestedItem.badgeType && openSubSubmenu === subItem.id}
                                  <NotificationBadge
                                    count={notificationStore.counts[
                                      nestedItem.badgeType
                                    ]}
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
                      <li
                        class="submenu-item"
                        class:active={isActive(subItem)}
                      >
                        <a
                          href={resolveDynamicPath(subItem.url ?? '')}
                          class="submenu-link"
                          class:active={isActive(subItem)}
                        >
                          <span>{subItem.label}</span>
                          {#if subItem.badgeType && openSubmenu === item.id}
                            <NotificationBadge
                              count={notificationStore.counts[
                                subItem.badgeType
                              ]}
                              size="sm"
                              position="inline"
                            />
                          {/if}
                        </a>
                      </li>
                    {/if}
                  {/each}
                </ul>
              </li>
            {:else}
              <li
                class="sidebar-item"
                class:active={isActive(item)}
              >
                <a
                  href={resolveDynamicPath(item.url ?? '')}
                  class="sidebar-link"
                >
                  <span
                    class="icon"
                    style="position: relative;"
                  >
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
          <span class="badge badge--sm {roleBadgeClass}">{roleBadgeText}</span>
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
              <div
                class="storage-progress-bar"
                style="width: 0%"
              ></div>
            </div>
            <div class="storage-percentage">0% belegt</div>
          </div>
        </div>
      {/if}
    </aside>

    <!-- Main Content (Child Routes) -->
    <main
      class="min-h-[calc(100vh-60px)] flex-1 bg-[var(--background-primary)] p-4"
    >
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
      <div
        class="confirm-modal confirm-modal--info"
        style="bottom: 10%;"
      >
        <div class="confirm-modal__icon">
          <i class="fas fa-sign-out-alt"></i>
        </div>
        <h3 class="confirm-modal__title">Abmeldung bestätigen</h3>
        <p class="confirm-modal__message">
          Möchten Sie sich wirklich abmelden?<br />
          <small
            ><i class="fas fa-info-circle"></i> Alle ungespeicherten Änderungen gehen
            verloren.</small
          >
        </p>
        <div class="confirm-modal__actions confirm-modal__actions--centered">
          <button
            type="button"
            class="confirm-modal__btn confirm-modal__btn--cancel confirm-modal__btn--wide"
            onclick={() => {
              showLogoutModal = false;
            }}
          >
            Abbrechen
          </button>
          <button
            type="button"
            class="btn btn-danger confirm-modal__btn--wide"
            onclick={() => {
              showLogoutModal = false;
              void logout();
            }}
          >
            Abmelden
          </button>
        </div>
      </div>
    </div>
  {/if}
{/if}
<!-- END: AUTH GUARD -->
