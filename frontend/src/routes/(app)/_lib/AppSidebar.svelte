<script lang="ts">
  /**
   * App Sidebar Navigation
   * Extracted from +layout.svelte for modularity (max-lines)
   * @module (app)/_lib/AppSidebar
   */
  import { resolve } from '$app/paths';
  import { page } from '$app/stores';

  import NotificationBadge from '$lib/components/NotificationBadge.svelte';
  import { notificationStore } from '$lib/stores/notification.store.svelte';
  import {
    getAvatarColorClass,
    getProfilePictureUrl,
  } from '$lib/utils/avatar-helpers';

  import { type NavItem } from './navigation-config';

  /**
   * Resolve dynamic path with base prefix.
   * Type assertion needed for runtime-computed paths that can't be
   * statically typed by SvelteKit's route system.
   */
  function resolveDynamicPath(path: string): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument -- Dynamic paths can't match SvelteKit's static route types
    return resolve(path as any, {});
  }

  interface UserInfo {
    id?: number;
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: 'root' | 'admin' | 'employee';
    employeeNumber?: string;
    profilePicture?: string;
    position?: string;
  }

  interface Props {
    collapsed: boolean;
    menuItems: NavItem[];
    currentRole: 'root' | 'admin' | 'employee';
    user: UserInfo | null;
    tenant: { id?: number; companyName?: string } | null;
    mobileMenuOpen?: boolean;
    isMobile?: boolean;
    onCloseMobile?: () => void;
  }

  const {
    collapsed,
    menuItems,
    currentRole,
    user,
    tenant,
    mobileMenuOpen = false,
    isMobile = false,
    onCloseMobile,
  }: Props = $props();

  // --- INTERNAL STATE ---
  let openSubmenu = $state<string | null>(null);
  let openSubSubmenu = $state<string | null>(null);

  // Close all submenus when sidebar collapses
  $effect(() => {
    if (collapsed) {
      openSubmenu = null;
      openSubSubmenu = null;
    }
  });

  // --- DERIVED ---

  const roleBadgeClass: string = $derived(
    currentRole === 'root' ? 'badge--danger'
    : currentRole === 'admin' ? 'badge--warning'
    : 'badge--info',
  );

  const roleBadgeText: string = $derived(
    currentRole === 'root' ? 'Root'
    : currentRole === 'admin' ? 'Admin'
    : 'Mitarbeiter',
  );

  // --- HELPERS ---

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

  /** Handle link click - close mobile menu on navigation */
  function handleLinkClick(): void {
    if (isMobile) {
      onCloseMobile?.();
    }
  }

  /** Toggle submenu */
  function toggleSubmenu(itemId: string): void {
    if (collapsed) return;
    openSubmenu = openSubmenu === itemId ? null : itemId;
    openSubSubmenu = null;
  }

  /** Toggle nested sub-submenu */
  function toggleSubSubmenu(itemId: string): void {
    if (collapsed) return;
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
</script>

<aside
  class="sidebar"
  class:collapsed
  class:mobile-open={mobileMenuOpen}
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
                            onclick={handleLinkClick}
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
                      onclick={handleLinkClick}
                    >
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
              onclick={handleLinkClick}
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
