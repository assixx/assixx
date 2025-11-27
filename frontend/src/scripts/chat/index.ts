/* eslint-disable max-lines */
/**
 * Chat Client System
 * WebSocket-based real-time chat functionality
 */

import type { User, JWTPayload } from '../../types/api.types';
import { ApiClient } from '../../utils/api-client';
import { $$, $all, show, hide, setHTML } from '../../utils/dom-utils';
import { getAuthToken } from '../auth/index';

// Extended window interface for chat-specific properties
declare global {
  interface Window {
    chatClient?: ChatClient;
    selectChatDropdownOption?: (type: string, id: number, name: string, meta?: string) => void;
    // unifiedNav is declared in components/unified-navigation.ts
  }
}

interface ChatUser extends User {
  status?: 'online' | 'offline' | 'away';
  lastSeen?: string;
  // departmentId inherited from User

  // department and position inherited from User
  // profilePicture inherited from User
  profileImageUrl?: string;
}

interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  senderName?: string;
  senderUsername?: string;
  senderProfilePicture?: string;
  content: string;
  createdAt: string;
  isRead: boolean;
  readAt?: string;
  updatedAt?: string;
  sender?: ChatUser;
  attachments?: Attachment[];
  attachment?: string | null;
  type?: 'text' | 'file' | 'system';
}

interface Attachment {
  id: number;
  messageId: number;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

interface Conversation {
  id: number;
  name?: string;
  isGroup: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessage?: Message;
  participants: ChatUser[];
  unreadCount?: number;
  typingUsers?: number[];
  displayName?: string;
}

interface WebSocketMessage {
  type: string;
  data: unknown;
}

type EmojiCategories = Record<string, string[]>;

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
  private isCreatingConversation = false;
  private apiClient: ApiClient;
  // eslint-disable-next-line max-lines-per-function
  constructor() {
    this.ws = null;
    this.token = getAuthToken();
    // Parse user from localStorage with proper type safety
    const storedUser = localStorage.getItem('user');
    const parsedUser: Partial<ChatUser> = storedUser !== null ? (JSON.parse(storedUser) as Partial<ChatUser>) : {};
    this.currentUser = parsedUser as ChatUser;
    this.apiClient = ApiClient.getInstance();

    // Import UnifiedNavigation type
    // Fallback für currentUserId wenn user object nicht komplett ist
    if (parsedUser.id === undefined && this.token !== null && this.token !== '' && this.token !== 'test-mode') {
      try {
        const tokenPart = this.token.split('.')[1];
        if (tokenPart === undefined) throw new Error('Invalid token');
        const payload = JSON.parse(atob(tokenPart)) as JWTPayload;
        parsedUser.id = payload.id;
        this.currentUser.id = payload.id;
        if (parsedUser.username === undefined || parsedUser.username === '') {
          parsedUser.username = payload.username;
          this.currentUser.username = payload.username;
        }
      } catch (error) {
        console.error('Error parsing token:', error);
      }
    }

    this.currentUserId = parsedUser.id ?? null;
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
    if (this.token === null || this.token === '') {
      console.error('❌ No authentication token found');
      window.location.href = '/login';
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

      // Don't automatically select first conversation
      // User should explicitly click on a conversation
      // if (this.conversations.length > 0 && !this.currentConversationId) {
      //   this.selectConversation(this.conversations[0].id);
      // }
    } catch (error) {
      console.error('❌ Error loading initial data:', error);
      this.showNotification('Fehler beim Laden der Daten', 'error');
    }
  }

  async loadConversations(): Promise<void> {
    try {
      // Use apiClient which will handle v1/v2 based on feature flag
      const response = await this.apiClient.request<{
        data: Conversation[];
        pagination?: unknown;
      }>('/chat/conversations', {
        method: 'GET',
      });

      // Auch ein leeres Array ist valide - keine Conversations vorhanden
      this.conversations = response.data.map((conv: Conversation) => ({
        ...conv,
        participants: Array.isArray(conv.participants) ? conv.participants : [],
      }));
      this.renderConversationList();
    } catch (error) {
      console.error('❌ Error loading conversations:', error);
      // Try v1 API as fallback
      try {
        const response = await fetch('/api/chat/conversations', {
          headers: {
            Authorization: `Bearer ${this.token ?? ''}`,
          },
        });

        if (response.ok) {
          const conversations = (await response.json()) as Conversation[];
          // Stelle sicher, dass jede Konversation ein participants Array hat
          this.conversations = conversations.map((conv: Conversation) => ({
            ...conv,
            participants: Array.isArray(conv.participants) ? conv.participants : [],
          }));
          this.renderConversationList();
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } catch (fallbackError) {
        console.error('❌ Error in fallback:', fallbackError);
        throw fallbackError;
      }
    }
  }

  async loadAvailableUsers(): Promise<void> {
    try {
      // Use apiClient which will handle v1/v2 based on feature flag
      const response = await this.apiClient.request<{
        users: ChatUser[];
        total: number;
      }>('/chat/users', {
        method: 'GET',
      });

      // Auch eine leere User-Liste ist valide
      this.availableUsers = response.users;
    } catch (error) {
      console.error('❌ Error loading available users:', error);
      // Try v1 API as fallback
      try {
        const response = await fetch('/api/chat/users', {
          headers: {
            Authorization: `Bearer ${this.token ?? ''}`,
          },
        });

        if (response.ok) {
          this.availableUsers = (await response.json()) as ChatUser[];
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } catch (fallbackError) {
        console.error('❌ Error in fallback:', fallbackError);
      }
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
    const wsUrl = `${protocol}//${window.location.host}/chat-ws?token=${encodeURIComponent(this.token ?? '')}`;

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
          const data: string = event.data as string;
          const message: WebSocketMessage = JSON.parse(data) as WebSocketMessage;
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

  private handleConnectionEstablished(): void {
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
  }

  private handleWebSocketError(data: unknown): void {
    console.error('❌ WebSocket Error:', data);
    if (data !== null && data !== undefined && typeof data === 'object' && 'message' in data) {
      const errorMessage = typeof data.message === 'string' ? data.message : 'Fehler beim Senden der Nachricht';
      this.showNotification(errorMessage, 'error');
    } else {
      this.showNotification('Fehler bei der Kommunikation mit dem Server', 'error');
    }
  }

  handleWebSocketMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'connection_established':
        this.handleConnectionEstablished();
        break;

      case 'auth_error':
        console.error('❌ Authentication failed:', message.data);
        this.ws?.close();
        window.location.href = '/login';
        break;

      case 'new_message': {
        const messageData = message.data as Message & { conversation_id: number };
        this.handleNewMessage({
          message: messageData,
          conversationId: messageData.conversationId,
        });
        break;
      }

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

      case 'error':
        this.handleWebSocketError(message.data);
        break;

      default:
        console.info('📨 Unknown message type:', message.type);
    }
  }

  handleNewMessage(data: { message: Message; conversationId: number }): void {
    const { message, conversationId } = data;

    this.ensureMessageHasSender(message);
    this.updateConversationWithMessage(message, conversationId);
    this.handleMessageInCurrentConversation(message, conversationId);
    this.handleNewMessageNotifications(message);
  }

  private ensureMessageHasSender(message: Message): void {
    interface MessageWithExtra extends Message {
      username?: string;
      firstName?: string;
      lastName?: string;
      profileImageUrl?: string;
    }
    const msgWithExtra = message as MessageWithExtra;
    if (!message.sender && msgWithExtra.senderId !== 0) {
      message.sender = {
        id: msgWithExtra.senderId,
        username: msgWithExtra.username ?? msgWithExtra.senderName ?? 'Unknown',
        firstName: msgWithExtra.firstName,
        lastName: msgWithExtra.lastName,
        profilePicture: msgWithExtra.profileImageUrl ?? msgWithExtra.senderProfilePicture,
        role: 'employee',
        tenantId: 0,
        email: '',
        createdAt: '',
        updatedAt: '',
        isActive: true,
        isArchived: false,
      };
    }
  }

  private updateConversationWithMessage(message: Message, conversationId: number): void {
    const conversation = this.conversations.find((c) => c.id === conversationId);
    if (!conversation) {
      return;
    }

    conversation.lastMessage = message;
    conversation.updatedAt = message.createdAt;

    if (conversationId !== this.currentConversationId) {
      conversation.unreadCount = (conversation.unreadCount ?? 0) + 1;
    }

    this.conversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    this.renderConversationList();
  }

  private handleMessageInCurrentConversation(message: Message, conversationId: number): void {
    if (conversationId !== this.currentConversationId) {
      return;
    }

    if (message.senderId === this.currentUserId) {
      this.replaceTemporaryMessage(message);
    } else {
      this.displayMessage(message);
      this.markMessageAsRead(message.id);

      if (!document.hasFocus()) {
        this.showDesktopNotification(message);
      }
    }
  }

  private replaceTemporaryMessage(message: Message): void {
    const messagesContainer = $$('#messagesContainer');
    if (!messagesContainer) {
      this.displayMessage(message);
      return;
    }

    const tempMessages = messagesContainer.querySelectorAll('.message.own');
    tempMessages.forEach((msg) => {
      const msgText = msg.querySelector('.message-text')?.textContent;
      if (msgText === message.content && ((msg as HTMLElement).dataset['messageId']?.length ?? 0) > 10) {
        msg.remove();
      }
    });
    this.displayMessage(message);
  }

  private handleNewMessageNotifications(message: Message): void {
    if (message.senderId === this.currentUserId) {
      return;
    }

    void this.playNotificationSound();

    if (window.unifiedNav && typeof window.unifiedNav.updateUnreadMessages === 'function') {
      void window.unifiedNav.updateUnreadMessages();
    }
  }

  handleTypingStart(data: { userId: number; conversationId: number }): void {
    if (data.conversationId !== this.currentConversationId) return;

    const conversation = this.conversations.find((c) => c.id === data.conversationId);

    if (conversation) {
      conversation.typingUsers ??= [];

      if (!conversation.typingUsers.includes(data.userId)) {
        conversation.typingUsers.push(data.userId);
        this.updateTypingIndicator();
      }
    }
  }

  handleTypingStop(data: { userId: number; conversationId: number }): void {
    if (data.conversationId !== this.currentConversationId) return;

    const conversation = this.conversations.find((c) => c.id === data.conversationId);

    if (conversation?.typingUsers) {
      conversation.typingUsers = conversation.typingUsers.filter((id) => id !== data.userId);
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
    if (currentConv?.participants.some((p) => p.id === data.userId) === true) {
      this.renderChatHeader();
    }
  }

  handleMessageRead(data: { messageId: number; userId: number }): void {
    // Update read status in UI
    const messageElement = $$(`[data-message-id="${data.messageId}"]`);
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
        void this.sendMessage(message.content);
      }
    }
  }

  async selectConversation(conversationId: number): Promise<void> {
    this.currentConversationId = conversationId;

    // Update UI
    $all('.conversation-item').forEach((item) => {
      item.classList.remove('active');
    });

    const selectedItem = $$(`[data-conversation-id="${conversationId}"]`);
    if (selectedItem) {
      selectedItem.classList.add('active');
    }

    // Clear unread count and mark messages as read
    const conversation = this.conversations.find((c) => c.id === conversationId);
    if (conversation) {
      conversation.unreadCount = 0;
      this.renderConversationList();

      // Mark all messages in this conversation as read
      await this.markConversationAsRead(conversationId);
    }

    // Load messages
    await this.loadMessages(conversationId);

    // Update header
    this.renderChatHeader();

    // Show chat elements
    const chatHeader = $$('#chat-header');
    const chatArea = $$('#chatArea');
    const noChatSelected = $$('#noChatSelected');
    const chatMain = $$('.chat-main');

    if (chatHeader) chatHeader.classList.remove('u-hidden');
    show(chatArea);
    hide(noChatSelected);
    if (chatMain) chatMain.classList.remove('u-hidden');

    // Show chat view on mobile
    const chatContainer = $$('.chat-container');
    if (chatContainer) {
      chatContainer.classList.add('show-chat');
    }
  }

  async markConversationAsRead(conversationId: number): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (token === null || token === '') return;

      // Use apiClient which will handle v1/v2 based on feature flag
      try {
        await this.apiClient.request<{ markedCount: number }>(`/chat/conversations/${conversationId}/read`, {
          method: 'POST',
          body: JSON.stringify({}), // Empty body to trigger Content-Type header
        });
      } catch {
        // Fallback to v1 API
        await fetch(`/api/chat/conversations/${conversationId}/read`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      }

      // Update the navigation badge
      if (window.unifiedNav && typeof window.unifiedNav.updateUnreadMessages === 'function') {
        void window.unifiedNav.updateUnreadMessages();
      }
    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  }

  async loadMessages(conversationId: number): Promise<void> {
    try {
      // Use apiClient which will handle v1/v2 based on feature flag
      const response = await this.apiClient.request<{
        data: Message[];
        pagination?: unknown;
      }>(`/chat/conversations/${conversationId}/messages`, {
        method: 'GET',
      });

      // Auch eine leere Nachrichtenliste ist valide
      this.displayMessages(response.data);
    } catch (error) {
      console.error('❌ Error loading messages:', error);
      // Fallback to v1 API
      try {
        const response = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
          headers: {
            Authorization: `Bearer ${this.token ?? ''}`,
          },
        });

        if (response.ok) {
          const messages = (await response.json()) as Message[];
          this.displayMessages(messages);
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } catch (fallbackError) {
        console.error('❌ Error in fallback:', fallbackError);
        this.showNotification('Fehler beim Laden der Nachrichten', 'error');
      }
    }
  }

  displayMessages(messages: Message[]): void {
    const messagesContainer = $$('#messagesContainer');
    if (!messagesContainer) return;

    // Hide container before updating
    messagesContainer.classList.remove('loaded');
    messagesContainer.innerHTML = '';

    let lastMessageDate: string | null = null;

    messages.forEach((message) => {
      const createdAt = message.createdAt;

      // Check if we need to add a date separator
      if (createdAt === '') {
        console.warn('Message without created date:', message);
        this.displayMessage(message);
        return;
      }

      const parsedDate = new Date(createdAt);

      // Check if date is valid
      if (Number.isNaN(parsedDate.getTime())) {
        console.warn('Invalid date for message:', createdAt, message);
        this.displayMessage(message);
        return;
      }

      const messageDate = parsedDate.toLocaleDateString('de-DE');

      if (lastMessageDate !== messageDate) {
        this.addDateSeparator(messageDate, messagesContainer);
        lastMessageDate = messageDate;
      }

      this.displayMessage(message);
    });

    // Immediately set scroll position to bottom without animation
    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      // Show container after positioning
      setTimeout(() => {
        messagesContainer.classList.add('loaded');
      }, 50);
    });
  }

  displayMessage(message: Message): void {
    const messagesContainer = $$('#messagesContainer');
    if (!messagesContainer) return;

    const messageDate = this.getValidMessageDate(message);
    if (messageDate === null) return;

    this.handleDateSeparator(messageDate, messagesContainer);
    this.continueDisplayMessage(message, messageDate);
  }

  private getValidMessageDate(message: Message): string | null {
    const createdAt = message.createdAt;
    if (createdAt === '') {
      console.warn('Message without created date:', message);
      return null;
    }

    const parsedDate = new Date(createdAt);
    if (Number.isNaN(parsedDate.getTime())) {
      console.error('Invalid date for message:', createdAt, message);
      return null;
    }

    return parsedDate.toLocaleDateString('de-DE');
  }

  private handleDateSeparator(messageDate: string, messagesContainer: HTMLElement): void {
    const messages = messagesContainer.querySelectorAll('.message');
    const lastMessage = messages[messages.length - 1] as HTMLElement;

    const separatorExists = this.checkDateSeparatorExists(messageDate, messagesContainer);

    if (!separatorExists) {
      if (messages.length > 0) {
        const lastMessageDate = lastMessage.dataset['date'];
        if (lastMessageDate !== '' && lastMessageDate !== messageDate) {
          this.addDateSeparator(messageDate, messagesContainer);
        }
      } else {
        this.addDateSeparator(messageDate, messagesContainer);
      }
    }
  }

  private checkDateSeparatorExists(messageDate: string, messagesContainer: HTMLElement): boolean {
    const existingSeparators = messagesContainer.querySelectorAll('.date-separator');
    return [...existingSeparators].some((separator) => {
      const separatorText = separator.textContent !== '' ? separator.textContent.trim() : '';
      return (
        separatorText === messageDate ||
        (separatorText === 'Heute' && this.isToday(messageDate)) ||
        (separatorText === 'Gestern' && this.isYesterday(messageDate))
      );
    });
  }

  private continueDisplayMessage(message: Message, messageDate: string): void {
    const messagesContainer = $$('#messagesContainer');
    if (!messagesContainer) return;

    const senderId = message.senderId;
    const isOwnMessage = senderId === this.currentUserId;
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwnMessage ? 'own' : ''}`;
    messageDiv.dataset['messageId'] = message.id.toString();
    messageDiv.dataset['date'] = messageDate;

    const createdAt = message.createdAt;
    const time = new Date(createdAt).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });

    let messageContent = this.escapeHtml(message.content);
    messageContent = this.parseEmojis(messageContent);

    // Create DOM elements programmatically to avoid XSS
    const messageContentDiv = document.createElement('div');
    messageContentDiv.className = 'message-content';

    const messageTextDiv = document.createElement('div');
    messageTextDiv.className = 'message-text';

    // Use innerHTML for linkified content since we control the linkify function
    // and it only creates safe anchor tags with escaped URLs
    // lgtm[js/xss] - Content is escaped before linkification, URLs are escaped in linkify()
    setHTML(messageTextDiv, this.linkify(messageContent));
    messageContentDiv.append(messageTextDiv);

    // Add attachments if present
    if (message.attachments && message.attachments.length > 0) {
      const attachmentFragment = this.renderAttachments(message.attachments);
      messageContentDiv.append(attachmentFragment);
    }

    // Create time element
    const messageTimeDiv = document.createElement('div');
    messageTimeDiv.className = 'message-time';
    messageTimeDiv.textContent = time;

    if (isOwnMessage) {
      const readIndicator = document.createElement('span');
      readIndicator.className = `read-indicator ${message.isRead ? 'read' : ''}`;
      readIndicator.textContent = '✓✓';
      messageTimeDiv.append(readIndicator);
    }

    messageContentDiv.append(messageTimeDiv);
    messageDiv.append(messageContentDiv);

    messagesContainer.append(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  addDateSeparator(dateString: string, container: HTMLElement): void {
    // Check if a separator for this date already exists
    const existingSeparators = container.querySelectorAll<HTMLElement>('.date-separator');
    const separatorExists = [...existingSeparators].some((separator) => {
      return separator.dataset['date'] === dateString;
    });

    // Don't add duplicate separator
    if (separatorExists) {
      return;
    }

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Handle both German format (dd.mm.yyyy) and ISO date strings
    let messageDate: Date;
    if (dateString.includes('.')) {
      // German format: dd.mm.yyyy
      const [day, month, year] = dateString.split('.');
      messageDate = new Date(
        Number.parseInt(year ?? '0', 10),
        Number.parseInt(month ?? '0', 10) - 1,
        Number.parseInt(day ?? '0', 10),
      );
    } else {
      // Assume ISO format or other parseable format
      messageDate = new Date(dateString);
    }

    // Check if date is valid
    if (Number.isNaN(messageDate.getTime())) {
      console.error('Invalid date for separator:', dateString);
      return;
    }

    let displayDate = dateString;

    // Check if it's today
    if (messageDate.toDateString() === today.toDateString()) {
      displayDate = 'Heute';
    }
    // Check if it's yesterday
    else if (messageDate.toDateString() === yesterday.toDateString()) {
      displayDate = 'Gestern';
    }
    // Format as German date
    else {
      displayDate = messageDate.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }

    const separator = document.createElement('div');
    separator.className = 'date-separator';
    separator.dataset['date'] = dateString;
    // Use safe setText from dom-utils instead of innerHTML
    const span = document.createElement('span');
    span.textContent = displayDate;
    separator.append(span);
    container.append(separator);
  }

  isToday(dateString: string): boolean {
    const today = new Date();
    const messageDate = new Date(dateString.split('.').reverse().join('-'));
    return messageDate.toDateString() === today.toDateString();
  }

  isYesterday(dateString: string): boolean {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const messageDate = new Date(dateString.split('.').reverse().join('-'));
    return messageDate.toDateString() === yesterday.toDateString();
  }

  renderAttachments(attachments: Attachment[]): DocumentFragment {
    const fragment = document.createDocumentFragment();

    attachments.forEach((attachment) => {
      const isImage = attachment.mimeType.startsWith('image/');
      const fileSize = this.formatFileSize(attachment.fileSize);

      const attachmentDiv = document.createElement('div');

      if (isImage) {
        attachmentDiv.className = 'attachment image-attachment';

        const img = document.createElement('img');
        img.src = `/api/chat/attachments/${attachment.id}`;
        img.alt = attachment.fileName;
        attachmentDiv.append(img);
      } else {
        attachmentDiv.className = 'attachment file-attachment';

        const fileIcon = document.createElement('i');
        fileIcon.className = 'fas fa-file';
        attachmentDiv.append(fileIcon);

        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';

        const fileName = document.createElement('div');
        fileName.className = 'file-name';
        fileName.textContent = attachment.fileName;
        fileInfo.append(fileName);

        const fileSizeDiv = document.createElement('div');
        fileSizeDiv.className = 'file-size';
        fileSizeDiv.textContent = fileSize;
        fileInfo.append(fileSizeDiv);

        attachmentDiv.append(fileInfo);

        const downloadLink = document.createElement('a');
        downloadLink.href = `/api/chat/attachments/${attachment.id}/download`;
        downloadLink.className = 'download-btn';

        const downloadIcon = document.createElement('i');
        downloadIcon.className = 'fas fa-download';
        downloadLink.append(downloadIcon);

        attachmentDiv.append(downloadLink);
      }

      fragment.append(attachmentDiv);
    });

    return fragment;
  }

  async sendMessage(content?: string): Promise<void> {
    console.info('sendMessage called');
    const messageInput = $$('#messageInput') as HTMLTextAreaElement | null;
    const messageContent = content ?? messageInput?.value.trim();

    console.info('Message content:', messageContent);
    console.info('Current conversation ID:', this.currentConversationId);
    console.info('Is connected:', this.isConnected);
    console.info('WebSocket state:', this.ws?.readyState);

    if (
      messageContent === undefined ||
      messageContent === '' ||
      this.currentConversationId === null ||
      this.currentConversationId === 0
    ) {
      console.warn('No message content or conversation ID');
      return;
    }

    // Clear input
    if (messageInput !== null && (content === undefined || content === '')) {
      messageInput.value = '';
      this.resizeTextarea();
    }

    // Stop typing indicator
    this.stopTyping();

    const tempMessage: Message = {
      id: Date.now(),
      conversationId: this.currentConversationId,
      senderId: this.currentUserId ?? 0,
      content: messageContent,
      createdAt: new Date().toISOString(),
      isRead: false,
      type: 'text',
      sender: this.currentUser,
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

  private createFileFormData(file: File): FormData {
    const formData = new FormData();
    formData.append('file', file);
    if (this.currentConversationId !== null && this.currentConversationId !== 0) {
      formData.append('conversationId', this.currentConversationId.toString());
    }
    return formData;
  }

  private async uploadFileV2(formData: FormData): Promise<number | null> {
    try {
      const response = await this.apiClient.request<{ success: boolean; data: { id: number } }>('/chat/attachments', {
        method: 'POST',
        body: formData,
      });
      return response.success ? response.data.id : null;
    } catch (error) {
      console.error('❌ Error uploading file (v2):', error);
      return null;
    }
  }

  private async uploadFileV1(formData: FormData): Promise<number | null> {
    try {
      const response = await fetch('/api/chat/attachments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token ?? ''}`,
        },
        body: formData,
      });

      if (response.ok) {
        const result = (await response.json()) as { id: number };
        return result.id;
      }
      return null;
    } catch (error) {
      console.error('❌ Error uploading file (v1):', error);
      return null;
    }
  }

  private async uploadSingleFile(file: File): Promise<number | null> {
    const formData = this.createFileFormData(file);

    // Try v2 API first, fallback to v1 if needed
    try {
      return await this.uploadFileV2(formData);
    } catch {
      return await this.uploadFileV1(formData);
    }
  }

  async uploadFiles(): Promise<number[]> {
    const attachmentIds: number[] = [];

    for (const file of this.pendingFiles) {
      const attachmentId = await this.uploadSingleFile(file);
      if (attachmentId !== null) {
        attachmentIds.push(attachmentId);
      }
    }

    return attachmentIds;
  }

  handleFileUpload(files: FileList): void {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const validFiles: File[] = [];

    for (const file of files) {
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
    const previewContainer = $$('#filePreview');
    if (!previewContainer) return;

    previewContainer.innerHTML = '';
    previewContainer.style.display = 'block';

    this.pendingFiles.forEach((file, index) => {
      const preview = document.createElement('div');
      preview.className = 'file-preview-item';

      const isImage = file.type.startsWith('image/');

      // Create preview elements safely to prevent XSS
      const fileIconDiv = document.createElement('div');
      fileIconDiv.className = 'file-icon';

      if (isImage) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        // lgtm[js/xss-through-dom] - Alt attribute is never read back as HTML
        img.alt = file.name;
        fileIconDiv.append(img);
      } else {
        const icon = document.createElement('i');
        icon.className = 'fas fa-file';
        fileIconDiv.append(icon);
      }

      const fileInfoDiv = document.createElement('div');
      fileInfoDiv.className = 'file-info';

      const fileName = document.createElement('div');
      fileName.className = 'file-name';
      fileName.textContent = file.name;

      const fileSize = document.createElement('div');
      fileSize.className = 'file-size';
      fileSize.textContent = this.formatFileSize(file.size);

      fileInfoDiv.append(fileName);
      fileInfoDiv.append(fileSize);

      const removeButton = document.createElement('button');
      removeButton.className = 'remove-file';
      removeButton.dataset['index'] = index.toString();
      const removeIcon = document.createElement('i');
      removeIcon.className = 'fas fa-times';
      removeButton.append(removeIcon);

      removeButton.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement | null;
        const fileIndex = Number.parseInt(target?.dataset['index'] ?? '0', 10);
        this.removeFile(fileIndex);
      });

      preview.append(fileIconDiv);
      preview.append(fileInfoDiv);
      preview.append(removeButton);

      previewContainer.append(preview);
    });
  }

  removeFile(index: number): void {
    this.pendingFiles.splice(index, 1);
    if (this.pendingFiles.length === 0) {
      const previewContainer = $$('#filePreview');
      if (previewContainer) {
        previewContainer.style.display = 'none';
      }
    } else {
      this.showFilePreview();
    }
  }

  toggleEmojiPicker(): void {
    const emojiPicker = $$('#emojiPicker');
    if (!emojiPicker) return;

    if (emojiPicker.style.display === 'none' || emojiPicker.style.display === '') {
      emojiPicker.style.display = 'block';
      this.showEmojiCategory('smileys');
    } else {
      emojiPicker.style.display = 'none';
    }
  }

  showEmojiCategory(categoryName: string): void {
    const emojiContent = $$('#emojiContent');
    if (!emojiContent) return;

    // eslint-disable-next-line security/detect-object-injection -- categoryName kommt aus Emoji-Picker UI (hartcodierte Kategorie-Buttons), kein User-Input
    const emojis = this.emojiCategories[categoryName] ?? [];
    emojiContent.innerHTML = '';

    emojis.forEach((emoji) => {
      const emojiSpan = document.createElement('span');
      emojiSpan.className = 'emoji-item';
      emojiSpan.textContent = emoji;
      emojiSpan.addEventListener('click', () => {
        this.insertEmoji(emoji);
      });
      emojiContent.append(emojiSpan);
    });
  }

  insertEmoji(emoji: string): void {
    const messageInput = $$('#messageInput') as HTMLTextAreaElement | null;
    if (!messageInput) return;

    const start = messageInput.selectionStart;
    const end = messageInput.selectionEnd;
    const text = messageInput.value;

    messageInput.value = text.substring(0, start) + emoji + text.substring(end);
    messageInput.selectionStart = messageInput.selectionEnd = start + emoji.length;
    messageInput.focus();

    // Hide emoji picker
    const emojiPicker = $$('#emojiPicker');
    if (emojiPicker) {
      emojiPicker.style.display = 'none';
    }
  }

  renderConversationList(): void {
    const conversationsList = $$('#conversationsList');
    if (!conversationsList) return;

    conversationsList.innerHTML = '';

    if (this.conversations.length === 0) {
      conversationsList.innerHTML = `
        <div class="no-conversations">
          <p></p>
        </div>
      `;
      return;
    }

    this.conversations.forEach((conversation) => {
      const item = this.createConversationItem(conversation);
      conversationsList.append(item);
    });
  }

  private createConversationItem(conversation: Conversation): HTMLDivElement {
    const item = document.createElement('div');
    item.className = 'conversation-item';
    item.dataset['conversationId'] = conversation.id.toString();

    this.applyConversationState(item, conversation);

    const displayName = this.getConversationName(conversation);
    const lastMessageText = this.getLastMessageText(conversation);
    const lastMessageTime = this.getLastMessageTime(conversation);
    const avatarHtml = this.getAvatarHtml(conversation, displayName);

    this.buildConversationItemDOM(item, avatarHtml, displayName, lastMessageText, lastMessageTime, conversation);

    item.addEventListener('click', () => {
      void this.selectConversation(conversation.id);
    });

    return item;
  }

  private applyConversationState(item: HTMLDivElement, conversation: Conversation): void {
    if (conversation.id === this.currentConversationId) {
      item.classList.add('active');
    }

    if (conversation.unreadCount !== undefined && conversation.unreadCount > 0) {
      item.classList.add('unread');
    }
  }

  private getConversationName(conversation: Conversation): string {
    return conversation.isGroup ? (conversation.name ?? 'Gruppenchat') : this.getConversationDisplayName(conversation);
  }

  private getLastMessageText(conversation: Conversation): string {
    if (conversation.lastMessage?.content !== undefined && conversation.lastMessage.content !== '') {
      const content = conversation.lastMessage.content;
      return content.length > 40 ? `${content.substring(0, 37)}...` : content;
    }
    return 'Keine Nachrichten';
  }

  private getLastMessageTime(conversation: Conversation): string {
    return conversation.lastMessage ? this.formatTime(conversation.lastMessage.createdAt) : '';
  }

  private getAvatarHtml(conversation: Conversation, displayName: string): string {
    if (conversation.isGroup) {
      return '<i class="fas fa-users"></i>';
    }

    const otherParticipant = conversation.participants.find((p) => p.id !== this.currentUserId);
    if (!otherParticipant) {
      return '<i class="fas fa-user"></i>';
    }

    return this.getParticipantAvatarHtml(otherParticipant, displayName);
  }

  private getParticipantAvatarHtml(participant: ChatUser, displayName: string): string {
    const profileUrl = this.getProfileImageUrl(participant);

    if (profileUrl !== null && profileUrl !== '') {
      return `<img src="${profileUrl}" alt="${this.escapeHtml(displayName)}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
    }

    if (this.hasName(participant)) {
      return this.getInitials(participant.firstName, participant.lastName);
    }

    return '<i class="fas fa-user"></i>';
  }

  private getProfileImageUrl(participant: ChatUser): string | null {
    if (participant.profilePicture !== undefined && participant.profilePicture !== '') {
      return participant.profilePicture;
    }
    if (participant.profileImageUrl !== undefined && participant.profileImageUrl !== '') {
      return participant.profileImageUrl;
    }
    return null;
  }

  private hasName(participant: ChatUser): boolean {
    return (
      (participant.firstName !== undefined && participant.firstName !== '') ||
      (participant.lastName !== undefined && participant.lastName !== '')
    );
  }

  private buildConversationItemDOM(
    item: HTMLDivElement,
    avatarHtml: string,
    displayName: string,
    lastMessageText: string,
    lastMessageTime: string,
    conversation: Conversation,
  ): void {
    while (item.firstChild) {
      item.firstChild.remove();
    }

    const avatarDiv = this.createAvatarElement(avatarHtml);
    const infoDiv = this.createInfoElement(displayName, lastMessageText);
    const metaDiv = this.createMetaElement(lastMessageTime, conversation);

    item.append(avatarDiv, infoDiv, metaDiv);
  }

  private createAvatarElement(avatarHtml: string): HTMLDivElement {
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'conversation-avatar';

    const iconElement = document.createElement('i');
    if (avatarHtml.includes('fa-users')) {
      iconElement.className = 'fas fa-users';
    } else {
      iconElement.className = 'fas fa-user';
    }
    avatarDiv.append(iconElement);

    return avatarDiv;
  }

  private createInfoElement(displayName: string, lastMessageText: string): HTMLDivElement {
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

  private createMetaElement(lastMessageTime: string, conversation: Conversation): HTMLDivElement {
    const metaDiv = document.createElement('div');
    metaDiv.className = 'conversation-meta';

    const timeDiv = document.createElement('div');
    timeDiv.className = 'conversation-time';
    timeDiv.textContent = lastMessageTime;

    metaDiv.append(timeDiv);

    if (conversation.unreadCount !== undefined && conversation.unreadCount > 0) {
      const badgeSpan = document.createElement('span');
      badgeSpan.className = 'unread-count';
      badgeSpan.textContent = conversation.unreadCount.toString();
      metaDiv.append(badgeSpan);
    }

    return metaDiv;
  }

  renderChatHeader(): void {
    const chatAvatar = $$('#chat-avatar');
    const chatPartnerName = $$('#chat-partner-name');
    const chatPartnerStatus = $$('#chat-partner-status');

    if (this.currentConversationId === null || this.currentConversationId === 0) return;

    const conversation = this.conversations.find((c) => c.id === this.currentConversationId);
    if (!conversation) return;

    const displayName = this.getChatDisplayName(conversation);
    this.updateChatName(chatPartnerName, displayName);
    this.updateChatAvatarAndStatus(chatAvatar, chatPartnerStatus, conversation, displayName);
  }

  private getChatDisplayName(conversation: Conversation): string {
    return conversation.isGroup ? (conversation.name ?? 'Gruppenchat') : this.getConversationDisplayName(conversation);
  }

  private updateChatName(chatPartnerName: HTMLElement | null, displayName: string): void {
    if (chatPartnerName) {
      chatPartnerName.textContent = displayName;
    }
  }

  private updateChatAvatarAndStatus(
    chatAvatar: HTMLElement | null,
    chatPartnerStatus: HTMLElement | null,
    conversation: Conversation,
    displayName: string,
  ): void {
    if (!chatAvatar) return;

    if (conversation.isGroup) {
      this.setGroupChatAvatar(chatAvatar, chatPartnerStatus);
    } else {
      this.setIndividualChatAvatar(chatAvatar, chatPartnerStatus, conversation, displayName);
    }
  }

  private setGroupChatAvatar(chatAvatar: HTMLElement, chatPartnerStatus: HTMLElement | null): void {
    chatAvatar.innerHTML = '<i class="fas fa-users"></i>';
    chatAvatar.style.display = 'flex';
    if (chatPartnerStatus) {
      chatPartnerStatus.textContent = 'Gruppenchat';
    }
  }

  private setIndividualChatAvatar(
    chatAvatar: HTMLElement,
    chatPartnerStatus: HTMLElement | null,
    conversation: Conversation,
    displayName: string,
  ): void {
    const otherParticipant = conversation.participants.find((p) => p.id !== this.currentUserId);
    if (!otherParticipant) return;

    this.updateAvatarDisplay(chatAvatar, otherParticipant, displayName);
    this.updatePartnerStatus(chatPartnerStatus, otherParticipant);
  }

  private updateAvatarDisplay(chatAvatar: HTMLElement, participant: ChatUser, displayName: string): void {
    const profileUrl = this.getProfileImageUrl(participant);

    if (profileUrl !== null && profileUrl !== '') {
      this.displayAvatarImage(chatAvatar, profileUrl, displayName);
    } else if (this.hasName(participant)) {
      this.displayAvatarInitials(chatAvatar, participant);
    } else {
      chatAvatar.style.display = 'none';
    }
  }

  private displayAvatarImage(chatAvatar: HTMLElement, imgUrl: string, displayName: string): void {
    while (chatAvatar.firstChild) {
      chatAvatar.firstChild.remove();
    }

    const img = document.createElement('img');
    img.src = imgUrl;
    img.alt = displayName;
    img.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; object-fit: cover;';
    chatAvatar.append(img);
    chatAvatar.style.display = 'flex';
  }

  private displayAvatarInitials(chatAvatar: HTMLElement, participant: ChatUser): void {
    const initials = this.getInitials(participant.firstName, participant.lastName);
    chatAvatar.textContent = initials;
    chatAvatar.style.display = 'flex';
  }

  private updatePartnerStatus(chatPartnerStatus: HTMLElement | null, participant: ChatUser): void {
    if (chatPartnerStatus) {
      chatPartnerStatus.textContent = this.getRoleDisplayName(participant.role);
    }
  }

  getInitials(firstName?: string, lastName?: string): string {
    const firstInitial = firstName !== undefined && firstName !== '' ? firstName.charAt(0).toUpperCase() : '';
    const lastInitial = lastName !== undefined && lastName !== '' ? lastName.charAt(0).toUpperCase() : '';
    const initials = `${firstInitial}${lastInitial}`;
    return initials !== '' ? initials : 'U';
  }

  getRoleDisplayName(role: string): string {
    const roleMap: Record<string, string> = {
      admin: 'Administrator',
      employee: 'Mitarbeiter',
      root: 'Root',
    };
    // eslint-disable-next-line security/detect-object-injection -- role kommt aus JWT Token (validierte User-Rolle: 'admin'|'employee'|'root'), kein beliebiger User-Input
    return roleMap[role] ?? role;
  }

  deleteConversationBtnHandler(): void {
    const canDelete = this.currentUser.role === 'admin' || this.currentUser.role === 'root';
    // Re-attach delete button listener only for admins and root users
    if (canDelete) {
      const deleteBtn = $$('#deleteConversationBtn') as HTMLButtonElement | null;
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          void this.deleteCurrentConversation();
        });
      }
    }
  }

  getConversationDisplayName(conversation: Conversation): string {
    // Für Gruppenchats
    if (conversation.isGroup) {
      return conversation.name ?? 'Gruppenchat';
    }

    // Für 1:1 Chats - nutze display_name wenn verfügbar
    if (conversation.displayName !== undefined && conversation.displayName !== '') {
      return conversation.displayName;
    }

    // Fallback auf participants array
    if (conversation.participants.length > 0) {
      const otherParticipant = conversation.participants.find((p) => p.id !== this.currentUserId);
      if (otherParticipant) {
        const fullName = `${otherParticipant.firstName ?? ''} ${otherParticipant.lastName ?? ''}`.trim();
        return fullName !== '' ? fullName : otherParticipant.username;
      }
    }

    return 'Unbekannt';
  }

  getParticipantStatus(conversation: Conversation): string {
    if (conversation.participants.length === 0) {
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
    const modal = $$('#newConversationModal');
    if (!modal) return;

    // Reset modal state
    this.resetModalState();

    // Load departments
    void this.loadDepartments();

    // Load admins
    this.loadAdmins();

    // Set up tab listeners
    this.setupTabListeners();

    // Show modal
    modal.classList.remove('u-hidden');
    modal.style.display = 'flex';
  }

  private resetModalState(): void {
    // Reset tabs
    $all('.chat-type-tab').forEach((tab) => {
      tab.classList.remove('active');
    });
    $$('#employeeTab')?.classList.add('active');

    // Reset selections
    $all('.recipient-selection').forEach((section) => {
      section.style.display = 'none';
    });
    const employeeSection = $$('#employeeSelection');
    if (employeeSection) employeeSection.style.display = 'block';

    // Reset dropdowns
    const deptDisplay = $$('#departmentDisplay span');
    if (deptDisplay) deptDisplay.textContent = 'Abteilung wählen';

    const empDisplay = $$('#employeeDisplay span');
    if (empDisplay) empDisplay.textContent = 'Mitarbeiter wählen';

    const adminDisplayElem = $$('#adminDisplay span');
    if (adminDisplayElem) adminDisplayElem.textContent = 'Administrator wählen';

    // Hide employee dropdown initially
    const employeeGroup = $$('#employeeDropdownGroup');
    if (employeeGroup) employeeGroup.style.display = 'none';

    // Clear selected recipients
    const selectedList = $$('#selectedRecipientsList');
    if (selectedList) selectedList.innerHTML = '';

    // Hide group options
    const groupOptions = $$('#groupChatOptions');
    if (groupOptions) groupOptions.style.display = 'none';
  }

  private setupTabListeners(): void {
    const tabs = $all('.chat-type-tab');
    tabs.forEach((tab) => {
      // Remove any existing listeners first
      const newTab = tab.cloneNode(true) as HTMLElement;
      tab.parentNode?.replaceChild(newTab, tab);

      // Add click listener
      newTab.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const target = e.currentTarget as HTMLElement | null;
        if (!target) return;
        const type = target.dataset['type'];

        console.info('Tab clicked:', type);

        // Update active tab
        $all('.chat-type-tab').forEach((t) => {
          t.classList.remove('active');
        });
        target.classList.add('active');

        // Show corresponding section
        $all('.recipient-selection').forEach((section) => {
          section.style.display = 'none';
        });

        if (type === 'employee') {
          const section = $$('#employeeSelection');
          if (section) section.style.display = 'block';
        } else if (type === 'admin') {
          const section = $$('#adminSelection');
          if (section) section.style.display = 'block';
        }
      });
    });
  }

  private createDepartmentOption(dept: { id: number; name: string }): HTMLDivElement {
    const option = document.createElement('div');
    option.className = 'dropdown-option';
    option.onclick = () => {
      if ('selectChatDropdownOption' in window && typeof window.selectChatDropdownOption === 'function') {
        window.selectChatDropdownOption('department', dept.id, dept.name);
      }
    };

    const optionInfo = document.createElement('div');
    optionInfo.className = 'option-info';
    const optionName = document.createElement('div');
    optionName.className = 'option-name';
    optionName.textContent = dept.name;
    optionInfo.append(optionName);
    option.append(optionInfo);

    return option;
  }

  private renderDepartmentsToDropdown(departments: { id: number; name: string }[]): void {
    const dropdown = $$('#departmentDropdown') as HTMLSelectElement | null;
    if (!dropdown) return;

    dropdown.innerHTML = '';
    const deptList = Array.isArray(departments) ? departments : [];
    deptList.forEach((dept) => {
      dropdown.append(this.createDepartmentOption(dept));
    });
  }

  private async loadDepartmentsV2(): Promise<void> {
    const departments = await this.apiClient.request<{ id: number; name: string }[]>('/departments', {
      method: 'GET',
    });
    this.renderDepartmentsToDropdown(departments);
  }

  private async loadDepartmentsV1(): Promise<void> {
    const response = await fetch('/api/departments', {
      headers: {
        Authorization: `Bearer ${this.token ?? ''}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const departments = (await response.json()) as { id: number; name: string }[];
    this.renderDepartmentsToDropdown(departments);
  }

  private async loadDepartments(): Promise<void> {
    try {
      // Try v2 API first, fallback to v1 if needed
      await this.loadDepartmentsV2();
    } catch (error) {
      console.error('Error loading departments with v2:', error);
      try {
        await this.loadDepartmentsV1();
      } catch (fallbackError) {
        console.error('Error loading departments with v1:', fallbackError);
      }
    }
  }

  loadEmployeesForDepartment(departmentId: string): void {
    try {
      // Filter employees by department
      const employees = this.availableUsers.filter(
        (user) => user.role === 'employee' && user.departmentId?.toString() === departmentId,
      );

      const dropdown = $$('#employeeDropdown') as HTMLSelectElement | null;

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
            const fullName = `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim();
            const name = fullName !== '' ? fullName : employee.username;
            if ('selectChatDropdownOption' in window && typeof window.selectChatDropdownOption === 'function') {
              window.selectChatDropdownOption('employee', employee.id, name, employee.department ?? '');
            }
          };
          // Build option content with DOM methods
          const optionInfo = document.createElement('div');
          optionInfo.className = 'option-info';

          const optionName = document.createElement('div');
          optionName.className = 'option-name';
          const n = `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim();
          optionName.textContent = n !== '' ? n : employee.username;

          const optionMeta = document.createElement('div');
          optionMeta.className = 'option-meta';
          optionMeta.textContent = employee.position ?? 'Mitarbeiter';

          optionInfo.append(optionName, optionMeta);
          option.append(optionInfo);
          dropdown.append(option);
        });
      }
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  }

  private loadAdmins(): void {
    const admins = this.availableUsers.filter((user) => user.role === 'admin' || user.role === 'root');

    const dropdown = $$('#adminDropdown') as HTMLSelectElement | null;

    if (dropdown) {
      dropdown.innerHTML = '';

      admins.forEach((admin) => {
        const option = document.createElement('div');
        option.className = 'dropdown-option';
        option.onclick = () => {
          const fullName = `${admin.firstName ?? ''} ${admin.lastName ?? ''}`.trim();
          const name = fullName !== '' ? fullName : admin.username;
          if ('selectChatDropdownOption' in window && typeof window.selectChatDropdownOption === 'function') {
            window.selectChatDropdownOption('admin', admin.id, name, admin.role);
          }
        };
        // Build option content with DOM methods
        const optionInfo = document.createElement('div');
        optionInfo.className = 'option-info';

        const optionName = document.createElement('div');
        optionName.className = 'option-name';
        const n = `${admin.firstName ?? ''} ${admin.lastName ?? ''}`.trim();
        optionName.textContent = n !== '' ? n : admin.username;

        const optionMeta = document.createElement('div');
        optionMeta.className = 'option-meta';
        optionMeta.textContent = admin.role === 'root' ? 'Root Administrator' : 'Administrator';

        optionInfo.append(optionName, optionMeta);
        option.append(optionInfo);
        dropdown.append(option);
      });
    }
  }

  closeModal(modalId: string): void {
    const modal = document.querySelector<HTMLElement>(`#${modalId}`);
    if (modal) {
      modal.style.display = 'none';
      modal.classList.add('u-hidden');
    }
  }

  async createConversation(): Promise<void> {
    if (this.isCreatingConversation) {
      console.info('Already creating conversation, ignoring duplicate call');
      return;
    }

    this.isCreatingConversation = true;

    try {
      const selectedUserId = this.getSelectedUserId();
      if (selectedUserId === null) {
        this.showNotification('Bitte wählen Sie einen Empfänger aus', 'warning');
        this.isCreatingConversation = false;
        return;
      }

      const requestBody = this.buildConversationRequest(selectedUserId);
      await this.sendConversationRequest(requestBody);
    } catch (error) {
      console.error('❌ Error creating conversation:', error);
      this.showNotification(error instanceof Error ? error.message : 'Fehler beim Erstellen der Unterhaltung', 'error');
    } finally {
      this.isCreatingConversation = false;
    }
  }

  private getSelectedUserId(): number | null {
    const activeTab = $$('.chat-type-tab.active');
    const tabType = activeTab?.dataset['type'];

    if (tabType === 'employee') {
      return this.getEmployeeUserId();
    } else if (tabType === 'admin') {
      return this.getAdminUserId();
    }

    return null;
  }

  private getEmployeeUserId(): number | null {
    const employeeInput = $$('#selectedEmployee') as HTMLInputElement | null;
    if (employeeInput?.value !== undefined && employeeInput.value !== '') {
      return Number.parseInt(employeeInput.value, 10);
    }
    return null;
  }

  private getAdminUserId(): number | null {
    const adminInput = $$('#selectedAdmin') as HTMLInputElement | null;
    if (adminInput?.value !== undefined && adminInput.value !== '') {
      return Number.parseInt(adminInput.value, 10);
    }
    return null;
  }

  private buildConversationRequest(selectedUserId: number): {
    participantIds: number[];
    isGroup: boolean;
    name?: string;
  } {
    const isGroup = false;
    const groupNameInput = $$('#groupChatName') as HTMLInputElement | null;
    const groupName = groupNameInput?.value.trim() ?? null;

    const requestBody: { participantIds: number[]; isGroup: boolean; name?: string } = {
      participantIds: [selectedUserId],
      isGroup,
    };

    if (groupName !== null && groupName !== '') {
      requestBody.name = groupName;
    }

    return requestBody;
  }

  private async sendConversationRequest(requestBody: {
    participantIds: number[];
    isGroup: boolean;
    name?: string;
  }): Promise<void> {
    // Try v2 API first, fallback to v1 if needed
    try {
      await this.sendV2ConversationRequest(requestBody);
    } catch {
      await this.sendV1ConversationRequest(requestBody);
    }
  }

  private async sendV2ConversationRequest(requestBody: {
    participantIds: number[];
    isGroup: boolean;
    name?: string;
  }): Promise<void> {
    const response = await this.apiClient.request<{ conversation: { id: number } }>('/chat/conversations', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    if (response.conversation.id !== 0) {
      await this.handleConversationCreated(response.conversation.id);
    } else {
      throw new Error('Failed to create conversation');
    }
  }

  private async sendV1ConversationRequest(requestBody: {
    participantIds: number[];
    isGroup: boolean;
    name?: string;
  }): Promise<void> {
    const response = await fetch('/api/chat/conversations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      const result = (await response.json()) as { id: number };
      await this.handleConversationCreated(result.id);
    } else {
      const error = (await response.json()) as { error?: string };
      throw new Error(error.error ?? `HTTP error! status: ${response.status}`);
    }
  }

  private async handleConversationCreated(conversationId: number): Promise<void> {
    this.showNotification('Unterhaltung erfolgreich erstellt', 'success');
    this.closeModal('newConversationModal');
    await this.loadInitialData();
    void this.selectConversation(conversationId);
  }

  private async deleteConversationV2(conversationId: number): Promise<void> {
    const response = await this.apiClient.request<{ message: string }>(`/chat/conversations/${conversationId}`, {
      method: 'DELETE',
    });

    if (response.message === '') {
      throw new Error('Failed to delete conversation');
    }
  }

  private async deleteConversationV1(conversationId: number): Promise<void> {
    const response = await fetch(`/api/chat/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.token ?? ''}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  async deleteCurrentConversation(): Promise<void> {
    if (this.currentConversationId === null || this.currentConversationId === 0) return;

    // Use custom confirm dialog instead of native confirm
    const userConfirmed = await this.showConfirmDialog('Möchten Sie diese Unterhaltung wirklich löschen?');
    if (!userConfirmed) return;

    try {
      // Try v2 API first, fallback to v1 if needed
      try {
        await this.deleteConversationV2(this.currentConversationId);
      } catch {
        await this.deleteConversationV1(this.currentConversationId);
      }

      this.showNotification('Unterhaltung gelöscht', 'success');

      // Reload the page to refresh everything
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('❌ Error deleting conversation:', error);
      this.showNotification('Fehler beim Löschen der Unterhaltung', 'error');
    }
  }

  showConversationsList(): void {
    const chatContainer = $$('.chat-container');
    if (chatContainer) {
      chatContainer.classList.remove('show-chat');
    }
  }

  initializeEventListeners(): void {
    this.setupMessageInput();
    this.setupButtons();
    this.setupFileUpload();
    this.setupEmojiHandlers();
    this.setupModalButtons();
    this.setupDeleteButton();
    this.startPeriodicPing();
  }

  private setupMessageInput(): void {
    const messageInput = $$('#messageInput') as HTMLTextAreaElement | null;
    if (messageInput) {
      messageInput.addEventListener('keypress', (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          void this.sendMessage();
        }
      });

      messageInput.addEventListener('input', () => {
        this.handleTyping();
        this.resizeTextarea();
      });
    }
  }

  private setupButtons(): void {
    const sendBtn = $$('#sendButton') as HTMLButtonElement | null;
    if (sendBtn) {
      sendBtn.addEventListener('click', () => {
        console.info('Send button clicked');
        void this.sendMessage();
      });
    } else {
      console.warn('Send button not found');
    }

    const newConvBtn = $$('#newConversationBtn') as HTMLButtonElement | null;
    if (newConvBtn) {
      newConvBtn.addEventListener('click', () => {
        this.showNewConversationModal();
      });
    }

    const createConvBtn = $$('#createConversationBtn') as HTMLButtonElement | null;
    if (createConvBtn) {
      createConvBtn.addEventListener('click', () => {
        void this.createConversation();
      });
    }
  }

  private setupFileUpload(): void {
    const fileInput = $$('#fileInput') as HTMLInputElement | null;
    const attachmentBtn = $$('#attachmentBtn') as HTMLButtonElement | null;

    if (attachmentBtn && fileInput) {
      attachmentBtn.addEventListener('click', (e) => {
        e.preventDefault();
        fileInput.click();
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', (event) => {
        const target = event.target as HTMLInputElement | null;
        const files = target?.files;
        if (files && files.length > 0) {
          this.handleFileUpload(files);
          fileInput.value = '';
        }
      });
    }
  }

  private setupEmojiHandlers(): void {
    const emojiBtn = $$('#emojiBtn') as HTMLButtonElement | null;
    if (emojiBtn) {
      emojiBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleEmojiPicker();
      });
    }

    const emojiCategories = $all('.emoji-category');
    emojiCategories.forEach((category) => {
      category.addEventListener('click', (e) => {
        const target = e.target as HTMLElement | null;
        if (!target) return;
        const categoryName = target.dataset['category'];
        if (categoryName !== undefined && categoryName !== '') {
          this.showEmojiCategory(categoryName);
          $all('.emoji-category').forEach((cat) => {
            cat.classList.remove('active');
          });
          target.classList.add('active');
        }
      });
    });

    document.addEventListener('click', (e) => {
      const emojiPicker = $$('#emojiPicker');
      const emojiBtnElement = $$('#emojiBtn');
      if (
        emojiPicker &&
        !emojiPicker.contains(e.target as Node) &&
        e.target !== emojiBtnElement &&
        emojiBtnElement?.contains(e.target as Node) !== true
      ) {
        emojiPicker.style.display = 'none';
      }
    });
  }

  private setupModalButtons(): void {
    const closeModalBtn = $$('#closeModalBtn') as HTMLButtonElement | null;
    const cancelModalBtn = $$('#cancelModalBtn') as HTMLButtonElement | null;

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
  }

  private setupDeleteButton(): void {
    const canDelete = this.currentUser.role === 'admin' || this.currentUser.role === 'root';
    if (canDelete) {
      const deleteBtn = $$('#deleteConversationBtn') as HTMLButtonElement | null;
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          console.info('Delete button clicked');
          void this.deleteCurrentConversation();
        });
      }
    }
  }

  private startPeriodicPing(): void {
    setInterval(() => {
      if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: 'ping',
            data: { timestamp: new Date().toISOString() },
          }),
        );
      }
    }, 30000);
  }

  handleTyping(): void {
    if (this.currentConversationId === null || this.currentConversationId === 0 || !this.isConnected) return;

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
    const typingIndicator = $$('#typingIndicator');
    if (!typingIndicator) return;

    const conversation = this.conversations.find((c) => c.id === this.currentConversationId);

    if (!conversation?.typingUsers || conversation.typingUsers.length === 0) {
      typingIndicator.style.display = 'none';
      return;
    }

    const typingUsers = conversation.typingUsers
      .map((userId) => {
        if (Array.isArray(conversation.participants)) {
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
    const textarea = $$('#messageInput') as HTMLTextAreaElement | null;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }

  updateConnectionStatus(connected: boolean): void {
    const statusIndicator = $$('#connectionStatus');
    if (statusIndicator) {
      statusIndicator.className = connected ? 'connected' : 'disconnected';
      statusIndicator.title = connected ? 'Verbunden' : 'Getrennt';
    }
  }

  async playNotificationSound(): Promise<void> {
    const audio = new Audio('/sounds/notification.mp3');
    try {
      await audio.play();
    } catch (error) {
      console.info('Could not play notification sound:', error);
    }
  }

  showDesktopNotification(message: Message): void {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      const notification = new Notification('Neue Nachricht', {
        body: `${message.sender?.username ?? 'Unknown'}: ${message.content}`,
        icon: '/images/logo.png',
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } else if (Notification.permission !== 'denied') {
      void Notification.requestPermission();
    }
  }

  showNotification(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info'): void {
    const notification = $$('#notification');
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

    const messageInput = $$('#message-input') as HTMLInputElement | null;
    if (!messageInput) return;

    messageInput.addEventListener('input', () => {
      if (!isTyping && this.currentConversationId !== null && this.currentConversationId !== 0) {
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
        if (isTyping && this.currentConversationId !== null && this.currentConversationId !== 0) {
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
  transformWebSocketMessage(data: {
    id: number;
    conversationId: number;
    senderId: number;
    content: string;
    createdAt: string;
    isRead?: boolean;
    type?: string;
    attachments?: Attachment[];
    sender?: ChatUser;
    username?: string;
    senderName?: string;
    firstName?: string;
    lastName?: string;
  }): Message {
    return {
      id: data.id,
      conversationId: data.conversationId,
      senderId: data.senderId,
      content: data.content,
      createdAt: data.createdAt,
      isRead: data.isRead ?? false,
      type: (data.type ?? 'text') as 'text' | 'file' | 'system',
      attachments: data.attachments ?? [],
      sender:
        data.sender ??
        ({
          id: data.senderId,
          username: data.username ?? data.senderName ?? 'Unknown',
          firstName: data.firstName,
          lastName: data.lastName,
          email: '',
          role: 'employee' as const,
          tenantId: 0,
          createdAt: '',
          updatedAt: '',
          isActive: true,
        } as ChatUser),
    };
  }

  // Utility methods
  async showConfirmDialog(message: string): Promise<boolean> {
    return await new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.style.cssText =
        'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';

      const dialog = document.createElement('div');
      dialog.className = 'confirm-dialog';
      dialog.style.cssText = 'background: #fff; padding: 20px; border-radius: 8px; max-width: 400px; width: 90%;';

      // Build dialog content with DOM methods
      const p = document.createElement('p');
      p.style.cssText = 'margin: 0 0 20px; color: #333;';
      p.textContent = message;

      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = 'display: flex; justify-content: flex-end; gap: 10px;';

      const cancelButton = document.createElement('button');
      cancelButton.id = 'confirmCancel';
      cancelButton.style.cssText =
        'padding: 8px 16px; border: 1px solid #ccc; background: #fff; border-radius: 4px; cursor: pointer;';
      cancelButton.textContent = 'Abbrechen';

      const okButton = document.createElement('button');
      okButton.id = 'confirmOk';
      okButton.style.cssText =
        'padding: 8px 16px; border: none; background: #dc3545; color: #fff; border-radius: 4px; cursor: pointer;';
      okButton.textContent = 'Löschen';

      buttonContainer.append(cancelButton, okButton);
      dialog.append(p, buttonContainer);

      modal.append(dialog);
      document.body.append(modal);

      const cleanup = () => {
        modal.remove();
      };

      const cancelBtn = dialog.querySelector('#confirmCancel');
      const okBtn = dialog.querySelector('#confirmOk');

      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          cleanup();
          resolve(false);
        });
      }

      if (okBtn) {
        okBtn.addEventListener('click', () => {
          cleanup();
          resolve(true);
        });
      }

      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          cleanup();
          resolve(false);
        }
      });
    });
  }

  escapeHtml(text: string | null | undefined): string {
    if (text === null || text === undefined || text === '') return '';

    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    // eslint-disable-next-line security/detect-object-injection -- m kommt aus Regex-Match von definierten Zeichen ["&'<>], kein beliebiger User-Input
    return text.replace(/["&'<>]/g, (m) => map[m] ?? m);
  }

  parseEmojis(text: string): string {
    // Simple emoji parsing - could be extended
    return text;
  }

  linkify(text: string): string {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, (match) => {
      const escapedUrl = this.escapeHtml(match);
      return `<a href="${escapedUrl}" target="_blank">${escapedUrl}</a>`;
    });
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
    // eslint-disable-next-line security/detect-object-injection -- i ist berechneter Index (0-3) basiert auf Math.log(), kein User-Input, 100% sicher
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i] ?? 'Bytes'}`;
  }
}

// Initialize chat client
let chatClient: ChatClient | null = null;

document.addEventListener('DOMContentLoaded', () => {
  // Only create if not already created
  if (!window.chatClient) {
    chatClient = new ChatClient();

    // Initialize the chat client
    void chatClient.init();

    // Export to window for backwards compatibility
    if (typeof window !== 'undefined') {
      window.chatClient = chatClient;
    }
  }
});
