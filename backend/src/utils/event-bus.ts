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

export interface ReadReceiptEntry {
  messageId: number;
  senderId: number;
}

interface MessagesReadEvent {
  readByUserId: number;
  entries: ReadReceiptEntry[];
}

export interface TpmEvent {
  tenantId: number;
  card: {
    uuid: string;
    cardCode: string;
    title: string;
    assetId: number;
    assetName?: string;
    intervalType: string;
    status: string;
  };
  executionUuid?: string;
  userId?: number;
  userName?: string;
}

export interface VacationRequestEvent {
  tenantId: number;
  request: {
    id: string;
    requesterId: number;
    approverId: number | null;
    startDate: string;
    endDate: string;
    vacationType: string;
    status: string;
    computedDays: number;
    requesterName?: string | undefined;
    approverName?: string | undefined;
  };
}

export interface WorkOrderEvent {
  tenantId: number;
  workOrder: {
    uuid: string;
    title: string;
    status: string;
    priority: string;
    assigneeUserIds: number[];
  };
  changedByUserId?: number;
  changedByName?: string;
}

interface ApprovalEvent {
  tenantId: number;
  approval: {
    uuid: string;
    title: string;
    addonCode: string;
    status: string;
    requestedByName: string;
    decidedByName?: string;
    decisionNote?: string | null;
  };
  /** User IDs of configured approval masters (for targeted delivery) */
  approverUserIds: number[];
  /** User ID of the requester (for decision notifications) */
  requestedByUserId: number;
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

  emitDocumentUploaded(tenantId: number, document: DocumentEvent['document']): void {
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

  /** Notify senders that their messages were read */
  emitMessagesRead(data: MessagesReadEvent): void {
    this.emit('messages.read', data);
  }

  emitVacationRequestCreated(tenantId: number, request: VacationRequestEvent['request']): void {
    logger.info(`[EventBus] Emitting vacation.request.created for tenant ${tenantId}`);
    this.emit('vacation.request.created', { tenantId, request });
  }

  emitVacationRequestResponded(tenantId: number, request: VacationRequestEvent['request']): void {
    logger.info(`[EventBus] Emitting vacation.request.responded for tenant ${tenantId}`);
    this.emit('vacation.request.responded', { tenantId, request });
  }

  emitVacationRequestWithdrawn(tenantId: number, request: VacationRequestEvent['request']): void {
    logger.info(`[EventBus] Emitting vacation.request.withdrawn for tenant ${tenantId}`);
    this.emit('vacation.request.withdrawn', { tenantId, request });
  }

  emitVacationRequestCancelled(tenantId: number, request: VacationRequestEvent['request']): void {
    logger.info(`[EventBus] Emitting vacation.request.cancelled for tenant ${tenantId}`);
    this.emit('vacation.request.cancelled', { tenantId, request });
  }

  // TPM events
  emitTpmMaintenanceDue(tenantId: number, card: TpmEvent['card']): void {
    logger.info(`[EventBus] Emitting tpm.maintenance.due for tenant ${tenantId}`);
    this.emit('tpm.maintenance.due', { tenantId, card });
  }

  emitTpmMaintenanceOverdue(tenantId: number, card: TpmEvent['card']): void {
    logger.info(`[EventBus] Emitting tpm.maintenance.overdue for tenant ${tenantId}`);
    this.emit('tpm.maintenance.overdue', { tenantId, card });
  }

  emitTpmMaintenanceCompleted(tenantId: number, card: TpmEvent['card'], userId: number): void {
    logger.info(`[EventBus] Emitting tpm.maintenance.completed for tenant ${tenantId}`);
    this.emit('tpm.maintenance.completed', { tenantId, card, userId });
  }

  emitTpmApprovalRequired(tenantId: number, card: TpmEvent['card'], executionUuid: string): void {
    logger.info(`[EventBus] Emitting tpm.approval.required for tenant ${tenantId}`);
    this.emit('tpm.approval.required', { tenantId, card, executionUuid });
  }

  emitTpmApprovalResult(
    tenantId: number,
    card: TpmEvent['card'],
    executionUuid: string,
    approved: boolean,
  ): void {
    logger.info(`[EventBus] Emitting tpm.approval.result for tenant ${tenantId}`);
    this.emit('tpm.approval.result', {
      tenantId,
      card,
      executionUuid,
      approved,
    });
  }

  // Work Order events
  emitWorkOrderAssigned(tenantId: number, workOrder: WorkOrderEvent['workOrder']): void {
    logger.info(`[EventBus] Emitting workorder.assigned for tenant ${tenantId}`);
    this.emit('workorder.assigned', { tenantId, workOrder });
  }

  emitWorkOrderStatusChanged(
    tenantId: number,
    workOrder: WorkOrderEvent['workOrder'],
    changedByUserId: number,
  ): void {
    logger.info(`[EventBus] Emitting workorder.status.changed for tenant ${tenantId}`);
    this.emit('workorder.status.changed', {
      tenantId,
      workOrder,
      changedByUserId,
    });
  }

  emitWorkOrderDueSoon(tenantId: number, workOrder: WorkOrderEvent['workOrder']): void {
    logger.info(`[EventBus] Emitting workorder.due.soon for tenant ${tenantId}`);
    this.emit('workorder.due.soon', { tenantId, workOrder });
  }

  emitWorkOrderVerified(
    tenantId: number,
    workOrder: WorkOrderEvent['workOrder'],
    changedByUserId: number,
  ): void {
    logger.info(`[EventBus] Emitting workorder.verified for tenant ${tenantId}`);
    this.emit('workorder.verified', {
      tenantId,
      workOrder,
      changedByUserId,
    });
  }

  // Get active listener count for monitoring
  getListenerCount(event: string): number {
    return this.listenerCount(event);
  }

  // ── Approval Events ────────────────────────────────────────────

  emitApprovalCreated(
    tenantId: number,
    approval: ApprovalEvent['approval'],
    approverUserIds: number[],
    requestedByUserId: number,
  ): void {
    logger.info(`[EventBus] Emitting approval.created for tenant ${tenantId}`);
    this.emit('approval.created', {
      tenantId,
      approval,
      approverUserIds,
      requestedByUserId,
    });
  }

  emitApprovalDecided(
    tenantId: number,
    approval: ApprovalEvent['approval'],
    requestedByUserId: number,
  ): void {
    logger.info(`[EventBus] Emitting approval.decided for tenant ${tenantId}`);
    this.emit('approval.decided', {
      tenantId,
      approval,
      approverUserIds: [],
      requestedByUserId,
    });
  }

  // Get all active events
  getActiveEvents(): string[] {
    return this.eventNames() as string[];
  }
}

export const eventBus = NotificationEventBus.getInstance();
