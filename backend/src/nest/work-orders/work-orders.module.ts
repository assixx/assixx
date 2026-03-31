/**
 * Work Orders Module
 *
 * Modulübergreifendes Arbeitsauftrag-System für Mängelbeseitigung
 * und Aufgabenverwaltung. Erstellt aus TPM-Defekten oder manuell.
 */
import { Module } from '@nestjs/common';

import { AddonCheckModule } from '../addon-check/addon-check.module.js';
import { ScopeModule } from '../hierarchy-permission/scope.module.js';
import { WorkOrderAssigneesService } from './work-orders-assignees.service.js';
import { WorkOrderCommentsService } from './work-orders-comments.service.js';
import { WorkOrderDueCronService } from './work-orders-due-cron.service.js';
import { WorkOrderNotificationService } from './work-orders-notification.service.js';
import { WorkOrdersPermissionRegistrar } from './work-orders-permission.registrar.js';
import { WorkOrderPhotosService } from './work-orders-photos.service.js';
import { WorkOrderStatusService } from './work-orders-status.service.js';
import { WorkOrdersController } from './work-orders.controller.js';
import { WorkOrdersService } from './work-orders.service.js';

@Module({
  imports: [AddonCheckModule, ScopeModule],
  controllers: [WorkOrdersController],
  providers: [
    // Permission registration (ADR-020)
    WorkOrdersPermissionRegistrar,

    // Core services
    WorkOrdersService,
    WorkOrderAssigneesService,
    WorkOrderStatusService,
    WorkOrderCommentsService,
    WorkOrderPhotosService,
    WorkOrderNotificationService,
    WorkOrderDueCronService,
  ],
  exports: [WorkOrdersService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS modules are decorator-configured, empty class body is standard pattern
export class WorkOrdersModule {}
