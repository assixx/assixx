<script lang="ts">
  import { getAvatarColorClass, getInitials } from '$lib/utils';
  import type { ChatUser, Conversation } from './types';
  import { MESSAGES } from './constants';
  import {
    highlightSearchTerm,
    formatConversationTime,
    getConversationDisplayName,
    getConversationAvatar,
    getRoleLabel,
    getRoleBadgeClass,
  } from './utils';

  interface Props {
    conversations: Conversation[];
    activeConversationId: number | null;
    currentUserId: number;
    canStartNewConversation: boolean;
    showUserSearch: boolean;
    userSearchQuery: string;
    userSearchResults: ChatUser[];
    isSearchingUsers: boolean;
    isLoading: boolean;
    ontoggleusersearch: () => void;
    onsearchusers: (query: string) => void;
    onclearusersearch: () => void;
    onstartconversation: (user: ChatUser) => void;
    onselectconversation: (conversation: Conversation) => void;
  }

  /* eslint-disable prefer-const */
  let {
    conversations,
    activeConversationId,
    currentUserId,
    canStartNewConversation,
    showUserSearch,
    userSearchQuery = $bindable(),
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
          oninput={() => onsearchusers(userSearchQuery)}
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
        <div class="search-input__results" id="chatUserSearchResults">
          {#each userSearchResults as user (user.id)}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div
              class="search-input__result-item"
              data-user-id={user.id}
              onclick={() => onstartconversation(user)}
            >
              <div class="flex items-center gap-3 w-full">
                <div class="avatar avatar--sm {getAvatarColorClass(user.id)}">
                  {#if user.profileImageUrl}
                    <img src={user.profileImageUrl} alt={user.username} class="avatar__image" />
                  {:else}
                    <span class="avatar__initials">
                      {getInitials(user.firstName, user.lastName)}
                    </span>
                  {/if}
                  <span class="avatar__status avatar__status--{user.status ?? 'offline'}"></span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="user-name">
                    <!-- eslint-disable svelte/no-at-html-tags -- Highlighting search term -->
                    {@html highlightSearchTerm(
                      `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
                      userSearchQuery,
                    )}
                    <!-- eslint-enable svelte/no-at-html-tags -->
                  </div>
                  <div class="user-details">
                    {#if user.employeeNumber}#{user.employeeNumber} ·{/if}
                    {user.email ?? user.username}
                  </div>
                  <div class="user-meta">
                    {#if user.role}
                      <span class="badge {getRoleBadgeClass(user.role)} badge--xs">
                        {getRoleLabel(user.role)}
                      </span>
                    {/if}
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Conversations List -->
  <div class="conversations-list">
    {#if isLoading}
      <div class="loading-spinner">
        <i class="fas fa-spinner fa-spin"></i>
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
          class="conversation-item"
          class:active={activeConversationId === conv.id}
          class:unread={conv.unreadCount && conv.unreadCount > 0}
          onclick={() => onselectconversation(conv)}
        >
          <div class="avatar {getAvatarColorClass(partner?.id)}">
            {#if getConversationAvatar(conv, currentUserId)}
              <img src={getConversationAvatar(conv, currentUserId)} alt="" class="avatar__image" />
            {:else}
              <span class="avatar__initials">
                {getInitials(partner?.firstName, partner?.lastName)}
              </span>
            {/if}
            {#if !conv.isGroup && partner}
              <span class="avatar__status avatar__status--{partner.status ?? 'offline'}"></span>
            {/if}
          </div>
          <div class="conversation-info">
            <h4 class="conversation-name">
              {getConversationDisplayName(conv, currentUserId)}
            </h4>
            {#if conv.lastMessage}
              <p class="conversation-preview">{conv.lastMessage.content}</p>
            {/if}
          </div>
          <div class="conversation-meta">
            {#if conv.lastMessage}
              <span class="conversation-time">
                {formatConversationTime(conv.lastMessage.createdAt)}
              </span>
            {/if}
            {#if conv.unreadCount && conv.unreadCount > 0}
              <span class="badge badge--count">{conv.unreadCount}</span>
            {/if}
          </div>
        </button>
      {/each}
    {/if}
  </div>
</div>

<style>
  .user-name {
    font-weight: 500;
    color: var(--text-primary);
  }

  .user-details {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .user-meta {
    font-size: 0.7rem;
    color: var(--text-muted);
    display: flex;
    gap: 6px;
    align-items: center;
    margin-top: 2px;
  }

  .badge--xs {
    font-size: 0.6rem;
    padding: 1px 5px;
  }

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
    opacity: 0.5;
  }
</style>
