<script lang="ts">
  import SearchResultUser from '$lib/components/SearchResultUser.svelte';
  import { getAvatarColorClass, getInitials } from '$lib/utils';

  import { MESSAGES } from './constants';
  import {
    formatConversationTime,
    getConversationAvatar,
    getChatPartnerName,
  } from './utils';

  import type { ChatUser, Conversation } from './types';

  interface Props {
    conversations: Conversation[];
    activeConversationId: number | null;
    currentUserId: number;
    canStartNewConversation: boolean;
    showUserSearch: boolean;
    userSearchQuery?: string; // Optional for $bindable() - parent uses bind:userSearchQuery
    userSearchResults: ChatUser[];
    isSearchingUsers: boolean;
    isLoading: boolean;
    ontoggleusersearch: () => void;
    onsearchusers: (query: string) => void;
    onclearusersearch: () => void;
    onstartconversation: (user: ChatUser) => void;
    onselectconversation: (conversation: Conversation) => void;
  }

  /* eslint-disable prefer-const -- Svelte $bindable() requires let */
  let {
    conversations,
    activeConversationId,
    currentUserId,
    canStartNewConversation,
    showUserSearch,
    userSearchQuery = $bindable(''),
    userSearchResults,
    isSearchingUsers,
    isLoading,
    ontoggleusersearch,
    onsearchusers,
    onclearusersearch,
    onstartconversation,
    onselectconversation,
  }: Props = $props();
  /* eslint-enable prefer-const */
</script>

<div class="chat-sidebar">
  <div class="chat-sidebar-header">
    <h2 class="chat-title">
      <i class="fas fa-comments"></i>
      {MESSAGES.labelMessages}
    </h2>
    {#if canStartNewConversation}
      <button
        type="button"
        class="btn btn-icon btn-secondary"
        title={MESSAGES.labelNewConversation}
        aria-label={MESSAGES.labelNewConversation}
        onclick={ontoggleusersearch}
      >
        <i class="fas fa-plus"></i>
      </button>
    {/if}
  </div>

  <!-- User Search (admin/root only) -->
  {#if canStartNewConversation && showUserSearch}
    <div
      class="search-input-wrapper"
      class:search-input-wrapper--open={userSearchResults.length > 0}
    >
      <div
        class="search-input"
        class:search-input--has-value={userSearchQuery.length > 0}
        class:search-input--loading={isSearchingUsers}
      >
        <i class="search-input__icon fas fa-search"></i>
        <input
          type="search"
          class="search-input__field"
          placeholder={MESSAGES.labelSearchUsers}
          autocomplete="off"
          bind:value={userSearchQuery}
          oninput={() => {
            onsearchusers(userSearchQuery);
          }}
        />
        <button
          class="search-input__clear"
          type="button"
          aria-label={MESSAGES.labelClearSearch}
          onclick={onclearusersearch}
        >
          <i class="fas fa-times"></i>
        </button>
        <div class="search-input__spinner"></div>
      </div>
      {#if userSearchResults.length > 0}
        <div
          class="search-input__results"
          id="chatUserSearchResults"
        >
          {#each userSearchResults as user (user.id)}
            <SearchResultUser
              id={user.id}
              firstName={user.firstName}
              lastName={user.lastName}
              username={user.username}
              email={user.email}
              imageUrl={user.profileImageUrl}
              status={user.status}
              role={user.role}
              employeeNumber={user.employeeNumber}
              query={userSearchQuery}
              onclick={() => {
                onstartconversation(user);
              }}
            />
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Conversations List -->
  <div class="conversations-list">
    {#if isLoading}
      <div class="loading-spinner">
        <span class="spinner-ring spinner-ring--sm"></span>
      </div>
    {:else if conversations.length === 0}
      <div class="conversations-empty">
        <i class="fas fa-inbox"></i>
        <span>{MESSAGES.emptyNoConversations}</span>
      </div>
    {:else}
      {#each conversations as conv (conv.id)}
        {@const partner = conv.participants.find((p) => p.id !== currentUserId)}
        <button
          type="button"
          class="conversation-item"
          class:active={activeConversationId === conv.id}
          class:unread={(conv.unreadCount ?? 0) > 0}
          onclick={() => {
            onselectconversation(conv);
          }}
        >
          <div
            class="avatar {getConversationAvatar(conv, currentUserId) !== null ?
              ''
            : getAvatarColorClass(partner?.id)}"
          >
            {#if getConversationAvatar(conv, currentUserId)}
              <img
                src={getConversationAvatar(conv, currentUserId)}
                alt=""
                class="avatar__image"
              />
            {:else}
              <span class="avatar__initials">
                {getInitials(partner?.firstName, partner?.lastName)}
              </span>
            {/if}
            {#if !conv.isGroup && partner}
              <span
                class="avatar__status avatar__status--{partner.status ??
                  'offline'}"
              ></span>
            {/if}
          </div>
          <div class="conversation-info">
            <h4 class="conversation-name">
              {conv.name ?? getChatPartnerName(partner ?? null, undefined)}
            </h4>
            {#if conv.lastMessage}
              <p class="conversation-preview">
                {#if conv.lastMessage.isE2e === true && (conv.lastMessage.content === null || conv.lastMessage.content === '')}
                  <i class="fas fa-lock"></i> {MESSAGES.e2eEncryptedPreview}
                {:else}
                  {conv.lastMessage.content}
                {/if}
              </p>
            {/if}
          </div>
          <div class="conversation-meta">
            {#if conv.lastMessage}
              <span class="conversation-time">
                {formatConversationTime(conv.lastMessage.createdAt)}
              </span>
            {/if}
            {#if (conv.unreadCount ?? 0) > 0}
              <span class="badge badge--count">{conv.unreadCount}</span>
            {/if}
          </div>
        </button>
      {/each}
    {/if}
  </div>
</div>

<style>
  .loading-spinner {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-8, 2rem);
    font-size: 2rem;
    color: var(--primary-color, #2196f3);
  }

  .conversations-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-2, 0.5rem);
    padding: var(--spacing-6, 1.5rem);
    color: var(--text-muted, #999);
    text-align: center;
    font-size: 0.875rem;
  }

  .conversations-empty i {
    font-size: 1.5rem;
    opacity: 50%;
  }
</style>
