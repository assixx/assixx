<script lang="ts">
  /**
   * KVP Suggestion Card - Single suggestion card in the grid
   * Extracted from +page.svelte for modularity (max-lines rule)
   */
  import {
    getStatusBadgeClass,
    getStatusText,
    getPriorityBadgeClass,
    getPriorityText,
    getVisibilityBadgeClass,
    getVisibilityInfo,
    formatDate,
    getSharedByInfo,
    getAttachmentText,
    isFaIcon,
  } from './utils';

  import type { KvpSuggestion } from './types';

  interface Props {
    suggestion: KvpSuggestion;
    onclick: () => void;
  }

  const { suggestion, onclick }: Props = $props();

  const visibilityInfo = $derived(getVisibilityInfo(suggestion));
  const isRead = $derived(suggestion.isConfirmed === true);
  const isNew = $derived(
    suggestion.firstSeenAt === null || suggestion.firstSeenAt === undefined,
  );
</script>

<div
  class="card kvp-card w-full cursor-pointer text-left"
  role="button"
  tabindex="0"
  {onclick}
  onkeydown={(e) => {
    if (e.key === 'Enter') onclick();
  }}
>
  <!-- Status container: Eye icon (left) + Badges (right) -->
  <div class="kvp-status-container">
    <!-- Read confirmation status -->
    <span
      class="kvp-read-status"
      class:kvp-read-status--read={isRead}
      class:kvp-read-status--unread={!isRead}
      title={isRead ? 'Gelesen' : 'Ungelesen'}
    >
      <i class="fas {isRead ? 'fa-eye' : 'fa-eye-slash'}"></i>
    </span>

    <div class="flex items-center gap-2">
      {#if isNew}
        <span class="badge badge--sm badge--success">Neu</span>
      {/if}
      <span class="badge {getStatusBadgeClass(suggestion.status)}">
        {getStatusText(suggestion.status)}
      </span>
    </div>
  </div>

  <div class="mb-4">
    <h3 class="suggestion-title">{suggestion.title}</h3>
    <div class="suggestion-meta">
      <span>
        <i class="fas fa-user"></i>
        {suggestion.submittedByName}
        {suggestion.submittedByLastname}
      </span>
      <span>
        <i class="fas fa-calendar"></i>
        {formatDate(suggestion.createdAt)}
      </span>
      {#if suggestion.attachmentCount !== undefined && suggestion.attachmentCount > 0}
        <span>
          <i class="fas fa-camera"></i>
          {getAttachmentText(suggestion.attachmentCount)}
        </span>
      {/if}
    </div>
    <div class="share-info">
      <i class="fas fa-share-alt"></i>
      <span class="badge {getVisibilityBadgeClass(suggestion.orgLevel)}">
        <i class="fas {visibilityInfo.icon}"></i>
        <span>{visibilityInfo.text}{getSharedByInfo(suggestion)}</span>
      </span>
    </div>
  </div>

  <div class="suggestion-description">{suggestion.description}</div>

  <div class="suggestion-footer">
    <div class="flex flex-wrap gap-2">
      <span class="badge {getPriorityBadgeClass(suggestion.priority)}">
        {getPriorityText(suggestion.priority)}
      </span>
      <div
        class="category-tag"
        class:category-tag--deleted={suggestion.categoryIsDeleted === true}
        style:background="{suggestion.categoryColor}20"
        style:color={suggestion.categoryColor}
        style:border="1px solid {suggestion.categoryColor}"
      >
        {#if isFaIcon(suggestion.categoryIcon)}
          <i
            class="fas fa-{suggestion.categoryIcon}"
            style:margin-right="0.1em"
          ></i>
        {:else}
          {suggestion.categoryIcon}
        {/if}
        {suggestion.categoryName}
      </div>
    </div>
  </div>
</div>

<style>
  .kvp-card {
    position: relative;
    cursor: pointer;
  }

  .kvp-card:hover {
    transform: translateY(-4px);
    border-color: oklch(64.49% 0.1953 252.39 / 50%);
  }

  .kvp-status-container {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    position: absolute;
    top: var(--spacing-4);
    right: var(--spacing-4);
  }

  .kvp-read-status {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    font-size: 0.9rem;
    transition:
      background-color 0.2s ease,
      color 0.2s ease,
      transform 0.2s ease;
  }

  .kvp-read-status--read {
    background: oklch(69.59% 0.1491 162.51 / 20%);
    color: oklch(69.59% 0.1491 162.51);
  }

  .kvp-read-status--unread {
    background: oklch(76.86% 0.1646 70.08 / 20%);
    color: oklch(76.86% 0.1646 70.08);
  }

  .kvp-read-status:hover {
    transform: scale(1.1);
  }

  .suggestion-title {
    margin-bottom: var(--spacing-2);
    color: var(--text-primary);
    font-weight: 600;
    font-size: 1.1rem;
    margin-top: var(--spacing-5);
  }

  .suggestion-meta {
    display: flex;
    align-items: center;
    gap: var(--spacing-4);
    color: var(--text-muted);
    padding-bottom: 10px;
    font-size: 0.85rem;
  }

  .suggestion-meta span {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
  }

  .suggestion-meta i {
    color: var(--primary-color);
  }

  .suggestion-description {
    position: relative;
    margin: var(--spacing-4) 0;
    max-height: 4.8em;
    overflow: hidden;
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    line-height: 1.6;
  }

  .suggestion-description::after {
    position: absolute;
    right: 0;
    bottom: 0;
    padding-left: 20px;
    content: '...';
  }

  .suggestion-footer {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
    align-items: flex-start;
    margin-top: var(--spacing-6);
    border-top: 1px solid var(--color-glass-border);
    padding-top: var(--spacing-4);
  }

  .category-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: var(--glass-border);
    border-radius: var(--radius-xl);
    background: var(--glass-bg-active);
    padding: 4px 12px;
    font-size: 0.8rem;
  }

  .category-tag--deleted {
    text-decoration: line-through;
    opacity: 55%;
  }

  .share-info {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .share-info > i {
    color: oklch(49.26% 0 0);
    font-size: 0.875rem;
  }
</style>
