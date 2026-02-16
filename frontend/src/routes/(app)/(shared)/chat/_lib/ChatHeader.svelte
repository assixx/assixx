<script lang="ts">
  import { getAvatarColorClass, getInitials } from '$lib/utils';

  import { MESSAGES } from './constants';
  import { getConversationAvatar, getStatusLabel } from './utils';

  import type { ChatUser, Conversation, UserStatus } from './types';

  interface Props {
    conversation: Conversation;
    partner: ChatUser | undefined;
    partnerName: string;
    partnerStatus: UserStatus;
    currentUserId: number;
    isAdmin: boolean;
    showSearchBar: boolean;
    searchQuery?: string; // Optional for $bindable() - parent uses bind:searchQuery
    searchResultCount: number;
    currentSearchIndex: number;
    ontogglesearch: () => void;
    onnavigateprev: () => void;
    onnavigatenext: () => void;
    ondelete: () => void;
  }

  /* eslint-disable prefer-const -- Svelte $bindable() requires let */
  let {
    conversation,
    partner,
    partnerName,
    partnerStatus,
    currentUserId,
    isAdmin,
    showSearchBar,
    searchQuery = $bindable(''),
    searchResultCount,
    currentSearchIndex,
    ontogglesearch,
    onnavigateprev,
    onnavigatenext,
    ondelete,
  }: Props = $props();
  /* eslint-enable prefer-const */
</script>

<!-- Chat Header -->
<div class="chat-header">
  <div class="chat-header-info">
    <div
      class="avatar {(
        getConversationAvatar(conversation, currentUserId) !== null
      ) ?
        ''
      : getAvatarColorClass(partner?.id)}"
    >
      {#if getConversationAvatar(conversation, currentUserId)}
        <img
          src={getConversationAvatar(conversation, currentUserId)}
          alt=""
          class="avatar__image"
        />
      {:else}
        <span class="avatar__initials">
          {getInitials(partner?.firstName, partner?.lastName)}
        </span>
      {/if}
    </div>
    <div class="chat-header-details">
      <h3>{partnerName}</h3>
      <div class="status">{getStatusLabel(partnerStatus)}</div>
    </div>
  </div>
  <div class="chat-actions">
    <button
      type="button"
      class="btn btn-icon btn-secondary"
      title={MESSAGES.labelSearchCtrlF}
      aria-label={MESSAGES.labelSearchCtrlF}
      onclick={ontogglesearch}
    >
      <i class="fas fa-search"></i>
    </button>
    {#if isAdmin}
      <button
        type="button"
        class="btn btn-icon btn-danger"
        title={MESSAGES.labelDeleteChat}
        aria-label={MESSAGES.labelDeleteChat}
        onclick={ondelete}
      >
        <i class="fas fa-trash"></i>
      </button>
    {/if}
  </div>
</div>

<!-- Search Bar -->
{#if showSearchBar}
  <div class="chat-search-bar">
    <div class="chat-search-input-wrapper">
      <i class="fas fa-search chat-search-icon"></i>
      <input
        type="search"
        class="chat-search-input"
        placeholder={MESSAGES.labelSearchChat}
        autocomplete="off"
        bind:value={searchQuery}
      />
      {#if searchResultCount > 0}
        <span class="chat-search-counter">
          {currentSearchIndex + 1}/{searchResultCount}
        </span>
      {/if}
      <button
        type="button"
        class="btn btn-icon btn-sm"
        title={MESSAGES.labelPreviousResult}
        aria-label={MESSAGES.labelPreviousResult}
        onclick={onnavigateprev}
      >
        <i class="fas fa-chevron-up"></i>
      </button>
      <button
        type="button"
        class="btn btn-icon btn-sm"
        title={MESSAGES.labelNextResult}
        aria-label={MESSAGES.labelNextResult}
        onclick={onnavigatenext}
      >
        <i class="fas fa-chevron-down"></i>
      </button>
      <button
        type="button"
        class="btn btn-icon btn-sm"
        title={MESSAGES.labelCloseSearch}
        aria-label={MESSAGES.labelCloseSearch}
        onclick={ontogglesearch}
      >
        <i class="fas fa-times"></i>
      </button>
    </div>
  </div>
{/if}

<style>
  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--color-glass-border);
    background: var(--glass-bg-hover);
    padding: 7px 16px;
  }

  .chat-header-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .chat-header-details h3 {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.3rem;
  }

  .chat-header-details .status {
    color: var(--text-secondary);
    font-size: 0.75rem;
  }

  .chat-actions {
    display: flex;
    gap: var(--spacing-2);
  }

  /* Search bar */
  .chat-search-bar {
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--border-color);
    background: var(--background-secondary);
    padding: var(--spacing-2) var(--spacing-4);
  }

  .chat-search-input-wrapper {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--background-primary);
    padding: var(--spacing-1) var(--spacing-3);
    width: 100%;
    max-width: 500px;
  }

  .chat-search-icon {
    color: var(--text-secondary);
  }

  .chat-search-input {
    flex: 1;
    outline: none;
    border: none;
    background: transparent;
    padding: var(--spacing-1) 0;
    min-width: 0;
    color: var(--text-primary);
    font-size: var(--font-size-sm);
  }

  .chat-search-input::placeholder {
    color: var(--text-tertiary);
  }

  .chat-search-counter {
    padding: 0 var(--spacing-2);
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
    white-space: nowrap;
  }

  /* Mobile: reduced padding */
  @media (width < 768px) {
    .chat-header {
      padding: var(--spacing-3);
    }
  }
</style>
