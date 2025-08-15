/**
 * Chat Client System
 * WebSocket-based real-time chat functionality
 */

import type { User, JWTPayload } from '../types/api.types';
import { ApiClient } from '../utils/api-client';

import { getAuthToken } from './auth';
import type UnifiedNavigation from './components/unified-navigation';

declare global {
  interface Window {
    chatClient?: ChatClient;
    selectChatDropdownOption?: (type: string, id: number, name: string, meta?: string) => void;
    unifiedNav: UnifiedNavigation;
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
        const payload = JSON.parse(atob(this.token.split('.')[1])) as JWTPayload;
        parsedUser.id = payload.id;
        this.currentUser.id = payload.id;
        if (parsedUser.username === undefined || parsedUser.username === '') {
          parsedUser.username = payload.username;
          this.currentUser.username = payload.username;
        }
      } catch (e) {
        console.error('Error parsing token:', e);
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
      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_CHAT ?? false;

      if (useV2) {
        // v2 API returns { data: [...], pagination } directly
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
      } else {
        // v1 API - legacy code
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
      }
    } catch (error) {
      console.error('❌ Error loading conversations:', error);
      throw error;
    }
  }

  async loadAvailableUsers(): Promise<void> {
    try {
      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_CHAT ?? false;

      if (useV2) {
        // v2 API returns { users: [...], total } directly
        const response = await this.apiClient.request<{
          users: ChatUser[];
          total: number;
        }>('/chat/users', {
          method: 'GET',
        });

        // Auch eine leere User-Liste ist valide
        this.availableUsers = response.users;
      } else {
        // v1 API - legacy code
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
          const message: WebSocketMessage = JSON.parse(event.data as string) as WebSocketMessage;
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
        window.location.href = '/login';
        break;

      case 'new_message': {
        // Backend sends message data directly, not wrapped in { message, conversationId }
        const messageData = message.data as Message & { conversation_id: number };
        this.handleNewMessage({
          message: messageData,
          conversationId: messageData.conversation_id,
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
        // Handle error messages from WebSocket
        console.error('❌ WebSocket Error:', message.data);
        if (
          message.data !== null &&
          message.data !== undefined &&
          typeof message.data === 'object' &&
          'message' in message.data
        ) {
          const errorMessage =
            typeof message.data.message === 'string' ? message.data.message : 'Fehler beim Senden der Nachricht';
          this.showNotification(errorMessage, 'error');
        } else {
          this.showNotification('Fehler bei der Kommunikation mit dem Server', 'error');
        }
        break;

      default:
        console.info('📨 Unknown message type:', message.type);
    }
  }

  handleNewMessage(data: { message: Message; conversationId: number }): void {
    const { message, conversationId } = data;

    // Ensure message has proper sender object structure
    interface MessageWithExtra extends Message {
      sender_name?: string;
      username?: string;
      first_name?: string;
      last_name?: string;
      profile_image_url?: string;
      profile_picture_url?: string;
    }
    const msgWithExtra = message as MessageWithExtra;
    if (!message.sender && msgWithExtra.sender_id !== 0) {
      message.sender = {
        id: msgWithExtra.sender_id,
        username: msgWithExtra.username ?? msgWithExtra.sender_name ?? 'Unknown',
        first_name: msgWithExtra.first_name,
        last_name: msgWithExtra.last_name,
        profile_picture_url: msgWithExtra.profile_image_url ?? msgWithExtra.profile_picture_url,
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
        conversation.unread_count = (conversation.unread_count ?? 0) + 1;
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

      // Update the unread messages badge in the sidebar
      if (typeof window.unifiedNav.updateUnreadMessages === 'function') {
        void window.unifiedNav.updateUnreadMessages();
      }
    }
  }

  handleTypingStart(data: { userId: number; conversationId: number }): void {
    if (data.conversationId !== this.currentConversationId) return;

    const conversation = this.conversations.find((c) => c.id === data.conversationId);

    if (conversation) {
      conversation.typing_users ??= [];

      if (!conversation.typing_users.includes(data.userId)) {
        conversation.typing_users.push(data.userId);
        this.updateTypingIndicator();
      }
    }
  }

  handleTypingStop(data: { userId: number; conversationId: number }): void {
    if (data.conversationId !== this.currentConversationId) return;

    const conversation = this.conversations.find((c) => c.id === data.conversationId);

    if (conversation?.typing_users) {
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
    if (currentConv?.participants.some((p) => p.id === data.userId) === true) {
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
        void this.sendMessage(message.content);
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
    const chatMain = document.querySelector('.chat-main');

    if (chatHeader) chatHeader.classList.remove('u-hidden');
    if (chatArea) chatArea.style.display = 'block';
    if (noChatSelected) noChatSelected.style.display = 'none';
    if (chatMain) chatMain.classList.remove('u-hidden');

    // Show chat view on mobile
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
      chatContainer.classList.add('show-chat');
    }
  }

  async markConversationAsRead(conversationId: number): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (token === null || token === '') return;

      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_CHAT ?? false;

      if (useV2) {
        // v2 API returns { markedCount: number } directly (apiClient unwraps success wrapper)
        await this.apiClient.request<{ markedCount: number }>(`/chat/conversations/${conversationId}/read`, {
          method: 'POST',
          body: JSON.stringify({}), // Empty body to trigger Content-Type header
        });
      } else {
        // v1 API - legacy code
        await fetch(`/api/chat/conversations/${conversationId}/read`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      }

      // Update the navigation badge
      if (typeof window.unifiedNav.updateUnreadMessages === 'function') {
        void window.unifiedNav.updateUnreadMessages();
      }
    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  }

  async loadMessages(conversationId: number): Promise<void> {
    try {
      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_CHAT ?? false;

      if (useV2) {
        // v2 API returns { data: [...], pagination } directly
        const response = await this.apiClient.request<{
          data: Message[];
          pagination?: unknown;
        }>(`/chat/conversations/${conversationId}/messages`, {
          method: 'GET',
        });

        // Auch eine leere Nachrichtenliste ist valide
        this.displayMessages(response.data);
      } else {
        // v1 API - legacy code
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
      }
    } catch (error) {
      console.error('❌ Error loading messages:', error);
      this.showNotification('Fehler beim Laden der Nachrichten', 'error');
    }
  }

  displayMessages(messages: Message[]): void {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;

    // Hide container before updating
    messagesContainer.classList.remove('loaded');
    messagesContainer.innerHTML = '';

    let lastMessageDate: string | null = null;

    messages.forEach((message) => {
      // Handle both camelCase and snake_case for created_at/createdAt
      const createdAt = message.created_at;

      // Check if we need to add a date separator
      if (createdAt === '') {
        console.warn('Message without created date:', message);
        this.displayMessage(message);
        return;
      }

      const messageDate = new Date(createdAt).toLocaleDateString('de-DE');

      // Check if date is valid
      if (messageDate === 'Invalid Date') {
        console.warn('Invalid date for message:', createdAt, message);
        this.displayMessage(message);
        return;
      }

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
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;

    // Handle both camelCase and snake_case for created_at/createdAt
    const createdAt = message.created_at;
    if (createdAt === '') {
      console.warn('Message without created date:', message);
      return;
    }

    // Check if we need to add a date separator
    const messageDate = new Date(createdAt).toLocaleDateString('de-DE');
    const messages = messagesContainer.querySelectorAll('.message');
    const lastMessage = messages[messages.length - 1];

    // Check if a date separator for this date already exists
    const existingSeparators = messagesContainer.querySelectorAll('.date-separator');
    const separatorExists = Array.from(existingSeparators).some((separator) => {
      const separatorText = separator.textContent !== '' ? separator.textContent.trim() : '';
      // Check if separator matches the date or "Heute" or "Gestern"
      return (
        separatorText === messageDate ||
        (separatorText === 'Heute' && this.isToday(messageDate)) ||
        (separatorText === 'Gestern' && this.isYesterday(messageDate))
      );
    });

    if (!separatorExists) {
      if (messages.length > 0) {
        const lastMessageDate = lastMessage.getAttribute('data-date');
        if (lastMessageDate !== null && lastMessageDate !== '' && lastMessageDate !== messageDate) {
          this.addDateSeparator(messageDate, messagesContainer);
        }
      } else {
        // First message in conversation
        this.addDateSeparator(messageDate, messagesContainer);
      }
    }

    // Handle both snake_case and camelCase for sender_id/senderId
    const senderId = message.sender_id;
    const isOwnMessage = senderId === this.currentUserId;
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwnMessage ? 'own' : ''}`;
    messageDiv.setAttribute('data-message-id', message.id.toString());
    messageDiv.setAttribute('data-date', messageDate);

    // Use same createdAt variable that handles both formats
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
    messageTextDiv.innerHTML = this.linkify(messageContent);
    messageContentDiv.appendChild(messageTextDiv);

    // Add attachments if present
    if (message.attachments && message.attachments.length > 0) {
      const attachmentFragment = this.renderAttachments(message.attachments);
      messageContentDiv.appendChild(attachmentFragment);
    }

    // Create time element
    const messageTimeDiv = document.createElement('div');
    messageTimeDiv.className = 'message-time';
    messageTimeDiv.textContent = time;

    if (isOwnMessage) {
      const readIndicator = document.createElement('span');
      readIndicator.className = `read-indicator ${message.is_read ? 'read' : ''}`;
      readIndicator.textContent = '✓✓';
      messageTimeDiv.appendChild(readIndicator);
    }

    messageContentDiv.appendChild(messageTimeDiv);
    messageDiv.appendChild(messageContentDiv);

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  addDateSeparator(dateString: string, container: HTMLElement): void {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Handle both German format (dd.mm.yyyy) and ISO date strings
    let messageDate: Date;
    if (dateString.includes('.')) {
      // German format: dd.mm.yyyy
      const [day, month, year] = dateString.split('.');
      messageDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    } else {
      // Assume ISO format or other parseable format
      messageDate = new Date(dateString);
    }

    // Check if date is valid
    if (isNaN(messageDate.getTime())) {
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
    separator.setAttribute('data-date', dateString);
    separator.innerHTML = `<span>${displayDate}</span>`;
    container.appendChild(separator);
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
      const isImage = attachment.mime_type.startsWith('image/');
      const fileSize = this.formatFileSize(attachment.file_size);

      const attachmentDiv = document.createElement('div');

      if (isImage) {
        attachmentDiv.className = 'attachment image-attachment';

        const img = document.createElement('img');
        img.src = `/api/chat/attachments/${attachment.id}`;
        img.alt = attachment.file_name;
        attachmentDiv.appendChild(img);
      } else {
        attachmentDiv.className = 'attachment file-attachment';

        const fileIcon = document.createElement('i');
        fileIcon.className = 'fas fa-file';
        attachmentDiv.appendChild(fileIcon);

        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';

        const fileName = document.createElement('div');
        fileName.className = 'file-name';
        fileName.textContent = attachment.file_name;
        fileInfo.appendChild(fileName);

        const fileSizeDiv = document.createElement('div');
        fileSizeDiv.className = 'file-size';
        fileSizeDiv.textContent = fileSize;
        fileInfo.appendChild(fileSizeDiv);

        attachmentDiv.appendChild(fileInfo);

        const downloadLink = document.createElement('a');
        downloadLink.href = `/api/chat/attachments/${attachment.id}/download`;
        downloadLink.className = 'download-btn';

        const downloadIcon = document.createElement('i');
        downloadIcon.className = 'fas fa-download';
        downloadLink.appendChild(downloadIcon);

        attachmentDiv.appendChild(downloadLink);
      }

      fragment.appendChild(attachmentDiv);
    });

    return fragment;
  }

  async sendMessage(content?: string): Promise<void> {
    console.info('sendMessage called');
    const messageInput = document.getElementById('messageInput') as HTMLTextAreaElement | null;
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
      conversation_id: this.currentConversationId,
      sender_id: this.currentUserId ?? 0,
      content: messageContent,
      created_at: new Date().toISOString(),
      is_read: false,
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

  async uploadFiles(): Promise<number[]> {
    const attachmentIds: number[] = [];

    for (const file of this.pendingFiles) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        if (this.currentConversationId !== null && this.currentConversationId !== 0) {
          formData.append('conversationId', this.currentConversationId.toString());
        }

        const useV2 = window.FEATURE_FLAGS?.USE_API_V2_CHAT ?? false;

        if (useV2) {
          // v2 API returns { success, data }
          const response = await this.apiClient.request<{ success: boolean; data: { id: number } }>(
            '/chat/attachments',
            {
              method: 'POST',
              body: formData,
            },
          );

          if (response.success) {
            attachmentIds.push(response.data.id);
          }
        } else {
          // v1 API - legacy code
          const response = await fetch('/api/chat/attachments', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.token ?? ''}`,
            },
            body: formData,
          });

          if (response.ok) {
            const result = (await response.json()) as { id: number };
            attachmentIds.push(result.id);
          }
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
    const previewContainer = document.getElementById('filePreview');
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
        fileIconDiv.appendChild(img);
      } else {
        const icon = document.createElement('i');
        icon.className = 'fas fa-file';
        fileIconDiv.appendChild(icon);
      }

      const fileInfoDiv = document.createElement('div');
      fileInfoDiv.className = 'file-info';

      const fileName = document.createElement('div');
      fileName.className = 'file-name';
      fileName.textContent = file.name;

      const fileSize = document.createElement('div');
      fileSize.className = 'file-size';
      fileSize.textContent = this.formatFileSize(file.size);

      fileInfoDiv.appendChild(fileName);
      fileInfoDiv.appendChild(fileSize);

      const removeButton = document.createElement('button');
      removeButton.className = 'remove-file';
      removeButton.dataset.index = index.toString();
      const removeIcon = document.createElement('i');
      removeIcon.className = 'fas fa-times';
      removeButton.appendChild(removeIcon);

      removeButton.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement | null;
        const fileIndex = parseInt(target?.dataset.index ?? '0', 10);
        this.removeFile(fileIndex);
      });

      preview.appendChild(fileIconDiv);
      preview.appendChild(fileInfoDiv);
      preview.appendChild(removeButton);

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

    if (emojiPicker.style.display === 'none' || emojiPicker.style.display === '') {
      emojiPicker.style.display = 'block';
      this.showEmojiCategory('smileys');
    } else {
      emojiPicker.style.display = 'none';
    }
  }

  showEmojiCategory(categoryName: string): void {
    const emojiContent = document.getElementById('emojiContent');
    if (!emojiContent) return;

    const emojis = this.emojiCategories[categoryName] ?? [];
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
    const messageInput = document.getElementById('messageInput') as HTMLTextAreaElement | null;
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

      // Add unread class if conversation has unread messages
      if (conversation.unread_count !== undefined && conversation.unread_count > 0) {
        item.classList.add('unread');
      }

      const displayName = conversation.is_group
        ? (conversation.name ?? 'Gruppenchat')
        : this.getConversationDisplayName(conversation);

      let lastMessageText = 'Keine Nachrichten';
      if (conversation.last_message?.content !== undefined && conversation.last_message.content !== '') {
        // Truncate message to one line (max ~40 chars)
        const content = conversation.last_message.content;
        lastMessageText = content.length > 40 ? `${content.substring(0, 37)}...` : content;
      }

      const lastMessageTime = conversation.last_message ? this.formatTime(conversation.last_message.created_at) : '';

      const unreadBadge =
        conversation.unread_count !== undefined && conversation.unread_count > 0
          ? `<span class="unread-count">${conversation.unread_count}</span>`
          : '';

      // Get avatar HTML
      let avatarHtml = '';
      if (!conversation.is_group) {
        const otherParticipant = conversation.participants.find((p) => p.id !== this.currentUserId);
        if (otherParticipant) {
          if (
            (otherParticipant.profile_picture_url !== undefined && otherParticipant.profile_picture_url !== '') ||
            (otherParticipant.profile_image_url !== undefined && otherParticipant.profile_image_url !== '')
          ) {
            const imgUrl = otherParticipant.profile_picture_url ?? otherParticipant.profile_image_url ?? null;
            if (imgUrl !== null && imgUrl !== '') {
              avatarHtml = `<img src="${imgUrl}" alt="${this.escapeHtml(displayName)}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            } else {
              const initials = this.getInitials(otherParticipant.first_name, otherParticipant.last_name);
              avatarHtml = initials;
            }
          } else if (
            (otherParticipant.first_name !== undefined && otherParticipant.first_name !== '') ||
            (otherParticipant.last_name !== undefined && otherParticipant.last_name !== '')
          ) {
            const initials = this.getInitials(otherParticipant.first_name, otherParticipant.last_name);
            avatarHtml = initials;
          } else {
            avatarHtml = '<i class="fas fa-user"></i>';
          }
        } else {
          avatarHtml = '<i class="fas fa-user"></i>';
        }
      } else {
        // Group chat
        avatarHtml = '<i class="fas fa-users"></i>';
      }

      item.innerHTML = `
        <div class="conversation-avatar">
          ${avatarHtml}
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
        void this.selectConversation(conversation.id);
      });

      conversationsList.appendChild(item);
    });
  }

  renderChatHeader(): void {
    const chatAvatar = document.getElementById('chat-avatar');
    const chatPartnerName = document.getElementById('chat-partner-name');
    const chatPartnerStatus = document.getElementById('chat-partner-status');

    if (this.currentConversationId === null || this.currentConversationId === 0) return;

    const conversation = this.conversations.find((c) => c.id === this.currentConversationId);
    if (!conversation) return;

    const displayName = conversation.is_group
      ? (conversation.name ?? 'Gruppenchat')
      : this.getConversationDisplayName(conversation);

    // Update name
    if (chatPartnerName) {
      chatPartnerName.textContent = displayName;
    }

    // Update avatar and status
    if (chatAvatar) {
      if (!conversation.is_group) {
        const otherParticipant = conversation.participants.find((p) => p.id !== this.currentUserId);
        if (otherParticipant) {
          // Show profile picture if available
          if (
            (otherParticipant.profile_picture_url !== undefined && otherParticipant.profile_picture_url !== '') ||
            (otherParticipant.profile_image_url !== undefined && otherParticipant.profile_image_url !== '')
          ) {
            const imgUrl = otherParticipant.profile_picture_url ?? otherParticipant.profile_image_url ?? null;
            if (imgUrl !== null && imgUrl !== '') {
              chatAvatar.innerHTML = `<img src="${imgUrl}" alt="${this.escapeHtml(displayName)}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            } else {
              // Show initials as fallback
              const initials = this.getInitials(otherParticipant.first_name, otherParticipant.last_name);
              chatAvatar.textContent = initials;
            }
            chatAvatar.style.display = 'flex';
          } else if (
            (otherParticipant.first_name !== undefined && otherParticipant.first_name !== '') ||
            (otherParticipant.last_name !== undefined && otherParticipant.last_name !== '')
          ) {
            // Show initials
            const initials = this.getInitials(otherParticipant.first_name, otherParticipant.last_name);
            chatAvatar.textContent = initials;
            chatAvatar.style.display = 'flex';
          } else {
            // Hide avatar if no data
            chatAvatar.style.display = 'none';
          }

          // Update status
          if (chatPartnerStatus) {
            chatPartnerStatus.textContent = this.getRoleDisplayName(otherParticipant.role);
          }
        }
      } else {
        // Group chat
        chatAvatar.innerHTML = '<i class="fas fa-users"></i>';
        chatAvatar.style.display = 'flex';
        if (chatPartnerStatus) {
          chatPartnerStatus.textContent = 'Gruppenchat';
        }
      }
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
    return roleMap[role] ?? role;
  }

  deleteConversationBtnHandler(): void {
    const canDelete = this.currentUser.role === 'admin' || this.currentUser.role === 'root';
    // Re-attach delete button listener only for admins and root users
    if (canDelete) {
      const deleteBtn = document.getElementById('deleteConversationBtn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          void this.deleteCurrentConversation();
        });
      }
    }
  }

  getConversationDisplayName(conversation: Conversation): string {
    // Für Gruppenchats
    if (conversation.is_group) {
      return conversation.name ?? 'Gruppenchat';
    }

    // Für 1:1 Chats - nutze display_name wenn verfügbar
    if (conversation.display_name !== undefined && conversation.display_name !== '') {
      return conversation.display_name;
    }

    // Fallback auf participants array
    if (conversation.participants.length > 0) {
      const otherParticipant = conversation.participants.find((p) => p.id !== this.currentUserId);
      if (otherParticipant) {
        const fullName = `${otherParticipant.first_name ?? ''} ${otherParticipant.last_name ?? ''}`.trim();
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
    const modal = document.getElementById('newConversationModal');
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
    document.querySelectorAll('.chat-type-tab').forEach((tab) => {
      tab.classList.remove('active');
    });
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
      // Remove any existing listeners first
      const newTab = tab.cloneNode(true) as HTMLElement;
      tab.parentNode?.replaceChild(newTab, tab);

      // Add click listener
      newTab.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const target = e.currentTarget as HTMLElement | null;
        if (!target) return;
        const type = target.dataset.type;

        console.info('Tab clicked:', type);

        // Update active tab
        document.querySelectorAll('.chat-type-tab').forEach((t) => {
          t.classList.remove('active');
        });
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
      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_CHAT ?? false;

      if (useV2) {
        // v2 API returns data array directly
        const departments = await this.apiClient.request<{ id: number; name: string }[]>('/departments', {
          method: 'GET',
        });

        const dropdown = document.getElementById('departmentDropdown');

        if (dropdown) {
          dropdown.innerHTML = '';

          // Handle both array response and empty departments
          const deptList = Array.isArray(departments) ? departments : [];

          deptList.forEach((dept: { id: number; name: string }) => {
            const option = document.createElement('div');
            option.className = 'dropdown-option';
            option.onclick = () => {
              if ('selectChatDropdownOption' in window && typeof window.selectChatDropdownOption === 'function') {
                window.selectChatDropdownOption('department', dept.id, dept.name);
              }
            };
            option.innerHTML = `
              <div class="option-info">
                <div class="option-name">${this.escapeHtml(dept.name)}</div>
              </div>
            `;
            dropdown.appendChild(option);
          });
        }
      } else {
        // v1 API - legacy code
        const response = await fetch('/api/departments', {
          headers: {
            Authorization: `Bearer ${this.token ?? ''}`,
          },
        });

        if (response.ok) {
          const departments = (await response.json()) as { id: number; name: string }[];
          const dropdown = document.getElementById('departmentDropdown');

          if (dropdown) {
            dropdown.innerHTML = '';

            departments.forEach((dept) => {
              const option = document.createElement('div');
              option.className = 'dropdown-option';
              option.onclick = () => {
                if ('selectChatDropdownOption' in window && typeof window.selectChatDropdownOption === 'function') {
                  window.selectChatDropdownOption('department', dept.id, dept.name);
                }
              };
              option.innerHTML = `
                <div class="option-info">
                  <div class="option-name">${this.escapeHtml(dept.name)}</div>
                </div>
              `;
              dropdown.appendChild(option);
            });
          }
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      }
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  }

  loadEmployeesForDepartment(departmentId: string): void {
    try {
      // Filter employees by department
      const employees = this.availableUsers.filter(
        (user) => user.role === 'employee' && user.department_id?.toString() === departmentId,
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
            const fullName = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim();
            const name = fullName !== '' ? fullName : employee.username;
            if ('selectChatDropdownOption' in window && typeof window.selectChatDropdownOption === 'function') {
              window.selectChatDropdownOption('employee', employee.id, name, employee.department ?? '');
            }
          };
          option.innerHTML = `
            <div class="option-info">
              <div class="option-name">${this.escapeHtml(
                (() => {
                  const n = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim();
                  return n !== '' ? n : employee.username;
                })(),
              )}</div>
              <div class="option-meta">${this.escapeHtml(employee.position ?? 'Mitarbeiter')}</div>
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
          const fullName = `${admin.first_name ?? ''} ${admin.last_name ?? ''}`.trim();
          const name = fullName !== '' ? fullName : admin.username;
          if ('selectChatDropdownOption' in window && typeof window.selectChatDropdownOption === 'function') {
            window.selectChatDropdownOption('admin', admin.id, name, admin.role);
          }
        };
        option.innerHTML = `
          <div class="option-info">
            <div class="option-name">${this.escapeHtml(
              (() => {
                const n = `${admin.first_name ?? ''} ${admin.last_name ?? ''}`.trim();
                return n !== '' ? n : admin.username;
              })(),
            )}</div>
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
      modal.classList.add('u-hidden');
    }
  }

  async createConversation(): Promise<void> {
    // Prevent duplicate calls
    if (this.isCreatingConversation) {
      console.info('Already creating conversation, ignoring duplicate call');
      return;
    }

    this.isCreatingConversation = true;

    try {
      // Get selected recipient based on active tab
      const activeTab = document.querySelector('.chat-type-tab.active');
      const tabType = (activeTab as HTMLElement | null)?.dataset.type;

      let selectedUserId: number | null = null;

      if (tabType === 'employee') {
        const employeeInput = document.getElementById('selectedEmployee') as HTMLInputElement | null;
        selectedUserId =
          employeeInput?.value !== undefined && employeeInput.value !== '' ? parseInt(employeeInput.value, 10) : null;
      } else if (tabType === 'admin') {
        const adminInput = document.getElementById('selectedAdmin') as HTMLInputElement | null;
        selectedUserId =
          adminInput?.value !== undefined && adminInput.value !== '' ? parseInt(adminInput.value, 10) : null;
      }

      if (selectedUserId === null || selectedUserId === 0) {
        this.showNotification('Bitte wählen Sie einen Empfänger aus', 'warning');
        this.isCreatingConversation = false;
        return;
      }

      // For now, we only support 1:1 chats
      const isGroup = false;
      const groupNameInput = document.getElementById('groupChatName') as HTMLInputElement | null;
      const groupName = groupNameInput?.value.trim() ?? null;
      const requestBody: { participantIds: number[]; isGroup: boolean; name?: string } = {
        participantIds: [selectedUserId],
        isGroup,
      };

      // Only add name for group chats
      if (groupName !== null && groupName !== '') {
        requestBody.name = groupName;
      }

      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_CHAT ?? false;

      if (useV2) {
        // v2 API returns { conversation: { id, ... } } directly (apiClient unwraps success wrapper)
        const response = await this.apiClient.request<{ conversation: { id: number } }>('/chat/conversations', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        if (response.conversation.id !== 0) {
          this.showNotification('Unterhaltung erfolgreich erstellt', 'success');
          this.closeModal('newConversationModal');

          // Reload conversations
          await this.loadInitialData();

          // Select new conversation
          void this.selectConversation(response.conversation.id);
        } else {
          throw new Error('Failed to create conversation');
        }
      } else {
        // v1 API - legacy code
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

          this.showNotification('Unterhaltung erfolgreich erstellt', 'success');
          this.closeModal('newConversationModal');

          // Reload conversations
          await this.loadInitialData();

          // Select new conversation
          void this.selectConversation(result.id);
        } else {
          const error = (await response.json()) as { error?: string };
          throw new Error(error.error ?? `HTTP error! status: ${response.status}`);
        }
      }
    } catch (error) {
      console.error('❌ Error creating conversation:', error);
      this.showNotification(error instanceof Error ? error.message : 'Fehler beim Erstellen der Unterhaltung', 'error');
    } finally {
      this.isCreatingConversation = false;
    }
  }

  async deleteCurrentConversation(): Promise<void> {
    if (this.currentConversationId === null || this.currentConversationId === 0) return;

    // Use custom confirm dialog instead of native confirm
    const userConfirmed = await this.showConfirmDialog('Möchten Sie diese Unterhaltung wirklich löschen?');
    if (!userConfirmed) {
      return;
    }

    try {
      const useV2 = window.FEATURE_FLAGS?.USE_API_V2_CHAT ?? false;

      if (useV2) {
        // v2 API returns { message: "..." } directly (apiClient unwraps success wrapper)
        const response = await this.apiClient.request<{ message: string }>(
          `/chat/conversations/${this.currentConversationId}`,
          {
            method: 'DELETE',
          },
        );

        if (response.message !== '') {
          this.showNotification('Unterhaltung gelöscht', 'success');

          // Reload the page to refresh everything
          setTimeout(() => {
            window.location.reload();
          }, 500);
        } else {
          throw new Error('Failed to delete conversation');
        }
      } else {
        // v1 API - legacy code
        const response = await fetch(`/api/chat/conversations/${this.currentConversationId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${this.token ?? ''}`,
          },
        });

        if (response.ok) {
          this.showNotification('Unterhaltung gelöscht', 'success');

          // Reload the page to refresh everything
          setTimeout(() => {
            window.location.reload();
          }, 500);
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
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
    const messageInput = document.getElementById('messageInput') as HTMLTextAreaElement | null;
    if (messageInput) {
      // Enter key to send
      messageInput.addEventListener('keypress', (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          void this.sendMessage();
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
        console.info('Send button clicked');
        void this.sendMessage();
      });
    } else {
      console.warn('Send button not found');
    }

    // File upload handler
    const fileInput = document.getElementById('fileInput') as HTMLInputElement | null;
    const attachmentBtn = document.getElementById('attachmentBtn');

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
        const target = e.target as HTMLElement | null;
        if (!target) return;
        const categoryName = target.dataset.category;
        if (categoryName !== undefined && categoryName !== '') {
          this.showEmojiCategory(categoryName);

          // Update active state
          document.querySelectorAll('.emoji-category').forEach((cat) => {
            cat.classList.remove('active');
          });
          target.classList.add('active');
        }
      });
    });

    // Click outside to close emoji picker
    document.addEventListener('click', (e) => {
      const emojiPicker = document.getElementById('emojiPicker');
      const emojiBtnElement = document.getElementById('emojiBtn');
      if (
        emojiPicker &&
        !emojiPicker.contains(e.target as Node) &&
        e.target !== emojiBtnElement &&
        emojiBtnElement?.contains(e.target as Node) !== true
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
        void this.createConversation();
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

    // Delete conversation button (only for admin and root)
    const canDelete = this.currentUser.role === 'admin' || this.currentUser.role === 'root';
    if (canDelete) {
      const deleteBtn = document.getElementById('deleteConversationBtn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          console.info('Delete button clicked');
          void this.deleteCurrentConversation();
        });
      }
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
    const typingIndicator = document.getElementById('typingIndicator');
    if (!typingIndicator) return;

    const conversation = this.conversations.find((c) => c.id === this.currentConversationId);

    if (!conversation?.typing_users || conversation.typing_users.length === 0) {
      typingIndicator.style.display = 'none';
      return;
    }

    const typingUsers = conversation.typing_users
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
    const textarea = document.getElementById('messageInput') as HTMLTextAreaElement | null;
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
    audio.play().catch((error: unknown) => {
      console.info('Could not play notification sound:', error);
    });
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

    const messageInput = document.getElementById('message-input') as HTMLTextAreaElement | null;
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
    conversation_id: number;
    sender_id: number;
    content: string;
    created_at: string;
    is_read?: boolean;
    type?: string;
    attachments?: Attachment[];
    sender?: ChatUser;
    username?: string;
    sender_name?: string;
    first_name?: string;
    last_name?: string;
  }): Message {
    return {
      id: data.id,
      conversation_id: data.conversation_id,
      sender_id: data.sender_id,
      content: data.content,
      created_at: data.created_at,
      is_read: data.is_read ?? false,
      type: (data.type ?? 'text') as 'text' | 'file' | 'system',
      attachments: data.attachments ?? [],
      sender:
        data.sender ??
        ({
          id: data.sender_id,
          username: data.username ?? data.sender_name ?? 'Unknown',
          first_name: data.first_name,
          last_name: data.last_name,
          email: '',
          role: 'employee' as const,
          tenant_id: 0,
          created_at: '',
          updated_at: '',
          is_active: true,
        } as ChatUser),
    };
  }

  // Utility methods
  async showConfirmDialog(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.style.cssText =
        'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;';

      const dialog = document.createElement('div');
      dialog.className = 'confirm-dialog';
      dialog.style.cssText = 'background: white; padding: 20px; border-radius: 8px; max-width: 400px; width: 90%;';

      dialog.innerHTML = `
        <p style="margin: 0 0 20px; color: #333;">${this.escapeHtml(message)}</p>
        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button id="confirmCancel" style="padding: 8px 16px; border: 1px solid #ccc; background: white; border-radius: 4px; cursor: pointer;">Abbrechen</button>
          <button id="confirmOk" style="padding: 8px 16px; border: none; background: #dc3545; color: #fff; border-radius: 4px; cursor: pointer;">Löschen</button>
        </div>
      `;

      modal.appendChild(dialog);
      document.body.appendChild(modal);

      const cleanup = () => {
        document.body.removeChild(modal);
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
    return text.replace(/[&<>"']/g, (m) => map[m]);
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
    void chatClient.init();

    // Export to window for backwards compatibility
    if (typeof window !== 'undefined') {
      window.chatClient = chatClient;
    }
  }
});
