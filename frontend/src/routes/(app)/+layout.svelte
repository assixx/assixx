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
  import { resolve } from '$app/paths';

  import Breadcrumb from '$lib/components/Breadcrumb.svelte';
  import RoleSwitch from '$lib/components/RoleSwitch.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import { e2e } from '$lib/crypto/e2e-state.svelte';
  import { clearPublicKeyCache } from '$lib/crypto/public-key-cache';
  import { notificationStore } from '$lib/stores/notification.store.svelte';
  import { syncThemeFromSSR } from '$lib/stores/theme.svelte';
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

  // WebSocket presence: keeps user "online" across ALL authenticated pages
  import {
    connectWebSocket as wsConnect,
    disconnectWebSocket as wsDisconnect,
    setPresenceCallbacks,
    startPeriodicPing,
    type WebSocketCallbacks,
  } from './(shared)/chat/_lib/handlers';
  import AppSidebar from './_lib/AppSidebar.svelte';
  import {
    filterMenuByAccess,
    getMenuItemsForRole,
    type NavItem,
  } from './_lib/navigation-config';

  import type { LayoutData } from './$types';

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
  let mobileMenuOpen = $state(false);
  let isMobile = $state(false);
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

  // Browser tab title base (without count prefix)
  let pageTitleBase = $state('Assixx');

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

    // Clear E2E encryption state + private key from Worker memory + IndexedDB
    await e2e.lock();
    clearPublicKeyCache();

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
  // WEBSOCKET PRESENCE
  // Keeps user "online" across all authenticated pages (not just chat).
  // Chat page upgrades callbacks for message handling, then restores on leave.
  // =============================================================================

  async function connectPresenceWebSocket(): Promise<void> {
    const userId = data.user?.id ?? 0;

    const callbacks: WebSocketCallbacks = {
      onConnected: () => {
        log.info('Presence WebSocket connected');
      },
      onDisconnect: (_permanent: boolean) => {
        // Reconnection handled automatically by handlers.ts
      },
      // No-op handlers: SSE handles notification badges outside chat page.
      // Chat page upgrades these with real handlers when mounted.
      onNewMessage: () => {
        /* no-op: SSE handles badges */
      },
      onTypingStart: () => {
        /* no-op: chat-page-only */
      },
      onTypingStop: () => {
        /* no-op: chat-page-only */
      },
      onUserStatus: () => {
        /* no-op: chat-page-only */
      },
      onMessageRead: () => {
        /* no-op: chat-page-only */
      },
      onError: (error: string) => {
        log.error(error);
      },
      onAuthError: () => {
        void goto('/login');
      },
      getActiveConversationId: () => null,
      getCurrentUserId: () => userId,
      getTenantId: () => data.user?.tenantId ?? 0,
      getConversations: () => [],
    };

    setPresenceCallbacks(callbacks);
    await wsConnect(callbacks);
    startPeriodicPing();
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
        fill="currentColor"
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
          src="/images/logo_collapsed_darkmode.png"
          alt="Assixx Logo"
          class="logo logo-dark"
        />
        <img
          src="/images/logo_collapsed_lightmode.png"
          alt="Assixx Logo"
          class="logo logo-light"
        />
      {:else}
        <img
          src="/images/logo_darkmode.png"
          alt="Assixx Logo"
          class="logo logo-dark"
        />
        <img
          src="/images/logo_lightmode.png"
          alt="Assixx Logo"
          class="logo logo-light"
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
    <!-- Mobile sidebar backdrop overlay -->
    {#if mobileMenuOpen}
      <button
        type="button"
        class="sidebar-backdrop active"
        onclick={closeMobileMenu}
        aria-label="Sidebar schließen"
      ></button>
    {/if}

    <!-- Sidebar Navigation (extracted to AppSidebar for modularity) -->
    <AppSidebar
      collapsed={sidebarCollapsed}
      {menuItems}
      {currentRole}
      {user}
      {tenant}
      {mobileMenuOpen}
      {isMobile}
      onCloseMobile={closeMobileMenu}
    />

    <!-- Main Content (Child Routes) -->
    <main
      class="min-h-[calc(100vh-60px)] flex-1 bg-(--background-primary) p-2 md:p-3 lg:p-4"
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

<style>
  /* NOTE: @import for modal.base.css and confirm-modal.css removed —
     already globally loaded via design-system/index.css */

  :global {
    /* Header Base Styles */
    .header {
      display: flex;
      position: sticky;
      top: 0;
      justify-content: space-between;
      align-items: center;
      z-index: 1000;
      backdrop-filter: blur(20px) saturate(180%);
      box-shadow: 0 0 0 2px #00000017;

      background: var(--glass-bg);
      padding: 0.5rem 1rem;

      height: 80px;
      min-height: 3.5rem;
    }

    .header .header-content {
      display: flex;
      flex: 1;
      justify-content: flex-end;
    }

    .header .logo-container {
      display: flex;
      align-items: center;

      margin-right: var(--spacing-6);
      margin-bottom: -3px;

      text-decoration: none;
    }

    .header .logo {
      margin-left: -13px;
      width: 150px;
      margin-bottom: 3px;
    }

    /* Logo theme switching */
    .logo-light {
      display: none;
    }
  }

  :global(html:not(.dark)) :global(.logo-dark) {
    display: none;
  }

  :global(html:not(.dark)) :global(.logo-light) {
    display: inline;
  }

  :global {
    .header .header-actions {
      display: flex;
      align-items: center;
      gap: calc(var(--spacing-6) + 8px);
    }

    .header-actions [id='user-info'] {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.2rem 0.5rem;
      border: none;
      border-radius: 0;
      background: transparent;
      backdrop-filter: none;
    }

    /* Token Timer */
    .token-timer {
      display: inline-block;

      transition: color 0.3s ease;

      min-width: 45px;
      color: var(--color-text-secondary);
      font-weight: 500;

      font-size: 1rem;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.05em;
      text-align: center;
    }

    .token-timer--warning {
      animation: -global-pulse-warning 2s ease-in-out infinite;
      color: #fbbf24;
      font-weight: 600;
    }

    .token-timer--expired {
      color: #ef4444;
      font-weight: 700;
    }

    .header-actions [id='user-name'] {
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Role Switch Warning Banner */
    .role-switch-banner {
      position: fixed;
      top: 80px;
      right: 30%;
      left: 30%;
      z-index: 999;

      margin-top: 2px;
      border-radius: 5px;
      padding: 5px 20px;
    }

    .role-switch-banner-content {
      display: flex;
      position: relative;
      justify-content: center;
      align-items: center;

      width: 100%;
      color: #ff9800;

      font-size: 14px;
    }

    .role-switch-banner-content strong {
      color: #ffb74d;
      font-weight: 600;
    }

    .role-switch-banner-close {
      display: inherit;

      position: absolute;
      right: 0;
      cursor: pointer;
      border: none;
      border-radius: 300px;

      background: none;

      padding: 4px;

      color: #ff9800;
    }

    .role-switch-banner-close:hover {
      background: rgb(255 193 7 / 20%);
      color: #ffb74d;
    }

    /* Base sidebar styles */
    .sidebar {
      position: sticky;
      top: 80px;
      left: 0;

      flex-shrink: 0;
      align-self: flex-start;
      backdrop-filter: blur(20px);

      transition:
        width 0.1s ease,
        min-width 0.1s ease;
      margin-top: 0;
      margin-left: 10px;

      background: transparent;

      width: 260px !important;
      min-width: 260px;

      height: calc(100vh - 80px);
      max-height: calc(100vh - 80px);

      overflow: hidden auto;
    }

    /* Scrollbar Styling */
    .sidebar::-webkit-scrollbar {
      width: 6px;
    }

    .sidebar::-webkit-scrollbar-track {
      background: var(--glass-bg-hover);
    }

    .sidebar::-webkit-scrollbar-thumb {
      border-radius: 3px;
      background: var(--color-glass-border-hover);
    }

    .sidebar::-webkit-scrollbar-thumb:hover {
      background: var(--scrollbar-thumb-hover);
    }

    .sidebar-nav {
      display: flex;
      position: relative;
      flex-direction: column;

      padding: var(--spacing-4);

      overflow: visible;
    }

    .sidebar-title {
      display: flex;

      position: relative;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      margin-top: 23px;
      margin-right: 1%;
      margin-left: 15px;
      border: 1px solid var(--color-text-primary);
      border-radius: 10px;

      background: rgb(234 187 0 / 0%);
      padding: var(--spacing-1);

      width: 85%;

      overflow: visible;
      color: var(--color-text-primary);

      font-weight: 600;
      text-align: center;
    }

    /* Sticky Note folded corner */
    .sidebar-title::after {
      position: absolute;
      right: -0.6px;
      bottom: -4px;
      transform-origin: bottom right;

      background: linear-gradient(45deg, transparent 50%, rgb(0 0 0 / 10%) 50%);

      width: 20px;
      height: 20px;
      content: '';
    }

    .sidebar-title::before {
      position: absolute;
      right: -2px;
      bottom: -5px;
      z-index: 1;
      border-width: 13px 10px 4px 3px;
      border-style: solid;
      border-color: var(--sidebar-fold-edge) var(--sidebar-fold-bg) transparent
        transparent;

      width: 0;
      height: 0;
      content: '';
    }

    .sidebar-title:hover {
      box-shadow:
        0 5px 10px rgb(0 0 0 / 25%),
        0 2px 4px rgb(0 0 0 / 15%);
    }

    /* Toggle button im Header */
    .header .sidebar-toggle {
      display: flex;

      position: relative;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      margin-right: 15px;
      margin-left: 8px;
      border: 1px solid transparent;
      border-radius: 8px;

      background: transparent;

      width: 40px;
      height: 40px;

      color: var(--color-text-primary);
    }

    .header .sidebar-toggle:hover {
      transform: scale(1.05);
      background: var(--glass-bg-active);
    }

    .sidebar-toggle:hover .toggle-icon {
      opacity: 80%;
    }

    /* Collapsed Sidebar Styles */
    .sidebar.collapsed {
      margin-left: 10px;
      width: 4.5rem !important;
      min-width: 4.5rem !important;
    }
  }

  /* Logo size adjustment when sidebar is collapsed */
  :global(body:has(.sidebar.collapsed)) :global(.header .logo) {
    margin-bottom: 8px;
    margin-left: -4px;
    width: 57px;
  }

  :global {
    .sidebar.collapsed .sidebar-title {
      justify-content: center;
      margin-left: 4px;

      background: #e6b80000;
      padding: var(--spacing-2);

      width: calc(100% - 8px);
      min-height: 26px;

      font-size: 0;
    }

    .sidebar.collapsed .title-text {
      display: none;
      opacity: 0%;
      width: 0;
    }

    .sidebar.collapsed .title-content {
      justify-content: center;
      gap: 0;
    }

    .sidebar.collapsed .user-info-card {
      flex-direction: column;
      align-items: center;

      margin-bottom: 9rem;
      margin-left: 4px;

      padding: 0.9rem 0.7rem 0.7rem;

      min-height: auto;
    }

    .sidebar.collapsed .user-details {
      display: none;
    }

    /* Im collapsed state NUR Label verstecken */
    .sidebar.collapsed .sidebar-link .label {
      display: none;
    }

    /* Collapsed state: Hover/Active NUR auf Icon */
    .sidebar.collapsed .sidebar-link {
      justify-content: flex-start;
      gap: 0;

      background: transparent;

      padding: 0.5rem;
      overflow: visible !important;

      font-size: 0.875rem !important;
      line-height: 1.25rem !important;
    }

    .sidebar-link .icon svg {
      display: block;
      width: 1.063rem !important;
      height: 1.063rem !important;
    }

    /* Active item when sidebar is collapsed */
    .sidebar.collapsed .sidebar-item.active .sidebar-link {
      transition: color 0.2s ease;
      color: var(--color-black) !important;
    }

    .sidebar.collapsed .sidebar-item.active .sidebar-link .icon {
      color: var(--color-black);
    }

    .sidebar.collapsed .sidebar-item.active .sidebar-link .icon::before {
      position: absolute;
      z-index: -1;
      inset: -0.55rem;

      border-radius: var(--glass-card-radius);
      background: linear-gradient(135deg, #e9f1f7 0%, #75bffc 100%);
      content: '';
    }

    /* Hover nur bei NICHT active */
    .sidebar.collapsed
      .sidebar-item:not(.active)
      .sidebar-link:hover
      .icon::before {
      position: absolute;
      z-index: -1;
      inset: -0.525rem;

      border-radius: var(--glass-card-radius);

      background: var(--nav-hover-bg);
      content: '';
    }

    /* Main content adjustment for collapsed sidebar */
    .sidebar-collapsed {
      margin-left: 0;
    }

    .sidebar-collapsed .container {
      max-width: none;
    }

    .sidebar-collapsed .content-section {
      width: 100%;
      max-width: none;
    }

    .sidebar-collapsed .card {
      max-width: none;
    }

    .user-info-card {
      position: relative;
      align-items: center;
      backdrop-filter: blur(20px) saturate(180%);

      margin: 20px 15px;
      border-radius: var(--radius-xl);

      background: var(--glass-bg);
      padding: 14px 10px 15px 20px;

      width: 85%;
      min-height: 100px;

      overflow: hidden;
    }

    .user-info-card::before {
      position: absolute;

      opacity: 100%;
      z-index: 0;
      inset: 0;
      background:
        radial-gradient(
          circle at 20% 80%,
          var(--glass-bg-active) 0%,
          transparent 50%
        ),
        radial-gradient(
          circle at 80% 20%,
          var(--glass-bg-active) 0%,
          transparent 50%
        );
      content: '';
    }

    .user-info-card::after {
      position: absolute;
      top: -50%;
      right: -20%;
      z-index: 0;
      border-radius: 50%;

      width: 200px;
      height: 200px;
      content: '';
    }

    .user-info-card > * {
      position: relative;
      z-index: 1;
    }

    .user-details {
      display: flex;
      flex: 1;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;

      min-width: 0;
    }

    .company-info {
      display: flex;
      align-items: baseline;
      gap: 6px;

      margin-bottom: 4px;

      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .company-name {
      margin-top: 8px;
      overflow: hidden;
      color: var(--primary-light);
      font-weight: 600;

      font-size: 14px;
      letter-spacing: 0.5px;
      text-overflow: ellipsis;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .user-full-name {
      overflow: hidden;
      color: var(--text-muted);

      font-size: 13px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Role Badge spacing in user-info-card */
    .user-info-card .badge {
      margin-top: 6px;
    }

    /* Role Switch Dropdown */
    .role-switch-dropdown {
      margin-right: 12px;
      min-width: 200px;
      font-size: 14px;
    }

    .role-switch-dropdown .dropdown__option i {
      margin-right: 8px !important;
    }

    .role-switch-dropdown .dropdown__trigger span i {
      margin-right: 8px !important;
    }

    .sidebar-menu {
      flex: 1;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .sidebar-link {
      display: flex;
      position: relative;
      align-items: center;

      box-sizing: border-box;
      width: 100%;
      margin-bottom: 0.3rem;
      border: 1px solid transparent;
      border-radius: var(--glass-card-radius);

      padding: 0.5rem;
      height: 2.1rem;

      overflow: hidden;
      color: var(--text-secondary);

      font-size: 0.875rem;
    }

    .sidebar-link .icon {
      display: flex;
      position: absolute;
      flex-shrink: 0;
      justify-content: center;
      align-items: center;
      margin-left: 0;

      width: 1.063rem;
      min-width: 1.063rem;
      height: 1.063rem;

      text-align: center;
    }

    .sidebar-link .label {
      flex: 1;

      margin-left: 1.75rem;
      overflow: hidden;

      font-weight: 500;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .nav-indicator {
      border-radius: 50%;
      background: transparent;
      width: 4px;
      height: 4px;
    }

    .nav-ripple {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      border-radius: 50%;

      background: rgb(33 150 243 / 30%);

      width: 0;
      height: 0;
    }

    /* Submenu Styles */
    .sidebar-item {
      margin: 0;
      padding: 0;
    }

    .sidebar-item.has-submenu .sidebar-link {
      position: relative;
      text-align: left;
      font-family: inherit;
      cursor: pointer;
      border: none;
      background: none;
    }

    /* Hover nur wenn NICHT collapsed UND NICHT active */
    .sidebar:not(.collapsed) .sidebar-item:not(.active) .sidebar-link:hover {
      background: var(--nav-hover-bg);
    }

    .sidebar:not(.collapsed) .sidebar-item.active .sidebar-link {
      border-color: var(--color-accent-bg);
      background: var(--color-accent-bg);
      color: var(--color-black);
    }

    .submenu-arrow {
      opacity: 60%;
      margin-left: auto;
    }

    .sidebar.collapsed .submenu-arrow {
      display: none;
    }

    .sidebar-item.has-submenu.open > .sidebar-link > .submenu-arrow {
      transform: rotate(180deg);
    }

    .submenu-item.has-submenu.open > .submenu-link > .submenu-arrow {
      transform: rotate(180deg);
    }

    .submenu {
      margin-top: 0.25rem;
      margin-bottom: 0.313rem;
      margin-left: 3rem;
      padding: 0;
      overflow: hidden;

      list-style: none;
    }

    .submenu--nested {
      margin-left: 0.75rem;
    }

    .submenu-link--toggle {
      cursor: pointer;
      border: none;
      background: none;
      width: 100%;
      text-align: left;
      font-family: inherit;
    }

    .sidebar.collapsed .submenu {
      display: none !important;
    }

    .submenu-item {
      margin-bottom: 0.125rem;
    }

    .submenu-link {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      position: relative;
      margin-right: 10px;
      border-radius: var(--glass-card-radius);
      padding: 0.4rem;
      color: var(--text-secondary);
      font-size: 0.85rem;
      text-decoration: none;
    }

    .submenu-link:hover {
      background: var(--nav-hover-bg);
    }

    .submenu-link.active,
    .submenu-item.active > .submenu-link {
      border-radius: var(--glass-card-radius);

      background: var(--nav-active-submenu-bg);

      text-align: center;
    }

    /* Layout adjustments */
    .layout-container {
      display: flex;
      box-sizing: border-box;
      min-height: calc(100vh - 60px);
    }

    /* Storage Widget */
    .storage-widget {
      margin-top: 50px;
      width: 95%;
    }

    .sidebar.collapsed .storage-widget {
      display: none;
    }

    .storage-header {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);

      margin-bottom: var(--spacing-4);
      color: var(--primary-color);
      font-weight: 600;

      font-size: 14px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .storage-info {
      margin-bottom: var(--spacing-4);
    }

    .storage-usage-text {
      margin-bottom: var(--spacing-2);
      color: var(--text-secondary);
      font-size: 13px;
    }

    .storage-usage-text span {
      color: var(--text-primary);
      font-weight: 600;
    }

    .storage-progress {
      margin-bottom: var(--spacing-1);
      box-shadow: inset 0 1px 3px rgb(0 0 0 / 30%);
      border-radius: 4px;

      background: var(--accent-color);

      width: 100%;
      height: 8px;
      overflow: hidden;
    }

    .storage-progress-bar {
      position: relative;
      border-radius: 4px;

      background: var(--success-color);

      height: 100%;

      overflow: hidden;
    }

    .storage-progress-bar::after {
      position: absolute;
      inset: 0;

      background: linear-gradient(
        45deg,
        transparent 25%,
        rgb(255 255 255 / 20%) 25%,
        rgb(255 255 255 / 20%) 50%,
        transparent 50%,
        transparent 75%,
        rgb(255 255 255 / 20%) 75%,
        rgb(255 255 255 / 20%)
      );
      background-size: 20px 20px;
      content: '';
    }

    .storage-percentage {
      color: var(--text-secondary);
      font-size: 12px;
      text-align: right;
    }

    /* Backdrop overlay for mobile sidebar */
    .sidebar-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 199;
      cursor: default;
      border: none;
      background: rgb(0 0 0 / 50%);
      backdrop-filter: blur(4px);
      padding: 0;
      width: 100%;
      height: 100%;
    }

    .sidebar-backdrop.active {
      display: block;
    }

    /* Navigation Badges */
    .nav-badge {
      display: inline-block;
      position: absolute;
      top: 8px;
      right: 10px;
      border-radius: 50px;

      background: linear-gradient(
        0deg,
        rgb(243 33 33 / 71%),
        rgb(243 33 33 / 76%)
      );

      min-width: 24px;
      color: #fff;
      font-weight: 700;

      font-size: 0.7rem;
      text-align: center;
    }

    .nav-badge-kvp {
      background: linear-gradient(
        0deg,
        rgb(76 175 80 / 71%),
        rgb(76 175 80 / 76%)
      );
    }

    .nav-badge-surveys {
      right: 15px;
      backdrop-filter: blur(10px);
      border: 1px solid rgb(255 152 0 / 30%);
      border-radius: 12px;

      background: rgb(255 152 0 / 15%);
      padding: 3px 8px;

      min-width: 20px;
      color: #ff9800;
      font-weight: 600;

      font-size: 0.75rem;
    }

    .nav-badge-documents {
      border-radius: 10px;
      background: #2196f3;
      min-width: 18px;
      color: #fff;
    }

    .nav-badge-lean-parent {
      right: 40px;
      backdrop-filter: blur(10px);

      background: rgb(255 153 0 / 70%);
      color: #fff;

      font-weight: 600;
    }

    .nav-badge-child {
      top: 50%;
      transform: translateY(-50%);
    }

    .nav-badge-child-default {
      border-radius: 10px;
      background: #ff5722;
      min-width: 18px;
      color: #fff;
    }

    /* Collapsed sidebar - show badges as dots */
    .sidebar.collapsed .nav-badge {
      position: absolute !important;
      top: 4px !important;
      right: 4px !important;
      left: auto !important;
      border-radius: 50% !important;
      padding: 0 !important;

      width: 8px !important;
      min-width: 8px !important;
      height: 8px !important;

      overflow: hidden !important;

      font-size: 0 !important;
      text-indent: -9999px !important;
    }

    .sidebar.collapsed .submenu-link .nav-badge {
      top: 50% !important;
      right: 8px !important;
      transform: translateY(-50%) !important;
    }

    /* Inline Style Replacements */
    .employee-number__text {
      letter-spacing: 2px;
      font-size: 13px;
    }

    .user-position {
      margin-top: 2px;
      font-size: 13px;
    }

    .user-employee-number {
      overflow: hidden;
      color: var(--text-muted);

      font-size: 13px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .submenu--open {
      display: block !important;
    }

    .mr-2 {
      margin-right: 8px;
    }

    .sidebar--banner-dismissed {
      top: unset;
      height: unset;
    }

    /* Logout Button */
    #logout-btn {
      padding: 10px 15px;
    }
  }

  /* Keyframes */
  /* stylelint-disable keyframes-name-pattern -- Svelte requires -global- prefix for unscoped keyframes */
  @keyframes -global-pulse-warning {
    0%,
    100% {
      opacity: 100%;
    }

    50% {
      opacity: 60%;
    }
  }

  /* Mobile: < 768px */
  @media (width < 768px) {
    :global {
      .header {
        height: var(--header-height-mobile);
        padding: 0.25rem 0.5rem;
      }

      .header-actions [id='user-name'] {
        display: none;
      }

      .header .logo {
        width: 100px;
      }

      .sidebar {
        position: fixed;
        top: var(--header-height-mobile);
        left: 0;
        z-index: 200;
        transform: translateX(-100%);

        margin-left: 0;

        width: 280px;
        height: calc(100vh - var(--header-height-mobile));
        max-height: calc(100vh - var(--header-height-mobile));

        transition: transform 0.3s ease;
      }

      .sidebar.mobile-open {
        transform: translateX(0);
      }

      .sidebar.mobile-open {
        width: 280px !important;
        min-width: 280px !important;
      }

      .sidebar.mobile-open .sidebar-link .label {
        display: inline;
      }

      .sidebar.mobile-open .submenu-arrow {
        display: flex;
      }

      .sidebar.mobile-open .submenu {
        display: block;
      }

      .layout-container {
        flex-direction: column;
      }

      .storage-widget {
        position: relative;
        right: auto;
        bottom: auto;
        left: auto;

        margin-top: var(--spacing-6);
      }

      .role-switch-banner {
        top: var(--header-height-mobile);
        right: 5%;
        left: 5%;
      }
    }
  }

  /* Tablet: 768px – 1023px */
  @media (width >= 768px) and (width < 1024px) {
    :global {
      .sidebar {
        width: var(--sidebar-width-collapsed) !important;
        min-width: var(--sidebar-width-collapsed) !important;
      }

      .sidebar .sidebar-link .label {
        display: none;
      }

      .sidebar .submenu-arrow {
        display: none;
      }

      .sidebar .submenu {
        display: none !important;
      }

      .sidebar .user-details {
        display: none;
      }

      .sidebar .storage-widget {
        display: none;
      }

      .sidebar .sidebar-link {
        justify-content: flex-start;
        gap: 0;
        padding: 0.5rem;
        overflow: visible !important;
      }

      .sidebar .user-info-card {
        flex-direction: column;
        align-items: center;
        margin-bottom: 9rem;
        margin-left: 4px;
        padding: 0.7rem;
        min-height: auto;
      }

      .sidebar .sidebar-title {
        justify-content: center;
        margin-left: 4px;
        padding: var(--spacing-2);
        width: calc(100% - 8px);
        min-height: 26px;
        font-size: 0;
      }

      .sidebar .title-text {
        display: none;
      }

      /* Override expanded active style on tablet */
      .sidebar:not(.collapsed) .sidebar-item.active .sidebar-link {
        border-color: transparent;
        background: transparent;
        color: var(--color-black) !important;
      }

      .sidebar:not(.collapsed)
        .sidebar-item.active
        .sidebar-link
        .icon::before {
        position: absolute;
        z-index: -1;
        inset: -0.55rem;
        border-radius: var(--glass-card-radius);
        background: linear-gradient(135deg, #e9f1f7 0%, #75bffc 100%);
        content: '';
      }

      .sidebar:not(.collapsed)
        .sidebar-item:not(.active)
        .sidebar-link:hover
        .icon::before {
        position: absolute;
        z-index: -1;
        inset: -0.525rem;
        border-radius: var(--glass-card-radius);
        background: var(--nav-hover-bg);
        content: '';
      }

      .sidebar:not(.collapsed) .sidebar-item:not(.active) .sidebar-link:hover {
        background: transparent;
      }
    }
  }
</style>
