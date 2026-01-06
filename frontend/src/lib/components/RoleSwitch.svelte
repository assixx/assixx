<script>
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  // Toast notifications (1:1 like legacy alerts.ts)
  import { showSuccessAlert, showWarningAlert, showErrorAlert } from '$lib/stores/toast.js';

  // =============================================================================
  // SVELTE 5 RUNES - Role Switch Dropdown
  // 1:1 Copy from frontend/src/scripts/components/navigation/render.ts
  // + frontend/src/scripts/auth/role-switch.ts
  // =============================================================================

  // Props
  /** @type {{ userRole: 'root' | 'admin' | 'employee', activeRole: 'root' | 'admin' | 'employee' }} */
  const { userRole, activeRole } = $props();

  // Dropdown State
  let isOpen = $state(false);
  let isSwitching = $state(false);

  // =============================================================================
  // CONSTANTS - Icons (Google Material Symbols)
  // =============================================================================

  /** @type {Record<string, string>} */
  const roleIcons = {
    root: 'manage_accounts',
    admin: 'supervisor_account',
    employee: 'person_apron',
  };

  /** @type {Record<string, string>} */
  const roleLabels = {
    root: 'Root-Ansicht',
    admin: 'Admin-Ansicht',
    employee: 'Mitarbeiter-Ansicht',
  };

  /** @type {Record<string, string>} */
  const roleDisplayNames = {
    root: 'Root',
    admin: 'Admin',
    employee: 'Mitarbeiter',
  };

  // =============================================================================
  // LOGGING FUNCTIONS (1:1 from legacy role-switch.ts)
  // =============================================================================

  /**
   * Get role display name
   * @param {string} role
   * @returns {string}
   */
  function getRoleDisplayName(role) {
    return roleDisplayNames[role] ?? role;
  }

  /**
   * Log role switch details (1:1 from legacy)
   * @param {string} prefix
   * @param {string | null} originalRole
   * @param {string | null} currentActiveRole
   * @param {string} targetRole
   */
  function logRoleSwitchDetails(prefix, originalRole, currentActiveRole, targetRole) {
    console.info(`[${prefix}] ============ ROLE SWITCH DETAILS ============`);
    console.info(`[${prefix}] Original Role:`, originalRole);
    console.info(`[${prefix}] Current Active Role:`, currentActiveRole);
    console.info(`[${prefix}] Target Role:`, targetRole);
    console.info(`[${prefix}] Current View before switch:`, currentActiveRole ?? originalRole);
  }

  /**
   * Log switch decision (1:1 from legacy)
   * @param {string} prefix
   * @param {string} description
   * @param {string} endpoint
   */
  function logSwitchDecision(prefix, description, endpoint) {
    console.info(`[${prefix}] Switch decision:`, description);
    console.info(`[${prefix}] Using endpoint:`, endpoint);
    console.info(`[${prefix}] ===========================================`);
  }

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const currentIcon = $derived(roleIcons[activeRole] ?? 'person');
  const currentLabel = $derived(roleLabels[activeRole] ?? 'Ansicht');

  // Available roles based on userRole
  const availableRoles = $derived(
    userRole === 'root'
      ? /** @type {const} */ (['root', 'admin', 'employee'])
      : userRole === 'admin'
        ? /** @type {const} */ (['admin', 'employee'])
        : /** @type {const} */ ([]),
  );

  // =============================================================================
  // HELPER FUNCTIONS
  // =============================================================================

  /**
   * Determine API endpoint for role switch
   * @param {string} targetRole
   * @param {string} currentActiveRole
   * @returns {{ endpoint: string; description: string }}
   */
  function determineEndpoint(targetRole, currentActiveRole) {
    // Root switching back to root
    if (targetRole === 'root' && currentActiveRole !== 'root') {
      return {
        endpoint: '/api/v2/role-switch/to-original',
        description: `${currentActiveRole} → Root (to-original)`,
      };
    }

    // Root to Admin
    if (targetRole === 'admin') {
      if (currentActiveRole === 'root') {
        return {
          endpoint: '/api/v2/role-switch/root-to-admin',
          description: 'Root → Admin (root-to-admin)',
        };
      }
      // Employee to Admin (needs to go through original first)
      if (currentActiveRole === 'employee') {
        // Log warning like legacy
        console.warn('[RoleSwitch] Cannot switch directly from Employee to Admin!');
        console.info('[RoleSwitch] Need to go: Employee → Root → Admin');
        return {
          endpoint: '/api/v2/role-switch/to-original',
          description: 'Employee → Root first (to-original)',
        };
      }
    }

    // Admin switching back to admin
    if (targetRole === 'admin' && currentActiveRole === 'employee' && userRole === 'admin') {
      return {
        endpoint: '/api/v2/role-switch/to-original',
        description: 'Employee → Admin (to-original)',
      };
    }

    // To Employee
    if (
      targetRole === 'employee' &&
      (currentActiveRole === 'root' || currentActiveRole === 'admin')
    ) {
      return {
        endpoint: '/api/v2/role-switch/to-employee',
        description: `${currentActiveRole} → Employee (to-employee)`,
      };
    }

    return { endpoint: '', description: '' };
  }

  /**
   * Get dashboard URL for role
   * @param {string} role
   * @returns {string}
   */
  function getDashboardUrl(role) {
    if (role === 'root') return '/root-dashboard';
    if (role === 'admin') return '/admin-dashboard';
    return '/employee-dashboard';
  }

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  /** Toggle dropdown */
  function toggleDropdown() {
    if (!isSwitching) {
      isOpen = !isOpen;
    }
  }

  /** Close dropdown */
  function closeDropdown() {
    isOpen = false;
  }

  /**
   * Handle role selection
   * @param {'root' | 'admin' | 'employee'} targetRole
   */
  async function handleRoleSelect(targetRole) {
    // Get prefix based on userRole (root uses 'RoleSwitch', admin uses 'RoleSwitch-Admin')
    const prefix = userRole === 'root' ? 'RoleSwitch' : 'RoleSwitch-Admin';

    // Get stored roles for logging
    const storedUserRole = localStorage.getItem('userRole');
    const storedActiveRole = localStorage.getItem('activeRole');

    // Log role switch details (1:1 like legacy)
    logRoleSwitchDetails(prefix, storedUserRole, storedActiveRole, targetRole);

    // Don't switch if already in target role
    if (targetRole === activeRole) {
      console.info(`[${prefix}] Already in target role, showing warning`);
      closeDropdown();
      showWarningAlert(`Sie sind bereits als ${getRoleDisplayName(targetRole)} aktiv!`);
      return;
    }

    isSwitching = true;
    closeDropdown();

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        goto(resolve('/login'));
        return;
      }

      const { endpoint, description } = determineEndpoint(targetRole, activeRole);

      if (endpoint === '') {
        console.warn(`[${prefix}] No valid endpoint for switch!`, {
          from: activeRole,
          to: targetRole,
          original: storedUserRole,
        });
        isSwitching = false;
        return;
      }

      // Log switch decision (1:1 like legacy)
      logSwitchDecision(prefix, description, endpoint);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Fehler beim Rollenwechsel');
      }

      const json = await response.json();
      // API returns { success: true, data: { token, user } }
      const result = json.data ?? json;

      console.info(`[${prefix}] API Response:`, { token: !!result.token, user: result.user });

      // Update storage (use 'accessToken' like TokenManager)
      // Set directly without if-check (like Legacy)
      if (result.token) {
        localStorage.setItem('accessToken', result.token);
      }
      if (result.user?.activeRole) {
        localStorage.setItem('activeRole', result.user.activeRole);
        console.info(`[${prefix}] Updated activeRole in localStorage:`, result.user.activeRole);
      }

      // Clear role switch banner dismissals
      ['root', 'admin', 'employee'].forEach((role) => {
        localStorage.removeItem(`roleSwitchBannerDismissed_${role}`);
      });

      // Show success message (1:1 like legacy)
      const newRole = result.user?.activeRole ?? targetRole;
      showSuccessAlert(`Wechsel zur ${getRoleDisplayName(newRole)}-Ansicht...`);

      // Redirect to appropriate dashboard
      // Use window.location.href (like Legacy) to force full page reload
      // This ensures Layout remounts and reads fresh activeRole from localStorage
      const dashboardUrl = getDashboardUrl(newRole);
      setTimeout(() => {
        window.location.href = dashboardUrl;
      }, 1000); // 1 second like legacy for toast to show
    } catch (err) {
      const prefix = userRole === 'root' ? 'RoleSwitch' : 'RoleSwitch-Admin';
      console.error(`[${prefix}] Error:`, err);
      showErrorAlert(err instanceof Error ? err.message : 'Fehler beim Rollenwechsel');
      isSwitching = false;
    }
  }

  /**
   * Handle click outside to close dropdown
   * @param {MouseEvent} event
   */
  function handleClickOutside(event) {
    const target = /** @type {HTMLElement} */ (event.target);
    if (!target.closest('.role-switch-dropdown')) {
      closeDropdown();
    }
  }

  // Setup click outside listener
  $effect(() => {
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
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
    <div class="dropdown__menu" class:active={isOpen} id="roleSwitchDropdown">
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
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
