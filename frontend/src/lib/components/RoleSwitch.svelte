<script lang="ts">
  import { showSuccessAlert, showWarningAlert, showErrorAlert } from '$lib/stores/toast';
  import { getApiClient } from '$lib/utils/api-client';
  import { setActiveRole } from '$lib/utils/auth';
  import { buildLoginUrl } from '$lib/utils/build-apex-url';
  import { getErrorMessage } from '$lib/utils/error';
  import { createLogger } from '$lib/utils/logger';
  import { broadcastRoleSwitch } from '$lib/utils/role-sync.svelte';
  import { getTokenManager } from '$lib/utils/token-manager';

  const log = createLogger('RoleSwitch');

  // =============================================================================
  // SVELTE 5 RUNES - Role Switch Dropdown
  // 1:1 Copy from frontend/src/scripts/components/navigation/render.ts
  // + frontend/src/scripts/auth/role-switch.ts
  // =============================================================================

  // Props
  type RoleType = 'root' | 'admin' | 'employee' | 'dummy';

  interface Props {
    userRole: RoleType;
    activeRole: RoleType;
  }

  const { userRole, activeRole }: Props = $props();

  // Dropdown State
  let isOpen = $state(false);
  let isSwitching = $state(false);

  // =============================================================================
  // CONSTANTS - Icons (Google Material Symbols)
  // =============================================================================

  const roleIcons: Record<RoleType, string> = {
    root: 'manage_accounts',
    admin: 'supervisor_account',
    employee: 'person_apron',
    dummy: 'desktop_windows',
  };

  const roleLabels: Record<RoleType, string> = {
    root: 'Root-Ansicht',
    admin: 'Admin-Ansicht',
    employee: 'Mitarbeiter-Ansicht',
    dummy: 'Dummy-Ansicht',
  };

  const roleDisplayNames: Record<RoleType, string> = {
    root: 'Root',
    admin: 'Admin',
    employee: 'Mitarbeiter',
    dummy: 'Dummy',
  };

  // =============================================================================
  // HELPER FUNCTIONS
  // =============================================================================

  function getRoleDisplayName(role: RoleType): string {
    return roleDisplayNames[role];
  }

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const currentIcon = $derived(roleIcons[activeRole]);
  const currentLabel = $derived(roleLabels[activeRole]);

  // Available roles based on userRole
  const availableRoles = $derived<readonly RoleType[]>(
    userRole === 'root' ? (['root', 'admin', 'employee'] as const)
    : userRole === 'admin' ? (['admin', 'employee'] as const)
    : [],
  );

  // =============================================================================
  // HELPER FUNCTIONS
  // =============================================================================

  interface EndpointResult {
    endpoint: string;
    description: string;
  }

  // Transition lookup table for role switches
  const ROLE_TRANSITIONS: Record<string, EndpointResult> = {
    'admin->root': {
      endpoint: '/api/v2/role-switch/to-original',
      description: 'Admin → Root',
    },
    'employee->root': {
      endpoint: '/api/v2/role-switch/to-original',
      description: 'Employee → Root',
    },
    'root->admin': {
      endpoint: '/api/v2/role-switch/root-to-admin',
      description: 'Root → Admin',
    },
    'root->employee': {
      endpoint: '/api/v2/role-switch/to-employee',
      description: 'Root → Employee',
    },
    'admin->employee': {
      endpoint: '/api/v2/role-switch/to-employee',
      description: 'Admin → Employee',
    },
  };

  function determineEndpoint(targetRole: RoleType, currentActiveRole: RoleType): EndpointResult {
    const transitionKey = `${currentActiveRole}->${targetRole}`;

    // Special case: employee → admin (needs intermediate step)
    if (transitionKey === 'employee->admin') {
      if (userRole === 'root') {
        log.warn('Cannot switch directly from Employee to Admin');
        return {
          endpoint: '/api/v2/role-switch/to-original',
          description: 'Employee → Root first',
        };
      }
      return {
        endpoint: '/api/v2/role-switch/to-original',
        description: 'Employee → Admin',
      };
    }

    return ROLE_TRANSITIONS[transitionKey] ?? { endpoint: '', description: '' };
  }

  const DASHBOARD_URLS: Record<RoleType, string> = {
    root: '/root-dashboard',
    admin: '/admin-dashboard',
    employee: '/employee-dashboard',
    dummy: '/blackboard',
  };

  function getDashboardUrl(role: RoleType): string {
    return DASHBOARD_URLS[role];
  }

  interface RoleSwitchResult {
    token?: string;
    user?: { activeRole?: RoleType };
  }

  function updateStorageAfterSwitch(result: RoleSwitchResult): void {
    if (result.token !== undefined && result.token !== '') {
      localStorage.setItem('accessToken', result.token);
    }
    if (result.user?.activeRole !== undefined) {
      setActiveRole(result.user.activeRole);

      // CRITICAL: Broadcast role switch to other tabs
      // Uses BroadcastChannel + triggers storage event for cross-tab sync
      broadcastRoleSwitch(result.user.activeRole as 'root' | 'admin' | 'employee', result.token);
    }
    // Clear role switch banner dismissals — migrated from localStorage to
    // cookies (commit 2026-04-30, eliminates SSR hydration flash on hard
    // reload). MUST stay in sync with ROLE_SWITCH_BANNER_DISMISS_COOKIE_PREFIX
    // in (app)/+layout.server.ts and ROLE_SWITCH_DISMISS_COOKIE_PREFIX in
    // (app)/+layout.svelte. Max-Age=0 deletes the cookie immediately.
    for (const role of ['root', 'admin', 'employee']) {
      document.cookie = `assixx_role_switch_banner_dismissed_${role}=; Path=/; Max-Age=0; SameSite=Lax`;
    }
  }

  function redirectToDashboard(role: RoleType): void {
    showSuccessAlert(`Wechsel zur ${getRoleDisplayName(role)}-Ansicht`);
    setTimeout(() => {
      window.location.href = getDashboardUrl(role);
    }, 1000);
  }

  interface RoleSwitchApiResponse {
    success?: boolean;
    data?: RoleSwitchResult;
    token?: string;
    user?: { activeRole?: RoleType };
  }

  /**
   * Execute the role switch against the backend.
   *
   * Uses the shared `apiClient` (not a custom `fetch`) so we inherit:
   *   - `credentials: 'include'` — cookie auth works when the in-memory
   *     Bearer token is absent (OAuth login-success is cookie-only).
   *   - Automatic Bearer-header attachment when TokenManager holds a token.
   *   - Centralised error handling + retry-on-401 token refresh.
   *
   * The previous hand-rolled `fetch` with hard-coded `Authorization: Bearer`
   * broke OAuth users because their `localStorage.accessToken` is null; the
   * request went out without any auth and 401'd. Routing through `apiClient`
   * unifies the path for password login and OAuth login.
   */
  async function executeRoleSwitch(endpoint: string): Promise<RoleSwitchResult> {
    // apiClient prepends `/api/v2` internally, so strip that prefix here.
    const relativeEndpoint =
      endpoint.startsWith('/api/v2') ? endpoint.slice('/api/v2'.length) : endpoint;
    const json = await getApiClient().post<RoleSwitchApiResponse>(relativeEndpoint, {});
    return json.data ?? json;
  }

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  function toggleDropdown(): void {
    if (!isSwitching) {
      isOpen = !isOpen;
    }
  }

  function closeDropdown(): void {
    isOpen = false;
  }

  async function handleRoleSelect(targetRole: RoleType): Promise<void> {
    if (targetRole === activeRole) {
      closeDropdown();
      showWarningAlert(`Sie sind bereits als ${getRoleDisplayName(targetRole)} aktiv!`);
      return;
    }

    isSwitching = true;
    closeDropdown();

    // Session check uses TokenManager's canonical session-signal predicate
    // (accepts either in-memory Bearer OR the `accessTokenExp` cookie set by
    // the backend on every auth event). The old `localStorage.getItem` gate
    // wrongly assumed localStorage is the only truth — OAuth users have a
    // valid session in cookies only, so the gate threw them to /login.
    if (!getTokenManager().hasValidToken()) {
      // ADR-050 Amendment 2026-04-22: cross-origin hard-nav to apex login.
      window.location.href = buildLoginUrl('session-expired');
      return;
    }

    const { endpoint } = determineEndpoint(targetRole, activeRole);
    if (endpoint === '') {
      log.warn({ targetRole, activeRole }, 'No valid endpoint for role switch');
      isSwitching = false;
      return;
    }

    try {
      const result = await executeRoleSwitch(endpoint);
      updateStorageAfterSwitch(result);
      redirectToDashboard(result.user?.activeRole ?? targetRole);
    } catch (err: unknown) {
      log.error({ err }, 'Role switch error');
      showErrorAlert(getErrorMessage(err));
      isSwitching = false;
    }
  }

  function handleClickOutside(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.role-switch-dropdown')) {
      closeDropdown();
    }
  }

  // Setup click outside listener
  $effect(() => {
    if (isOpen) {
      document.addEventListener('click', handleClickOutside, true);
      return () => {
        document.removeEventListener('click', handleClickOutside, true);
      };
    }
  });
</script>

<!-- Role Switch Dropdown (EXACT Storybook Structure) -->
{#if availableRoles.length > 0}
  <div class="dropdown role-switch-dropdown">
    <!-- Trigger -->
    <button
      class="dropdown__trigger"
      class:active={isOpen}
      id="roleSwitchDisplay"
      onclick={toggleDropdown}
      disabled={isSwitching}
      type="button"
    >
      <span>
        <span class="material-symbols-outlined mr-2">{currentIcon}</span>
        {currentLabel}
      </span>
      <i class="fas fa-chevron-down"></i>
    </button>

    <!-- Menu -->
    <div
      class="dropdown__menu"
      class:active={isOpen}
      id="roleSwitchDropdown"
    >
      {#each availableRoles as role (role)}
        <button
          class="dropdown__option"
          class:active={activeRole === role}
          data-value={role}
          onclick={() => handleRoleSelect(role)}
          type="button"
        >
          <span class="material-symbols-outlined mr-2">{roleIcons[role]}</span>
          {roleLabels[role]}
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  /* Reset button styles for dropdown trigger */

  /* Reset button styles for dropdown options */
  .dropdown__option {
    cursor: pointer;
    width: 100%;
    border: none;
    text-align: left;
    font-family: inherit;
  }

  .dropdown__trigger:disabled {
    opacity: 50%;
    cursor: not-allowed;
  }
</style>
