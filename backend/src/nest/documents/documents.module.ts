/**
 * Documents Module
 *
 * Encapsulates document management functionality.
 * Provides document CRUD, download/preview, and statistics.
 */
import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module.js';
import { DocumentAccessService } from './document-access.service.js';
import { DocumentNotificationService } from './document-notification.service.js';
import { DocumentStorageService } from './document-storage.service.js';
import { DocumentsPermissionRegistrar } from './documents-permission.registrar.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';

@Module({
  imports: [NotificationsModule],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    DocumentAccessService,
    DocumentStorageService,
    DocumentNotificationService,
    // Permission registration (ADR-020)
    DocumentsPermissionRegistrar,
  ],
  exports: [DocumentsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are empty by design
export class DocumentsModule {}
