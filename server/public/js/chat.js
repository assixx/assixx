class ChatClient {
  constructor() {
    this.ws = null;
    this.token = localStorage.getItem('token');
    this.currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    this.currentConversationId = null;
    this.conversations = [];
    this.availableUsers = [];
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    
    this.init();
  }

  async init() {
    await this.loadInitialData();
    this.connectWebSocket();
    this.initializeEventListeners();
    this.startTypingTimer();
  }

  async loadInitialData() {
    try {
      // Lade Unterhaltungen
      const response = await fetch('/api/chat/conversations', {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        this.conversations = await response.json();
        this.renderConversations();
      }

      // Lade verfügbare Benutzer
      const usersResponse = await fetch('/api/chat/users', {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (usersResponse.ok) {
        this.availableUsers = await usersResponse.json();
      }

    } catch (error) {
      console.error('Fehler beim Laden der initialen Daten:', error);
      this.showNotification('Fehler beim Laden der Chat-Daten', 'error');
    }
  }

  connectWebSocket() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/chat-ws?token=${this.token}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket-Verbindung hergestellt');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.updateConnectionStatus(true);
        
        // Aktuelle Unterhaltung wieder beitreten
        if (this.currentConversationId) {
          this.joinConversation(this.currentConversationId);
        }
      };

      this.ws.onmessage = (event) => {
        this.handleWebSocketMessage(JSON.parse(event.data));
      };

      this.ws.onclose = () => {
        console.log('WebSocket-Verbindung getrennt');
        this.isConnected = false;
        this.updateConnectionStatus(false);
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket-Fehler:', error);
        this.updateConnectionStatus(false);
      };

    } catch (error) {
      console.error('Fehler beim Verbinden des WebSocket:', error);
      this.attemptReconnect();
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      console.log(`Verbindungsversuch ${this.reconnectAttempts} in ${delay}ms`);
      
      setTimeout(() => {
        this.connectWebSocket();
      }, delay);
    } else {
      this.showNotification('Verbindung zum Chat-Server verloren. Bitte Seite neu laden.', 'error');
    }
  }

  handleWebSocketMessage(message) {
    switch (message.type) {
      case 'connection_established':
        console.log('Chat-Verbindung bestätigt');
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
      case 'error':
        this.showNotification(message.data.message, 'error');
        break;
      default:
        console.log('Unbekannte WebSocket-Nachricht:', message);
    }
  }

  handleNewMessage(messageData) {
    // Nachricht zur aktuellen Unterhaltung hinzufügen
    if (messageData.conversation_id == this.currentConversationId) {
      this.displayMessage(messageData);
      this.scrollToBottom();
      
      // Nachricht als gelesen markieren
      this.markMessageAsRead(messageData.id);
    }

    // Unterhaltungsliste aktualisieren
    this.updateConversationInList(messageData);
    
    // Benachrichtigung anzeigen wenn nicht aktuelle Unterhaltung
    if (messageData.conversation_id != this.currentConversationId && 
        messageData.sender_id != this.currentUser.id) {
      this.showNotification(`Neue Nachricht von ${messageData.sender_name}`, 'info');
    }
  }

  async sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    const scheduling = document.getElementById('messageScheduling').value;
    
    if (!content || !this.currentConversationId) return;

    const messageData = {
      type: 'send_message',
      data: {
        conversationId: this.currentConversationId,
        content: content,
        scheduled_delivery: scheduling
      }
    };

    // Über WebSocket senden für sofortige Zustellung
    if (scheduling === 'immediate' && this.isConnected) {
      this.ws.send(JSON.stringify(messageData));
    } else {
      // Über HTTP API für geplante Nachrichten
      try {
        const response = await fetch(`/api/chat/conversations/${this.currentConversationId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            content: content,
            scheduled_delivery: scheduling
          })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.scheduled_delivery) {
            this.showNotification(`Nachricht für ${this.formatSchedulingTime(scheduling)} geplant`, 'success');
          }
        }
      } catch (error) {
        console.error('Fehler beim Senden der Nachricht:', error);
        this.showNotification('Fehler beim Senden der Nachricht', 'error');
      }
    }

    input.value = '';
    this.resizeTextarea();
  }

  async loadMessages(conversationId) {
    try {
      const response = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const messages = await response.json();
        this.displayMessages(messages);
        this.scrollToBottom();
      }
    } catch (error) {
      console.error('Fehler beim Laden der Nachrichten:', error);
      this.showNotification('Fehler beim Laden der Nachrichten', 'error');
    }
  }

  displayMessages(messages) {
    const container = document.getElementById('messagesContainer');
    container.innerHTML = '';
    
    messages.forEach(message => {
      this.displayMessage(message);
    });
  }

  displayMessage(message) {
    const container = document.getElementById('messagesContainer');
    const isOwnMessage = message.sender_id == this.currentUser.id;
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isOwnMessage ? 'own-message' : 'other-message'}`;
    messageElement.dataset.messageId = message.id;
    
    const time = new Date(message.created_at).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });

    messageElement.innerHTML = `
      <div class="message-header">
        ${!isOwnMessage ? `
          <img src="${message.profile_picture_url || '/images/default-avatar.svg'}" 
               alt="Avatar" class="message-avatar">
          <span class="message-sender">${message.first_name} ${message.last_name}</span>
        ` : ''}
        <span class="message-time">${time}</span>
        ${message.is_scheduled ? '<span class="scheduled-indicator">📅</span>' : ''}
        ${isOwnMessage ? `
          <div class="message-actions">
            <button class="message-action" onclick="chatClient.deleteMessage(${message.id})" title="Löschen">
              <i class="fas fa-trash"></i>
            </button>
            <button class="message-action" onclick="chatClient.archiveMessage(${message.id})" title="Archivieren">
              <i class="fas fa-archive"></i>
            </button>
          </div>
        ` : ''}
      </div>
      <div class="message-content">${this.formatMessageContent(message.content)}</div>
      ${message.attachments ? this.renderAttachments(message.attachments) : ''}
      <div class="message-status">
        ${isOwnMessage ? (message.is_read ? '✓✓' : '✓') : ''}
      </div>
    `;
    
    container.appendChild(messageElement);
  }

  renderAttachments(attachments) {
    if (!attachments || attachments.length === 0) return '';
    
    return `
      <div class="message-attachments">
        ${attachments.map(attachment => `
          <div class="attachment">
            <a href="/api/chat/attachments/${attachment.filename}" 
               download="${attachment.original_filename}" 
               class="attachment-link">
              📎 ${attachment.original_filename}
            </a>
          </div>
        `).join('')}
      </div>
    `;
  }

  formatMessageContent(content) {
    // Sicherheitscheck für content
    if (!content || typeof content !== 'string') {
      return '';
    }
    
    // Einfache URL-Erkennung und Verlinkung
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return content.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  }

  renderConversations() {
    const container = document.getElementById('conversationsList');
    container.innerHTML = '';

    this.conversations.forEach(conversation => {
      const conversationElement = document.createElement('div');
      conversationElement.className = 'conversation-item';
      conversationElement.dataset.conversationId = conversation.id;
      
      if (conversation.id == this.currentConversationId) {
        conversationElement.classList.add('active');
      }

      const lastMessageTime = conversation.last_message_time ? 
        new Date(conversation.last_message_time).toLocaleTimeString('de-DE', {
          hour: '2-digit',
          minute: '2-digit'
        }) : '';

      conversationElement.innerHTML = `
        <div class="conversation-avatar">
          <img src="${conversation.profile_picture_url || '/images/default-avatar.svg'}" 
               alt="Avatar">
          ${conversation.unread_count > 0 ? `<span class="unread-badge">${conversation.unread_count}</span>` : ''}
        </div>
        <div class="conversation-info">
          <div class="conversation-name">${conversation.display_name}</div>
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
    // Vorherige Auswahl entfernen
    document.querySelectorAll('.conversation-item').forEach(item => {
      item.classList.remove('active');
    });

    // Neue Auswahl markieren
    const selectedItem = document.querySelector(`[data-conversation-id="${conversationId}"]`);
    if (selectedItem) {
      selectedItem.classList.add('active');
    }

    this.currentConversationId = conversationId;
    
    // Unterhaltung beitreten
    this.joinConversation(conversationId);
    
    // Nachrichten laden
    await this.loadMessages(conversationId);
    
    // Chat-Bereich anzeigen
    const chatArea = document.getElementById('chatArea');
    const noChatSelected = document.getElementById('noChatSelected');
    
    if (chatArea) chatArea.style.display = 'flex';
    if (noChatSelected) noChatSelected.style.display = 'none';
  }

  joinConversation(conversationId) {
    if (this.isConnected) {
      this.ws.send(JSON.stringify({
        type: 'join_conversation',
        data: { conversationId }
      }));
    }
  }

  showNewConversationModal() {
    console.log('📋 showNewConversationModal aufgerufen');
    
    const modal = document.getElementById('newConversationModal');
    const usersList = document.getElementById('availableUsersList');
    
    console.log('Modal Element gefunden:', !!modal);
    console.log('UsersList Element gefunden:', !!usersList);
    console.log('Verfügbare Benutzer:', this.availableUsers.length);
    
    if (!modal) {
      console.error('❌ Modal nicht gefunden!');
      return;
    }
    
    if (!usersList) {
      console.error('❌ UsersList nicht gefunden!');
      return;
    }
    
    // Verfügbare Benutzer anzeigen
    usersList.innerHTML = '';
    this.availableUsers.forEach(user => {
      const userElement = document.createElement('div');
      userElement.className = 'available-user';
      const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'Unbekannter Benutzer';
      
      userElement.innerHTML = `
        <input type="checkbox" id="user_${user.id}" value="${user.id}">
        <label for="user_${user.id}">
          <img src="${user.profile_picture_url || '/images/default-avatar.svg'}" alt="Avatar" onerror="this.src='/images/default-avatar.svg'">
          ${userName} <span class="user-role">(${user.role})</span>
        </label>
      `;
      usersList.appendChild(userElement);
    });

    console.log('👥 Benutzer hinzugefügt, Modal wird angezeigt...');
    modal.style.display = 'block';
    console.log('✅ Modal angezeigt');
  }

  async createNewConversation() {
    const selectedUsers = Array.from(document.querySelectorAll('#availableUsersList input:checked'))
      .map(input => parseInt(input.value));

    if (selectedUsers.length === 0) {
      this.showNotification('Bitte mindestens einen Benutzer auswählen', 'warning');
      return;
    }

    try {
      const response = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          participant_ids: selectedUsers,
          is_group: selectedUsers.length > 1
        })
      });

      if (response.ok) {
        const result = await response.json();
        this.showNotification('Unterhaltung erfolgreich erstellt', 'success');
        this.closeModal('newConversationModal');
        
        // Unterhaltungen neu laden
        await this.loadInitialData();
        
        // Neue Unterhaltung auswählen
        this.selectConversation(result.id);
      }
    } catch (error) {
      console.error('Fehler beim Erstellen der Unterhaltung:', error);
      this.showNotification('Fehler beim Erstellen der Unterhaltung', 'error');
    }
  }

  initializeEventListeners() {
    // Nur Event-Listener für Message-Input (andere werden in HTML hinzugefügt)
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
      // Enter-Taste zum Senden
      messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });

      // Typing-Indikator
      messageInput.addEventListener('input', () => {
        this.handleTyping();
        this.resizeTextarea();
      });
    }

    // File-Upload Handler nur falls vorhanden
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
      fileInput.addEventListener('change', (event) => {
        const files = event.target.files;
        if (files.length > 0) {
          console.log('📎 Dateien ausgewählt:', files);
          // TODO: File upload implementieren
        }
      });
    }
  }

  handleTyping() {
    if (!this.currentConversationId || !this.isConnected) return;

    // Typing-Start senden
    this.ws.send(JSON.stringify({
      type: 'typing_start',
      data: { conversationId: this.currentConversationId }
    }));

    // Timer für Typing-Stop
    clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => {
      this.ws.send(JSON.stringify({
        type: 'typing_stop',
        data: { conversationId: this.currentConversationId }
      }));
    }, 2000);
  }

  markMessageAsRead(messageId) {
    if (this.isConnected) {
      this.ws.send(JSON.stringify({
        type: 'mark_read',
        data: { messageId }
      }));
    }
  }

  resizeTextarea() {
    const textarea = document.getElementById('messageInput');
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    container.scrollTop = container.scrollHeight;
  }

  updateConnectionStatus(connected) {
    const indicator = document.getElementById('connectionStatus');
    if (indicator) {
      indicator.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
      indicator.textContent = connected ? 'Verbunden' : 'Getrennt';
    }
    console.log(`WebSocket Status: ${connected ? 'Verbunden' : 'Getrennt'}`);
  }

  formatSchedulingTime(scheduling) {
    switch (scheduling) {
      case 'break_time': return 'Pausenzeit (12:00)';
      case 'after_work': return 'Feierabend (17:00)';
      default: return 'sofort';
    }
  }

  showNotification(message, type = 'info') {
    // Einfache Benachrichtigung - kann später durch Toast-System ersetzt werden
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }

  closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
  }

  startTypingTimer() {
    // Placeholder für Typing-Timer-Initialisierung
  }

  updateConversationInList(messageData) {
    // Unterhaltung in der Liste aktualisieren
    const conversation = this.conversations.find(c => c.id == messageData.conversation_id);
    if (conversation) {
      conversation.last_message = messageData.content;
      conversation.last_message_time = messageData.created_at;
      if (messageData.sender_id != this.currentUser.id) {
        conversation.unread_count = (conversation.unread_count || 0) + 1;
      }
      this.renderConversations();
    }
  }

  showTypingIndicator(data) {
    // Typing-Indikator anzeigen
    const container = document.getElementById('messagesContainer');
    const existingIndicator = document.getElementById(`typing-${data.userId}`);
    
    if (!existingIndicator && data.conversationId == this.currentConversationId) {
      const indicator = document.createElement('div');
      indicator.id = `typing-${data.userId}`;
      indicator.className = 'typing-indicator';
      indicator.innerHTML = '<span>Schreibt...</span>';
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
    const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (messageElement) {
      const statusElement = messageElement.querySelector('.message-status');
      if (statusElement) {
        statusElement.innerHTML = '✓✓';
      }
    }
  }

  handleUserStatusChange(data) {
    // Benutzer-Status in der UI aktualisieren
    console.log(`Benutzer ${data.userId} ist jetzt ${data.status}`);
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
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      
      if (response.ok) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
          messageElement.style.opacity = '0';
          setTimeout(() => messageElement.remove(), 300);
        }
        this.showNotification('Nachricht gelöscht', 'success');
      }
    } catch (error) {
      console.error('Fehler beim Löschen der Nachricht:', error);
      this.showNotification('Fehler beim Löschen der Nachricht', 'error');
    }
  }

  async archiveMessage(messageId) {
    try {
      const response = await fetch(`/api/chat/messages/${messageId}/archive`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      
      if (response.ok) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
          messageElement.style.opacity = '0.5';
          messageElement.classList.add('archived');
        }
        this.showNotification('Nachricht archiviert', 'success');
      }
    } catch (error) {
      console.error('Fehler beim Archivieren der Nachricht:', error);
      this.showNotification('Fehler beim Archivieren der Nachricht', 'error');
    }
  }
}

// Chat-Client initialisieren wenn Seite geladen ist
document.addEventListener('DOMContentLoaded', () => {
  window.chatClient = new ChatClient();
});