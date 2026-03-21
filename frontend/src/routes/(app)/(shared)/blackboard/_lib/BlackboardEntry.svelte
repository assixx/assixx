<script lang="ts">
  /**
   * BlackboardEntry - Individual Sticky Note Component
   *
   * Displays a single blackboard entry as a sticky note with:
   * - Title, content (truncated), author, date
   * - Priority and org level badges
   * - Expiration indicator
   * - Comment/attachment counts
   * - Read/unread status
   * - New badge
   */
  import {
    formatDateShort,
    getOrgLevelClass,
    getOrgLevelLabel,
    getPriorityClass,
    getPriorityLabel,
    isExpired,
    truncateText,
  } from './utils';

  import type { BlackboardEntry } from './types';

  interface Props {
    entry: BlackboardEntry;
    onclick?: (uuid: string, isConfirmed: boolean) => void;
  }

  const { entry, onclick }: Props = $props();

  // Derived values
  const isRead = $derived(entry.isConfirmed === true);
  const isNew = $derived(entry.firstSeenAt === null || entry.firstSeenAt === undefined);

  function handleClick(): void {
    if (onclick !== undefined) {
      onclick(entry.uuid, isRead);
    }
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && onclick !== undefined) {
      onclick(entry.uuid, isRead);
    }
  }
</script>

<div
  class="pinboard-item"
  onclick={handleClick}
  role="button"
  tabindex="0"
  onkeydown={handleKeyDown}
>
  <div class="sticky-note sticky-note--{entry.color} sticky-note--large">
    <div class="sticky-note__pin"></div>

    <!-- Header: Title + Expiration -->
    <div class="sticky-note__header">
      <div class="sticky-note__title">
        {entry.title}
        {#if isNew}
          <span class="badge badge--sm badge--success ml-2">Neu</span>
        {/if}
      </div>
      {#if entry.expiresAt}
        <span
          class="sticky-note__expires"
          class:sticky-note__expires--expired={isExpired(entry.expiresAt)}
          title={isExpired(entry.expiresAt) ? 'Abgelaufen' : 'Gültig bis'}
        >
          <i class="fas fa-clock"></i>
          {formatDateShort(entry.expiresAt)}
        </span>
      {/if}
    </div>

    <!-- Content (truncated) -->
    <div class="sticky-note__content">
      {truncateText(entry.content)}
    </div>

    <!-- Indicators: Comments, Attachments, Read Status -->
    <div class="sticky-note__indicators">
      {#if (entry.commentCount ?? 0) > 0}
        <span
          class="sticky-note__comments"
          title="Kommentare"
        >
          <i class="fas fa-comments"></i>
          {entry.commentCount}
        </span>
      {/if}
      {#if (entry.attachmentCount ?? 0) > 0}
        <span
          class="sticky-note__attachments"
          title="Anhänge"
        >
          <i class="fas fa-paperclip"></i>
          {entry.attachmentCount}
        </span>
      {/if}
      <span
        class="sticky-note__read-status"
        class:sticky-note__read-status--read={isRead}
        class:sticky-note__read-status--unread={!isRead}
        title={isRead ? 'Gelesen' : 'Ungelesen'}
      >
        <i class="fas {isRead ? 'fa-eye' : 'fa-eye-slash'}"></i>
      </span>
    </div>

    <!-- Footer: Badges + Author + Date -->
    <div class="sticky-note__footer">
      <div class="sticky-note__badges">
        <span class="sticky-note__badge {getPriorityClass(entry.priority)}">
          {getPriorityLabel(entry.priority)}
        </span>
        <span class="sticky-note__badge {getOrgLevelClass(entry.orgLevel)}">
          {getOrgLevelLabel(entry.orgLevel)}
        </span>
      </div>
      <div class="sticky-note__footer-row">
        <span class="sticky-note__author">
          <i class="fas fa-user"></i>
          {entry.authorFullName ?? entry.authorName ?? 'Unbekannt'}
        </span>
        <span class="sticky-note__date">
          <i class="fas fa-calendar"></i>
          {formatDateShort(entry.createdAt)}
        </span>
      </div>
    </div>
  </div>
</div>

<style>
  .pinboard-item {
    position: relative;
    z-index: 1;
  }

  .pinboard-item:hover {
    z-index: 10;
  }
</style>
