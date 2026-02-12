/**
 * Vacation Notification Service
 *
 * Emits vacation lifecycle events via the EventBus for SSE delivery
 * and handles email notification stubs for future integration.
 *
 * Called by VacationService after successful status transitions.
 */
import { Injectable, Logger } from '@nestjs/common';

import { type VacationRequestEvent, eventBus } from '../../utils/eventBus.js';
import type { VacationRequest } from './vacation.types.js';

@Injectable()
export class VacationNotificationService {
  private readonly logger = new Logger(VacationNotificationService.name);

  /**
   * Build the EventBus payload from a VacationRequest domain object.
   * Only includes the fields needed for notification display.
   */
  private toEventPayload(
    request: VacationRequest,
  ): VacationRequestEvent['request'] {
    return {
      id: request.id,
      requesterId: request.requesterId,
      approverId: request.approverId,
      startDate: request.startDate,
      endDate: request.endDate,
      vacationType: request.vacationType,
      status: request.status,
      computedDays: request.computedDays,
      requesterName: request.requesterName,
      approverName: request.approverName,
    };
  }

  /** Notify that a new vacation request was created */
  notifyCreated(tenantId: number, request: VacationRequest): void {
    this.logger.log(
      `Vacation request created: ${request.id} by user ${String(request.requesterId)}`,
    );
    eventBus.emitVacationRequestCreated(tenantId, this.toEventPayload(request));
    this.sendEmailStub('created', tenantId, request);
  }

  /** Notify that a vacation request was approved or denied */
  notifyResponded(tenantId: number, request: VacationRequest): void {
    this.logger.log(
      `Vacation request ${request.status}: ${request.id} by approver ${String(request.respondedBy)}`,
    );
    eventBus.emitVacationRequestResponded(
      tenantId,
      this.toEventPayload(request),
    );
    this.sendEmailStub('responded', tenantId, request);
  }

  /** Notify that a vacation request was withdrawn by the requester */
  notifyWithdrawn(
    tenantId: number,
    requestId: string,
    requesterId: number,
  ): void {
    this.logger.log(
      `Vacation request withdrawn: ${requestId} by user ${String(requesterId)}`,
    );
    eventBus.emitVacationRequestWithdrawn(tenantId, {
      id: requestId,
      requesterId,
      approverId: null,
      startDate: '',
      endDate: '',
      vacationType: 'regular',
      status: 'withdrawn',
      computedDays: 0,
    });
  }

  /** Notify that an approved vacation request was cancelled */
  notifyCancelled(
    tenantId: number,
    requestId: string,
    requesterId: number,
  ): void {
    this.logger.log(
      `Vacation request cancelled: ${requestId} by user ${String(requesterId)}`,
    );
    eventBus.emitVacationRequestCancelled(tenantId, {
      id: requestId,
      requesterId,
      approverId: null,
      startDate: '',
      endDate: '',
      vacationType: 'regular',
      status: 'cancelled',
      computedDays: 0,
    });
  }

  /**
   * Email notification stub — logs intent, no actual email sent.
   * Will be replaced with real email integration in a future session.
   */
  private sendEmailStub(
    action: string,
    tenantId: number,
    request: VacationRequest,
  ): void {
    this.logger.debug(
      `[EMAIL STUB] Would send '${action}' email for request ${request.id} ` +
        `(tenant ${String(tenantId)}, requester ${String(request.requesterId)})`,
    );
  }
}
