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

  import { afterNavigate, beforeNavigate, goto } from '$app/navigation';

  import Breadcrumb from '$lib/components/Breadcrumb.svelte';
  import { e2e } from '$lib/crypto/e2e-state.svelte';
  import { clearPublicKeyCache } from '$lib/crypto/public-key-cache';
  import { notificationStore } from '$lib/stores/notification.store.svelte';
  import { syncThemeFromSSR } from '$lib/stores/theme.svelte';
  import { getApiClient } from '$lib/utils/api-client';
  import { createLogger } from '$lib/utils/logger';
  import { perf, logPageLoadTiming, logResourceTiming } from '$lib/utils/perf-logger';
  import { getRoleSyncManager, type RoleSyncManager } from '$lib/utils/role-sync.svelte';
  import { getSessionManager, type SessionManager } from '$lib/utils/session-manager';
  import { getTokenManager } from '$lib/utils/token-manager';
  import { clearUserCache } from '$lib/utils/user-service';

  // WebSocket presence: keeps user "online" across ALL authenticated pages
  import {
    connectWebSocket as wsConnect,
    disconnectWebSocket as wsDisconnect,
    setPresenceCallbacks,
    startPeriodicPing,
  } from './(shared)/chat/_lib/handlers';
  import AppHeader from './_lib/AppHeader.svelte';
  import AppSidebar from './_lib/AppSidebar.svelte';
  import { createPresenceCallbacks, formatTokenTime, performLogout } from './_lib/layout-helpers';
  import LogoutModal from './_lib/LogoutModal.svelte';
  import {
    filterMenuByAccess,
    filterMenuByAddons,
    filterMenuByScope,
    getMenuItemsForRole,
    type NavItem,
  } from './_lib/navigation-config';
  import RoleSwitchBanner from './_lib/RoleSwitchBanner.svelte';

  import type { LayoutData } from './$types';

  const log = createLogger('AppLayout');

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
    role?: 'root' | 'admin' | 'employee' | 'dummy';
    employeeNumber?: string;
    profilePicture?: string;
    position?: string;
  } | null>(data.user ?? null);

  // Immediate client-side init (hydration) - ensures role switch banner shows instantly
  const getStorageValue = (key: string): string | null =>
    typeof window === 'undefined' ? null : localStorage.getItem(key);

  const getInitialActiveRole = (): 'root' | 'admin' | 'employee' | 'dummy' => {
    const stored = getStorageValue('activeRole');
    if (stored === 'root' || stored === 'admin' || stored === 'employee') {
      return stored;
    }
    return (data.user?.role ?? 'employee') as 'root' | 'admin' | 'employee' | 'dummy';
  };

  const isBannerDismissed = (role: string): boolean =>
    getStorageValue(`roleSwitchBannerDismissed_${role}`) === 'true';

  // Role Switch State - activeRole read from localStorage IMMEDIATELY during hydration
  // svelte-ignore state_referenced_locally
  let userRole = $state<'root' | 'admin' | 'employee' | 'dummy'>(
    (data.user?.role ?? 'employee') as 'root' | 'admin' | 'employee' | 'dummy',
  );
  let activeRole = $state<'root' | 'admin' | 'employee' | 'dummy'>(getInitialActiveRole());
  let sidebarCollapsed = $state(false);
  let mobileMenuOpen = $state(false);
  let isMobile = $state(false);
  let roleSwitchBannerDismissed = $state(isBannerDismissed(getInitialActiveRole()));

  // Token Timer State
  let tokenTimeLeft = $state('--:--');
  let tokenWarning = $state(false);
  let tokenExpired = $state(false);
  let tokenTimerUnsubscribe = $state<(() => void) | null>(null);

  // Logout Modal State
  let showLogoutModal = $state(false);

  // Browser tab title base (without count prefix)
  let pageTitleBase = $state('Assixx');

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

  // Role Switch Banner: Show when user is viewing as different role
  const isRoleSwitched = $derived(userRole !== activeRole);
  const showRoleSwitchBanner = $derived(isRoleSwitched && !roleSwitchBannerDismissed);

  // Sync SSR user data to local state on invalidateAll() / navigation
  // This ensures UI updates immediately after PATCH /users/me
  $effect(() => {
    if (ssrUser !== null) {
      user = ssrUser;
    }
  });

  // =========================================================================
  // RESPONSIVE: Mobile detection via matchMedia
  // =========================================================================

  $effect(() => {
    if (typeof window === 'undefined') return;

    const mql = window.matchMedia('(max-width: 767px)');

    function handleChange(e: MediaQueryListEvent | MediaQueryList): void {
      isMobile = e.matches;
      // Auto-close mobile menu when switching to desktop
      if (!e.matches) {
        mobileMenuOpen = false;
      }
    }

    // Set initial value
    handleChange(mql);

    mql.addEventListener('change', handleChange);
    return () => {
      mql.removeEventListener('change', handleChange);
    };
  });

  // Close mobile menu on navigation
  beforeNavigate(() => {
    if (isMobile) {
      mobileMenuOpen = false;
    }
  });

  // =========================================================================
  // BROWSER TAB TITLE - Show unread count (e.g., "(3) Chat - Assixx")
  // =========================================================================

  // Capture page-set title after each navigation (<svelte:head> in child pages)
  afterNavigate(() => {
    requestAnimationFrame(() => {
      pageTitleBase = document.title.replace(/^\(\d+\)\s*/, '');
    });
  });

  // Apply unread count prefix to browser tab title
  $effect(() => {
    const count = notificationStore.totalUnread;
    const base = pageTitleBase;
    document.title = count > 0 ? `(${count}) ${base}` : base;
  });

  // Hierarchy labels from SSR (tenant-specific names for areas, departments, etc.)
  const hierarchyLabels = $derived(data.hierarchyLabels);

  // Navigation menu items - filtered by access level and tenant addon activation
  const hasFullAccess = $derived(data.user?.role === 'root' || Boolean(data.user?.hasFullAccess));
  const activeAddonsSet = $derived(new Set(data.activeAddons));
  const menuItems = $derived<NavItem[]>(
    filterMenuByAddons(
      filterMenuByScope(
        filterMenuByAccess(getMenuItemsForRole(currentRole, hierarchyLabels), hasFullAccess),
        data.orgScope,
        currentRole,
        hierarchyLabels,
      ),
      activeAddonsSet,
    ),
  );

  // --- API FUNCTIONS ---

  async function logout(): Promise<void> {
    await performLogout({
      apiClient,
      onError: (err: unknown) => {
        log.error({ err }, 'Logout API error (continuing with logout)');
      },
      lockE2E: () => e2e.lock(),
      clearCaches: () => {
        clearPublicKeyCache();
        clearUserCache();
      },
      navigate: (url: string) => goto(url, { replaceState: true }),
    });

    // CRITICAL: Reset ALL Svelte state to prevent stale data on re-login
    user = null;
    userRole = 'employee';
    activeRole = 'employee';
    tenant = null;
  }

  // =============================================================================
  // WEBSOCKET PRESENCE
  // Keeps user "online" across all authenticated pages (not just chat).
  // Chat page upgrades callbacks for message handling, then restores on leave.
  // =============================================================================

  async function connectPresenceWebSocket(): Promise<void> {
    const callbacks = createPresenceCallbacks({
      userId: data.user?.id ?? 0,
      tenantId: data.user?.tenantId ?? 0,
      onInfo: (msg: string) => {
        log.info(msg);
      },
      onError: (msg: string) => {
        log.error(msg);
      },
      onAuthError: () => void goto('/login'),
    });
    setPresenceCallbacks(callbacks);
    await wsConnect(callbacks);
    startPeriodicPing();
  }

  // =============================================================================
  // TOKEN TIMER
  // =============================================================================

  function handleTokenTimerUpdate(remainingSeconds: number): void {
    const result = formatTokenTime(remainingSeconds);
    tokenTimeLeft = result.timeLeft;
    tokenWarning = result.warning;
    tokenExpired = result.expired;
  }

  // --- EVENT HANDLERS ---

  /** Toggle sidebar: mobile opens overlay, desktop toggles collapsed */
  function toggleSidebar(): void {
    if (isMobile) {
      mobileMenuOpen = !mobileMenuOpen;
    } else {
      sidebarCollapsed = !sidebarCollapsed;
      localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
    }
  }

  /** Close mobile sidebar overlay */
  function closeMobileMenu(): void {
    mobileMenuOpen = false;
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

    // Sync theme preference from SSR data (cross-device persistence)
    syncThemeFromSSR(data.theme);

    // Subscribe to TokenManager timer updates (uses relative time - no clock skew!)
    // NOTE: Token expiration redirect is handled by TokenManager.clearTokens() internally
    perf.timeSync('layout:tokenManager:init', () => {
      const tokenManager = getTokenManager();
      tokenTimerUnsubscribe = tokenManager.onTimerUpdate(handleTokenTimerUpdate);
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

    // Initialize notification counts from SSR data or fetch client-side (fallback)
    perf.timeSync('layout:notifications:init', () => {
      if (data.dashboardCounts !== null) {
        notificationStore.initFromSSR(data.dashboardCounts);
      } else {
        void notificationStore.loadInitialCounts();
      }
    });

    perf.timeSync('layout:sse:connect', () => {
      notificationStore.connect();
    });

    // Initialize E2E encryption (generates keys if needed, uploads public key)
    // Silent — no user interaction required. Keys are device-bound + user-scoped.
    if (ssrUser?.id !== undefined) {
      void e2e.initialize(ssrUser.id);
    }

    // Connect WebSocket for presence tracking (user appears "online" app-wide)
    void connectPresenceWebSocket();

    endLayoutMount();

    // Page load timing (only outputs when PERF_LOG=true)
    setTimeout(() => {
      logPageLoadTiming();
      logResourceTiming('/api/');
    }, 100);
  });

  onDestroy(() => {
    tokenTimerUnsubscribe?.();
    sessionManagerInstance?.destroy();
    roleSyncManagerInstance?.destroy();
    notificationStore.disconnect();
    wsDisconnect();
  });
</script>

<!-- AUTH GUARD: Block ALL content until authenticated -->
{#if isAuthenticated}
  <RoleSwitchBanner
    isVisible={showRoleSwitchBanner}
    {userRole}
    {activeRole}
    onDismiss={dismissRoleSwitchBanner}
  />

  <AppHeader
    {sidebarCollapsed}
    {tokenTimeLeft}
    {tokenWarning}
    {tokenExpired}
    {user}
    {userRole}
    {activeRole}
    {currentRole}
    onToggleSidebar={toggleSidebar}
    onShowLogoutModal={() => {
      showLogoutModal = true;
    }}
  />

  <div class="layout-container">
    {#if mobileMenuOpen}
      <button
        type="button"
        class="sidebar-backdrop active"
        onclick={closeMobileMenu}
        aria-label="Sidebar schließen"
      ></button>
    {/if}

    <AppSidebar
      collapsed={sidebarCollapsed}
      {menuItems}
      {currentRole}
      {user}
      {tenant}
      {hierarchyLabels}
      {mobileMenuOpen}
      {isMobile}
      onCloseMobile={closeMobileMenu}
    />

    <main class="min-h-[calc(100vh-60px)] flex-1 bg-(--background-primary) p-2 md:p-3 lg:p-4">
      <div id="breadcrumb-container">
        <Breadcrumb
          userRole={currentRole}
          {hierarchyLabels}
        />
      </div>
      {@render children()}
    </main>
  </div>

  <LogoutModal
    isVisible={showLogoutModal}
    onCancel={() => {
      showLogoutModal = false;
    }}
    onConfirm={() => {
      showLogoutModal = false;
      void logout();
    }}
  />
{/if}

<style>
  .layout-container {
    display: flex;
    box-sizing: border-box;
    min-height: calc(100vh - 60px);
  }

  .sidebar-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 199;
    cursor: default;
    border: none;
    background: color-mix(in oklch, var(--color-black) 50%, transparent);
    backdrop-filter: blur(4px);
    padding: 0;
    width: 100%;
    height: 100%;
  }

  .sidebar-backdrop.active {
    display: block;
  }

  @media (width < 768px) {
    .layout-container {
      flex-direction: column;
    }
  }
</style>
