<script lang="ts">
  /**
   * App Sidebar Navigation
   * Extracted from +layout.svelte for modularity (max-lines)
   * @module (app)/_lib/AppSidebar
   */
  import { SvelteSet } from 'svelte/reactivity';

  import { resolve } from '$app/paths';
  import { page } from '$app/stores';

  import NotificationBadge from '$lib/components/NotificationBadge.svelte';
  import { notificationStore } from '$lib/stores/notification.store.svelte';

  import { type NavItem } from './navigation-config';
  import SidebarUserCard from './SidebarUserCard.svelte';

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
    role?: 'root' | 'admin' | 'employee' | 'dummy';
    employeeNumber?: string;
    profilePicture?: string;
    position?: string;
  }

  interface Props {
    collapsed: boolean;
    menuItems: NavItem[];
    currentRole: 'root' | 'admin' | 'employee' | 'dummy';
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
  const openSubmenus = new SvelteSet<string>();
  const openSubSubmenus = new SvelteSet<string>();

  // Close all submenus when sidebar collapses
  $effect(() => {
    if (collapsed) {
      openSubmenus.clear();
      openSubSubmenus.clear();
    }
  });

  // Auto-open submenu for the currently active page
  $effect(() => {
    if (collapsed) return;

    const activeParent = menuItems.find(
      (item: NavItem) => item.submenu !== undefined && isActive(item),
    );
    if (activeParent === undefined) return;

    openSubmenus.add(activeParent.id);

    const activeSubParent = activeParent.submenu?.find(
      (sub: NavItem) => sub.submenu !== undefined && isActive(sub),
    );
    if (activeSubParent !== undefined) {
      openSubSubmenus.add(activeSubParent.id);
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
    if (openSubmenus.has(itemId)) {
      openSubmenus.delete(itemId);
    } else {
      openSubmenus.add(itemId);
    }
  }

  /** Toggle nested sub-submenu */
  function toggleSubSubmenu(itemId: string): void {
    if (collapsed) return;
    if (openSubSubmenus.has(itemId)) {
      openSubSubmenus.delete(itemId);
    } else {
      openSubSubmenus.add(itemId);
    }
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
            class:open={openSubmenus.has(item.id)}
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
                {#if !openSubmenus.has(item.id)}
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
            <div
              class="submenu-wrapper"
              class:open={openSubmenus.has(item.id)}
            >
              <ul class="submenu">
                {#each item.submenu as subItem (subItem.id)}
                  {#if subItem.submenu !== undefined}
                    <li
                      class="submenu-item has-submenu"
                      class:active={isActive(subItem)}
                      class:open={openSubSubmenus.has(subItem.id)}
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
                        {#if !openSubSubmenus.has(subItem.id)}
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
                      <div
                        class="submenu-wrapper"
                        class:open={openSubSubmenus.has(subItem.id)}
                      >
                        <ul class="submenu submenu--nested">
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
                                {#if nestedItem.badgeType && openSubSubmenus.has(subItem.id)}
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
                      </div>
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
                        {#if subItem.badgeType && openSubmenus.has(item.id)}
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
            </div>
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

  <!-- Sidebar Footer Area — pinned to bottom via flex -->
  <div class="sidebar-footer-area">
    <SidebarUserCard
      {user}
      {tenant}
      {roleBadgeClass}
      {roleBadgeText}
      {collapsed}
    />
  </div>
</aside>

<style>
  /* Base sidebar — flex column so footer stays pinned at bottom */
  .sidebar {
    display: flex;
    position: sticky;
    top: 80px;
    left: 0;
    flex-direction: column;
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
    overflow: hidden;
  }

  /* Nav scrolls independently, footer stays visible */
  .sidebar-nav {
    display: flex;
    position: relative;
    flex: 1;
    flex-direction: column;
    padding-left: var(--spacing-4);
    min-height: 0;
    overflow: hidden auto;
    scrollbar-width: thin;
    scrollbar-color: color-mix(in oklch, var(--color-black) 25%, transparent)
      transparent;
  }

  :global(html.dark) .sidebar-nav {
    scrollbar-color: var(--glass-border-sidebar-tree) transparent;
  }

  .sidebar-footer-area {
    flex-shrink: 0;
  }

  /* Collapsed sidebar */
  .sidebar.collapsed {
    margin-left: 10px;
    width: 4.5rem !important;
    min-width: 4.5rem !important;
  }

  .sidebar.collapsed .sidebar-link .label {
    display: none;
  }

  .sidebar.collapsed .sidebar-link {
    justify-content: flex-start;
    gap: 0;
    background: transparent;
    padding: 0.5rem;
    overflow: visible !important;
    font-size: 0.875rem !important;
    line-height: 1.25rem !important;
  }

  .sidebar-link .icon :global(svg) {
    display: block;
    width: 1.063rem !important;
    height: 1.063rem !important;
  }

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
    background: linear-gradient(
      135deg,
      oklch(95.55% 0.0129 240.14) 0%,
      oklch(76.44% 0.1084 243.55) 100%
    );
    content: '';
  }

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

  /* Sidebar menu */
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
    margin-bottom: 0.3rem;
    border: 1px solid transparent;
    border-radius: var(--glass-card-radius);
    padding: 0.5rem;
    width: 100%;
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

  .sidebar-item {
    margin: 0;
    padding: 0;
    margin-right: 10px;
  }

  .sidebar-item.has-submenu .sidebar-link {
    position: relative;
    cursor: pointer;
    border: none;
    background: none;
    text-align: left;
    font-family: inherit;
  }

  .sidebar:not(.collapsed) .sidebar-item:not(.active) .sidebar-link:hover {
    background: var(--nav-hover-bg);
  }

  .sidebar:not(.collapsed) .sidebar-item.active .sidebar-link {
    border-color: var(--color-accent-bg);
    background: var(--color-accent-bg);
    color: var(--color-black);
  }

  /* Submenu */
  .submenu-arrow {
    opacity: 60%;
    margin-left: auto;
    transition: transform 0.25s ease;
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

  /* Smooth expand/collapse via CSS grid trick */
  .submenu-wrapper {
    display: grid;
    grid-template-rows: 0fr;
    overflow: hidden;
    transition:
      grid-template-rows 0.25s ease,
      max-height 0s 0.25s;
    max-height: 0;
    pointer-events: none;
    visibility: hidden;
  }

  .submenu-wrapper.open {
    grid-template-rows: 1fr;
    transition:
      grid-template-rows 0.25s ease,
      visibility 0s 0s,
      max-height 0s 0s;
    max-height: none;
    pointer-events: auto;
    visibility: visible;
  }

  .submenu {
    min-height: 0; /* required for grid-template-rows: 0fr to work */
    overflow: hidden; /* required for grid item to fully collapse below its padding */
    margin: 0 0 0 1.5rem;
    padding: 0.25rem 0 0.313rem 1rem;
    list-style: none;
  }

  .submenu--nested {
    margin-left: 0.5rem;
  }

  .submenu-link--toggle {
    cursor: pointer;
    border: none;
    background: none;
    width: 100%;
    text-align: left;
    font-family: inherit;
  }

  .sidebar.collapsed .submenu-wrapper {
    display: none !important;
  }

  .submenu-item {
    position: relative;
    margin-bottom: 0.125rem;
  }

  .submenu-item::before {
    content: '';
    position: absolute;
    top: 0;
    left: -1rem;
    width: 0.625rem;
    height: 50%;
    border-left: var(--glass-border-sidebar-tree);
    border-bottom: var(--glass-border-sidebar-tree);
    border-bottom-left-radius: 6px;
  }

  .submenu-item::after {
    content: '';
    position: absolute;
    top: 50%;
    left: -1rem;
    height: calc(50% + 0.125rem);
    border-left: var(--glass-border-sidebar-tree);
  }

  .submenu-item:last-child::after {
    display: none;
  }

  .submenu-link {
    display: flex;
    position: relative;
    align-items: center;
    gap: 0.5rem;
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

  /* Navigation Badges — targets NotificationBadge child component */
  .sidebar :global(.nav-badge) {
    display: inline-block;
    position: absolute;
    top: 8px;
    right: 10px;
    border-radius: 50px;
    background: linear-gradient(
      0deg,
      oklch(61.6% 0.2378 27.96 / 71%),
      oklch(61.6% 0.2378 27.96 / 76%)
    );
    min-width: 24px;
    color: var(--color-white);
    font-weight: 700;
    font-size: 0.7rem;
    text-align: center;
  }

  .sidebar :global(.nav-badge-kvp) {
    background: linear-gradient(
      0deg,
      color-mix(in oklch, var(--color-success) 71%, transparent),
      color-mix(in oklch, var(--color-success) 76%, transparent)
    );
  }

  .sidebar :global(.nav-badge-surveys) {
    right: 15px;
    backdrop-filter: blur(10px);
    border: 1px solid color-mix(in oklch, var(--color-warning) 30%, transparent);
    border-radius: 12px;
    background: color-mix(in oklch, var(--color-warning) 15%, transparent);
    padding: 3px 8px;
    min-width: 20px;
    color: var(--color-warning);
    font-weight: 600;
    font-size: 0.75rem;
  }

  .sidebar :global(.nav-badge-documents) {
    border-radius: 10px;
    background: var(--color-primary);
    min-width: 18px;
    color: var(--color-white);
  }

  .sidebar :global(.nav-badge-lean-parent) {
    right: 40px;
    backdrop-filter: blur(10px);
    background: oklch(77.2% 0.1738 64.55 / 70%);
    color: var(--color-white);
    font-weight: 600;
  }

  .sidebar :global(.nav-badge-child) {
    top: 50%;
    transform: translateY(-50%);
  }

  .sidebar :global(.nav-badge-child-default) {
    border-radius: 10px;
    background: var(--color-deep-orange);
    min-width: 18px;
    color: var(--color-white);
  }

  /* Collapsed sidebar — badges as dots */
  .sidebar.collapsed :global(.nav-badge) {
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

  .sidebar.collapsed .submenu-link :global(.nav-badge) {
    top: 50% !important;
    right: 8px !important;
    transform: translateY(-50%) !important;
  }

  /* Mobile: < 768px */
  @media (width < 768px) {
    .sidebar {
      position: fixed;
      top: var(--header-height-mobile);
      left: 0;
      z-index: 200;
      transform: translateX(-100%);
      transition: transform 0.3s ease;
      margin-left: 0;
      width: 280px;
      height: calc(100vh - var(--header-height-mobile));
      max-height: calc(100vh - var(--header-height-mobile));
    }

    .sidebar.mobile-open {
      transform: translateX(0);
      width: 280px !important;
      min-width: 280px !important;
    }

    .sidebar.mobile-open .sidebar-link .label {
      display: inline;
    }

    .sidebar.mobile-open .submenu-arrow {
      display: flex;
    }
  }

  /* Tablet: 768px – 1023px */
  @media (width >= 768px) and (width < 1024px) {
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

    .sidebar .submenu-wrapper {
      display: none !important;
    }

    .sidebar .sidebar-link {
      justify-content: flex-start;
      gap: 0;
      padding: 0.5rem;
      overflow: visible !important;
    }

    /* Override expanded active style on tablet */
    .sidebar:not(.collapsed) .sidebar-item.active .sidebar-link {
      border-color: transparent;
      background: transparent;
      color: var(--color-black) !important;
    }

    .sidebar:not(.collapsed) .sidebar-item.active .sidebar-link .icon::before {
      position: absolute;
      z-index: -1;
      inset: -0.55rem;
      border-radius: var(--glass-card-radius);
      background: linear-gradient(
        135deg,
        oklch(95.55% 0.0129 240.14) 0%,
        oklch(76.44% 0.1084 243.55) 100%
      );
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
</style>
