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

  import { afterNavigate, goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  import Breadcrumb from '$lib/components/Breadcrumb.svelte';
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

  /** Toggle sidebar collapsed state */
  function toggleSidebar(): void {
    sidebarCollapsed = !sidebarCollapsed;
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
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

    // Connect WebSocket for presence tracking (user appears "online" app-wide)
    void connectPresenceWebSocket();

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
    <!-- Sidebar Navigation (extracted to AppSidebar for modularity) -->
    <AppSidebar
      collapsed={sidebarCollapsed}
      {menuItems}
      {currentRole}
      {user}
      {tenant}
    />

    <!-- Main Content (Child Routes) -->
    <main class="min-h-[calc(100vh-60px)] flex-1 bg-(--background-primary) p-4">
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
