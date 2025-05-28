class ChatClient {
  constructor() {
    this.ws = null;
    this.currentUser = JSON.parse(localStorage.getItem('user') || '{}');
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
    this.messageQueue = []; // Queue for messages sent while disconnected

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
        '✊',
        '👊',
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
        '🦿',
        '🦻',
        '👂',
        '🦻',
        '👃',
        '🧠',
        '🦾',
        '🦷',
        '🦴',
        '👀',
        '👁️',
        '👅',
        '👄',
        '💋',
        '💘',
      ],
      hearts: [
        '❤️',
        '🧡',
        '💛',
        '💚',
        '💙',
        '💜',
        '🤎',
        '🖤',
        '🤍',
        '💔',
        '❣️',
        '💕',
        '💖',
        '💗',
        '💓',
        '💘',
        '💝',
        '💞',
        '💟',
        '♥️',
        '♦️',
        '♠️',
        '♣️',
      ],
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
        '🐸',
        '🐵',
        '🙈',
        '🙉',
        '🙊',
        '🐒',
        '🦍',
        '🦧',
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
        '🦼',
        '🐴',
        '🦄',
        '🐝',
        '🦟',
        '🦗',
        '🐛',
        '🐌',
        '🐚',
        '🐞',
        '🐜',
        '🦞',
        '🦘',
        '🐍',
        '🐢',
        '🦕',
        '🦖',
        '🐙',
        '🦑',
        '🦀',
        '🦞',
        '🦐',
        '🦪',
        '😸',
        '🐠',
        '🐟',
        '🐡',
        '🐋',
        '🦈',
        '🐳',
        '🐊',
        '🐅',
        '🐆',
        '🦓',
        '🦌',
        '🦭',
        '🐘',
        '🦛',
        '🦒',
      ],
      food: [
        '🍎',
        '🍏',
        '🍐',
        '🍊',
        '🍋',
        '🍌',
        '🍉',
        '🍇',
        '🍓',
        '🍈',
        '🍒',
        '🍑',
        '🥭',
        '🍍',
        '🥥',
        '🥝',
        '🍅',
        '🥑',
        '🥦',
        '🧄',
        '🧅',
        '🌶️',
        '🥒',
        '🥬',
        '🥦',
        '🥚',
        '🥞',
        '🧀',
        '🍞',
        '🥐',
        '🥖',
        '🧁',
        '🥨',
        '🥯',
        '🥛',
        '🥓',
        '🥤',
        '🌭',
        '🍔',
        '🍕',
        '🍖',
        '🥪',
        '🌮',
        '🌯',
        '🥙',
        '🧆',
        '🥜',
        '🍳',
        '🥘',
        '🍲',
        '🍥',
        '🍜',
        '🍝',
        '🍠',
        '🍢',
        '🍣',
        '🍤',
        '🍙',
        '🍚',
        '🍛',
        '🦀',
        '🦞',
        '🦐',
        '🦑',
        '🍦',
        '🍧',
        '🍨',
        '🍩',
        '🍪',
        '🎂',
        '🍰',
        '🧁',
        '🥧',
        '🍫',
        '🍬',
        '🍭',
        '🍮',
        '🍯',
        '🍼',
        '🥛',
        '☕',
        '🍵',
        '🍶',
        '🍺',
        '🍻',
        '🥂',
        '🍷',
        '🥃',
        '🍸',
        '🍹',
        '🍾',
        '🥄',
        '🧋',
        '🧊',
      ],
      activities: [
        '⚽',
        '🏀',
        '🏈',
        '⚾',
        '🥎',
        '🏓',
        '🏸',
        '🏉',
        '🎾',
        '🥏',
        '🎳',
        '🏏',
        '🏑',
        '🏒',
        '🥍',
        '🏅',
        '🥇',
        '🥈',
        '🥉',
        '🏆',
        '🎱',
        '🔮',
        '🎯',
        '🎲',
        '🧩',
        '🎰',
        '🎳',
      ],
      objects: [
        '💡',
        '🔦',
        '🕯️',
        '🧪',
        '🔎',
        '🔍',
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
        '⏱️',
        '⏲️',
        '⏰',
        '🕰️',
        '⌚',
        '⏳',
        '📡',
        '🔋',
        '🔌',
        '💻',
        '🖥️',
        '🖨️',
        '⌨️',
        '🖱️',
        '🖲️',
        '💽',
        '💾',
        '💿',
        '📀',
        '📁',
        '🗂️',
        '📂',
        '📃',
        '📄',
        '📅',
        '📆',
        '🖇️',
        '📇',
        '📈',
        '📉',
        '📊',
        '📋',
        '📌',
        '📍',
        '📎',
        '🖇️',
        '📏',
        '📐',
        '✂️',
        '🖊️',
        '🖋️',
        '✒️',
        '🖌️',
        '🖍️',
        '📑',
        '📒',
        '📓',
        '📔',
        '📕',
        '📖',
        '📗',
        '📘',
        '📙',
        '📚',
        '📐',
        '🔖',
        '📎',
        '🖇️',
        '🔐',
        '🔒',
        '🔓',
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
        '🔥',
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
        '🎆',
        '🎇',
        '🏧',
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
        '🎲',
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
        '📃',
        '🗃️',
        '🗄️',
        '📋',
        '🗒️',
        '🗓️',
        '🔐',
        '🔒',
        '🔓',
        '🔏',
        '🔐',
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
        '🧫',
        '🚬',
        '⚰️',
        '⚱️',
        '🏺️',
        '🗿',
        '🧿',
        '📴',
        '📵',
        '🛢️',
      ],
    };

    this.init();
  }

  async init() {
    // Check if user is authenticated via cookies
    if (!this.currentUser.id) {
      console.error('❌ No authentication found');
      window.location.href = '/login';
      return;
    }

    await this.loadInitialData();
    this.connectWebSocket();
    this.initializeEventListeners();
    this.startTypingTimer();
  }

  async loadInitialData() {
    try {
      // Load conversations
      const response = await fetch('/api/chat/conversations', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      this.conversations = await response.json();

      this.renderConversations();

      // Load available users
      const usersResponse = await fetch('/api/chat/users', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (usersResponse.ok) {
        this.availableUsers = await usersResponse.json();
      }
    } catch (error) {
      console.error('❌ Error loading initial data:', error);
      this.showNotification('Fehler beim Laden der Chat-Daten', 'error');
    }
  }

  connectWebSocket() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    // Get the correct protocol and host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/chat-ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.updateConnectionStatus(true);

        // Process any queued messages
        this.processMessageQueue();

        // Rejoin current conversation
        if (this.currentConversationId) {
          this.joinConversation(this.currentConversationId);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          console.log('🔍 DEBUG - Full WebSocket message:', {
            type: message.type,
            data: message.data,
            timestamp: new Date().toISOString(),
          });
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
          console.error('🔍 DEBUG - Raw message data:', event.data);
        }
      };

      this.ws.onclose = (event) => {
        this.isConnected = false;
        this.updateConnectionStatus(false);

        // Only attempt reconnect if not a normal closure
        if (event.code !== 1000) {
          this.attemptReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.updateConnectionStatus(false);
      };
    } catch (error) {
      console.error('❌ Error connecting WebSocket:', error);
      this.attemptReconnect();
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay =
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

      setTimeout(() => {
        this.connectWebSocket();
      }, delay);
    } else {
      console.error('❌ Max reconnection attempts reached');
      this.showNotification(
        'Verbindung zum Chat-Server verloren. Bitte Seite neu laden.',
        'error'
      );
    }
  }

  processMessageQueue() {
    if (this.messageQueue.length === 0) return;

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message));
      }
    }
  }

  handleWebSocketMessage(message) {
    console.log('🔍 DEBUG - WebSocket message details:', {
      type: message.type,
      hasData: !!message.data,
      dataKeys: message.data ? Object.keys(message.data) : [],
      conversationId: message.data?.conversation_id,
      currentConvId: this.currentConversationId,
    });

    switch (message.type) {
      case 'connection_established':
        break;
      case 'new_message':
        this.handleNewMessage(message.data);
        break;
      case 'user_typing':
        this.showTypingIndicator(message.data);
        break;
      case 'user_stopped_typing':
        this.hideTypingIndicator(message.data);
        break;
      case 'message_read':
        this.handleMessageRead(message.data);
        break;
      case 'user_status_changed':
        this.handleUserStatusChange(message.data);
        break;
      case 'scheduled_message_delivered':
        this.handleScheduledMessageDelivered(message.data);
        break;
      case 'message_sent':
        this.handleMessageSent(message.data);
        break;
      case 'message_delivered':
        this.handleMessageDelivered(message.data);
        break;
      case 'pong':
        break;
      case 'error':
        console.error('❌ Server error:', message.data.message);
        this.showNotification(message.data.message, 'error');
        break;
      default:
    }
  }

  handleNewMessage(messageData) {
    console.log('🔍 DEBUG - handleNewMessage details:', {
      messageId: messageData.id,
      conversationId: messageData.conversation_id,
      currentConvId: this.currentConversationId,
      senderId: messageData.sender_id,
      currentUserId: this.currentUser.id,
      content:
        typeof messageData.content === 'string'
          ? `${messageData.content.substring(0, 50)}...`
          : `${JSON.stringify(messageData.content).substring(0, 50)}...`,
      isOwnMessage: messageData.sender_id == this.currentUser.id,
    });

    // Check if message already exists to prevent duplicates
    const existingMessage = document.querySelector(
      `[data-message-id="${messageData.id}"]`
    );
    if (existingMessage) {
      return;
    }

    // Remove temporary message if this is our own message
    if (messageData.sender_id == this.currentUser.id) {
      const tempMessages = document.querySelectorAll('[data-temp-id]');
      tempMessages.forEach((msg) => {
        msg.remove();
      });
    }

    // Add message to current conversation
    if (messageData.conversation_id == this.currentConversationId) {
      this.displayMessage(messageData);
      this.scrollToBottom();

      // Mark as read if not own message
      if (messageData.sender_id != this.currentUser.id) {
        this.markMessageAsRead(messageData.id);
      }
    } else {
      console.log('🔍 DEBUG - Message is for different conversation:', {
        messageConvId: messageData.conversation_id,
        currentConvId: this.currentConversationId,
      });
    }

    // Update conversation list
    this.updateConversationInList(messageData);

    // Show notification if not current conversation
    if (
      messageData.conversation_id != this.currentConversationId &&
      messageData.sender_id != this.currentUser.id
    ) {
      this.showNotification(
        `Neue Nachricht von ${messageData.sender_name}`,
        'info'
      );
    }
  }

  async sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    const scheduling =
      document.getElementById('messageScheduling')?.value || 'immediate';

    console.log('🔍 DEBUG - sendMessage called:', {
      content,
      scheduling,
      currentConversationId: this.currentConversationId,
      pendingFiles: this.pendingFiles.length,
      wsConnected: this.ws?.readyState === WebSocket.OPEN,
    });

    if (
      (!content && this.pendingFiles.length === 0) ||
      !this.currentConversationId
    ) {
      return;
    }

    // Send via HTTP API if files attached or scheduled
    if (this.pendingFiles.length > 0 || scheduling !== 'immediate') {
      try {
        const formData = new FormData();
        formData.append('content', content);
        formData.append('scheduled_delivery', scheduling);

        // Attach files
        this.pendingFiles.forEach((file) => {
          formData.append('attachments', file);
        });

        const response = await fetch(
          `/api/chat/conversations/${this.currentConversationId}/messages`,
          {
            method: 'POST',
            credentials: 'include',
            body: formData,
          }
        );

        if (response.ok) {
          const result = await response.json();
          if (result.scheduled_delivery) {
            this.showNotification(
              `Nachricht für ${this.formatSchedulingTime(scheduling)} geplant`,
              'success'
            );
          } else {
            this.showNotification('Nachricht gesendet', 'success');
          }

          // Clear pending files
          this.pendingFiles = [];
          this.updateFilePreview();
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } catch (error) {
        console.error('❌ Error sending message:', error);
        this.showNotification('Fehler beim Senden der Nachricht', 'error');
      }
    } else {
      // Send via WebSocket for immediate delivery without files
      const messageData = {
        type: 'send_message',
        data: {
          conversationId: this.currentConversationId,
          content,
        },
      };

      if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify(messageData));

          // Show temporary message
          const tempMessage = {
            id: `temp-${Date.now()}`,
            conversation_id: this.currentConversationId,
            content,
            sender_id: this.currentUser.id,
            sender_name:
              this.currentUser.first_name ||
              this.currentUser.last_name ||
              this.currentUser.username ||
              'Unknown',
            first_name: this.currentUser.first_name || '',
            last_name: this.currentUser.last_name || '',
            profile_picture_url: this.currentUser.profile_picture_url || null,
            created_at: new Date().toISOString(),
            delivery_status: 'sending',
            is_read: false,
            attachments: [],
          };

          this.displayMessage(tempMessage);
          this.scrollToBottom();
        } catch (error) {
          console.error('❌ Error sending via WebSocket:', error);
          this.showNotification('Fehler beim Senden der Nachricht', 'error');
        }
      } else {
        // Queue message if not connected

        this.messageQueue.push(messageData);
        this.showNotification(
          'Nachricht wird gesendet, sobald die Verbindung wiederhergestellt ist',
          'warning'
        );
      }
    }

    input.value = '';
    this.resizeTextarea();
  }

  async loadMessages(conversationId) {
    try {
      const response = await fetch(
        `/api/chat/conversations/${conversationId}/messages`,
        {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const messages = await response.json();

        console.log(
          '🔍 DEBUG - First few messages:',
          messages.slice(0, 3).map((m) => ({
            id: m.id,
            content: m.content,
            sender_id: m.sender_id,
            sender_name: m.sender_name,
            username: m.username,
            first_name: m.first_name,
            last_name: m.last_name,
          }))
        );
        this.displayMessages(messages);
        this.scrollToBottom();
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error loading messages:', error);
      this.showNotification('Fehler beim Laden der Nachrichten', 'error');
    }
  }

  displayMessages(messages) {
    const container = document.getElementById('messagesContainer');
    if (!container) {
      console.error('❌ Messages container not found');
      return;
    }

    container.innerHTML = '';
    messages.forEach((message) => {
      this.displayMessage(message);
    });
  }

  displayMessage(message) {
    const container = document.getElementById('messagesContainer');
    if (!container) {
      console.error('❌ Messages container not found');
      return;
    }

    console.log('🔍 DEBUG - Message display details:', {
      messageId: message.id,
      isTemp: message.id?.toString().startsWith('temp-'),
      senderId: message.sender_id,
      currentUserId: this.currentUser.id,
      isOwnMessage: message.sender_id == this.currentUser.id,
      senderName: message.sender_name || message.username,
      content:
        typeof message.content === 'string'
          ? `${message.content.substring(0, 50)}...`
          : `${JSON.stringify(message.content || '').substring(0, 50)}...`,
    });

    const isOwnMessage = message.sender_id == this.currentUser.id;

    // Check if this is a temporary message update
    const tempId =
      typeof message.id === 'string' && message.id.startsWith('temp-')
        ? message.id
        : null;
    const existingMessage = tempId
      ? container.querySelector(`[data-temp-id="${tempId}"]`)
      : null;

    if (existingMessage) {
      existingMessage.remove();
    }

    const messageElement = document.createElement('div');
    messageElement.className = `message ${isOwnMessage ? 'own' : ''}`;

    if (tempId) {
      messageElement.dataset.tempId = message.id;
    } else {
      messageElement.dataset.messageId = message.id;
    }

    const time = new Date(message.created_at).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });

    messageElement.innerHTML = `
      ${
        !isOwnMessage
          ? `
        <img src="${message.profile_picture_url || '/images/default-avatar.svg'}" 
             alt="Avatar" class="message-avatar" onerror="this.src='/images/default-avatar.svg'">
      `
          : ''
      }
      <div class="message-bubble">
        <div class="message-header">
          ${
            !isOwnMessage
              ? `
            <span class="message-sender">${message.sender_name || `${message.first_name || ''} ${message.last_name || ''}`.trim() || message.username || 'Unbekannt'}</span>
          `
              : ''
          }
          <span class="message-time">${time}</span>
          ${message.is_scheduled ? '<span class="scheduled-indicator">📅</span>' : ''}
          ${
            isOwnMessage
              ? `
            <div class="message-actions">
              <button class="message-action" onclick="chatClient.deleteMessage('${message.id}')" title="Löschen">
                <i class="fas fa-trash"></i>
              </button>
              <button class="message-action" onclick="chatClient.archiveMessage('${message.id}')" title="Archivieren">
                <i class="fas fa-archive"></i>
              </button>
            </div>
          `
              : ''
          }
        </div>
        <div class="message-content">${this.formatMessageContent(message.content)}</div>
        ${message.attachments ? this.renderAttachments(message.attachments) : ''}
        ${
          isOwnMessage
            ? `
          <div class="message-status" style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px; text-align: right;">
            ${
              message.delivery_status === 'failed'
                ? '<span style="color: #f44336;">❌ Fehler</span>'
                : message.delivery_status === 'sending'
                  ? '<span style="color: #9e9e9e;">⏳</span>'
                  : message.is_read
                    ? '<span style="color: #2196f3;">✓✓</span>'
                    : message.delivery_status === 'delivered'
                      ? '<span style="color: #9e9e9e;">✓✓</span>'
                      : '<span style="color: #9e9e9e;">✓</span>'
            }
          </div>
        `
            : ''
        }
      </div>
    `;

    container.appendChild(messageElement);

    // Scroll zum neusten Nachrichten
    this.scrollToBottom();
  }

  renderAttachments(attachments) {
    if (!attachments || attachments.length === 0) return '';

    return `
      <div class="message-attachments">
        ${attachments
          .map((attachment) => {
            const isImage =
              attachment.mime_type && attachment.mime_type.startsWith('image/');

            if (isImage) {
              return `
              <div class="attachment image-attachment">
                <img src="/api/chat/attachments/${attachment.filename}" 
                     alt="${attachment.original_filename}"
                     style="max-width: 300px; max-height: 200px; border-radius: 8px; cursor: pointer;"
                     onclick="window.open('/api/chat/attachments/${attachment.filename}', '_blank')"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="attachment-fallback" style="display: none;">
                  <a href="/api/chat/attachments/${attachment.filename}" 
                     download="${attachment.original_filename}" 
                     class="attachment-link">
                    🖼️ ${attachment.original_filename}
                  </a>
                </div>
              </div>
            `;
            } else {
              let icon = '📎';
              if (attachment.mime_type === 'application/pdf') icon = '📄';
              else if (
                attachment.mime_type &&
                attachment.mime_type.includes('word')
              )
                icon = '📝';

              return `
              <div class="attachment">
                <a href="/api/chat/attachments/${attachment.filename}" 
                   download="${attachment.original_filename}" 
                   class="attachment-link"
                   style="display: flex; align-items: center; gap: 8px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; text-decoration: none; color: inherit;">
                  <span style="font-size: 1.5rem;">${icon}</span>
                  <div>
                    <div style="font-weight: 500;">${attachment.original_filename}</div>
                    <div style="font-size: 0.8rem; opacity: 0.7;">${this.formatFileSize(attachment.file_size)}</div>
                  </div>
                </a>
              </div>
            `;
            }
          })
          .join('')}
      </div>
    `;
  }

  formatFileSize(bytes) {
    if (!bytes) return '';
    const kb = bytes / 1024;
    const mb = kb / 1024;
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    if (kb >= 1) return `${kb.toFixed(0)} KB`;
    return `${bytes} B`;
  }

  formatMessageContent(content) {
    if (!content || typeof content !== 'string') {
      return '';
    }

    // Escape HTML to prevent XSS
    const escapeHtml = (text) => {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      };
      return text.replace(/[&<>"']/g, (m) => map[m]);
    };

    // Escape content first
    let formatted = escapeHtml(content);

    // Convert URLs to links
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    formatted = formatted.replace(
      urlRegex,
      '<a href="$1" target="_blank" rel="noopener">$1</a>'
    );

    return formatted;
  }

  renderConversations() {
    const container = document.getElementById('conversationsList');
    if (!container) {
      console.error('❌ Conversations list container not found');
      return;
    }

    container.innerHTML = '';

    this.conversations.forEach((conversation) => {
      const conversationElement = document.createElement('div');
      conversationElement.className = 'conversation-item';
      conversationElement.dataset.conversationId = conversation.id;

      if (conversation.id == this.currentConversationId) {
        conversationElement.classList.add('active');
      }

      const lastMessageTime = conversation.last_message_time
        ? new Date(conversation.last_message_time).toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : '';

      // Avatar für Einzelchats oder Gruppenchats
      let avatarContent = '';
      if (conversation.is_group) {
        avatarContent = `<div style="background: linear-gradient(135deg, #9c27b0, #ba68c8); width: 45px; height: 45px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white;">
          <i class="fas fa-users"></i>
        </div>`;
      } else {
        // Bei Einzelchat: Profilbild des anderen Users anzeigen
        avatarContent = `<img src="${conversation.other_user_picture || conversation.profile_picture_url || '/images/default-avatar.svg'}" 
             alt="Avatar" 
             style="width: 45px; height: 45px; border-radius: 50%; object-fit: cover;"
             onerror="this.src='/images/default-avatar.svg'">
         <span class="status-indicator ${conversation.user_status || 'offline'}" 
               data-user-status="${conversation.other_user_id}"
               style="position: absolute; bottom: 0; right: 0; width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--background-primary); background: ${conversation.user_status === 'online' ? '#4caf50' : '#9e9e9e'};"
               title="${conversation.user_status === 'online' ? 'Online' : 'Offline'}"></span>`;
      }

      conversationElement.innerHTML = `
        <div class="conversation-avatar" style="position: relative;">
          ${avatarContent}
          ${conversation.unread_count > 0 ? `<span class="unread-badge" style="position: absolute; top: -5px; right: -5px; background: #ff4444; color: white; font-size: 0.7rem; padding: 2px 6px; border-radius: 10px; font-weight: bold; min-width: 18px; text-align: center;">${conversation.unread_count > 99 ? '99+' : conversation.unread_count}</span>` : ''}
        </div>
        <div class="conversation-info">
          <div class="conversation-name">
            ${conversation.is_group ? '<i class="fas fa-users" style="font-size: 0.8rem; margin-right: 4px;"></i>' : ''}
            ${conversation.display_name || conversation.name || conversation.username || 'Unbekannt'}
          </div>
          <div class="conversation-last-message">${conversation.last_message || 'Keine Nachrichten'}</div>
        </div>
        <div class="conversation-meta">
          <div class="conversation-time">${lastMessageTime}</div>
        </div>
      `;

      conversationElement.addEventListener('click', () => {
        this.selectConversation(conversation.id);
      });

      container.appendChild(conversationElement);
    });
  }

  async selectConversation(conversationId) {
    // Remove previous selection
    document.querySelectorAll('.conversation-item').forEach((item) => {
      item.classList.remove('active');
    });

    // Mark new selection
    const selectedItem = document.querySelector(
      `[data-conversation-id="${conversationId}"]`
    );
    if (selectedItem) {
      selectedItem.classList.add('active');
    }

    this.currentConversationId = conversationId;

    // Find conversation details
    const conversation = this.conversations.find((c) => c.id == conversationId);
    if (conversation) {
      // Update chat header
      const chatHeader = document.getElementById('chat-header');
      const chatAvatar = document.getElementById('chat-avatar');
      const chatPartnerName = document.getElementById('chat-partner-name');
      const chatPartnerStatus = document.getElementById('chat-partner-status');

      if (chatHeader) chatHeader.style.display = 'flex';
      if (chatPartnerName)
        chatPartnerName.textContent =
          conversation.display_name ||
          conversation.name ||
          conversation.username ||
          'Unbekannt';
      if (chatPartnerStatus) {
        // Bei Einzelchats Rolle anzeigen, bei Gruppenchats "Gruppenchat"
        if (conversation.is_group) {
          chatPartnerStatus.textContent = 'Gruppenchat';
        } else {
          // Rolle des anderen Users anzeigen (z.B. "Administrator", "Mitarbeiter")
          const roleText =
            conversation.other_user_role ||
            conversation.user_role ||
            'employee';
          const roleMap = {
            admin: 'Administrator',
            employee: 'Mitarbeiter',
            root: 'Root-Admin',
          };
          chatPartnerStatus.textContent = roleMap[roleText] || 'Benutzer';
        }
      }

      if (chatAvatar) {
        if (conversation.is_group) {
          chatAvatar.innerHTML = '<i class="fas fa-users"></i>';
          chatAvatar.style.background =
            'linear-gradient(135deg, #9c27b0, #ba68c8)';
          chatAvatar.style.backgroundImage = 'none';
        } else {
          // Bei Einzelchat: Profilbild des anderen Users
          if (
            conversation.other_user_picture ||
            conversation.profile_picture_url
          ) {
            chatAvatar.innerHTML = `<img src="${conversation.other_user_picture || conversation.profile_picture_url || '/images/default-avatar.svg'}" 
                                        alt="Avatar" 
                                        style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;"
                                        onerror="this.src='/images/default-avatar.svg'">`;
            chatAvatar.style.background = 'none';
          } else {
            // Fallback zu Initialen
            const initials = (conversation.display_name || 'U')
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase();
            chatAvatar.textContent = initials;
            chatAvatar.style.background =
              'linear-gradient(135deg, var(--primary-color), var(--primary-light))';
          }
        }
      }
    }

    // Join conversation
    this.joinConversation(conversationId);

    // Load messages
    await this.loadMessages(conversationId);

    // Show chat area
    const chatArea = document.getElementById('chatArea');
    const noChatSelected = document.getElementById('noChatSelected');

    if (chatArea) chatArea.style.display = 'block';
    if (noChatSelected) noChatSelected.style.display = 'none';
  }

  joinConversation(conversationId) {
    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'join_conversation',
          data: { conversationId },
        })
      );
    } else {
      // No conversation selected - nothing to do
    }
  }

  showNewConversationModal() {
    const modal = document.getElementById('newConversationModal');
    const usersList = document.getElementById('availableUsersList');
    const groupChatOptions = document.getElementById('groupChatOptions');
    const groupChatName = document.getElementById('groupChatName');

    if (!modal || !usersList) {
      console.error('❌ Modal elements not found');
      return;
    }

    // Reset modal state
    if (groupChatName) groupChatName.value = '';
    if (groupChatOptions) groupChatOptions.style.display = 'none';

    // Show available users
    usersList.innerHTML = '';
    this.availableUsers.forEach((user) => {
      const userElement = document.createElement('div');
      userElement.className = 'available-user';
      const userName =
        `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
        user.username ||
        'Unbekannter Benutzer';

      userElement.innerHTML = `
        <input type="checkbox" id="user_${user.id}" value="${user.id}" class="user-checkbox">
        <label for="user_${user.id}" style="display: flex; align-items: center; gap: 8px; flex: 1;">
          <div style="position: relative;">
            <img src="${user.profile_picture_url || '/images/default-avatar.svg'}" alt="Avatar" onerror="this.src='/images/default-avatar.svg'">
            <span class="status-indicator ${user.online_status || 'offline'}" 
                  data-user-status="${user.id}"
                  style="position: absolute; bottom: 0; right: 0; width: 12px; height: 12px; border-radius: 50%; border: 2px solid #1a1a2e; background: ${user.online_status === 'online' ? '#4caf50' : '#9e9e9e'};"
                  title="${user.online_status === 'online' ? 'Online' : 'Offline'}"></span>
          </div>
          ${userName} <span class="user-role">(${user.role})</span>
        </label>
      `;
      usersList.appendChild(userElement);
    });

    // Event listener for checkbox changes
    usersList.addEventListener('change', (e) => {
      if (e.target.classList.contains('user-checkbox')) {
        const checkedCount = usersList.querySelectorAll(
          '.user-checkbox:checked'
        ).length;
        if (groupChatOptions) {
          groupChatOptions.style.display = checkedCount > 1 ? 'block' : 'none';
        }
      }
    });

    modal.style.display = 'flex';
  }

  async createNewConversation() {
    const selectedUsers = Array.from(
      document.querySelectorAll('#availableUsersList input:checked')
    ).map((input) => parseInt(input.value));

    if (selectedUsers.length === 0) {
      this.showNotification(
        'Bitte mindestens einen Benutzer auswählen',
        'warning'
      );
      return;
    }

    const isGroup = selectedUsers.length > 1;
    const groupNameInput = document.getElementById('groupChatName');
    const groupName =
      isGroup && groupNameInput ? groupNameInput.value.trim() : null;

    try {
      const response = await fetch('/api/chat/conversations', {
        method: 'POST',
        credentials: 'include',
        headers: {
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
          isGroup
            ? 'Gruppenchat erfolgreich erstellt'
            : 'Unterhaltung erfolgreich erstellt',
          'success'
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

  initializeEventListeners() {
    // Message input
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
      // Enter key to send
      messageInput.addEventListener('keypress', (e) => {
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

    // File upload handler
    const fileInput = document.getElementById('fileInput');
    const attachmentBtn = document.getElementById('attachmentBtn');

    if (attachmentBtn && fileInput) {
      attachmentBtn.addEventListener('click', (e) => {
        e.preventDefault();
        fileInput.click();
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', async (event) => {
        const files = event.target.files;
        if (files.length > 0) {
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
    const emojiCategories = document.querySelectorAll('.emoji-category');
    emojiCategories.forEach((category) => {
      category.addEventListener('click', (e) => {
        const categoryName = e.target.dataset.category;
        this.showEmojiCategory(categoryName);

        // Update active state
        document
          .querySelectorAll('.emoji-category')
          .forEach((cat) => cat.classList.remove('active'));
        e.target.classList.add('active');
      });
    });

    // Click outside to close emoji picker
    document.addEventListener('click', (e) => {
      const emojiPicker = document.getElementById('emojiPicker');
      const emojiBtn = document.getElementById('emojiBtn');
      if (
        emojiPicker &&
        !emojiPicker.contains(e.target) &&
        e.target !== emojiBtn &&
        !emojiBtn.contains(e.target)
      ) {
        emojiPicker.style.display = 'none';
      }
    });

    // Search functionality
    const searchBtn = document.querySelector(
      '.chat-action-btn[title="Suchen"]'
    );
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        this.toggleSearch();
      });
    }

    // Delete conversation button
    const deleteConvBtn = document.getElementById('deleteConversationBtn');
    if (deleteConvBtn) {
      deleteConvBtn.addEventListener('click', () => {
        this.deleteCurrentConversation();
      });
    }

    // Periodic connection check
    setInterval(() => {
      if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: 'ping',
            data: { timestamp: new Date().toISOString() },
          })
        );
      }
    }, 30000); // Every 30 seconds
  }

  handleTyping() {
    if (!this.currentConversationId || !this.isConnected) return;

    // Send typing start
    this.ws.send(
      JSON.stringify({
        type: 'typing_start',
        data: { conversationId: this.currentConversationId },
      })
    );

    // Timer for typing stop
    clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => {
      if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: 'typing_stop',
            data: { conversationId: this.currentConversationId },
          })
        );
      }
    }, 2000);
  }

  markMessageAsRead(messageId) {
    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'mark_read',
          data: { messageId },
        })
      );
    }
  }

  resizeTextarea() {
    const textarea = document.getElementById('messageInput');
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }

  scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  updateConnectionStatus(connected) {
    const indicator = document.getElementById('connectionStatus');
    if (indicator) {
      indicator.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
      indicator.textContent = connected ? 'Verbunden' : 'Getrennt';
    }
  }

  formatSchedulingTime(scheduling) {
    switch (scheduling) {
      case 'break_time':
        return 'Pausenzeit (12:00)';
      case 'after_work':
        return 'Feierabend (17:00)';
      default:
        return 'sofort';
    }
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : type === 'success' ? '#4caf50' : '#2196f3'};
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 9999;
      animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
    }
  }

  startTypingTimer() {
    // Placeholder for typing timer initialization
  }

  updateConversationInList(messageData) {
    // Update conversation in list
    const conversation = this.conversations.find(
      (c) => c.id == messageData.conversation_id
    );
    if (conversation) {
      conversation.last_message = messageData.content;
      conversation.last_message_time = messageData.created_at;
      if (
        messageData.sender_id != this.currentUser.id &&
        messageData.conversation_id != this.currentConversationId
      ) {
        conversation.unread_count = (conversation.unread_count || 0) + 1;
      }
      this.renderConversations();
    }
  }

  showTypingIndicator(data) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;

    const existingIndicator = document.getElementById(`typing-${data.userId}`);

    if (
      !existingIndicator &&
      data.conversationId == this.currentConversationId
    ) {
      const indicator = document.createElement('div');
      indicator.id = `typing-${data.userId}`;
      indicator.className = 'typing-indicator';
      indicator.innerHTML = `
        <div class="typing-dots">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
        <span style="margin-left: 8px; color: var(--text-secondary); font-size: 0.85rem;">${data.userName || 'Jemand'} schreibt...</span>
      `;
      container.appendChild(indicator);
      this.scrollToBottom();
    }
  }

  hideTypingIndicator(data) {
    const indicator = document.getElementById(`typing-${data.userId}`);
    if (indicator) {
      indicator.remove();
    }
  }

  handleMessageRead(data) {
    const messageElement = document.querySelector(
      `[data-message-id="${data.messageId}"]`
    );
    if (messageElement) {
      const statusElement = messageElement.querySelector('.message-status');
      if (statusElement) {
        statusElement.innerHTML = '<span style="color: #2196f3;">✓✓</span>';
      }
    }
  }

  handleUserStatusChange(data) {
    // Update user status in availableUsers
    const user = this.availableUsers.find((u) => u.id === data.userId);
    if (user) {
      user.online_status = data.status;
    }

    // Update status indicator in conversation list
    const statusIndicators = document.querySelectorAll(
      `[data-user-status="${data.userId}"]`
    );
    statusIndicators.forEach((indicator) => {
      indicator.className = `status-indicator ${data.status}`;
      indicator.style.background =
        data.status === 'online' ? '#4caf50' : '#9e9e9e';
      indicator.title = data.status === 'online' ? 'Online' : 'Offline';
    });
  }

  handleScheduledMessageDelivered(messageData) {
    if (messageData.conversation_id == this.currentConversationId) {
      this.displayMessage(messageData);
      this.scrollToBottom();
    }
    this.updateConversationInList(messageData);
  }

  async deleteMessage(messageId) {
    if (!confirm('Möchten Sie diese Nachricht wirklich löschen?')) return;

    try {
      const response = await fetch(`/api/chat/messages/${messageId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        const messageElement = document.querySelector(
          `[data-message-id="${messageId}"]`
        );
        if (messageElement) {
          messageElement.style.opacity = '0';
          setTimeout(() => messageElement.remove(), 300);
        }
        this.showNotification('Nachricht gelöscht', 'success');
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error deleting message:', error);
      this.showNotification('Fehler beim Löschen der Nachricht', 'error');
    }
  }

  async archiveMessage(messageId) {
    try {
      const response = await fetch(`/api/chat/messages/${messageId}/archive`, {
        method: 'PUT',
        credentials: 'include',
      });

      if (response.ok) {
        const messageElement = document.querySelector(
          `[data-message-id="${messageId}"]`
        );
        if (messageElement) {
          messageElement.style.opacity = '0.5';
          messageElement.classList.add('archived');
        }
        this.showNotification('Nachricht archiviert', 'success');
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error archiving message:', error);
      this.showNotification('Fehler beim Archivieren der Nachricht', 'error');
    }
  }

  handleFileUpload(files) {
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    for (const file of files) {
      // Check size
      if (file.size > maxFileSize) {
        this.showNotification(
          `Datei ${file.name} ist zu groß (max. 10MB)`,
          'error'
        );
        continue;
      }

      // Check type
      if (!allowedTypes.includes(file.type)) {
        this.showNotification(`Dateityp ${file.type} nicht erlaubt`, 'error');
        continue;
      }

      // Add to pending files
      this.pendingFiles.push(file);
    }

    // Update preview
    this.updateFilePreview();
  }

  updateFilePreview() {
    // Remove old preview
    const existingPreview = document.getElementById('file-preview');
    if (existingPreview) {
      existingPreview.remove();
    }

    if (this.pendingFiles.length === 0) return;

    // Create new preview
    const previewContainer = document.createElement('div');
    previewContainer.id = 'file-preview';
    previewContainer.className = 'file-preview-container';
    previewContainer.style.cssText = `
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 8px;
      margin-bottom: 8px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    `;

    this.pendingFiles.forEach((file, index) => {
      const filePreview = document.createElement('div');
      filePreview.className = 'file-preview-item';
      filePreview.style.cssText = `
        background: rgba(33, 150, 243, 0.1);
        border: 1px solid rgba(33, 150, 243, 0.3);
        border-radius: 4px;
        padding: 4px 8px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.85rem;
      `;

      // Icon based on file type
      let icon = '📎';
      if (file.type.startsWith('image/')) icon = '🖼️';
      else if (file.type === 'application/pdf') icon = '📄';
      else if (file.type.includes('word')) icon = '📝';

      filePreview.innerHTML = `
        <span>${icon}</span>
        <span>${file.name}</span>
        <button onclick="chatClient.removeFile(${index})" style="
          background: none;
          border: none;
          color: #f44336;
          cursor: pointer;
          padding: 2px;
          font-size: 1rem;
        ">&times;</button>
      `;

      previewContainer.appendChild(filePreview);
    });

    // Insert preview above input area
    const inputContainer = document.querySelector('.message-input-container');
    const inputWrapper = document.querySelector('.message-input-wrapper');
    if (inputContainer && inputWrapper) {
      inputContainer.insertBefore(previewContainer, inputWrapper);
    }
  }

  removeFile(index) {
    this.pendingFiles.splice(index, 1);
    this.updateFilePreview();
  }

  handleMessageSent(data) {
    // Update temporary message with real message ID
    const tempMessages = document.querySelectorAll('[data-temp-id]');

    if (tempMessages.length > 0) {
      const messageElement = tempMessages[0];
      messageElement.dataset.messageId = data.messageId;
      delete messageElement.dataset.tempId;

      const statusElement = messageElement.querySelector('.message-status');
      if (statusElement) {
        statusElement.innerHTML = '<span style="color: #9e9e9e;">✓</span>';
      }
    }
  }

  handleMessageDelivered(data) {
    // Update message status to delivered
    const messageElement = document.querySelector(
      `[data-message-id="${data.messageId}"]`
    );
    if (messageElement) {
      const statusElement = messageElement.querySelector('.message-status');
      if (statusElement) {
        statusElement.innerHTML = '<span style="color: #9e9e9e;">✓✓</span>';
      }
    }
  }

  toggleEmojiPicker() {
    const emojiPicker = document.getElementById('emojiPicker');
    if (!emojiPicker) return;

    if (emojiPicker.style.display === 'none' || !emojiPicker.style.display) {
      emojiPicker.style.display = 'flex';
      this.showEmojiCategory('smileys');
    } else {
      emojiPicker.style.display = 'none';
    }
  }

  showEmojiCategory(category) {
    const emojiContent = document.getElementById('emojiContent');
    if (!emojiContent) return;

    const emojis = this.emojiCategories[category] || [];

    emojiContent.innerHTML = '';
    emojis.forEach((emoji) => {
      const emojiItem = document.createElement('div');
      emojiItem.className = 'emoji-item';
      emojiItem.textContent = emoji;
      emojiItem.addEventListener('click', () => {
        this.insertEmoji(emoji);
      });
      emojiContent.appendChild(emojiItem);
    });
  }

  insertEmoji(emoji) {
    const messageInput = document.getElementById('messageInput');
    if (!messageInput) return;

    const cursorPos = messageInput.selectionStart;
    const textBefore = messageInput.value.substring(0, cursorPos);
    const textAfter = messageInput.value.substring(cursorPos);

    messageInput.value = textBefore + emoji + textAfter;
    messageInput.focus();
    messageInput.setSelectionRange(
      cursorPos + emoji.length,
      cursorPos + emoji.length
    );

    this.resizeTextarea();
  }

  toggleSearch() {
    const searchContainer = document.querySelector('.chat-search');
    if (!searchContainer) {
      // Create search container
      const chatHeader = document.getElementById('chat-header');
      const searchDiv = document.createElement('div');
      searchDiv.className = 'chat-search';
      searchDiv.innerHTML = `
        <div class="search-input-wrapper">
          <input type="text" class="search-input" id="searchInput" placeholder="Nachrichten durchsuchen...">
          <button class="search-close" onclick="chatClient.closeSearch()" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-secondary); cursor: pointer;">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="search-results" id="searchResults"></div>
      `;
      chatHeader.parentNode.insertBefore(searchDiv, chatHeader.nextSibling);

      // Add search event listener
      const searchInput = document.getElementById('searchInput');
      searchInput.addEventListener('input', (e) => {
        this.searchMessages(e.target.value);
      });
      searchInput.focus();
    } else {
      searchContainer.style.display =
        searchContainer.style.display === 'none' ? 'block' : 'none';
      if (searchContainer.style.display === 'block') {
        document.getElementById('searchInput').focus();
      }
    }
  }

  closeSearch() {
    const searchContainer = document.querySelector('.chat-search');
    if (searchContainer) {
      searchContainer.style.display = 'none';
    }
  }

  async searchMessages(query) {
    if (!query || query.length < 2) {
      const resultsContainer = document.getElementById('searchResults');
      if (resultsContainer) {
        resultsContainer.innerHTML = '';
      }
      return;
    }

    try {
      const response = await fetch(
        `/api/chat/conversations/${this.currentConversationId}/search?q=${encodeURIComponent(query)}`,
        {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const results = await response.json();
        this.displaySearchResults(results);
      }
    } catch (error) {
      console.error('❌ Error searching:', error);
    }
  }

  displaySearchResults(results) {
    const resultsContainer = document.getElementById('searchResults');
    if (!resultsContainer) return;

    if (!results || results.length === 0) {
      resultsContainer.innerHTML =
        '<div style="padding: 10px; color: var(--text-secondary);">Keine Ergebnisse gefunden</div>';
      return;
    }

    resultsContainer.innerHTML = results
      .map(
        (result) => `
      <div class="search-result-item" onclick="chatClient.scrollToMessage(${result.id})">
        <div style="font-weight: 500;">${result.sender_name}</div>
        <div style="font-size: 0.85rem; color: var(--text-secondary);">${result.content}</div>
        <div style="font-size: 0.75rem; color: var(--text-secondary);">${new Date(result.created_at).toLocaleString('de-DE')}</div>
      </div>
    `
      )
      .join('');
  }

  scrollToMessage(messageId) {
    const messageElement = document.querySelector(
      `[data-message-id="${messageId}"]`
    );
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      messageElement.style.animation = 'highlight 2s ease';
      setTimeout(() => {
        messageElement.style.animation = '';
      }, 2000);
    }
    this.closeSearch();
  }

  async addReaction(messageId, emoji) {
    try {
      const response = await fetch(
        `/api/chat/messages/${messageId}/reactions`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ emoji }),
        }
      );

      if (response.ok) {
        // Reaction added successfully - UI already updated optimistically
      }
    } catch (error) {
      console.error('❌ Error adding reaction:', error);
    }
  }

  async deleteCurrentConversation() {
    if (!this.currentConversationId) {
      this.showNotification('Keine Unterhaltung ausgewählt', 'warning');
      return;
    }

    if (
      !confirm(
        'Möchten Sie diese Unterhaltung wirklich löschen? Alle Nachrichten werden unwiderruflich gelöscht.'
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `/api/chat/conversations/${this.currentConversationId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      if (response.ok) {
        this.showNotification('Unterhaltung gelöscht', 'success');

        // Remove from conversations list
        this.conversations = this.conversations.filter(
          (c) => c.id !== this.currentConversationId
        );
        this.currentConversationId = null;

        // Update UI
        this.renderConversations();
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
          messagesContainer.innerHTML = `
            <div class="empty-chat" id="noChatSelected">
              <div class="empty-chat-icon">
                <i class="fas fa-comments"></i>
              </div>
              <h3>Willkommen im Chat</h3>
              <p>Wählen Sie eine Unterhaltung aus der Liste oder starten Sie eine neue Nachricht.</p>
            </div>
          `;
        }

        const chatArea = document.getElementById('chatArea');
        const chatHeader = document.getElementById('chat-header');
        if (chatArea) chatArea.style.display = 'none';
        if (chatHeader) chatHeader.style.display = 'none';
      } else {
        const error = await response.json();
        this.showNotification(
          error.message || 'Fehler beim Löschen der Unterhaltung',
          'error'
        );
      }
    } catch (error) {
      console.error('❌ Error deleting conversation:', error);
      this.showNotification('Fehler beim Löschen der Unterhaltung', 'error');
    }
  }
}

// Initialize chat client when page loads
document.addEventListener('DOMContentLoaded', () => {
  window.chatClient = new ChatClient();

  // Add CSS for animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes highlight {
      0% { background-color: rgba(33, 150, 243, 0.3); }
      100% { background-color: transparent; }
    }
    
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
    
    .typing-dots {
      display: inline-flex;
      gap: 4px;
    }
    
    .typing-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--text-secondary);
      animation: typingDot 1.5s infinite;
    }
    
    .typing-dot:nth-child(2) {
      animation-delay: 0.2s;
    }
    
    .typing-dot:nth-child(3) {
      animation-delay: 0.4s;
    }
    
    @keyframes typingDot {
      0%, 60%, 100% {
        opacity: 0.3;
      }
      30% {
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
});
