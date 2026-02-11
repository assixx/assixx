<script lang="ts">
  /**
   * SearchResultUser - Reusable search result item for user/admin/employee dropdowns
   * @module lib/components/SearchResultUser
   *
   * Design System component following the same pattern as badge, btn, avatar.
   * Uses HighlightText (XSS-safe) instead of {@html} for search term highlighting.
   *
   * Reference: ChatSidebar.svelte search results (the original implementation).
   *
   * @example
   * <SearchResultUser
   *   id={user.id}
   *   firstName={user.firstName}
   *   lastName={user.lastName}
   *   email={user.email}
   *   imageUrl={user.profileImageUrl}
   *   status={user.status}
   *   role={user.role}
   *   employeeNumber={user.employeeNumber}
   *   query={searchQuery}
   *   onclick={() => selectUser(user)}
   * />
   */
  import HighlightText from '$lib/components/HighlightText.svelte';
  import { getAvatarColorClass, getInitials } from '$lib/utils';

  interface Props {
    /** Unique user ID (used for avatar color generation) */
    id: number;
    firstName?: string;
    lastName?: string;
    username?: string;
    email?: string;
    /** Profile image URL for avatar display */
    imageUrl?: string | null;
    /** Online status indicator: 'online' | 'offline' | 'away' */
    status?: string;
    /** User role for badge: 'root' | 'admin' | 'employee' */
    role?: string;
    employeeNumber?: string;
    /** Job position / title (shown in meta line) */
    position?: string;
    /** Search query string for text highlighting */
    query: string;
    /** Click handler for selecting this result */
    onclick: () => void;
  }

  const {
    id,
    firstName,
    lastName,
    username,
    email,
    imageUrl,
    status,
    role,
    employeeNumber,
    position,
    query,
    onclick,
  }: Props = $props();

  /** Full display name with fallback to username */
  const displayName = $derived.by(() => {
    const fullName = `${firstName ?? ''} ${lastName ?? ''}`.trim();
    if (fullName !== '') return fullName;
    if (username !== undefined && username !== '') return username;
    return '';
  });

  /** Whether a profile image is available */
  const hasImage = $derived(
    imageUrl !== undefined && imageUrl !== null && imageUrl !== '',
  );

  /** Role label mapping */
  const ROLE_LABELS: Record<string, string> = {
    root: 'Root',
    admin: 'Admin',
    employee: 'Mitarbeiter',
  };

  /** Role badge variant mapping */
  const ROLE_BADGES: Record<string, string> = {
    root: 'badge--danger',
    admin: 'badge--warning',
    employee: 'badge--info',
  };
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
  class="search-input__result-item"
  {onclick}
>
  <div class="flex w-full items-center gap-3">
    <div class="avatar avatar--sm {hasImage ? '' : getAvatarColorClass(id)}">
      {#if hasImage}
        <img
          src={imageUrl}
          alt={username ?? displayName}
          class="avatar__image"
        />
      {:else}
        <span class="avatar__initials">
          {getInitials(firstName, lastName)}
        </span>
      {/if}
      {#if status !== undefined}
        <span class="avatar__status avatar__status--{status}"></span>
      {/if}
    </div>
    <div class="min-w-0 flex-1">
      <div class="search-input__result-name">
        <HighlightText
          text={displayName}
          {query}
        />
      </div>
      <div class="search-input__result-detail">
        {#if employeeNumber}#{employeeNumber} ·
        {/if}
        {#if email}
          <HighlightText
            text={email}
            {query}
          />
        {:else if username}
          {username}
        {/if}
      </div>
      {#if role !== undefined || position !== undefined}
        <div class="search-input__result-meta">
          {#if role}
            <span class="badge {ROLE_BADGES[role] ?? 'badge--info'} badge--xs">
              {ROLE_LABELS[role] ?? role}
            </span>
          {/if}
          {#if position}
            <span>
              <HighlightText
                text={position}
                {query}
              />
            </span>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>
