<!--
  SidebarUserCard.svelte
  Sidebar footer — click-to-expand user info card
  Trigger: Avatar + Name + Chevron → expands to show full details
-->
<script lang="ts">
  import { resolve } from '$app/paths';

  import {
    type HierarchyLabels,
    DEFAULT_HIERARCHY_LABELS,
    resolvePositionDisplay,
  } from '$lib/types/hierarchy-labels';
  import { getAvatarColorClass, getProfilePictureUrl } from '$lib/utils/avatar-helpers';

  /**
   * Build-time version constant from `frontend/package.json`.
   * Injected by Vite `define` (see frontend/vite.config.ts) and kept in lockstep
   * with all workspace packages via Changesets Fixed-Group
   * (docs/how-to/HOW-TO-USE-CHANGESETS.md).
   */
  const appVersion: string = __APP_VERSION__;

  const versionInfoHref: string = resolve('/versioninfo');

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
    user: UserInfo | null;
    tenant: { id?: number; companyName?: string } | null;
    roleBadgeClass: string;
    roleBadgeText: string;
    collapsed: boolean;
    hierarchyLabels?: HierarchyLabels;
  }

  const {
    user,
    tenant,
    roleBadgeClass,
    roleBadgeText,
    collapsed,
    hierarchyLabels = DEFAULT_HIERARCHY_LABELS,
  }: Props = $props();

  /** Resolve position to human-readable display name */
  const positionDisplay: string | undefined = $derived(
    user?.position !== undefined ?
      resolvePositionDisplay(user.position, hierarchyLabels)
    : undefined,
  );

  let expanded = $state(false);

  /** Close details when sidebar collapses */
  $effect(() => {
    if (collapsed) {
      expanded = false;
    }
  });

  /** Get user initials for avatar fallback */
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

  function toggleExpanded(): void {
    expanded = !expanded;
  }
</script>

<div
  class="sidebar-footer"
  class:collapsed
  class:expanded
>
  <button
    type="button"
    class="footer-trigger"
    onclick={toggleExpanded}
    aria-expanded={expanded}
    title={collapsed ? getDisplayName() : undefined}
  >
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

    <span class="footer-name">{getDisplayName()}</span>
    <svg
      class="footer-chevron"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <path d="m7 15 5 5 5-5" />
      <path d="m7 9 5-5 5 5" />
    </svg>
  </button>

  <div
    class="footer-details"
    class:open={expanded}
  >
    <div class="footer-details-inner">
      <div class="detail-divider"></div>
      <div class="detail-company">{tenant?.companyName ?? 'Firma'}</div>
      {#if user?.email}
        <div class="detail-item">{user.email}</div>
      {/if}
      {#if positionDisplay}
        <div class="detail-item">{positionDisplay}</div>
      {/if}
      {#if user?.employeeNumber}
        <div class="detail-item detail-mono">{user.employeeNumber}</div>
      {/if}
      <span class="badge badge--sm {roleBadgeClass}">{roleBadgeText}</span>
    </div>
  </div>
</div>

<!--
  Version + bug-report row — sits under the user card, outside the glass
  container. Both links use the same dezente sidebar-version styling so the
  row feels like a single utility bar. Hash `#bug-report` jumps straight to
  the form section on /versioninfo. Hidden when sidebar is collapsed.
-->
{#if !collapsed}
  <div class="sidebar-footer-links">
    <a
      href={versionInfoHref}
      class="sidebar-version"
      title="Versionsinfo & Changelog"
    >
      v{appVersion}
    </a>
    <span
      class="sidebar-version-sep"
      aria-hidden="true">·</span
    >
    <a
      href="{versionInfoHref}#bug-report"
      class="sidebar-version"
      title="Fehler melden"
    >
      Fehler melden
    </a>
  </div>
{/if}

<style>
  .sidebar-footer {
    position: relative;
    margin: 0 8px 40px;
    border: var(--glass-border);
    border-radius: var(--radius-xl);
    background: var(--glass-bg);
    overflow: hidden;
  }

  /* Trigger button — always visible */
  .footer-trigger {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    border: none;
    border-radius: 0;
    background: var(--glass-bg-active);
    padding: 8px;
    width: 100%;
    min-height: 56px;
    color: inherit;
    font-family: inherit;
    text-align: left;
  }

  .footer-trigger:hover {
    background: var(--glass-bg-hover, color-mix(in oklch, var(--color-white) 5%, transparent));
  }

  .sidebar-footer.collapsed .footer-trigger {
    padding: 8px;
  }

  .sidebar-footer.collapsed .footer-details {
    display: none;
  }

  .footer-name {
    flex: 1;
    overflow: hidden;
    color: var(--text-secondary);
    font-weight: 500;
    font-size: 0.875rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .footer-chevron {
    flex-shrink: 0;
    opacity: 60%;
    color: var(--text-secondary);
  }

  /* Expandable details — same pattern as sidebar submenu-wrapper */
  .footer-details {
    display: grid;
    grid-template-rows: 0fr;
    overflow: hidden;
    background: var(--main-bg);
    transition:
      grid-template-rows 0.4s ease,
      visibility 0s 0.4s;
    visibility: hidden;
  }

  .footer-details.open {
    grid-template-rows: 1fr;
    transition:
      grid-template-rows 0.4s ease,
      visibility 0s 0s;
    visibility: visible;
  }

  .footer-details-inner {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-height: 0;
    overflow: hidden;
    padding: 0 14px;
    padding-bottom: 0;
    opacity: 0%;
    transition:
      opacity 0.3s ease,
      padding-bottom 0.4s ease;
  }

  .footer-details.open .footer-details-inner {
    padding-bottom: 12px;
    opacity: 100%;
  }

  .detail-divider {
    margin-bottom: 4px;
    border-bottom: 1px solid
      var(--glass-border, color-mix(in oklch, var(--color-white) 10%, transparent));
  }

  .detail-company {
    color: var(--primary-light);
    font-weight: 600;
    font-size: 0.75rem;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .detail-item {
    overflow: hidden;
    color: var(--text-muted);
    font-size: 0.813rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .detail-mono {
    letter-spacing: 2px;
  }

  .sidebar-footer :global(.badge) {
    margin-top: 4px;
    align-self: flex-start;
  }

  /* Row wrapper under the card — groups version + bug-report link inline.
     Negative top margin tucks close to the glass container since
     .sidebar-footer keeps its own 30px bottom margin for non-version layouts. */
  .sidebar-footer-links {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 4px;

    margin: -22px 8px 12px;
  }

  /* Both links share the same muted tone so the row reads as one utility
     bar. Only the hover state diverges (primary-blue for the action). */
  .sidebar-version {
    padding: 2px 6px;

    color: var(--text-secondary, color-mix(in oklch, var(--color-white) 65%, transparent));

    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
    text-decoration: none;

    letter-spacing: 0.3px;

    transition: color 0.2s ease;
  }

  .sidebar-version:hover,
  .sidebar-version:focus-visible {
    color: var(--color-primary);
    text-decoration: none;
  }

  .sidebar-version-sep {
    color: var(--text-secondary, color-mix(in oklch, var(--color-white) 65%, transparent));
    font-size: 0.8rem;
    user-select: none;
  }
</style>
