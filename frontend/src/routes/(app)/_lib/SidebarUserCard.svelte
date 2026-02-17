<!--
  SidebarUserCard.svelte
  User info card in the sidebar — avatar, name, role badge
  Extracted from AppSidebar.svelte for max-lines compliance
-->
<script lang="ts">
  import {
    getAvatarColorClass,
    getProfilePictureUrl,
  } from '$lib/utils/avatar-helpers';

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
    user: UserInfo | null;
    tenant: { id?: number; companyName?: string } | null;
    roleBadgeClass: string;
    roleBadgeText: string;
  }

  const { user, tenant, roleBadgeClass, roleBadgeText }: Props = $props();

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

<style>
  .user-info-card {
    position: relative;
    align-items: center;

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

  .user-info-card > :global(*) {
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

  .user-name {
    overflow: hidden;
    color: var(--text-muted);
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .user-position {
    margin-top: 2px;
    font-size: 13px;
  }

  .employee-number__text {
    letter-spacing: 2px;
    font-size: 13px;
  }

  /* Role Badge spacing */
  .user-info-card :global(.badge) {
    margin-top: 6px;
  }
</style>
