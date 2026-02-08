// =============================================================================
// CHAT PAGE - CONSTANTS
// =============================================================================

/**
 * WebSocket configuration
 */
export const WEBSOCKET_CONFIG = {
  /** Maximum reconnection attempts before giving up */
  maxReconnectAttempts: 5,
  /** Base delay between reconnection attempts (ms) */
  reconnectDelay: 3000,
  /** Interval for sending ping messages (ms) */
  pingInterval: 30000,
  /** Timeout for typing indicator (ms) */
  typingTimeout: 6000,
} as const;

/**
 * Schedule validation constraints
 */
export const SCHEDULE_CONSTRAINTS = {
  /** Minimum time in future (ms) - 5 minutes */
  minFutureTime: 5 * 60 * 1000,
  /** Default time in future for modal (ms) - 6 minutes (buffer for user) */
  defaultFutureTime: 6 * 60 * 1000,
  /** Maximum time in future (ms) - 30 days */
  maxFutureTime: 30 * 24 * 60 * 60 * 1000,
} as const;

/**
 * UI messages (German)
 */
export const MESSAGES = {
  // Errors
  errorLoadConversations: 'Fehler beim Laden der Unterhaltungen',
  errorLoadMessages: 'Fehler beim Laden der Nachrichten',
  errorCreateConversation: 'Fehler beim Erstellen der Unterhaltung',
  errorScheduleMessage: 'Fehler beim Planen der Nachricht',
  errorCancelScheduled: 'Fehler beim Abbrechen der Nachricht',
  errorDeleteConversation: 'Fehler beim Löschen der Unterhaltung',
  errorUploadFiles: 'Fehler beim Hochladen der Dateien',
  errorWebSocket: 'Fehler bei der Kommunikation mit dem Server',
  errorConnectionLost:
    'Verbindung zum Server konnte nicht wiederhergestellt werden. Bitte Seite neu laden.',
  errorConnectionRetry: 'Verbindung verloren. Bitte versuchen Sie es erneut.',
  reconnecting: 'Verbindung unterbrochen – Wiederverbindung läuft...',

  // Success
  successScheduled: 'Nachricht wurde geplant',
  successCancelScheduled: 'Geplante Nachricht wurde abgebrochen',
  successDeleteConversation: 'Unterhaltung wurde gelöscht',

  // Warnings
  warningSelectDateTime: 'Bitte wählen Sie Datum und Uhrzeit',
  warningMinFutureTime: 'Zeit muss mindestens 5 Minuten in der Zukunft liegen',
  warningMaxFutureTime: 'Zeit darf maximal 30 Tage in der Zukunft liegen',

  // Info
  infoScheduledAt: 'Nachricht wird gesendet am',

  // Confirmations
  confirmDeleteConversation: 'Möchten Sie diese Unterhaltung wirklich löschen?',

  // Status labels
  statusOnline: 'Online',
  statusOffline: 'Offline',
  statusAway: 'Abwesend',

  // Date labels
  dateToday: 'Heute',
  dateYesterday: 'Gestern',

  // Empty states
  emptyNoConversations: 'Keine Unterhaltungen',
  emptyNewConversation: 'Neue Unterhaltung',
  emptyFirstMessage: 'Schreiben Sie Ihre erste Nachricht.',
  emptyWelcome: 'Willkommen im Chat',
  emptySelectConversation:
    'Wählen Sie eine Unterhaltung aus der Liste oder starten Sie eine neue Nachricht.',

  // UI labels
  labelMessages: 'Nachrichten',
  labelNewConversation: 'Neue Unterhaltung starten',
  labelSearchUsers: 'Benutzer suchen...',
  labelSearchChat: 'Im Chat suchen...',
  labelMessagePlaceholder: 'Nachricht eingeben...',
  labelScheduleMessage: 'Nachricht planen',
  labelAttachFile: 'Datei anhängen',
  labelSendMessage: 'Nachricht senden',
  labelConfirmDelete: 'Löschen bestätigen',
  labelCancel: 'Abbrechen',
  labelDelete: 'Löschen',
  labelSchedule: 'Planen',
  labelDate: 'Datum',
  labelTime: 'Uhrzeit',
  labelScheduleHint: 'Mindestens 5 Minuten in der Zukunft, maximal 30 Tage.',
  labelScheduleTitle: 'Nachricht planen',
  labelScheduleDescription:
    'Wählen Sie Datum und Uhrzeit, wann die Nachricht gesendet werden soll.',
  labelScheduledFor: 'Geplant für',
  labelCancelScheduled: 'Geplante Nachricht abbrechen',
  labelClearSchedule: 'Planung aufheben',
  labelPreviousResult: 'Vorheriger Treffer',
  labelNextResult: 'Nächster Treffer',
  labelCloseSearch: 'Suche schließen',
  labelDeleteChat: 'Chat löschen',
  labelSearchCtrlF: 'Suchen (Strg+F)',
  labelRemoveFile: 'Datei entfernen',
  labelDownloadFile: 'Datei herunterladen',
  labelCloseModal: 'Modal schließen',
  labelClearSearch: 'Suche löschen',
  labelTyping: 'schreibt...',
  labelConversation: 'Unterhaltung',
  labelGroupConversation: 'Gruppenunterhaltung',
  labelUnknown: 'Unbekannt',

  // Role labels
  roleAdmin: 'Admin',
  roleRoot: 'Root',
  roleEmployee: 'Mitarbeiter',
} as const;

/**
 * File size formatting units
 */
export const FILE_SIZE_UNITS = ['Bytes', 'KB', 'MB', 'GB'] as const;

/**
 * MIME type to icon mapping
 */
export const MIME_TYPE_ICONS: Record<string, string> = {
  image: 'fa-image',
  video: 'fa-video',
  audio: 'fa-music',
  pdf: 'fa-file-pdf',
  word: 'fa-file-word',
  document: 'fa-file-word',
  excel: 'fa-file-excel',
  spreadsheet: 'fa-file-excel',
  zip: 'fa-file-archive',
  rar: 'fa-file-archive',
  archive: 'fa-file-archive',
  default: 'fa-file',
} as const;

/**
 * WebSocket message types
 */
export const WS_MESSAGE_TYPES = {
  // Outgoing
  SEND_MESSAGE: 'send_message',
  TYPING_START: 'typing_start',
  TYPING_STOP: 'typing_stop',
  PING: 'ping',
  REQUEST_PRESENCE: 'request_presence',

  // Incoming
  CONNECTION_ESTABLISHED: 'connection_established',
  AUTH_ERROR: 'auth_error',
  NEW_MESSAGE: 'new_message',
  USER_TYPING: 'user_typing',
  USER_STOPPED_TYPING: 'user_stopped_typing',
  USER_STATUS: 'user_status',
  USER_STATUS_CHANGED: 'user_status_changed',
  INITIAL_PRESENCE: 'initial_presence',
  MESSAGE_READ: 'message_read',
  MESSAGE_SENT: 'message_sent',
  PONG: 'pong',
  ERROR: 'error',
} as const;

/**
 * API endpoints
 */
export const API_ENDPOINTS = {
  conversations: '/chat/conversations',
  messages: (conversationId: number) =>
    `/chat/conversations/${conversationId}/messages`,
  scheduledMessages: (conversationId: number) =>
    `/chat/conversations/${conversationId}/scheduled-messages`,
  markRead: (conversationId: number) =>
    `/chat/conversations/${conversationId}/read`,
  attachments: (conversationId: number) =>
    `/chat/conversations/${conversationId}/attachments`,
  users: '/chat/users',
  deleteScheduled: (id: string) => `/chat/scheduled-messages/${id}`,
  deleteConversation: (id: number) => `/chat/conversations/${id}`,
  createScheduled: '/chat/scheduled-messages',
} as const;
