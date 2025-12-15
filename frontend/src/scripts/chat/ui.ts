/**
 * Chat Module - UI Rendering
 * Conversation list, chat header, and UI updates
 */

import type { Conversation, ChatUser, ConversationParticipant } from './types';
import { getChatState } from './state';
import { $$, $all, show, hide } from '../../utils/dom-utils';
import { getInitials, getRoleDisplayName, getProfileImageUrl, hasName, getUserDisplayName } from './utils';
// Design System avatar helper for consistent color assignment
import { getColorClass } from '../../design-system/primitives/avatar/avatar.js';

// CSS class constants
const AVATAR_INITIALS_CLASS = 'avatar__initials';
const AVATAR_SM_CLASS = 'avatar--sm';
const AVATAR_DEFAULT_COLOR = 'avatar--color-0';

// ============================================================================
// Conversation List
// ============================================================================

/**
 * Render the conversation list
 */
export function renderConversationList(): void {
  const state = getChatState();
  const conversationsList = $$('#conversationsList');
  if (!conversationsList) return;

  conversationsList.innerHTML = '';

  if (state.conversations.length === 0) {
    renderEmptyState(conversationsList, state.canStartChat());
    return;
  }

  state.conversations.forEach((conversation) => {
    const item = createConversationItem(conversation);
    conversationsList.append(item);
  });
}

/**
 * Render empty state for conversation list
 */
function renderEmptyState(container: HTMLElement, canStartChat: boolean): void {
  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state empty-state--sm';
  emptyState.setAttribute('role', 'status');

  // Icon
  const iconDiv = document.createElement('div');
  iconDiv.className = 'empty-state__icon';
  const icon = document.createElement('i');
  icon.className = 'fas fa-comments';
  iconDiv.append(icon);

  // Title
  const title = document.createElement('h3');
  title.className = 'empty-state__title';
  title.textContent = 'Keine Unterhaltungen';

  // Description
  const description = document.createElement('p');
  description.className = 'empty-state__description';
  description.textContent = canStartChat ? 'Starten Sie eine neue Unterhaltung' : 'Noch keine Nachrichten vorhanden';

  emptyState.append(iconDiv, title, description);

  // Action button (only for root/admin)
  if (canStartChat) {
    const button = document.createElement('button');
    button.className = 'btn btn-primary';
    button.innerHTML = '<i class="fas fa-plus"></i> Neue Unterhaltung';
    button.addEventListener('click', () => {
      const newChatBtn = $$('#newConversationBtn');
      if (newChatBtn instanceof HTMLButtonElement) {
        newChatBtn.click();
      }
    });
    emptyState.append(button);
  }

  container.append(emptyState);
}

/**
 * Create a conversation list item
 */
function createConversationItem(conversation: Conversation): HTMLDivElement {
  const state = getChatState();
  const item = document.createElement('div');
  item.className = 'conversation-item';
  item.dataset['conversationId'] = conversation.id.toString();

  // Apply state classes
  if (conversation.id === state.currentConversationId) {
    item.classList.add('active');
  }
  if (conversation.unreadCount !== undefined && conversation.unreadCount > 0) {
    item.classList.add('unread');
  }

  const displayName = getConversationDisplayName(conversation);
  const lastMessageText = getLastMessageText(conversation);
  const lastMessageTime = getLastMessageTime(conversation);

  // Build DOM
  const avatarDiv = createAvatarElement(conversation, displayName);
  const infoDiv = createInfoElement(displayName, lastMessageText);
  const metaDiv = createMetaElement(lastMessageTime, conversation);

  item.append(avatarDiv, infoDiv, metaDiv);

  return item;
}

/**
 * Get conversation display name
 */
export function getConversationDisplayName(conversation: Conversation): string {
  const state = getChatState();

  if (conversation.isGroup) {
    return conversation.name ?? 'Gruppenchat';
  }

  if (conversation.displayName !== undefined && conversation.displayName !== '') {
    return conversation.displayName;
  }

  if (conversation.participants.length > 0) {
    const otherParticipant = conversation.participants.find((p) => p.id !== state.currentUserId);
    if (otherParticipant !== undefined) {
      return getUserDisplayName(otherParticipant);
    }
  }

  return 'Unbekannt';
}

/**
 * Get last message text preview
 */
function getLastMessageText(conversation: Conversation): string {
  if (conversation.lastMessage?.content !== undefined && conversation.lastMessage.content !== '') {
    const content = conversation.lastMessage.content;
    return content.length > 40 ? `${content.substring(0, 37)}...` : content;
  }
  return 'Keine Nachrichten';
}

/**
 * Get formatted last message time
 * Format: DD.MM.YYYY HH:MM (always full date + time)
 */
function getLastMessageTime(conversation: Conversation): string {
  if (!conversation.lastMessage) return '';

  const date = new Date(conversation.lastMessage.createdAt);

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

/**
 * Create a default user icon element
 */
function createDefaultUserIcon(): HTMLElement {
  const icon = document.createElement('i');
  icon.className = 'fas fa-user';
  return icon;
}

/**
 * Populate avatar for a single participant
 * Accepts both ChatUser and ConversationParticipant types
 */
function populateParticipantAvatar(
  avatarDiv: HTMLDivElement,
  participant: Partial<ChatUser> | ConversationParticipant,
  displayName: string,
  size: 'sm' | 'md' = 'sm',
): void {
  const profileUrl = getProfileImageUrl(participant);
  // Generate consistent color based on username (email not available on ConversationParticipant)
  const colorIdentifier = participant.username ?? displayName;
  const colorClass = getColorClass(colorIdentifier);

  // Add Design System avatar classes
  avatarDiv.classList.add('avatar', `avatar--${size}`, colorClass);

  if (profileUrl !== null && profileUrl !== '') {
    const img = document.createElement('img');
    img.src = profileUrl;
    img.alt = displayName;
    img.className = 'avatar__image';
    avatarDiv.append(img);
  } else if (hasName(participant)) {
    const initialsSpan = document.createElement('span');
    initialsSpan.className = AVATAR_INITIALS_CLASS;
    initialsSpan.textContent = getInitials(participant.firstName, participant.lastName);
    avatarDiv.append(initialsSpan);
  } else {
    avatarDiv.append(createDefaultUserIcon());
  }
}

/**
 * Create avatar element for conversation
 */
function createAvatarElement(conversation: Conversation, displayName: string): HTMLDivElement {
  const state = getChatState();
  const avatarDiv = document.createElement('div');

  if (conversation.isGroup) {
    // Group avatar: Design System avatar with icon
    avatarDiv.classList.add('avatar', AVATAR_SM_CLASS, AVATAR_DEFAULT_COLOR);
    const initialsSpan = document.createElement('span');
    initialsSpan.className = AVATAR_INITIALS_CLASS;
    const icon = document.createElement('i');
    icon.className = 'fas fa-users';
    initialsSpan.append(icon);
    avatarDiv.append(initialsSpan);
    return avatarDiv;
  }

  const otherParticipant = conversation.participants.find((p) => p.id !== state.currentUserId);
  if (otherParticipant !== undefined) {
    populateParticipantAvatar(avatarDiv, otherParticipant, displayName, 'sm');
  } else {
    avatarDiv.classList.add('avatar', AVATAR_SM_CLASS, AVATAR_DEFAULT_COLOR);
    avatarDiv.append(createDefaultUserIcon());
  }

  return avatarDiv;
}

/**
 * Create info element for conversation
 */
function createInfoElement(displayName: string, lastMessageText: string): HTMLDivElement {
  const infoDiv = document.createElement('div');
  infoDiv.className = 'conversation-info';

  const nameDiv = document.createElement('div');
  nameDiv.className = 'conversation-name';
  nameDiv.textContent = displayName;

  const lastMessageDiv = document.createElement('div');
  lastMessageDiv.className = 'conversation-last-message';
  lastMessageDiv.textContent = lastMessageText;

  infoDiv.append(nameDiv, lastMessageDiv);
  return infoDiv;
}

/**
 * Create meta element for conversation
 */
function createMetaElement(lastMessageTime: string, conversation: Conversation): HTMLDivElement {
  const metaDiv = document.createElement('div');
  metaDiv.className = 'conversation-meta';

  const timeDiv = document.createElement('div');
  timeDiv.className = 'conversation-time';
  timeDiv.textContent = lastMessageTime;

  metaDiv.append(timeDiv);

  if (conversation.unreadCount !== undefined && conversation.unreadCount > 0) {
    const badgeSpan = document.createElement('span');
    badgeSpan.className = 'badge badge--count';
    badgeSpan.textContent = conversation.unreadCount.toString();
    metaDiv.append(badgeSpan);
  }

  return metaDiv;
}

// ============================================================================
// Chat Header
// ============================================================================

/**
 * Render chat header with participant info
 */
export function renderChatHeader(): void {
  const state = getChatState();
  const chatAvatar = $$('#chat-avatar');
  const chatPartnerName = $$('#chat-partner-name');
  const chatPartnerStatus = $$('#chat-partner-status');

  if (state.currentConversationId === null) return;

  const conversation = state.getCurrentConversation();
  if (!conversation) return;

  const displayName = getConversationDisplayName(conversation);

  // Update name
  if (chatPartnerName !== null) {
    chatPartnerName.textContent = displayName;
  }

  // Update avatar and status
  if (chatAvatar !== null) {
    updateChatAvatar(chatAvatar, chatPartnerStatus, conversation, displayName);
  }
}

/**
 * Set group avatar display
 */
function setGroupAvatarDisplay(chatAvatar: HTMLElement, chatPartnerStatus: HTMLElement | null): void {
  // Design System avatar for groups
  chatAvatar.classList.add('avatar', AVATAR_SM_CLASS, AVATAR_DEFAULT_COLOR);
  const initialsSpan = document.createElement('span');
  initialsSpan.className = AVATAR_INITIALS_CLASS;
  const icon = document.createElement('i');
  icon.className = 'fas fa-users';
  initialsSpan.append(icon);
  chatAvatar.append(initialsSpan);
  if (chatPartnerStatus !== null) chatPartnerStatus.textContent = 'Gruppenchat';
}

/**
 * Set participant avatar display in header
 * Accepts both ChatUser and ConversationParticipant types
 */
function setParticipantAvatarDisplay(
  chatAvatar: HTMLElement,
  participant: Partial<ChatUser> | ConversationParticipant,
  displayName: string,
  chatPartnerStatus: HTMLElement | null,
): void {
  const profileUrl = getProfileImageUrl(participant);
  // Generate consistent color based on username (email not available on ConversationParticipant)
  const colorIdentifier = participant.username ?? displayName;
  const colorClass = getColorClass(colorIdentifier);

  // Add Design System avatar classes
  chatAvatar.classList.add('avatar', AVATAR_SM_CLASS, colorClass);

  if (profileUrl !== null && profileUrl !== '') {
    const img = document.createElement('img');
    img.src = profileUrl;
    img.alt = displayName;
    img.className = 'avatar__image';
    chatAvatar.append(img);
  } else if (hasName(participant)) {
    const initialsSpan = document.createElement('span');
    initialsSpan.className = AVATAR_INITIALS_CLASS;
    initialsSpan.textContent = getInitials(participant.firstName, participant.lastName);
    chatAvatar.append(initialsSpan);
  } else {
    chatAvatar.classList.add('u-hidden');
  }

  if (chatPartnerStatus !== null && 'role' in participant && typeof participant.role === 'string') {
    chatPartnerStatus.textContent = getRoleDisplayName(participant.role);
  }
}

/**
 * Update chat avatar in header
 */
function updateChatAvatar(
  chatAvatar: HTMLElement,
  chatPartnerStatus: HTMLElement | null,
  conversation: Conversation,
  displayName: string,
): void {
  const state = getChatState();

  // Clear existing content
  while (chatAvatar.firstChild) {
    chatAvatar.firstChild.remove();
  }

  // Reset avatar classes (keep only base ID-related classes)
  chatAvatar.className = '';

  if (conversation.isGroup) {
    setGroupAvatarDisplay(chatAvatar, chatPartnerStatus);
    return;
  }

  const otherParticipant = conversation.participants.find((p) => p.id !== state.currentUserId);
  if (otherParticipant !== undefined) {
    setParticipantAvatarDisplay(chatAvatar, otherParticipant, displayName, chatPartnerStatus);
  }
}

// ============================================================================
// Pending Conversation Header
// ============================================================================

/**
 * Set up avatar element for a user
 */
function setupUserAvatar(avatarElement: HTMLElement, user: ChatUser, displayName: string): void {
  // Clear existing content
  while (avatarElement.firstChild) {
    avatarElement.firstChild.remove();
  }
  avatarElement.className = '';

  const avatarDiv = avatarElement as HTMLDivElement;
  const profileUrl = getProfileImageUrl(user);
  const colorIdentifier = user.username;
  const colorClass = getColorClass(colorIdentifier);

  avatarDiv.classList.add('avatar', AVATAR_SM_CLASS, colorClass);

  if (profileUrl !== null && profileUrl !== '') {
    const img = document.createElement('img');
    img.src = profileUrl;
    img.alt = displayName;
    img.className = 'avatar__image';
    avatarDiv.append(img);
    return;
  }

  if (hasName(user)) {
    const initialsSpan = document.createElement('span');
    initialsSpan.className = AVATAR_INITIALS_CLASS;
    initialsSpan.textContent = getInitials(user.firstName, user.lastName);
    avatarDiv.append(initialsSpan);
    return;
  }

  avatarDiv.append(createDefaultUserIcon());
}

/**
 * Render chat header for a pending conversation (not yet created in DB)
 * Shows target user info similar to regular conversation header
 */
export function renderPendingChatHeader(targetUser: ChatUser): void {
  const chatAvatar = $$('#chat-avatar');
  const chatPartnerName = $$('#chat-partner-name');
  const chatPartnerStatus = $$('#chat-partner-status');

  const displayName = getUserDisplayName(targetUser);

  if (chatPartnerName !== null) {
    chatPartnerName.textContent = displayName;
  }

  if (chatAvatar !== null) {
    setupUserAvatar(chatAvatar, targetUser, displayName);
  }

  if (chatPartnerStatus !== null) {
    chatPartnerStatus.textContent = getRoleDisplayName(targetUser.role);
  }
}

// ============================================================================
// Typing Indicator
// ============================================================================

/**
 * Update typing indicator in chat
 */
export function updateTypingIndicator(): void {
  const state = getChatState();
  const typingIndicator = $$('#typingIndicator');
  if (!typingIndicator) return;

  const conversation = state.getCurrentConversation();

  if (!conversation?.typingUsers || conversation.typingUsers.length === 0) {
    typingIndicator.style.display = 'none';
    return;
  }

  const typingUsers = conversation.typingUsers
    .map((userId) => {
      if (Array.isArray(conversation.participants)) {
        const participant = conversation.participants.find((p) => p.id === userId);
        return participant?.username ?? 'Unknown';
      }
      return 'Unknown';
    })
    .filter((name) => name !== 'Unknown');

  if (typingUsers.length > 0) {
    typingIndicator.style.display = 'block';
    typingIndicator.textContent = `${typingUsers.join(', ')} ${typingUsers.length === 1 ? 'tippt' : 'tippen'}...`;
  } else {
    typingIndicator.style.display = 'none';
  }
}

// ============================================================================
// Participant Status
// ============================================================================

/**
 * Get participant status HTML (online/offline/away)
 */
export function getParticipantStatus(conversation: Conversation): string {
  const state = getChatState();

  if (conversation.participants.length === 0) return '';

  const otherParticipant = conversation.participants.find((p) => p.id !== state.currentUserId);
  if (!otherParticipant) return '';

  switch (otherParticipant.status) {
    case 'online':
      return '<span class="status-online">Online</span>';
    case 'away':
      return '<span class="status-away">Abwesend</span>';
    default:
      return '<span class="status-offline">Offline</span>';
  }
}

// ============================================================================
// UI State Updates
// ============================================================================

/**
 * Show chat area (when conversation is selected)
 */
export function showChatArea(): void {
  const chatHeader = $$('#chat-header');
  const chatArea = $$('#chatArea');
  const noChatSelected = $$('#noChatSelected');
  const chatMain = $$('.chat-main');

  if (chatHeader !== null) chatHeader.classList.remove('u-hidden');
  show(chatArea);
  hide(noChatSelected);
  if (chatMain !== null) chatMain.classList.remove('u-hidden');

  // Mobile: show chat view
  const chatContainer = $$('.chat-container');
  if (chatContainer !== null) {
    chatContainer.classList.add('show-chat');
  }
}

/**
 * Show conversations list (mobile back button)
 */
export function showConversationsList(): void {
  const chatContainer = $$('.chat-container');
  if (chatContainer !== null) {
    chatContainer.classList.remove('show-chat');
  }
}

/**
 * Update conversation item as active
 */
export function setActiveConversation(conversationId: number): void {
  $all('.conversation-item').forEach((item) => {
    item.classList.remove('active');
  });

  const selectedItem = $$(`[data-conversation-id="${conversationId}"]`);
  if (selectedItem !== null) {
    selectedItem.classList.add('active');
  }
}

/**
 * Update message read indicator
 */
export function updateMessageReadIndicator(messageId: number): void {
  const messageElement = $$(`[data-message-id="${messageId}"]`);
  if (messageElement !== null) {
    const readIndicator = messageElement.querySelector('.read-indicator');
    if (readIndicator !== null) {
      readIndicator.classList.add('read');
    }
  }
}
