<script>
  import { onMount, onDestroy } from 'svelte';
  import { base } from '$app/paths';
  import { page } from '$app/stores';

  // Components
  import Breadcrumb from '$lib/components/Breadcrumb.svelte';
  import RoleSwitch from '$lib/components/RoleSwitch.svelte';

  // Session Manager (1:1 from Legacy - handles inactivity timeout + warning modal)
  import { getSessionManager } from '$lib/utils/session-manager';

  // Token Manager (singleton - manages JWT lifecycle + in-memory + localStorage)
  import { getTokenManager } from '$lib/utils/token-manager';

  // API Client (proactive token refresh on activity < 10 min)
  import { getApiClient } from '$lib/utils/api-client';
  const apiClient = getApiClient();

  // Layout-specific CSS (shared across all dashboard pages)
  import '../../styles/unified-navigation.css';

  // =============================================================================
  // SVELTE 5 RUNES - Dashboard Layout (Unified Navigation)
  // 1:1 Copy from frontend/src/scripts/components/navigation/*
  // =============================================================================

  // Props - children snippet for layout
  /** @type {{ children: import('svelte').Snippet }} */
  const { children } = $props();

  // User State
  /** @type {{ id?: number; firstName?: string; lastName?: string; email?: string; role?: 'root' | 'admin' | 'employee'; employeeNumber?: string; profilePicture?: string; position?: string } | null} */
  let user = $state(null);
  let _loading = $state(true);

  // Role Switch State (original role vs active role after switching)
  /** @type {'root' | 'admin' | 'employee'} */
  let userRole = $state('employee');
  /** @type {'root' | 'admin' | 'employee'} */
  let activeRole = $state('employee');

  // Sidebar State
  let sidebarCollapsed = $state(false);
  /** @type {string | null} */
  let openSubmenu = $state(null);

  // Token Timer State
  let tokenTimeLeft = $state('--:--');
  let tokenWarning = $state(false);
  let tokenExpired = $state(false);
  /** @type {ReturnType<typeof setInterval> | null} */
  let tokenTimerInterval = $state(null);

  // Logout Modal State
  let showLogoutModal = $state(false);

  // Tenant Info
  /** @type {{ companyName?: string } | null} */
  let tenant = $state(null);

  // Session Manager instance (for cleanup on destroy)
  /** @type {import('$lib/utils/session-manager').SessionManager | null} */
  let sessionManagerInstance = $state(null);


  // Current role for navigation (uses activeRole from role switch)
  // activeRole reflects the current view, which may differ from original userRole
  const currentRole = $derived.by(() => {
    /** @type {'root' | 'admin' | 'employee'} */
    return activeRole;
  });

  // =============================================================================
  // NAVIGATION MENU CONFIG
  // =============================================================================

  /** @type {Record<string, string>} */
  const ICONS = {
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

  /**
   * @typedef {Object} NavItem
   * @property {string} id
   * @property {string} [icon]
   * @property {string} label
   * @property {string} [url]
   * @property {boolean} [hasSubmenu]
   * @property {NavItem[]} [submenu]
   */

  /** @type {NavItem[]} */
  const rootMenuItems = $derived([
    { id: 'dashboard', icon: ICONS.home, label: 'Root Dashboard', url: '/root-dashboard' },
    { id: 'blackboard', icon: ICONS.pin, label: 'Schwarzes Brett', url: '/blackboard' },
    { id: 'root-users', icon: ICONS['user-shield'], label: 'Root User', url: '/manage-root' },
    { id: 'admins', icon: ICONS.admin, label: 'Administratoren', url: '/manage-admins' },
    { id: 'areas', icon: ICONS.sitemap, label: 'Bereiche', url: '/manage-areas' },
    { id: 'departments', icon: ICONS.building, label: 'Abteilungen', url: '/manage-departments' },
    { id: 'chat', icon: ICONS.chat, label: 'Chat', url: '/chat' },
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

  /** @type {NavItem[]} */
  const adminMenuItems = $derived([
    { id: 'dashboard', icon: ICONS.home, label: 'Übersicht', url: '/admin-dashboard' },
    { id: 'blackboard', icon: ICONS.pin, label: 'Schwarzes Brett', url: '/blackboard' },
    { id: 'employees', icon: ICONS.users, label: 'Mitarbeiter', url: '/manage-employees' },
    { id: 'teams', icon: ICONS.team, label: 'Teams', url: '/manage-teams' },
    { id: 'machines', icon: ICONS.generator, label: 'Maschinen', url: '/manage-machines' },
    {
      id: 'documents',
      icon: ICONS.document,
      label: 'Dokumente',
      hasSubmenu: true,
      submenu: [{ id: 'documents-explorer', label: 'Datei Explorer', url: '/documents-explorer' }],
    },
    { id: 'calendar', icon: ICONS.calendar, label: 'Kalender', url: '/calendar' },
    {
      id: 'lean-management',
      icon: ICONS.lean,
      label: 'LEAN-Management',
      hasSubmenu: true,
      submenu: [
        { id: 'kvp', label: 'KVP System', url: '/kvp' },
        { id: 'surveys', label: 'Umfragen', url: '/survey-admin' },
      ],
    },
    { id: 'shifts', icon: ICONS.clock, label: 'Schichtplanung', url: '/shifts' },
    { id: 'chat', icon: ICONS.chat, label: 'Chat', url: '/chat' },
    { id: 'settings', icon: ICONS.settings, label: 'Einstellungen', url: '#settings' },
    { id: 'profile', icon: ICONS.user, label: 'Mein Profil', url: '/admin-profile' },
  ]);

  /** @type {NavItem[]} */
  const employeeMenuItems = $derived([
    { id: 'dashboard', icon: ICONS.home, label: 'Dashboard', url: '/employee-dashboard' },
    { id: 'blackboard', icon: ICONS.pin, label: 'Schwarzes Brett', url: '/blackboard' },
    {
      id: 'documents',
      icon: ICONS.document,
      label: 'Dokumente',
      hasSubmenu: true,
      submenu: [{ id: 'documents-explorer', label: 'Datei Explorer', url: '/documents-explorer' }],
    },
    { id: 'calendar', icon: ICONS.calendar, label: 'Kalender', url: '/calendar' },
    {
      id: 'lean-management',
      icon: ICONS.lean,
      label: 'LEAN-Management',
      hasSubmenu: true,
      submenu: [
        { id: 'kvp', label: 'KVP System', url: '/kvp' },
        { id: 'surveys', label: 'Umfragen', url: '/survey-employee' },
      ],
    },
    { id: 'chat', icon: ICONS.chat, label: 'Chat', url: '/chat' },
    { id: 'shifts', icon: ICONS.clock, label: 'Schichtplanung', url: '/shifts' },
    { id: 'profile', icon: ICONS.user, label: 'Mein Profil', url: '/employee-profile' },
  ]);

  /** @type {NavItem[]} */
  const menuItems = $derived(
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
  function getInitials() {
    if (!user) return 'U';
    const first = user.firstName?.charAt(0) ?? '';
    const last = user.lastName?.charAt(0) ?? '';
    return (first + last).toUpperCase() || 'U';
  }

  /** Get display name */
  function getDisplayName() {
    if (!user) return 'User';
    const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    return fullName || user.email || 'User';
  }

  /** Get role badge class */
  function getRoleBadgeClass() {
    if (currentRole === 'root') return 'badge--danger';
    if (currentRole === 'admin') return 'badge--warning';
    return 'badge--info';
  }

  /** Get role badge text */
  function getRoleBadgeText() {
    if (currentRole === 'root') return 'Root';
    if (currentRole === 'admin') return 'Admin';
    return 'Mitarbeiter';
  }

  /** Check if menu item is active */
  /** @param {NavItem} item */
  function isActive(item) {
    const currentPath = $page.url.pathname;
    if (item.url) {
      return currentPath === item.url || currentPath.startsWith(item.url + '/');
    }
    if (item.submenu) {
      return item.submenu.some(
        (sub) => currentPath === sub.url || currentPath.startsWith(sub.url + '/'),
      );
    }
    return false;
  }

  // =============================================================================
  // API FUNCTIONS
  // =============================================================================

  /**
   * Load user info from API
   * Uses apiClient for proactive token refresh (auto-refresh when < 10 min)
   */
  async function loadUserInfo() {
    try {
      // apiClient handles auth + proactive token refresh
      /** @type {{ data?: any; tenant?: any; role?: string } & { firstName?: string; lastName?: string; email?: string; role?: string; employeeNumber?: string; profilePicture?: string; position?: string }} */
      const result = await apiClient.get('/users/me');

      user = result.data ?? result;
      tenant = result.tenant ?? result.data?.tenant ?? null;

      // Update role state from user data if not already set from localStorage
      if (user?.role) {
        const role = /** @type {'root' | 'admin' | 'employee'} */ (user.role);
        // If userRole wasn't in localStorage, set it from user data
        if (!localStorage.getItem('userRole')) {
          userRole = role;
          localStorage.setItem('userRole', role);
        }
        // If activeRole wasn't in localStorage, set it from user data
        if (!localStorage.getItem('activeRole')) {
          activeRole = role;
          localStorage.setItem('activeRole', role);
        }
      }
    } catch (err) {
      console.error('Error loading user:', err);
      // apiClient handles 401/403 automatically via clearTokens()
    } finally {
      _loading = false;
    }
  }

  /**
   * Logout user
   * CRITICAL: Must use TokenManager.clearTokens() to clear BOTH in-memory AND localStorage!
   * Direct localStorage writes don't clear the TokenManager singleton's in-memory state.
   */
  async function logout() {
    try {
      // Call logout API first (while we still have a valid token)
      await apiClient.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // CRITICAL: Reset ALL Svelte state to prevent stale data on re-login
      user = null;
      userRole = 'employee';
      activeRole = 'employee';
      tenant = null;
      _loading = true;

      // Clear role data from localStorage (TokenManager doesn't manage these)
      localStorage.removeItem('userRole');
      localStorage.removeItem('activeRole');
      localStorage.removeItem('token'); // Legacy token

      // CRITICAL: Use TokenManager to clear BOTH in-memory AND localStorage tokens
      // This also triggers a full page reload via window.location.replace('/login')
      // which completely destroys all JavaScript state including the TokenManager singleton
      getTokenManager().clearTokens('logout');
    }
  }

  // =============================================================================
  // TOKEN TIMER
  // =============================================================================

  /** Parse JWT and get expiration */
  /** @param {string} token */
  function getTokenExpiration(token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp ? payload.exp * 1000 : null;
    } catch {
      return null;
    }
  }

  /** Update token timer display */
  function updateTokenTimer() {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      tokenTimeLeft = '--:--';
      return;
    }

    const exp = getTokenExpiration(token);
    if (!exp) {
      tokenTimeLeft = '--:--';
      return;
    }

    const now = Date.now();
    const diff = exp - now;

    if (diff <= 0) {
      tokenTimeLeft = '00:00';
      tokenExpired = true;
      tokenWarning = false;
      return;
    }

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    tokenTimeLeft = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    tokenWarning = diff <= 120000; // 2 minutes warning
    tokenExpired = false;
  }

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  /** Toggle sidebar collapsed state */
  function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed;
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
  }

  /** Toggle submenu */
  /** @param {string} itemId */
  function toggleSubmenu(itemId) {
    openSubmenu = openSubmenu === itemId ? null : itemId;
  }

  /** Handle logout button click */
  function handleLogoutClick() {
    showLogoutModal = true;
  }

  /** Confirm logout */
  function confirmLogout() {
    showLogoutModal = false;
    logout();
  }

  /** Cancel logout */
  function cancelLogout() {
    showLogoutModal = false;
  }

  // =============================================================================
  // LIFECYCLE
  // =============================================================================

  /**
   * Re-initialize state from localStorage and refetch user data
   * Called on mount AND after navigation (to handle login → dashboard flow)
   */
  function initializeState() {
    // Load saved sidebar state
    const savedCollapsed = localStorage.getItem('sidebarCollapsed');
    if (savedCollapsed === 'true') {
      sidebarCollapsed = true;
    }

    // Load role switch state from localStorage
    const storedUserRole = localStorage.getItem('userRole');
    const storedActiveRole = localStorage.getItem('activeRole');
    if (storedUserRole === 'root' || storedUserRole === 'admin' || storedUserRole === 'employee') {
      userRole = storedUserRole;
    }
    if (
      storedActiveRole === 'root' ||
      storedActiveRole === 'admin' ||
      storedActiveRole === 'employee'
    ) {
      activeRole = storedActiveRole;
    } else if (storedUserRole) {
      activeRole = /** @type {'root' | 'admin' | 'employee'} */ (storedUserRole);
    }

    // Load user info from API
    loadUserInfo();
  }

  onMount(() => {
    initializeState();

    // Start token timer
    updateTokenTimer();
    tokenTimerInterval = setInterval(updateTokenTimer, 1000);

    // Initialize Session Manager (handles inactivity timeout + warning modal)
    // 1:1 like Legacy - SessionManager subscribes to TokenManager events
    sessionManagerInstance = getSessionManager();
  });

  onDestroy(() => {
    if (tokenTimerInterval) {
      clearInterval(tokenTimerInterval);
    }
    // Cleanup SessionManager
    if (sessionManagerInstance !== null) {
      sessionManagerInstance.destroy();
    }
  });
</script>

<!-- Header -->
<header class="header">
  <button class="sidebar-toggle" onclick={toggleSidebar} title="Sidebar ein-/ausklappen">
    <svg class="toggle-icon" width="30" height="30" viewBox="0 0 24 24" fill="white">
      {#if sidebarCollapsed}
        <path d="M4,6H20V8H4V6M4,11H15V13H4V11M4,16H20V18H4V16Z"></path>
      {:else}
        <path d="M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z"></path>
      {/if}
    </svg>
  </button>

  <a href={`${base}/${currentRole}-dashboard`} class="logo-container">
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
            <img src={user.profilePicture} alt={getDisplayName()} class="avatar__image" />
          </div>
        {:else}
          <div class="avatar avatar--md avatar--color-5">
            <span class="avatar__initials">{getInitials()}</span>
          </div>
        {/if}
        <span id="user-name">{getDisplayName()}</span>
      </div>

      <button
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
          {#if item.hasSubmenu && item.submenu}
            <li
              class="sidebar-item has-submenu"
              class:active={isActive(item)}
              class:open={openSubmenu === item.id}
            >
              <button class="sidebar-link" onclick={() => toggleSubmenu(item.id)}>
                <!-- eslint-disable-next-line svelte/no-at-html-tags -- Icons are hardcoded in ICONS object, safe -->
                <span class="icon">{@html item.icon}</span>
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
                    <!-- eslint-disable svelte/no-navigation-without-resolve -- Dynamic menu URLs -->
                    <a href={`${base}${subItem.url}`} class="submenu-link">{subItem.label}</a>
                    <!-- eslint-enable svelte/no-navigation-without-resolve -->
                  </li>
                {/each}
              </ul>
            </li>
          {:else}
            <li class="sidebar-item" class:active={isActive(item)}>
              <!-- eslint-disable svelte/no-navigation-without-resolve -- Dynamic menu URLs -->
              <a href={`${base}${item.url}`} class="sidebar-link">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -- Icons are hardcoded in ICONS object, safe -->
                <span class="icon">{@html item.icon}</span>
                <span class="label">{item.label}</span>
              </a>
              <!-- eslint-enable svelte/no-navigation-without-resolve -->
            </li>
          {/if}
        {/each}
      </ul>

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
    </nav>

    <!-- User Info Card -->
    <div class="user-info-card">
      {#if user?.profilePicture}
        <div class="avatar avatar--md">
          <img src={user.profilePicture} alt={getDisplayName()} class="avatar__image" />
        </div>
      {:else}
        <div class="avatar avatar--md avatar--color-0">
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
    <div class="confirm-modal confirm-modal--info">
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
          class="confirm-modal__btn confirm-modal__btn--cancel confirm-modal__btn--wide"
          onclick={cancelLogout}
        >
          Abbrechen
        </button>
        <button class="btn btn-danger confirm-modal__btn--wide" onclick={confirmLogout}>
          Abmelden
        </button>
      </div>
    </div>
  </div>
{/if}
