/**
 * Inventory Module
 *
 * Equipment tracking & inventory management addon.
 * Provides lists, items, custom fields, photos, and QR code support.
 * See docs/FEAT_INVENTORY_MASTERPLAN.md for full architecture.
 */
import { Module } from '@nestjs/common';

import { AddonCheckModule } from '../addon-check/addon-check.module.js';
import { InventoryCustomFieldsService } from './inventory-custom-fields.service.js';
import { InventoryItemsService } from './inventory-items.service.js';
import { InventoryListsService } from './inventory-lists.service.js';
import { InventoryPermissionRegistrar } from './inventory-permission.registrar.js';
import { InventoryPhotosService } from './inventory-photos.service.js';
import { InventoryController } from './inventory.controller.js';

@Module({
  imports: [AddonCheckModule],
  controllers: [InventoryController],
  providers: [
    InventoryPermissionRegistrar,
    InventoryListsService,
    InventoryItemsService,
    InventoryCustomFieldsService,
    InventoryPhotosService,
  ],
  exports: [
    InventoryListsService,
    InventoryItemsService,
    InventoryCustomFieldsService,
    InventoryPhotosService,
  ],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS @Module() decorated class
export class InventoryModule {}
