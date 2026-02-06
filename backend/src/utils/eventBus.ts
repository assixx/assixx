import { EventEmitter } from 'events';

import { logger } from './logger.js';

interface SurveyEvent {
  tenantId: number;
  survey: {
    id: number;
    title: string;
    deadline?: string;
    created_at?: string;
  };
}

interface DocumentEvent {
  tenantId: number;
  document: {
    id: number;
    filename: string;
    category?: string;
  };
}

interface KvpEvent {
  tenantId: number;
  kvp: {
    id: number;
    title: string;
    submitted_by?: string;
  };
}

interface MessageEvent {
  tenantId: number;
  message: {
    id: number;
    uuid: string;
    conversationId: number;
    senderId: number;
    recipientIds: number[];
    preview?: string;
  };
}

class NotificationEventBus extends EventEmitter {
  private static instance: NotificationEventBus | null = null;

  private constructor() {
    super();
    this.setMaxListeners(100); // Support many SSE connections
    logger.info('[EventBus] Initialized notification event bus');
  }

  static getInstance(): NotificationEventBus {
    NotificationEventBus.instance ??= new NotificationEventBus();
    return NotificationEventBus.instance;
  }

  // Type-safe event emitters
  emitSurveyCreated(tenantId: number, survey: SurveyEvent['survey']): void {
    logger.info(`[EventBus] Emitting survey.created for tenant ${tenantId}`);
    this.emit('survey.created', { tenantId, survey });
  }

  emitSurveyUpdated(tenantId: number, survey: SurveyEvent['survey']): void {
    logger.info(`[EventBus] Emitting survey.updated for tenant ${tenantId}`);
    this.emit('survey.updated', { tenantId, survey });
  }

  emitDocumentUploaded(
    tenantId: number,
    document: DocumentEvent['document'],
  ): void {
    logger.info(`[EventBus] Emitting document.uploaded for tenant ${tenantId}`);
    this.emit('document.uploaded', { tenantId, document });
  }

  emitKvpSubmitted(tenantId: number, kvp: KvpEvent['kvp']): void {
    logger.info(`[EventBus] Emitting kvp.submitted for tenant ${tenantId}`);
    this.emit('kvp.submitted', { tenantId, kvp });
  }

  emitNewMessage(tenantId: number, message: MessageEvent['message']): void {
    logger.info(`[EventBus] Emitting message.created for tenant ${tenantId}`);
    this.emit('message.created', { tenantId, message });
  }

  // Get active listener count for monitoring
  getListenerCount(event: string): number {
    return this.listenerCount(event);
  }

  // Get all active events
  getActiveEvents(): string[] {
    return this.eventNames() as string[];
  }
}

export const eventBus = NotificationEventBus.getInstance();
