/**
 * Document Notification Service
 *
 * Handles notification creation for document uploads.
 * Maps document access scopes to notification recipients.
 */
import { Injectable } from '@nestjs/common';

import { NotificationsService } from '../notifications/notifications.service.js';
import type { DocumentCreateInput } from './documents.service.js';

@Injectable()
export class DocumentNotificationService {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Create a persistent notification for a document upload (ADR-004).
   * Determines the recipient based on the document's access scope.
   */
  createUploadNotification(
    data: DocumentCreateInput,
    documentId: number,
    tenantId: number,
    userId: number,
  ): void {
    const recipientMapping = this.mapAccessScopeToRecipient(data);
    if (recipientMapping !== null) {
      void this.notificationsService.createAddonNotification(
        'document',
        documentId,
        `Neues Dokument: ${data.originalName}`,
        `Kategorie: ${data.category}`,
        recipientMapping.type,
        recipientMapping.id,
        tenantId,
        userId,
      );
    }
  }

  /**
   * Map document access scope to notification recipient.
   * Returns null for scopes that don't need notifications (payroll, blackboard, chat).
   */
  mapAccessScopeToRecipient(data: DocumentCreateInput): {
    type: 'user' | 'department' | 'team' | 'all';
    id: number | null;
  } | null {
    switch (data.accessScope) {
      case 'personal':
        return data.ownerUserId !== undefined ?
            { type: 'user', id: data.ownerUserId }
          : null;
      case 'team':
        return data.targetTeamId !== undefined ?
            { type: 'team', id: data.targetTeamId }
          : null;
      case 'department':
        return data.targetDepartmentId !== undefined ?
            { type: 'department', id: data.targetDepartmentId }
          : null;
      case 'company':
        return { type: 'all', id: null };
      default:
        // payroll, blackboard, chat have their own notification mechanisms
        return null;
    }
  }
}
