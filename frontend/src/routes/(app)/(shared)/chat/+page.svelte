<script lang="ts">
  /**
   * Chat Page - Thin Template Shell
   * All business logic lives in chat-page-state.svelte.ts
   * This file: SSR props, factory call, lifecycle hooks, template.
   */

  import { onMount, onDestroy } from 'svelte';

  import '../../../../styles/chat.css';

  import { createChatPageState } from './_lib/chat-page-state.svelte';
  import ChatHeader from './_lib/ChatHeader.svelte';
  import ChatSidebar from './_lib/ChatSidebar.svelte';
  import ConfirmDialog from './_lib/ConfirmDialog.svelte';
  import { MESSAGES } from './_lib/constants';
  import ImagePreviewModal from './_lib/ImagePreviewModal.svelte';
  import MessageInputArea from './_lib/MessageInputArea.svelte';
  import MessagesArea from './_lib/MessagesArea.svelte';
  import ScheduleModal from './_lib/ScheduleModal.svelte';

  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();

  const state = createChatPageState({
    getSsrUser: () => data.currentUser,
    getSsrConversations: () => data.conversations,
    getSsrTenantId: () =>
      (data.currentUser as unknown as { tenantId?: number } | null)?.tenantId ??
      0,
  });

  onMount(() => {
    state.mount();
  });
  onDestroy(() => {
    state.destroy();
  });
</script>

<svelte:head>
  <title>Chat - Assixx</title>
</svelte:head>

<main class="chat-page-main">
  <div class="chat-container">
    <ChatSidebar
      conversations={state.conversations}
      activeConversationId={state.activeConversation?.id ?? null}
      currentUserId={state.currentUser?.id ?? 0}
      canStartNewConversation={state.canStartNewConversation}
      showUserSearch={state.showUserSearch}
      bind:userSearchQuery={state.userSearchQuery}
      userSearchResults={state.userSearchResults}
      isSearchingUsers={state.isSearchingUsers}
      isLoading={state.isLoading}
      ontoggleusersearch={state.toggleUserSearch}
      onsearchusers={state.searchUsers}
      onclearusersearch={state.clearUserSearch}
      onstartconversation={state.startConversationWith}
      onselectconversation={state.selectConversation}
    />

    <div class="chat-main">
      {#if state.isDisconnected}
        <div
          class="connection-lost-banner"
          role="alert"
        >
          <i class="fas fa-exclamation-triangle"></i>
          <span>{MESSAGES.reconnecting}</span>
        </div>
      {/if}
      {#if state.activeConversation}
        <ChatHeader
          conversation={state.activeConversation}
          partner={state.chatPartner ?? undefined}
          partnerName={state.chatPartnerName}
          partnerStatus={state.chatPartnerStatus}
          currentUserId={state.currentUser?.id ?? 0}
          isAdmin={state.isAdmin}
          showSearchBar={state.showSearchBar}
          bind:searchQuery={state.searchQuery}
          searchResultCount={state.searchResultCount}
          currentSearchIndex={state.currentSearchIndex}
          ontogglesearch={state.toggleSearchBar}
          onnavigateprev={() => {
            state.navigateSearch('prev');
          }}
          onnavigatenext={() => {
            state.navigateSearch('next');
          }}
          ondelete={state.deleteCurrentConversation}
        />

        <MessagesArea
          bind:this={state.messagesAreaRef}
          messages={state.messages}
          scheduledMessages={state.scheduledMessages}
          currentUserId={state.currentUser?.id ?? 0}
          searchQuery={state.debouncedSearchQuery}
          isLoading={state.isLoadingMessages}
          oncancelscheduled={state.cancelScheduled}
          onimageclick={state.openImagePreview}
        />

        {#if state.typingUsers.length > 0}
          <div class="typing-indicator">
            <span class="typing-dots"
              ><span></span><span></span><span></span></span
            >
            <span class="typing-text">{MESSAGES.labelTyping}</span>
          </div>
        {/if}
        <MessageInputArea
          bind:messageInput={state.messageInput}
          selectedFiles={state.selectedFiles}
          scheduledFor={state.scheduledFor}
          onsend={state.sendMessage}
          onkeydown={state.handleKeyDown}
          oninput={state.handleTyping}
          onopenfilepicker={state.openFilePicker}
          onremovefile={state.removeFile}
          onopenschedule={state.openScheduleModal}
          onclearschedule={state.clearSchedule}
        />
      {:else}
        <div class="messages-container loaded">
          <div class="empty-chat">
            <div class="empty-chat-icon">
              <i class="fas fa-comments"></i>
            </div>
            <h3>{MESSAGES.emptyWelcome}</h3>
            <p>{MESSAGES.emptySelectConversation}</p>
          </div>
        </div>
      {/if}
    </div>
  </div>
</main>

<input
  type="file"
  class="hidden"
  multiple
  bind:this={state.fileInputRef}
  onchange={state.handleFileSelect}
/>

<ScheduleModal
  show={state.showScheduleModal}
  bind:date={state.scheduleDate}
  bind:time={state.scheduleTimeInput}
  errorMessage={state.scheduleError}
  onclose={state.closeScheduleModal}
  onconfirm={state.confirmSchedule}
/>

<ConfirmDialog
  show={state.showConfirmDialog}
  message={state.confirmMessage}
  onclose={state.closeConfirmDialog}
  onconfirm={state.executeConfirm}
/>

<ImagePreviewModal
  show={state.previewImage !== null}
  image={state.previewImage}
  onclose={state.closeImagePreview}
/>
