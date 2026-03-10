<!--
  AppHeader.svelte
  App layout header — logo, sidebar toggle, user info, token timer, logout
  Extracted from +layout.svelte for max-lines compliance
-->
<script lang="ts">
  import { resolve } from '$app/paths';

  import RoleSwitch from '$lib/components/RoleSwitch.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import {
    getAvatarColorClass,
    getProfilePictureUrl,
  } from '$lib/utils/avatar-helpers';

  interface UserInfo {
    id?: number;
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: 'root' | 'admin' | 'employee' | 'dummy';
    profilePicture?: string;
  }

  interface Props {
    sidebarCollapsed: boolean;
    tokenTimeLeft: string;
    tokenWarning: boolean;
    tokenExpired: boolean;
    user: UserInfo | null;
    userRole: 'root' | 'admin' | 'employee' | 'dummy';
    activeRole: 'root' | 'admin' | 'employee' | 'dummy';
    currentRole: 'root' | 'admin' | 'employee' | 'dummy';
    onToggleSidebar: () => void;
    onShowLogoutModal: () => void;
  }

  const {
    sidebarCollapsed,
    tokenTimeLeft,
    tokenWarning,
    tokenExpired,
    user,
    userRole,
    activeRole,
    currentRole,
    onToggleSidebar,
    onShowLogoutModal,
  }: Props = $props();

  /**
   * Resolve dynamic path with base prefix.
   * Type assertion needed for runtime-computed paths.
   */
  function resolveDynamicPath(path: string): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument -- Dynamic paths can't match SvelteKit's static route types
    return resolve(path as any, {});
  }

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
</script>

<header class="header">
  <button
    type="button"
    class="sidebar-toggle"
    onclick={onToggleSidebar}
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
    class:collapsed={sidebarCollapsed}
  >
    <img
      src="/images/logo_darkmode.png"
      alt="Assixx Logo"
      class="logo-full logo-dark"
    />
    <img
      src="/images/logo_lightmode.png"
      alt="Assixx Logo"
      class="logo-full logo-light"
    />
    <img
      src="/images/logo_collapsed_darkmode.png"
      alt="Assixx Logo"
      class="logo-small logo-dark"
    />
    <img
      src="/images/logo_collapsed_lightmode.png"
      alt="Assixx Logo"
      class="logo-small logo-light"
    />
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
        onclick={onShowLogoutModal}
        title="Abmelden"
        aria-label="Abmelden"
      >
        <i class="fas fa-sign-out-alt"></i>
      </button>
    </div>
  </div>
</header>

<style>
  .header {
    display: flex;
    position: sticky;
    top: 0;
    justify-content: space-between;
    align-items: center;
    z-index: 1000;

    background: var(--header-bg);
    padding: 0.5rem 1rem;
    height: 65px;
    min-height: 3.5rem;
  }

  :global(html:not(.dark)) .header {
    box-shadow: 0 1px 2px
      color-mix(in oklch, var(--color-black) 18%, transparent);
  }

  .header-content {
    display: flex;
    flex: 1;
    justify-content: flex-end;
  }

  .logo-container {
    display: grid;
    align-items: center;
    margin-right: var(--spacing-6);
    margin-bottom: -3px;
    width: 135px;
    overflow: hidden;
    text-decoration: none;
  }

  .logo-container.collapsed {
    width: 47px;
  }

  /* Both logos stacked in same grid cell */
  .logo-full,
  .logo-small {
    grid-area: 1 / 1;
  }

  /* Full logo: on top, instant hide on collapse, slow fade in on expand */
  .logo-full {
    z-index: 1;
    margin-bottom: 3px;
    margin-left: -10px;
    width: 135px;
    transition: opacity 0.4s ease 0.05s;
  }

  .logo-container.collapsed .logo-full {
    opacity: 0%;
    transition: none;
  }

  /* Collapsed logo: instant show on collapse, instant hide on expand */
  .logo-small {
    margin-bottom: 8px;
    width: 47px;
    opacity: 0%;
    pointer-events: none;
  }

  .logo-container.collapsed .logo-small {
    opacity: 100%;
    pointer-events: auto;
  }

  /* Logo theme switching */
  .logo-light {
    display: none;
  }

  :global(html:not(.dark)) .logo-dark {
    display: none;
  }

  :global(html:not(.dark)) .logo-light {
    display: inline;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: calc(var(--spacing-6) + 8px);
  }

  #user-info {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    border: none;
    border-radius: 0;
    background: transparent;
    backdrop-filter: none;
    padding: 0.2rem 0.5rem;
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
    color: var(--color-amber-light);
    font-weight: 600;
  }

  .token-timer--expired {
    color: var(--color-coral);
    font-weight: 700;
  }

  #user-name {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Sidebar Toggle Button */
  .sidebar-toggle {
    display: flex;
    position: relative;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    margin-right: 15px;
    margin-left: 7px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    width: 40px;
    height: 40px;
    color: var(--color-text-primary);
  }

  .sidebar-toggle:hover {
    transform: scale(1.05);
    background: var(--glass-bg-active);
  }

  .sidebar-toggle:hover .toggle-icon {
    opacity: 80%;
  }

  /* Role Switch Dropdown — child component styling */
  :global(.role-switch-dropdown) {
    margin-right: 12px;
    min-width: 220px;
    font-size: 12px;
    scale: 0.85;
    transform-origin: center;
  }

  :global(.role-switch-dropdown .dropdown__option i) {
    margin-right: 8px !important;
  }

  :global(.role-switch-dropdown .dropdown__trigger span i) {
    margin-right: 8px !important;
  }

  /* Logout Button */
  #logout-btn {
    padding: 10px 15px;
  }

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
    .header {
      height: var(--header-height-mobile);
      padding: 0.25rem 0.5rem;
    }

    #user-name {
      display: none;
    }

    .logo-container {
      width: 100px;
    }

    .logo-full {
      width: 100px;
    }
  }
</style>
