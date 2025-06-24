/**
 * Chat Client System
 * WebSocket-based real-time chat functionality
 */

import type { User } from '../types/api.types';
import { getAuthToken } from './auth';
// import { showSuccess, showError } from './auth';

declare global {
  interface Window {
    chatClient?: ChatClient;
  }
}

interface ChatUser extends User {
  status?: 'online' | 'offline' | 'away';
  last_seen?: string;
  department_id?: number;
  department?: string;
  position?: string;
  profile_picture_url?: string;
  profile_image_url?: string;
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
  display_name?: string;
}

interface WebSocketMessage {
  type: string;
  data: unknown;
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
  private messageQueue: Message[];
  private typingTimer: NodeJS.Timeout | null;
  private emojiCategories: EmojiCategories;
  private isCreatingConversation: boolean = false;

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
    this.messageQueue = [];
    this.typingTimer = null;

    // Initialize emoji categories with basic emojis only
    this.emojiCategories = {
      smileys: [
        '😀',
        '😃',
        '😄',
        '😁',
        '😊',
        '😉',
        '🙂',
        '😂',
        '😍',
        '🥰',
        '😘',
        '😎',
        '🤔',
        '😐',
        '😑',
        '😏',
        '😒',
        '😔',
        '😢',
        '😭',
        '😤',
        '😠',
        '😡',
        '🤬',
        '😱',
        '😨',
        '😰',
        '😥',
        '🤗',
        '😶',
        '🙄',
        '😴',
        '🤢',
        '🤮',
        '😷',
        '🤒',
        '🤕',
        '🤯',
        '😵',
        '🥳',
      ],
      hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '💕', '💞', '💓', '💗', '💖', '💘', '💝'],
      animals: [
        '🐶',
        '🐱',
        '🐭',
        '🐹',
        '🐰',
        '🦊',
        '🐻',
        '🐼',
        '🐻‍❄️',
        '🐨',
        '🐯',
        '🦁',
        '🐮',
        '🐷',
        '🐽',
        '🐸',
        '🐵',
        '🙈',
        '🙉',
        '🙊',
        '🐒',
        '🐔',
        '🐧',
        '🐦',
        '🐤',
        '🐣',
        '🐥',
        '🦆',
        '🦅',
        '🦉',
        '🦇',
        '🐺',
        '🐗',
        '🐴',
        '🦄',
        '🐝',
        '🪱',
        '🐛',
        '🦋',
        '🐌',
        '🐞',
        '🐜',
        '🪰',
        '🪲',
        '🪳',
        '🦟',
        '🦗',
        '🕷️',
        '🕸️',
        '🦂',
        '🐢',
        '🐍',
        '🦎',
        '🦖',
        '🦕',
        '🐙',
        '🦑',
        '🦐',
        '🦞',
        '🦀',
        '🐡',
        '🐠',
        '🐟',
        '🐬',
        '🐳',
        '🐋',
        '🦈',
        '🐊',
        '🐅',
        '🐆',
        '🦓',
        '🦍',
        '🦧',
        '🦣',
        '🐘',
        '🦛',
        '🦏',
        '🐪',
        '🐫',
        '🦒',
        '🦘',
        '🦬',
        '🐃',
        '🐂',
        '🐄',
        '🐎',
        '🐖',
        '🐏',
        '🐑',
        '🦙',
        '🐐',
        '🦌',
        '🐕',
        '🐩',
        '🦮',
        '🐕‍🦺',
        '🐈',
        '🐈‍⬛',
        '🪶',
        '🐓',
        '🦃',
        '🦤',
        '🦚',
        '🦜',
        '🦢',
        '🦩',
        '🕊️',
        '🐇',
        '🦝',
        '🦨',
        '🦡',
        '🦫',
        '🦦',
        '🦥',
        '🐁',
        '🐀',
        '🐿️',
        '🦔',
      ],
      food: [
        '🍏',
        '🍎',
        '🍐',
        '🍊',
        '🍋',
        '🍌',
        '🍉',
        '🍇',
        '🍓',
        '🫐',
        '🍈',
        '🍒',
        '🍑',
        '🥭',
        '🍍',
        '🥥',
        '🥝',
        '🍅',
        '🍆',
        '🥑',
        '🥦',
        '🥬',
        '🥒',
        '🌶️',
        '🫑',
        '🌽',
        '🥕',
        '🫒',
        '🧄',
        '🧅',
        '🥔',
        '🍠',
        '🥐',
        '🥯',
        '🍞',
        '🥖',
        '🥨',
        '🧀',
        '🥚',
        '🍳',
        '🧈',
        '🥞',
        '🧇',
        '🥓',
        '🥩',
        '🍗',
        '🍖',
        '🌭',
        '🍔',
        '🍟',
        '🍕',
        '🫓',
        '🥪',
        '🥙',
        '🧆',
        '🌮',
        '🌯',
        '🫔',
        '🥗',
        '🥘',
        '🫕',
        '🥫',
        '🍝',
        '🍜',
        '🍲',
        '🍛',
        '🍣',
        '🍱',
        '🥟',
        '🦪',
        '🍤',
        '🍙',
        '🍚',
        '🍘',
        '🍥',
        '🥠',
        '🥮',
        '🍢',
        '🍡',
        '🍧',
        '🍨',
        '🍦',
        '🥧',
        '🧁',
        '🍰',
        '🎂',
        '🍮',
        '🍭',
        '🍬',
        '🍫',
        '🍿',
        '🍩',
        '🍪',
        '🌰',
        '🥜',
        '🍯',
        '🥛',
        '🍼',
        '🫖',
        '☕',
        '🍵',
        '🧃',
        '🥤',
        '🧋',
        '🍶',
        '🍺',
        '🍻',
        '🥂',
        '🍷',
        '🥃',
        '🍸',
        '🍹',
        '🧉',
        '🍾',
        '🧊',
        '🥄',
        '🍴',
        '🍽️',
        '🥣',
        '🥡',
        '🥢',
        '🧂',
      ],
      activities: [
        '⚽',
        '🏀',
        '🏈',
        '⚾',
        '🥎',
        '🎾',
        '🏐',
        '🏉',
        '🥏',
        '🎱',
        '🪀',
        '🏓',
        '🏸',
        '🏒',
        '🏑',
        '🥍',
        '🏏',
        '🪃',
        '🥅',
        '⛳',
        '🪁',
        '🏹',
        '🎣',
        '🤿',
        '🥊',
        '🥋',
        '🎽',
        '🛹',
        '🛼',
        '🛷',
        '⛸️',
        '🥌',
        '🎿',
        '⛷️',
        '🏂',
        '🪂',
        '🏋️‍♀️',
        '🏋️',
        '🏋️‍♂️',
        '🤼‍♀️',
        '🤼',
        '🤼‍♂️',
        '🤸‍♀️',
        '🤸',
        '🤸‍♂️',
        '⛹️‍♀️',
        '⛹️',
        '⛹️‍♂️',
        '🤺',
        '🤾‍♀️',
        '🤾',
        '🤾‍♂️',
        '🏌️‍♀️',
        '🏌️',
        '🏌️‍♂️',
        '🏇',
        '🧘‍♀️',
        '🧘',
        '🧘‍♂️',
        '🏄‍♀️',
        '🏄',
        '🏄‍♂️',
        '🏊‍♀️',
        '🏊',
        '🏊‍♂️',
        '🤽‍♀️',
        '🤽',
        '🤽‍♂️',
        '🚣‍♀️',
        '🚣',
        '🚣‍♂️',
        '🧗‍♀️',
        '🧗',
        '🧗‍♂️',
        '🚵‍♀️',
        '🚵',
        '🚵‍♂️',
        '🚴‍♀️',
        '🚴',
        '🚴‍♂️',
        '🏆',
        '🥇',
        '🥈',
        '🥉',
        '🏅',
        '🎖️',
        '🏵️',
        '🎗️',
        '🎫',
        '🎟️',
        '🎪',
        '🤹‍♀️',
        '🤹',
        '🤹‍♂️',
        '🎭',
        '🩰',
        '🎨',
        '🎬',
        '🎤',
        '🎧',
        '🎼',
        '🎹',
        '🥁',
        '🪘',
        '🎷',
        '🎺',
        '🪗',
        '🎸',
        '🪕',
        '🎻',
        '🎲',
        '♟️',
        '🎯',
        '🎳',
        '🎮',
        '🎰',
        '🧩',
      ],
      objects: [
        '💡',
        '🔦',
        '🏮',
        '🪔',
        '📱',
        '💻',
        '⌨️',
        '🖥️',
        '🖨️',
        '🖱️',
        '🖲️',
        '💾',
        '💿',
        '📀',
        '📼',
        '📷',
        '📸',
        '📹',
        '🎥',
        '📽️',
        '🎞️',
        '📞',
        '☎️',
        '📟',
        '📠',
        '📺',
        '📻',
        '🎙️',
        '🎚️',
        '🎛️',
        '🧭',
        '⏱️',
        '⏲️',
        '⏰',
        '🕰️',
        '⌛',
        '⏳',
        '📡',
        '🔋',
        '🔌',
        '💡',
        '🔦',
        '🕯️',
        '🪔',
        '🧯',
        '🛢️',
        '💸',
        '💵',
        '💴',
        '💶',
        '💷',
        '🪙',
        '💰',
        '💳',
        '💎',
        '⚖️',
        '🪜',
        '🧰',
        '🪛',
        '🔧',
        '🔨',
        '⚒️',
        '🛠️',
        '⛏️',
        '🪚',
        '🔩',
        '⚙️',
        '🪤',
        '🧱',
        '⛓️',
        '🧲',
        '🔫',
        '💣',
        '🧨',
        '🪓',
        '🔪',
        '🗡️',
        '⚔️',
        '🛡️',
        '🚬',
        '⚰️',
        '🪦',
        '⚱️',
        '🏺',
        '🔮',
        '📿',
        '🧿',
        '💈',
        '⚗️',
        '🔭',
        '🔬',
        '🕳️',
        '🩹',
        '🩺',
        '💊',
        '💉',
        '🩸',
        '🧬',
        '🦠',
        '🧫',
        '🧪',
        '🌡️',
        '🧹',
        '🪠',
        '🧺',
        '🧻',
        '🚽',
        '🚰',
        '🚿',
        '🛁',
        '🛀',
        '🧼',
        '🪥',
        '🪒',
        '🧽',
        '🪣',
        '🧴',
        '🛎️',
        '🔑',
        '🗝️',
        '🚪',
        '🪑',
        '🛋️',
        '🛏️',
        '🛌',
        '🧸',
        '🪆',
        '🖼️',
        '🪞',
        '🪟',
        '🛍️',
        '🛒',
        '🎁',
        '🎈',
        '🎏',
        '🎀',
        '🪄',
        '🪅',
        '🎊',
        '🎉',
        '🎎',
        '🏮',
        '🎐',
        '🧧',
        '✉️',
        '📩',
        '📨',
        '📧',
        '💌',
        '📥',
        '📤',
        '📦',
        '🏷️',
        '🪧',
        '📪',
        '📫',
        '📬',
        '📭',
        '📮',
        '📯',
        '📜',
        '📃',
        '📄',
        '📑',
        '🧾',
        '📊',
        '📈',
        '📉',
        '🗒️',
        '🗓️',
        '📆',
        '📅',
        '🗑️',
        '📇',
        '🗃️',
        '🗳️',
        '🗄️',
        '📋',
        '📁',
        '📂',
        '🗂️',
        '🗞️',
        '📰',
        '📓',
        '📔',
        '📒',
        '📕',
        '📗',
        '📘',
        '📙',
        '📚',
        '📖',
        '🔖',
        '🧷',
        '🔗',
        '📎',
        '🖇️',
        '📐',
        '📏',
        '🧮',
        '📌',
        '📍',
        '✂️',
        '🖊️',
        '🖋️',
        '✒️',
        '🖌️',
        '🖍️',
        '📝',
        '✏️',
        '🔍',
        '🔎',
        '🔏',
        '🔐',
        '🔒',
        '🔓',
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

    // init() will be called from DOMContentLoaded
  }

  private initialized = false;

  async init(): Promise<void> {
    // Prevent multiple initializations
    if (this.initialized) {
      console.warn('⚠️ ChatClient already initialized');
      return;
    }

    // Check if token exists
    if (!this.token) {
      console.error('❌ No authentication token found');
      window.location.href = '/pages/login.html';
      return;
    }

    this.initialized = true;
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
        const conversations = await response.json();
        // Stelle sicher, dass jede Konversation ein participants Array hat
        this.conversations = conversations.map((conv: any) => ({
          ...conv,
          participants: conv.participants || [],
        }));
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
      const response = await fetch('/api/chat/users', {
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
    // Close existing connection if any
    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnect attempts
      this.ws.close();
      this.ws = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Include token as query parameter for authentication
    const wsUrl = `${protocol}//${window.location.host}/chat-ws?token=${encodeURIComponent(this.token || '')}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.info('✅ WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.updateConnectionStatus(true);

        // No need to send auth message since token is in query params
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
        console.info('🔌 WebSocket disconnected');
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
      case 'connection_established':
        console.info('✅ Connection established');
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
        // Backend sends message data directly, not wrapped in { message, conversationId }
        const messageData = message.data as Message & { conversation_id: number };
        this.handleNewMessage({
          message: messageData,
          conversationId: messageData.conversation_id,
        });
        break;

      case 'typing_start':
      case 'user_typing':
        this.handleTypingStart(message.data as { userId: number; conversationId: number });
        break;

      case 'typing_stop':
      case 'user_stopped_typing':
        this.handleTypingStop(message.data as { userId: number; conversationId: number });
        break;

      case 'user_status':
      case 'user_status_changed':
        this.handleUserStatus(message.data as { userId: number; status: string });
        break;

      case 'message_read':
        this.handleMessageRead(message.data as { messageId: number; userId: number });
        break;

      case 'pong':
        // Connection keepalive response
        break;

      default:
        console.info('📨 Unknown message type:', message.type);
    }
  }

  handleNewMessage(data: { message: Message; conversationId: number }): void {
    const { message, conversationId } = data;

    // Ensure message has proper sender object structure
    if (!message.sender && (message as any).sender_id) {
      message.sender = {
        id: (message as any).sender_id,
        username: (message as any).username || (message as any).sender_name || 'Unknown',
        first_name: (message as any).first_name,
        last_name: (message as any).last_name,
        profile_picture_url: (message as any).profile_image_url || (message as any).profile_picture_url,
        role: 'employee', // Default role
        tenant_id: 0, // Will be set by backend
        email: '',
        created_at: '',
        updated_at: '',
        is_active: true,
        is_archived: false,
      };
    }

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
      if (message.sender_id === this.currentUserId) {
        // For our own messages, we need to replace the temporary message
        // Find and remove the temporary message with matching content
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
          const tempMessages = messagesContainer.querySelectorAll('.message.own');
          tempMessages.forEach((msg) => {
            const msgText = msg.querySelector('.message-text')?.textContent;
            if (msgText === message.content && (msg.getAttribute('data-message-id')?.length ?? 0) > 10) {
              // Remove temporary message (IDs > 10 chars are timestamps)
              msg.remove();
            }
          });
        }
        // Display the real message from server
        this.displayMessage(message);
      } else {
        // Display messages from other users
        this.displayMessage(message);
        this.markMessageAsRead(message.id);

        // Show notification if window is not focused
        if (!document.hasFocus()) {
          this.showDesktopNotification(message);
        }
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
    console.info(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

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

    // Clear unread count and mark messages as read
    const conversation = this.conversations.find((c) => c.id === conversationId);
    if (conversation) {
      conversation.unread_count = 0;
      this.renderConversationList();

      // Mark all messages in this conversation as read
      await this.markConversationAsRead(conversationId);
    }

    // Load messages
    await this.loadMessages(conversationId);

    // Update header
    this.renderChatHeader();

    // Show chat elements
    const chatHeader = document.getElementById('chat-header');
    const chatArea = document.getElementById('chatArea');
    const noChatSelected = document.getElementById('noChatSelected');

    if (chatHeader) chatHeader.style.display = 'flex';
    if (chatArea) chatArea.style.display = 'block';
    if (noChatSelected) noChatSelected.style.display = 'none';

    // Show chat view on mobile
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
      chatContainer.classList.add('show-chat');
    }
  }

  async markConversationAsRead(conversationId: number): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await fetch(`/api/chat/conversations/${conversationId}/read`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      // Update the navigation badge
      if (window.unifiedNav) {
        window.unifiedNav.updateUnreadMessages();
      }
    } catch (error) {
      console.error('Error marking conversation as read:', error);
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
    messageDiv.className = `message ${isOwnMessage ? 'own' : ''}`;
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
    console.log('sendMessage called');
    const messageInput = document.getElementById('messageInput') as HTMLTextAreaElement;
    const messageContent = content || messageInput?.value.trim();

    console.log('Message content:', messageContent);
    console.log('Current conversation ID:', this.currentConversationId);
    console.log('Is connected:', this.isConnected);
    console.log('WebSocket state:', this.ws?.readyState);

    if (!messageContent || !this.currentConversationId) {
      console.warn('No message content or conversation ID');
      return;
    }

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
      sender_id: this.currentUserId || 0,
      content: messageContent,
      created_at: new Date().toISOString(),
      is_read: false,
      type: 'text',
      sender: this.currentUser as ChatUser,
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
      // Don't display the message here - it will come back via WebSocket
    } else {
      // Queue message
      this.messageQueue.push(tempMessage);
      this.showNotification('Nachricht wird gesendet, sobald die Verbindung wiederhergestellt ist', 'info');
      // Display message immediately when offline
      this.displayMessage(tempMessage);
    }
  }

  async uploadFiles(): Promise<number[]> {
    const attachmentIds: number[] = [];

    for (const file of this.pendingFiles) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        if (this.currentConversationId) {
          formData.append('conversationId', this.currentConversationId.toString());
        }

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

  handleFileUpload(files: FileList): void {
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
    const emojiContent = document.getElementById('emojiContent');
    if (!emojiContent) return;

    const emojis = this.emojiCategories[categoryName] || [];
    emojiContent.innerHTML = '';

    emojis.forEach((emoji) => {
      const emojiSpan = document.createElement('span');
      emojiSpan.className = 'emoji-item';
      emojiSpan.textContent = emoji;
      emojiSpan.addEventListener('click', () => {
        this.insertEmoji(emoji);
      });
      emojiContent.appendChild(emojiSpan);
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

      let lastMessageText = 'Keine Nachrichten';
      if (conversation.last_message && conversation.last_message.content) {
        // Truncate message to one line (max ~40 chars)
        const content = conversation.last_message.content;
        lastMessageText = content.length > 40 ? `${content.substring(0, 37)}...` : content;
      }

      const lastMessageTime = conversation.last_message ? this.formatTime(conversation.last_message.created_at) : '';

      const unreadBadge = conversation.unread_count
        ? `<span class="unread-count">${conversation.unread_count}</span>`
        : '';

      item.innerHTML = `
        <div class="conversation-avatar">
          ${conversation.is_group ? '<i class="fas fa-users"></i>' : '<i class="fas fa-user"></i>'}
        </div>
        <div class="conversation-info">
          <div class="conversation-name">${this.escapeHtml(displayName || 'Unbekannt')}</div>
          <div class="conversation-last-message">${this.escapeHtml(lastMessageText)}</div>
        </div>
        <div class="conversation-meta">
          <div class="conversation-time">${lastMessageTime || ''}</div>
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
    const chatHeader = document.getElementById('chat-header');
    if (!chatHeader || !this.currentConversationId) return;

    const conversation = this.conversations.find((c) => c.id === this.currentConversationId);
    if (!conversation) return;

    const displayName = conversation.is_group
      ? conversation.name || 'Gruppenchat'
      : this.getConversationDisplayName(conversation);

    const isAdmin = this.currentUser.role === 'admin';

    // Get avatar for 1:1 chats
    let avatarHtml = '<i class="fas fa-users"></i>';
    if (!conversation.is_group && conversation.participants) {
      const otherParticipant = conversation.participants.find((p) => p.id !== this.currentUserId);
      if (otherParticipant && otherParticipant.profile_image_url) {
        avatarHtml = `<img src="${otherParticipant.profile_image_url}" alt="${this.escapeHtml(displayName)}" />`;
      } else {
        avatarHtml = '<i class="fas fa-user"></i>';
      }
    }

    chatHeader.innerHTML = `
      <button class="back-btn" onclick="chatClient.showConversationsList()">
        <i class="fas fa-arrow-left"></i>
      </button>
      <div class="chat-user-info">
        <div class="chat-user-avatar">
          ${avatarHtml}
        </div>
        <div class="chat-user-details">
          <div class="chat-user-name">${this.escapeHtml(displayName)}</div>
        </div>
      </div>
      <div class="chat-actions">
        <button class="chat-action-btn" title="Suchen">
          <i class="fas fa-search"></i>
        </button>
        ${
  isAdmin
    ? `
          <button class="chat-action-btn" title="Löschen" id="deleteConversationBtn">
            <i class="fas fa-trash"></i>
          </button>
        `
    : ''
}
      </div>
    `;

    // Re-attach delete button listener only for admins
    if (isAdmin) {
      const deleteBtn = document.getElementById('deleteConversationBtn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          this.deleteCurrentConversation();
        });
      }
    }
  }

  getConversationDisplayName(conversation: Conversation): string {
    // Für Gruppenchats
    if (conversation.is_group) {
      return conversation.name || 'Gruppenchat';
    }

    // Für 1:1 Chats - nutze display_name wenn verfügbar
    if (conversation.display_name) {
      return conversation.display_name;
    }

    // Fallback auf participants array
    if (conversation.participants && conversation.participants.length > 0) {
      const otherParticipant = conversation.participants.find((p) => p.id !== this.currentUserId);
      if (otherParticipant) {
        return (
          `${otherParticipant.first_name || ''} ${otherParticipant.last_name || ''}`.trim() || otherParticipant.username
        );
      }
    }

    return 'Unbekannt';
  }

  getParticipantStatus(conversation: Conversation): string {
    if (!conversation.participants || conversation.participants.length === 0) {
      return '';
    }
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

    // Reset modal state
    this.resetModalState();

    // Load departments
    this.loadDepartments();

    // Load admins
    this.loadAdmins();

    // Set up tab listeners
    this.setupTabListeners();

    modal.style.display = 'flex';
  }

  private resetModalState(): void {
    // Reset tabs
    document.querySelectorAll('.chat-type-tab').forEach((tab) => tab.classList.remove('active'));
    document.getElementById('employeeTab')?.classList.add('active');

    // Reset selections
    document.querySelectorAll('.recipient-selection').forEach((section) => {
      (section as HTMLElement).style.display = 'none';
    });
    const employeeSection = document.getElementById('employeeSelection');
    if (employeeSection) employeeSection.style.display = 'block';

    // Reset dropdowns
    const deptDisplay = document.getElementById('departmentDisplay')?.querySelector('span');
    if (deptDisplay) deptDisplay.textContent = 'Abteilung wählen';

    const empDisplay = document.getElementById('employeeDisplay')?.querySelector('span');
    if (empDisplay) empDisplay.textContent = 'Mitarbeiter wählen';

    const adminDisplayElem = document.getElementById('adminDisplay')?.querySelector('span');
    if (adminDisplayElem) adminDisplayElem.textContent = 'Administrator wählen';

    // Hide employee dropdown initially
    const employeeGroup = document.getElementById('employeeDropdownGroup');
    if (employeeGroup) employeeGroup.style.display = 'none';

    // Clear selected recipients
    const selectedList = document.getElementById('selectedRecipientsList');
    if (selectedList) selectedList.innerHTML = '';

    // Hide group options
    const groupOptions = document.getElementById('groupChatOptions');
    if (groupOptions) groupOptions.style.display = 'none';
  }

  private setupTabListeners(): void {
    const tabs = document.querySelectorAll('.chat-type-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const type = target.dataset.type;

        // Update active tab
        tabs.forEach((t) => t.classList.remove('active'));
        target.classList.add('active');

        // Show corresponding section
        document.querySelectorAll('.recipient-selection').forEach((section) => {
          (section as HTMLElement).style.display = 'none';
        });

        if (type === 'employee') {
          const section = document.getElementById('employeeSelection');
          if (section) section.style.display = 'block';
        } else if (type === 'admin') {
          const section = document.getElementById('adminSelection');
          if (section) section.style.display = 'block';
        }
      });
    });
  }

  private async loadDepartments(): Promise<void> {
    try {
      const response = await fetch('/api/departments', {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (response.ok) {
        const departments = await response.json();
        const dropdown = document.getElementById('departmentDropdown');

        if (dropdown) {
          dropdown.innerHTML = '';

          departments.forEach((dept: any) => {
            const option = document.createElement('div');
            option.className = 'dropdown-option';
            option.onclick = () => {
              (window as any).selectChatDropdownOption('department', dept.id, dept.name);
            };
            option.innerHTML = `
              <div class="option-info">
                <div class="option-name">${this.escapeHtml(dept.name)}</div>
              </div>
            `;
            dropdown.appendChild(option);
          });
        }
      }
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  }

  async loadEmployeesForDepartment(departmentId: string): Promise<void> {
    try {
      // Filter employees by department
      const employees = this.availableUsers.filter(
        (user) => user.role === 'employee' && user.department_id?.toString() === departmentId.toString(),
      );

      const dropdown = document.getElementById('employeeDropdown');

      if (dropdown) {
        dropdown.innerHTML = '';

        if (employees.length === 0) {
          dropdown.innerHTML = '<div class="dropdown-option disabled">Keine Mitarbeiter in dieser Abteilung</div>';
          return;
        }

        employees.forEach((employee) => {
          const option = document.createElement('div');
          option.className = 'dropdown-option';
          option.onclick = () => {
            const name = `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.username;
            (window as any).selectChatDropdownOption('employee', employee.id, name, employee.department || '');
          };
          option.innerHTML = `
            <div class="option-info">
              <div class="option-name">${this.escapeHtml(`${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.username)}</div>
              <div class="option-meta">${this.escapeHtml(employee.position || 'Mitarbeiter')}</div>
            </div>
          `;
          dropdown.appendChild(option);
        });
      }
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  }

  private loadAdmins(): void {
    const admins = this.availableUsers.filter((user) => user.role === 'admin' || user.role === 'root');

    const dropdown = document.getElementById('adminDropdown');

    if (dropdown) {
      dropdown.innerHTML = '';

      admins.forEach((admin) => {
        const option = document.createElement('div');
        option.className = 'dropdown-option';
        option.onclick = () => {
          const name = `${admin.first_name || ''} ${admin.last_name || ''}`.trim() || admin.username;
          (window as any).selectChatDropdownOption('admin', admin.id, name, admin.role);
        };
        option.innerHTML = `
          <div class="option-info">
            <div class="option-name">${this.escapeHtml(`${admin.first_name || ''} ${admin.last_name || ''}`.trim() || admin.username)}</div>
            <div class="option-meta">${this.escapeHtml(admin.role === 'root' ? 'Root Administrator' : 'Administrator')}</div>
          </div>
        `;
        dropdown.appendChild(option);
      });
    }
  }

  closeModal(modalId: string): void {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
    }
  }

  async createConversation(): Promise<void> {
    // Prevent duplicate calls
    if (this.isCreatingConversation) {
      console.log('Already creating conversation, ignoring duplicate call');
      return;
    }

    this.isCreatingConversation = true;

    try {
      // Get selected recipient based on active tab
      const activeTab = document.querySelector('.chat-type-tab.active') as HTMLElement;
      const tabType = activeTab?.dataset.type;

      let selectedUserId: number | null = null;

      if (tabType === 'employee') {
        const employeeInput = document.getElementById('selectedEmployee') as HTMLInputElement;
        selectedUserId = employeeInput?.value ? parseInt(employeeInput.value) : null;
      } else if (tabType === 'admin') {
        const adminInput = document.getElementById('selectedAdmin') as HTMLInputElement;
        selectedUserId = adminInput?.value ? parseInt(adminInput.value) : null;
      }

      if (!selectedUserId) {
        this.showNotification('Bitte wählen Sie einen Empfänger aus', 'warning');
        this.isCreatingConversation = false;
        return;
      }

      // For now, we only support 1:1 chats
      const isGroup = false;
      const groupNameInput = document.getElementById('groupChatName') as HTMLInputElement;
      const groupName = isGroup && groupNameInput ? groupNameInput.value.trim() : null;
      const response = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participant_ids: [selectedUserId],
          is_group: isGroup,
          name: groupName || null,
        }),
      });

      if (response.ok) {
        const result = await response.json();

        this.showNotification('Unterhaltung erfolgreich erstellt', 'success');
        this.closeModal('newConversationModal');

        // Reload conversations
        await this.loadInitialData();

        // Select new conversation
        this.selectConversation(result.id);
      } else {
        const error = await response.json();
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error creating conversation:', error);
      this.showNotification(error instanceof Error ? error.message : 'Fehler beim Erstellen der Unterhaltung', 'error');
    } finally {
      this.isCreatingConversation = false;
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
    const sendBtn = document.getElementById('sendButton');
    if (sendBtn) {
      sendBtn.addEventListener('click', () => {
        console.log('Send button clicked');
        this.sendMessage();
      });
    } else {
      console.warn('Send button not found');
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
      fileInput.addEventListener('change', (event) => {
        const target = event.target as HTMLInputElement;
        const files = target.files;
        if (files && files.length > 0) {
          this.handleFileUpload(files);
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
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelModalBtn = document.getElementById('cancelModalBtn');

    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', () => {
        this.closeModal('newConversationModal');
      });
    }

    if (cancelModalBtn) {
      cancelModalBtn.addEventListener('click', () => {
        this.closeModal('newConversationModal');
      });
    }

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
        if (conversation.participants && Array.isArray(conversation.participants)) {
          const participant = conversation.participants.find((p) => p.id === userId);
          return participant ? participant.username : 'Unknown';
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
      console.info('Could not play notification sound:', error);
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
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(
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
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(
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
    console.info('Search functionality not yet implemented');
  }

  // Transform WebSocket message to ensure proper structure
  transformWebSocketMessage(data: any): Message {
    return {
      id: data.id,
      conversation_id: data.conversation_id,
      sender_id: data.sender_id,
      content: data.content,
      created_at: data.created_at,
      is_read: data.is_read || false,
      type: data.type || 'text',
      attachments: data.attachments || [],
      sender: data.sender || {
        id: data.sender_id,
        username: data.username || data.sender_name || 'Unknown',
        first_name: data.first_name,
        last_name: data.last_name,
        email: '',
        role: 'employee',
        tenant_id: 0,
        created_at: '',
        updated_at: '',
      },
    };
  }

  // Utility methods
  escapeHtml(text: string | null | undefined): string {
    if (!text) return '';

    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return String(text).replace(/[&<>"']/g, (m) => map[m]);
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
  // Only create if not already created
  if (!window.chatClient) {
    chatClient = new ChatClient();

    // Initialize the chat client
    chatClient.init();

    // Export to window for backwards compatibility
    if (typeof window !== 'undefined') {
      window.chatClient = chatClient;
    }
  }
});
