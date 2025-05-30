/**
 * Chat Client System
 * WebSocket-based real-time chat functionality
 */

import type { User } from '../types/api.types';
import { getAuthToken } from './auth';
import { showSuccess, showError } from './auth';

interface ChatUser extends User {
  status?: 'online' | 'offline' | 'away';
  last_seen?: string;
}

interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  created_at: string;
  is_read: boolean;
  sender?: ChatUser;
  attachments?: Attachment[];
  type?: 'text' | 'file' | 'system';
}

interface Attachment {
  id: number;
  message_id: number;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

interface Conversation {
  id: number;
  name?: string;
  is_group: boolean;
  created_at: string;
  updated_at: string;
  last_message?: Message;
  participants: ChatUser[];
  unread_count?: number;
  typing_users?: number[];
}

interface WebSocketMessage {
  type: string;
  data: any;
}

interface EmojiCategories {
  [key: string]: string[];
}

class ChatClient {
  private ws: WebSocket | null;
  private token: string | null;
  private currentUser: ChatUser;
  private currentUserId: number | null;
  private currentConversationId: number | null;
  private conversations: Conversation[];
  private availableUsers: ChatUser[];
  private isConnected: boolean;
  private reconnectAttempts: number;
  private readonly maxReconnectAttempts: number;
  private reconnectDelay: number;
  private pendingFiles: File[];
  private searchQuery: string;
  private messageQueue: Message[];
  private typingTimer: NodeJS.Timeout | null;
  private emojiCategories: EmojiCategories;

  constructor() {
    this.ws = null;
    this.token = getAuthToken();
    this.currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    // Fallback für currentUserId wenn user object nicht komplett ist
    if (!this.currentUser.id && this.token && this.token !== 'test-mode') {
      try {
        const payload = JSON.parse(atob(this.token.split('.')[1]));
        this.currentUser.id = payload.userId || payload.id;
        this.currentUser.username = this.currentUser.username || payload.username;
      } catch (e) {
        console.error('Error parsing token:', e);
      }
    }

    this.currentUserId = this.currentUser.id || null;
    this.currentConversationId = null;
    this.conversations = [];
    this.availableUsers = [];
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.pendingFiles = [];
    this.searchQuery = '';
    this.messageQueue = [];
    this.typingTimer = null;

    // Initialize emoji categories
    this.emojiCategories = {
      smileys: [
        '😀',
        '😃',
        '😄',
        '😁',
        '😆',
        '😅',
        '😂',
        '🤣',
        '😇',
        '😉',
        '😊',
        '🙂',
        '🙃',
        '☺️',
        '😋',
        '😌',
        '😍',
        '🥰',
        '😘',
        '😗',
        '😙',
        '😚',
        '🥲',
        '🤪',
        '🤩',
        '🥳',
        '😎',
        '🥸',
        '🧐',
        '🤓',
        '😏',
        '😒',
        '😞',
        '😔',
        '😟',
        '😕',
        '🙁',
        '☹️',
        '😣',
        '😖',
        '😫',
        '😩',
        '🥺',
        '😢',
        '😭',
        '😤',
        '😠',
        '😡',
        '🤬',
        '🤯',
        '😳',
        '🥵',
        '🥶',
        '😱',
        '😨',
        '😰',
        '😥',
        '😓',
        '🤗',
        '🤔',
        '🤭',
        '🤫',
        '🤥',
        '😶',
        '😐',
        '😑',
        '😬',
        '🙄',
        '😯',
        '😦',
        '😧',
        '😮',
        '😲',
        '🥱',
        '😴',
        '🤤',
        '😪',
        '😵',
        '🤐',
        '🥴',
        '🤢',
        '🤮',
        '🤧',
        '😷',
        '🤒',
        '🤕',
        '🤑',
        '🤠',
        '😈',
        '👿',
        '👹',
        '👺',
        '🤡',
        '💩',
        '👻',
        '💀',
        '☠️',
        '👽',
        '👾',
        '🤖',
        '🎃',
        '😺',
        '😸',
        '😹',
        '😻',
        '😼',
        '😽',
        '🙀',
        '😿',
        '😾',
      ],
      gestures: [
        '👋',
        '🤚',
        '🖐️',
        '✋',
        '👌',
        '🤌',
        '🤏',
        '✌️',
        '🤞',
        '🤟',
        '🤘',
        '🤙',
        '👈',
        '👉',
        '👆',
        '🖕',
        '👇',
        '☝️',
        '👍',
        '👎',
        '👊',
        '✊',
        '🤛',
        '🤜',
        '👏',
        '🙌',
        '👐',
        '🤲',
        '🤝',
        '🙏',
        '✍️',
        '💅',
        '🤳',
        '💪',
        '🦾',
        '🦵',
        '🦿',
        '🦶',
        '👂',
        '🦻',
        '👃',
        '🧠',
        '🫀',
        '🫁',
        '🦷',
        '🦴',
        '👀',
        '👁️',
        '👅',
        '👄',
      ],
      symbols: [
        '✨',
        '💫',
        '💥',
        '🔥',
        '🌙',
        '☀️',
        '🌤️',
        '⛅',
        '🌥️',
        '🌦️',
        '🌈',
        '☁️',
        '🌧️',
        '⛈️',
        '🌩️',
        '⚡',
        '💧',
        '🌊',
        '🎆',
        '🎇',
        '🎐',
        '🎑',
        '🎖️',
        '🎗️',
        '🎟️',
        '🎫',
        '🏆',
        '🏅',
        '🥇',
        '🥈',
        '🥉',
        '🎪',
        '🎭',
        '🎨',
        '🎬',
        '🎤',
        '🎧',
        '🎼',
        '🎵',
        '🎶',
        '🎹',
        '🎻',
        '🥁',
        '🎷',
        '🎺',
        '🎸',
        '🎲',
        '♟️',
        '🎯',
        '🎴',
        '🀄',
        '📣',
        '📪',
        '📫',
        '📬',
        '📭',
        '📮',
        '📯',
        '📰',
        '📦',
        '📧',
        '📨',
        '📩',
        '📤',
        '📥',
        '📜',
        '📃',
        '📑',
        '📊',
        '📈',
        '📉',
        '📄',
        '📅',
        '📆',
        '📇',
        '📁',
        '📂',
        '🗃️',
        '🗄️',
        '📋',
        '🗒️',
        '🗓️',
        '🔐',
        '🔒',
        '🔓',
        '🔏',
        '🔑',
        '🗝️',
        '🔨',
        '⛏️',
        '🔩',
        '🔪',
        '🔫',
        '💉',
        '💊',
        '🌡️',
        '🎒',
        '🧪',
        '🧫',
        '🧬',
        '🧭',
        '🧮',
        '🧯',
        '🧰',
        '🧿',
        '🚬',
        '⚰️',
        '⚱️',
        '🏺️',
        '🗿',
      ],
    };

    this.init();
  }

  async init(): Promise<void> {
    // Check if token exists
    if (!this.token) {
      console.error('❌ No authentication token found');
      window.location.href = '/pages/login.html';
      return;
    }

    await this.loadInitialData();
    this.connectWebSocket();
    this.initializeEventListeners();
    this.startTypingTimer();
  }

  async loadInitialData(): Promise<void> {
    try {
      // Load conversations
      await this.loadConversations();

      // Load available users
      await this.loadAvailableUsers();

      // Select first conversation if exists
      if (this.conversations.length > 0 && !this.currentConversationId) {
        this.selectConversation(this.conversations[0].id);
      }
    } catch (error) {
      console.error('❌ Error loading initial data:', error);
      this.showNotification('Fehler beim Laden der Daten', 'error');
    }
  }

  async loadConversations(): Promise<void> {
    try {
      const response = await fetch('/api/chat/conversations', {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (response.ok) {
        this.conversations = await response.json();
        this.renderConversationList();
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error loading conversations:', error);
      throw error;
    }
  }

  async loadAvailableUsers(): Promise<void> {
    try {
      const response = await fetch('/api/chat/available-users', {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (response.ok) {
        this.availableUsers = await response.json();
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error loading available users:', error);
    }
  }

  connectWebSocket(): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.updateConnectionStatus(true);

        // Authenticate
        this.ws!.send(
          JSON.stringify({
            type: 'auth',
            data: { token: this.token },
          }),
        );

        // Process message queue
        this.processMessageQueue();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.isConnected = false;
        this.updateConnectionStatus(false);
      };

      this.ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        this.isConnected = false;
        this.updateConnectionStatus(false);
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('❌ Error creating WebSocket:', error);
      this.isConnected = false;
      this.updateConnectionStatus(false);
    }
  }

  handleWebSocketMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'auth_success':
        console.log('✅ Authentication successful');
        // Join conversations
        this.conversations.forEach((conv) => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(
              JSON.stringify({
                type: 'join_conversation',
                data: { conversationId: conv.id },
              }),
            );
          }
        });
        break;

      case 'auth_error':
        console.error('❌ Authentication failed:', message.data);
        this.ws?.close();
        window.location.href = '/pages/login.html';
        break;

      case 'new_message':
        this.handleNewMessage(message.data);
        break;

      case 'typing_start':
        this.handleTypingStart(message.data);
        break;

      case 'typing_stop':
        this.handleTypingStop(message.data);
        break;

      case 'user_status':
        this.handleUserStatus(message.data);
        break;

      case 'message_read':
        this.handleMessageRead(message.data);
        break;

      case 'pong':
        // Connection keepalive response
        break;

      default:
        console.log('📨 Unknown message type:', message.type);
    }
  }

  handleNewMessage(data: { message: Message; conversationId: number }): void {
    const { message, conversationId } = data;

    // Update conversation in list
    const conversation = this.conversations.find((c) => c.id === conversationId);
    if (conversation) {
      conversation.last_message = message;
      conversation.updated_at = message.created_at;

      // Increment unread count if not current conversation
      if (conversationId !== this.currentConversationId) {
        conversation.unread_count = (conversation.unread_count || 0) + 1;
      }

      // Re-sort conversations
      this.conversations.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

      this.renderConversationList();
    }

    // Display message if in current conversation
    if (conversationId === this.currentConversationId) {
      this.displayMessage(message);

      // Mark as read if from another user
      if (message.sender_id !== this.currentUserId) {
        this.markMessageAsRead(message.id);
      }

      // Show notification if window is not focused
      if (!document.hasFocus() && message.sender_id !== this.currentUserId) {
        this.showDesktopNotification(message);
      }
    }

    // Play notification sound if from another user
    if (message.sender_id !== this.currentUserId) {
      this.playNotificationSound();
    }
  }

  handleTypingStart(data: { userId: number; conversationId: number }): void {
    if (data.conversationId !== this.currentConversationId) return;

    const conversation = this.conversations.find((c) => c.id === data.conversationId);

    if (conversation) {
      if (!conversation.typing_users) {
        conversation.typing_users = [];
      }

      if (!conversation.typing_users.includes(data.userId)) {
        conversation.typing_users.push(data.userId);
        this.updateTypingIndicator();
      }
    }
  }

  handleTypingStop(data: { userId: number; conversationId: number }): void {
    if (data.conversationId !== this.currentConversationId) return;

    const conversation = this.conversations.find((c) => c.id === data.conversationId);

    if (conversation && conversation.typing_users) {
      conversation.typing_users = conversation.typing_users.filter((id) => id !== data.userId);
      this.updateTypingIndicator();
    }
  }

  handleUserStatus(data: { userId: number; status: string }): void {
    // Update user status in available users
    const user = this.availableUsers.find((u) => u.id === data.userId);
    if (user) {
      user.status = data.status as 'online' | 'offline' | 'away';
    }

    // Update in conversations
    this.conversations.forEach((conv) => {
      const participant = conv.participants.find((p) => p.id === data.userId);
      if (participant) {
        participant.status = data.status as 'online' | 'offline' | 'away';
      }
    });

    // Re-render if affects current conversation
    const currentConv = this.conversations.find((c) => c.id === this.currentConversationId);
    if (currentConv?.participants.some((p) => p.id === data.userId)) {
      this.renderChatHeader();
    }
  }

  handleMessageRead(data: { messageId: number; userId: number }): void {
    // Update read status in UI
    const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (messageElement) {
      const readIndicator = messageElement.querySelector('.read-indicator');
      if (readIndicator) {
        readIndicator.classList.add('read');
      }
    }
  }

  attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      this.showNotification('Verbindung zum Server verloren. Bitte Seite neu laden.', 'error');
      return;
    }

    this.reconnectAttempts++;
    console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(() => {
      this.connectWebSocket();
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message.content);
      }
    }
  }

  async selectConversation(conversationId: number): Promise<void> {
    this.currentConversationId = conversationId;

    // Update UI
    document.querySelectorAll('.conversation-item').forEach((item) => {
      item.classList.remove('active');
    });

    const selectedItem = document.querySelector(`[data-conversation-id="${conversationId}"]`);
    if (selectedItem) {
      selectedItem.classList.add('active');
    }

    // Clear unread count
    const conversation = this.conversations.find((c) => c.id === conversationId);
    if (conversation) {
      conversation.unread_count = 0;
      this.renderConversationList();
    }

    // Load messages
    await this.loadMessages(conversationId);

    // Update header
    this.renderChatHeader();

    // Show chat view on mobile
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
      chatContainer.classList.add('show-chat');
    }
  }

  async loadMessages(conversationId: number): Promise<void> {
    try {
      const response = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (response.ok) {
        const messages: Message[] = await response.json();
        this.displayMessages(messages);
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error loading messages:', error);
      this.showNotification('Fehler beim Laden der Nachrichten', 'error');
    }
  }

  displayMessages(messages: Message[]): void {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;

    messagesContainer.innerHTML = '';

    messages.forEach((message) => {
      this.displayMessage(message);
    });

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  displayMessage(message: Message): void {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;

    const isOwnMessage = message.sender_id === this.currentUserId;
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwnMessage ? 'sent' : 'received'}`;
    messageDiv.setAttribute('data-message-id', message.id.toString());

    const time = new Date(message.created_at).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });

    let messageContent = this.escapeHtml(message.content);
    messageContent = this.parseEmojis(messageContent);
    messageContent = this.linkify(messageContent);

    const attachmentsHtml = message.attachments ? this.renderAttachments(message.attachments) : '';

    messageDiv.innerHTML = `
      <div class="message-content">
        ${!isOwnMessage ? `<div class="sender-name">${this.escapeHtml(message.sender?.username || 'Unknown')}</div>` : ''}
        <div class="message-text">${messageContent}</div>
        ${attachmentsHtml}
        <div class="message-time">
          ${time}
          ${isOwnMessage ? `<span class="read-indicator ${message.is_read ? 'read' : ''}">✓✓</span>` : ''}
        </div>
      </div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  renderAttachments(attachments: Attachment[]): string {
    return attachments
      .map((attachment) => {
        const isImage = attachment.mime_type.startsWith('image/');
        const fileSize = this.formatFileSize(attachment.file_size);

        if (isImage) {
          return `
            <div class="attachment image-attachment">
              <img src="/api/chat/attachments/${attachment.id}" alt="${this.escapeHtml(attachment.file_name)}" />
            </div>
          `;
        } else {
          return `
            <div class="attachment file-attachment">
              <i class="fas fa-file"></i>
              <div class="file-info">
                <div class="file-name">${this.escapeHtml(attachment.file_name)}</div>
                <div class="file-size">${fileSize}</div>
              </div>
              <a href="/api/chat/attachments/${attachment.id}/download" class="download-btn">
                <i class="fas fa-download"></i>
              </a>
            </div>
          `;
        }
      })
      .join('');
  }

  async sendMessage(content?: string): Promise<void> {
    const messageInput = document.getElementById('messageInput') as HTMLTextAreaElement;
    const messageContent = content || messageInput?.value.trim();

    if (!messageContent || !this.currentConversationId) return;

    // Clear input
    if (messageInput && !content) {
      messageInput.value = '';
      this.resizeTextarea();
    }

    // Stop typing indicator
    this.stopTyping();

    const tempMessage: Message = {
      id: Date.now(),
      conversation_id: this.currentConversationId,
      sender_id: this.currentUserId!,
      content: messageContent,
      created_at: new Date().toISOString(),
      is_read: false,
      type: 'text',
    };

    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Send via WebSocket
      this.ws.send(
        JSON.stringify({
          type: 'send_message',
          data: {
            conversationId: this.currentConversationId,
            content: messageContent,
            attachments: this.pendingFiles.length > 0 ? await this.uploadFiles() : [],
          },
        }),
      );
      this.pendingFiles = [];
    } else {
      // Queue message
      this.messageQueue.push(tempMessage);
      this.showNotification('Nachricht wird gesendet, sobald die Verbindung wiederhergestellt ist', 'info');
    }

    // Display message immediately
    this.displayMessage(tempMessage);
  }

  async uploadFiles(): Promise<number[]> {
    const attachmentIds: number[] = [];

    for (const file of this.pendingFiles) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('conversationId', this.currentConversationId!.toString());

        const response = await fetch('/api/chat/attachments', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          attachmentIds.push(result.id);
        }
      } catch (error) {
        console.error('❌ Error uploading file:', error);
      }
    }

    return attachmentIds;
  }

  async handleFileUpload(files: FileList): Promise<void> {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const validFiles: File[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > maxSize) {
        this.showNotification(`Datei "${file.name}" ist zu groß (max. 10MB)`, 'warning');
      } else {
        validFiles.push(file);
      }
    }

    if (validFiles.length > 0) {
      this.pendingFiles = validFiles;
      this.showFilePreview();
    }
  }

  showFilePreview(): void {
    const previewContainer = document.getElementById('filePreview');
    if (!previewContainer) return;

    previewContainer.innerHTML = '';
    previewContainer.style.display = 'block';

    this.pendingFiles.forEach((file, index) => {
      const preview = document.createElement('div');
      preview.className = 'file-preview-item';

      const isImage = file.type.startsWith('image/');

      preview.innerHTML = `
        <div class="file-icon">
          ${isImage ? `<img src="${URL.createObjectURL(file)}" alt="${this.escapeHtml(file.name)}" />` : '<i class="fas fa-file"></i>'}
        </div>
        <div class="file-info">
          <div class="file-name">${this.escapeHtml(file.name)}</div>
          <div class="file-size">${this.formatFileSize(file.size)}</div>
        </div>
        <button class="remove-file" data-index="${index}">
          <i class="fas fa-times"></i>
        </button>
      `;

      preview.querySelector('.remove-file')?.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const fileIndex = parseInt(target.dataset.index || '0');
        this.removeFile(fileIndex);
      });

      previewContainer.appendChild(preview);
    });
  }

  removeFile(index: number): void {
    this.pendingFiles.splice(index, 1);
    if (this.pendingFiles.length === 0) {
      const previewContainer = document.getElementById('filePreview');
      if (previewContainer) {
        previewContainer.style.display = 'none';
      }
    } else {
      this.showFilePreview();
    }
  }

  toggleEmojiPicker(): void {
    const emojiPicker = document.getElementById('emojiPicker');
    if (!emojiPicker) return;

    if (emojiPicker.style.display === 'none' || !emojiPicker.style.display) {
      emojiPicker.style.display = 'block';
      this.showEmojiCategory('smileys');
    } else {
      emojiPicker.style.display = 'none';
    }
  }

  showEmojiCategory(categoryName: string): void {
    const emojiGrid = document.getElementById('emojiGrid');
    if (!emojiGrid) return;

    const emojis = this.emojiCategories[categoryName] || [];
    emojiGrid.innerHTML = '';

    emojis.forEach((emoji) => {
      const emojiSpan = document.createElement('span');
      emojiSpan.className = 'emoji';
      emojiSpan.textContent = emoji;
      emojiSpan.addEventListener('click', () => {
        this.insertEmoji(emoji);
      });
      emojiGrid.appendChild(emojiSpan);
    });
  }

  insertEmoji(emoji: string): void {
    const messageInput = document.getElementById('messageInput') as HTMLTextAreaElement;
    if (!messageInput) return;

    const start = messageInput.selectionStart;
    const end = messageInput.selectionEnd;
    const text = messageInput.value;

    messageInput.value = text.substring(0, start) + emoji + text.substring(end);
    messageInput.selectionStart = messageInput.selectionEnd = start + emoji.length;
    messageInput.focus();

    // Hide emoji picker
    const emojiPicker = document.getElementById('emojiPicker');
    if (emojiPicker) {
      emojiPicker.style.display = 'none';
    }
  }

  renderConversationList(): void {
    const conversationsList = document.getElementById('conversationsList');
    if (!conversationsList) return;

    conversationsList.innerHTML = '';

    if (this.conversations.length === 0) {
      conversationsList.innerHTML = `
        <div class="no-conversations">
          <p>Keine Unterhaltungen vorhanden</p>
          <button class="btn btn-primary" onclick="chatClient.showNewConversationModal()">
            Neue Unterhaltung starten
          </button>
        </div>
      `;
      return;
    }

    this.conversations.forEach((conversation) => {
      const item = document.createElement('div');
      item.className = 'conversation-item';
      item.setAttribute('data-conversation-id', conversation.id.toString());

      if (conversation.id === this.currentConversationId) {
        item.classList.add('active');
      }

      const displayName = conversation.is_group
        ? conversation.name || 'Gruppenchat'
        : this.getConversationDisplayName(conversation);

      const lastMessageText = conversation.last_message ? conversation.last_message.content : 'Keine Nachrichten';

      const lastMessageTime = conversation.last_message ? this.formatTime(conversation.last_message.created_at) : '';

      const unreadBadge = conversation.unread_count
        ? `<span class="unread-count">${conversation.unread_count}</span>`
        : '';

      item.innerHTML = `
        <div class="conversation-avatar">
          ${conversation.is_group ? '<i class="fas fa-users"></i>' : '<i class="fas fa-user"></i>'}
        </div>
        <div class="conversation-info">
          <div class="conversation-name">${this.escapeHtml(displayName)}</div>
          <div class="conversation-last-message">${this.escapeHtml(lastMessageText)}</div>
        </div>
        <div class="conversation-meta">
          <div class="conversation-time">${lastMessageTime}</div>
          ${unreadBadge}
        </div>
      `;

      item.addEventListener('click', () => {
        this.selectConversation(conversation.id);
      });

      conversationsList.appendChild(item);
    });
  }

  renderChatHeader(): void {
    const chatHeader = document.getElementById('chatHeader');
    if (!chatHeader || !this.currentConversationId) return;

    const conversation = this.conversations.find((c) => c.id === this.currentConversationId);
    if (!conversation) return;

    const displayName = conversation.is_group
      ? conversation.name || 'Gruppenchat'
      : this.getConversationDisplayName(conversation);

    const statusHtml = conversation.is_group
      ? `<span class="user-count">${conversation.participants.length} Teilnehmer</span>`
      : this.getParticipantStatus(conversation);

    chatHeader.innerHTML = `
      <button class="back-btn" onclick="chatClient.showConversationsList()">
        <i class="fas fa-arrow-left"></i>
      </button>
      <div class="chat-user-info">
        <div class="chat-user-avatar">
          ${conversation.is_group ? '<i class="fas fa-users"></i>' : '<i class="fas fa-user"></i>'}
        </div>
        <div class="chat-user-details">
          <div class="chat-user-name">${this.escapeHtml(displayName)}</div>
          <div class="chat-user-status">${statusHtml}</div>
        </div>
      </div>
      <div class="chat-actions">
        <button class="chat-action-btn" title="Suchen">
          <i class="fas fa-search"></i>
        </button>
        <button class="chat-action-btn" title="Löschen" id="deleteConversationBtn">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;

    // Re-attach delete button listener
    const deleteBtn = document.getElementById('deleteConversationBtn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        this.deleteCurrentConversation();
      });
    }
  }

  getConversationDisplayName(conversation: Conversation): string {
    const otherParticipant = conversation.participants.find((p) => p.id !== this.currentUserId);
    return otherParticipant
      ? `${otherParticipant.first_name || ''} ${otherParticipant.last_name || ''}`.trim() || otherParticipant.username
      : 'Unknown';
  }

  getParticipantStatus(conversation: Conversation): string {
    const otherParticipant = conversation.participants.find((p) => p.id !== this.currentUserId);

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

  showNewConversationModal(): void {
    const modal = document.getElementById('newConversationModal');
    if (!modal) return;

    // Populate user list
    const userList = document.getElementById('userList');
    if (userList) {
      userList.innerHTML = '';

      this.availableUsers.forEach((user) => {
        if (user.id === this.currentUserId) return;

        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.innerHTML = `
          <input type="checkbox" id="user-${user.id}" value="${user.id}" />
          <label for="user-${user.id}">
            <div class="user-avatar">
              <i class="fas fa-user"></i>
            </div>
            <div class="user-info">
              <div class="user-name">${this.escapeHtml(`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username)}</div>
              <div class="user-role">${this.escapeHtml(user.role)}</div>
            </div>
          </label>
        `;
        userList.appendChild(userItem);
      });
    }

    modal.style.display = 'flex';
  }

  closeModal(modalId: string): void {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
    }
  }

  async createConversation(): Promise<void> {
    const selectedUsers = Array.from(
      document.querySelectorAll<HTMLInputElement>('#userList input[type="checkbox"]:checked'),
    ).map((input) => parseInt(input.value));

    if (selectedUsers.length === 0) {
      this.showNotification('Bitte mindestens einen Benutzer auswählen', 'warning');
      return;
    }

    const isGroup = selectedUsers.length > 1;
    const groupNameInput = document.getElementById('groupChatName') as HTMLInputElement;
    const groupName = isGroup && groupNameInput ? groupNameInput.value.trim() : null;

    try {
      const response = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participant_ids: selectedUsers,
          is_group: isGroup,
          name: groupName || null,
        }),
      });

      if (response.ok) {
        const result = await response.json();

        this.showNotification(
          isGroup ? 'Gruppenchat erfolgreich erstellt' : 'Unterhaltung erfolgreich erstellt',
          'success',
        );
        this.closeModal('newConversationModal');

        // Reload conversations
        await this.loadInitialData();

        // Select new conversation
        this.selectConversation(result.id);
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error creating conversation:', error);
      this.showNotification('Fehler beim Erstellen der Unterhaltung', 'error');
    }
  }

  async deleteCurrentConversation(): Promise<void> {
    if (!this.currentConversationId) return;

    if (!confirm('Möchten Sie diese Unterhaltung wirklich löschen?')) {
      return;
    }

    try {
      const response = await fetch(`/api/chat/conversations/${this.currentConversationId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (response.ok) {
        this.showNotification('Unterhaltung gelöscht', 'success');

        // Remove from list
        this.conversations = this.conversations.filter((c) => c.id !== this.currentConversationId);

        this.currentConversationId = null;
        this.renderConversationList();

        // Clear chat
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
          messagesContainer.innerHTML = '';
        }

        // Show conversation list on mobile
        this.showConversationsList();
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error deleting conversation:', error);
      this.showNotification('Fehler beim Löschen der Unterhaltung', 'error');
    }
  }

  showConversationsList(): void {
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
      chatContainer.classList.remove('show-chat');
    }
  }

  initializeEventListeners(): void {
    // Message input
    const messageInput = document.getElementById('messageInput') as HTMLTextAreaElement;
    if (messageInput) {
      // Enter key to send
      messageInput.addEventListener('keypress', (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });

      // Typing indicator
      messageInput.addEventListener('input', () => {
        this.handleTyping();
        this.resizeTextarea();
      });
    }

    // Send button
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
      sendBtn.addEventListener('click', () => {
        this.sendMessage();
      });
    }

    // File upload handler
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    const attachmentBtn = document.getElementById('attachmentBtn');

    if (attachmentBtn && fileInput) {
      attachmentBtn.addEventListener('click', (e) => {
        e.preventDefault();
        fileInput.click();
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', async (event) => {
        const target = event.target as HTMLInputElement;
        const files = target.files;
        if (files && files.length > 0) {
          await this.handleFileUpload(files);
          fileInput.value = '';
        }
      });
    }

    // Emoji picker handler
    const emojiBtn = document.getElementById('emojiBtn');
    if (emojiBtn) {
      emojiBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleEmojiPicker();
      });
    }

    // Emoji category handlers
    const emojiCategories = document.querySelectorAll<HTMLElement>('.emoji-category');
    emojiCategories.forEach((category) => {
      category.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const categoryName = target.dataset.category;
        if (categoryName) {
          this.showEmojiCategory(categoryName);

          // Update active state
          document.querySelectorAll('.emoji-category').forEach((cat) => cat.classList.remove('active'));
          target.classList.add('active');
        }
      });
    });

    // Click outside to close emoji picker
    document.addEventListener('click', (e) => {
      const emojiPicker = document.getElementById('emojiPicker');
      const emojiBtn = document.getElementById('emojiBtn');
      if (
        emojiPicker &&
        !emojiPicker.contains(e.target as Node) &&
        e.target !== emojiBtn &&
        !emojiBtn?.contains(e.target as Node)
      ) {
        emojiPicker.style.display = 'none';
      }
    });

    // New conversation button
    const newConvBtn = document.getElementById('newConversationBtn');
    if (newConvBtn) {
      newConvBtn.addEventListener('click', () => {
        this.showNewConversationModal();
      });
    }

    // Create conversation button
    const createConvBtn = document.getElementById('createConversationBtn');
    if (createConvBtn) {
      createConvBtn.addEventListener('click', () => {
        this.createConversation();
      });
    }

    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const modal = (e.target as HTMLElement).closest('.modal') as HTMLElement;
        if (modal) {
          modal.style.display = 'none';
        }
      });
    });

    // Periodic connection check
    setInterval(() => {
      if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: 'ping',
            data: { timestamp: new Date().toISOString() },
          }),
        );
      }
    }, 30000); // Every 30 seconds
  }

  handleTyping(): void {
    if (!this.currentConversationId || !this.isConnected) return;

    // Send typing start
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'typing_start',
          data: { conversationId: this.currentConversationId },
        }),
      );
    }

    // Timer for typing stop
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
    }

    this.typingTimer = setTimeout(() => {
      if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: 'typing_stop',
            data: { conversationId: this.currentConversationId },
          }),
        );
      }
    }, 2000);
  }

  stopTyping(): void {
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
    }

    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'typing_stop',
          data: { conversationId: this.currentConversationId },
        }),
      );
    }
  }

  updateTypingIndicator(): void {
    const typingIndicator = document.getElementById('typingIndicator');
    if (!typingIndicator) return;

    const conversation = this.conversations.find((c) => c.id === this.currentConversationId);

    if (!conversation || !conversation.typing_users || conversation.typing_users.length === 0) {
      typingIndicator.style.display = 'none';
      return;
    }

    const typingUsers = conversation.typing_users
      .map((userId) => {
        const participant = conversation.participants.find((p) => p.id === userId);
        return participant ? participant.username : 'Unknown';
      })
      .filter((name) => name !== 'Unknown');

    if (typingUsers.length > 0) {
      typingIndicator.style.display = 'block';
      typingIndicator.textContent = `${typingUsers.join(', ')} ${typingUsers.length === 1 ? 'tippt' : 'tippen'}...`;
    } else {
      typingIndicator.style.display = 'none';
    }
  }

  markMessageAsRead(messageId: number): void {
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'mark_read',
          data: { messageId },
        }),
      );
    }
  }

  resizeTextarea(): void {
    const textarea = document.getElementById('messageInput') as HTMLTextAreaElement;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }

  updateConnectionStatus(connected: boolean): void {
    const statusIndicator = document.getElementById('connectionStatus');
    if (statusIndicator) {
      statusIndicator.className = connected ? 'connected' : 'disconnected';
      statusIndicator.title = connected ? 'Verbunden' : 'Getrennt';
    }
  }

  playNotificationSound(): void {
    const audio = new Audio('/sounds/notification.mp3');
    audio.play().catch((error) => {
      console.log('Could not play notification sound:', error);
    });
  }

  showDesktopNotification(message: Message): void {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      const notification = new Notification('Neue Nachricht', {
        body: `${message.sender?.username || 'Unknown'}: ${message.content}`,
        icon: '/images/logo.png',
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }

  showNotification(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info'): void {
    const notification = document.getElementById('notification');
    if (!notification) return;

    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.display = 'block';

    setTimeout(() => {
      notification.style.display = 'none';
    }, 3000);
  }

  startTypingTimer(): void {
    let typingTimer: NodeJS.Timeout | null = null;
    let isTyping = false;

    const messageInput = document.getElementById('message-input') as HTMLTextAreaElement;
    if (!messageInput) return;

    messageInput.addEventListener('input', () => {
      if (!isTyping && this.currentConversationId) {
        isTyping = true;
        // Send typing started event
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(
            JSON.stringify({
              type: 'typing',
              data: { conversationId: this.currentConversationId },
            }),
          );
        }
      }

      // Clear existing timer
      if (typingTimer) {
        clearTimeout(typingTimer);
      }

      // Set new timer to stop typing after 2 seconds
      typingTimer = setTimeout(() => {
        if (isTyping && this.currentConversationId) {
          isTyping = false;
          // Send typing stopped event
          if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(
              JSON.stringify({
                type: 'stop_typing',
                data: { conversationId: this.currentConversationId },
              }),
            );
          }
        }
      }, 2000);
    });
  }

  toggleSearch(): void {
    // Implement search functionality
    console.log('Search functionality not yet implemented');
  }

  // Utility methods
  escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  parseEmojis(text: string): string {
    // Simple emoji parsing - could be extended
    return text;
  }

  linkify(text: string): string {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, '<a href="$1" target="_blank">$1</a>');
  }

  formatTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else if (diffDays === 1) {
      return 'Gestern';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('de-DE', { weekday: 'long' });
    } else {
      return date.toLocaleDateString('de-DE');
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}

// Initialize chat client
let chatClient: ChatClient | null = null;

document.addEventListener('DOMContentLoaded', () => {
  chatClient = new ChatClient();

  // Export to window for backwards compatibility
  if (typeof window !== 'undefined') {
    (window as any).chatClient = chatClient;
  }
});
