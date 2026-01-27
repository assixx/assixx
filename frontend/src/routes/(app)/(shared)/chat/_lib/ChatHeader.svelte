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
