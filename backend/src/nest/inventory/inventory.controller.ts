/**
 * Inventory Controller
 *
 * 18 REST endpoints for the inventory addon.
 * All endpoints require @RequireAddon('inventory') + per-method @RequirePermission.
 * See docs/FEAT_INVENTORY_MASTERPLAN.md Step 2.6 for the full endpoint table.
 */
import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequireAddon } from '../common/decorators/require-addon.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { CreateCustomFieldDto } from './dto/create-custom-field.dto.js';
import type { CreateItemDto } from './dto/create-item.dto.js';
import type { CreateListDto } from './dto/create-list.dto.js';
import type { ItemsQueryDto } from './dto/items-query.dto.js';
import type { ReorderPhotosDto } from './dto/reorder-photos.dto.js';
import type { UpdateCustomFieldDto } from './dto/update-custom-field.dto.js';
import type { UpdateItemDto } from './dto/update-item.dto.js';
import type { UpdateListDto } from './dto/update-list.dto.js';
import type { UpdatePhotoCaptionDto } from './dto/update-photo-caption.dto.js';
import type { UploadPhotoDto } from './dto/upload-photo.dto.js';
import { InventoryCustomFieldsService } from './inventory-custom-fields.service.js';
import { InventoryItemsService } from './inventory-items.service.js';
import { InventoryListsService } from './inventory-lists.service.js';
import { InventoryPhotosService } from './inventory-photos.service.js';
import type {
  InventoryCustomFieldRow,
  InventoryCustomValueWithField,
  InventoryItemPhoto,
  InventoryItemPhotoRow,
  InventoryItemRow,
  InventoryListRow,
  InventoryListWithCounts,
} from './inventory.types.js';

const ADDON = 'inventory';
const MOD_LISTS = 'inventory-lists';
const MOD_ITEMS = 'inventory-items';

@Controller('inventory')
@RequireAddon(ADDON)
export class InventoryController {
  constructor(
    private readonly listsService: InventoryListsService,
    private readonly itemsService: InventoryItemsService,
    private readonly fieldsService: InventoryCustomFieldsService,
    private readonly photosService: InventoryPhotosService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  // ── Lists ─────────────────────────────────────────────────────

  @Get('lists')
  @RequirePermission(ADDON, MOD_LISTS, 'canRead')
  async getLists(): Promise<InventoryListWithCounts[]> {
    return await this.listsService.findAll();
  }

  @Post('lists')
  @RequirePermission(ADDON, MOD_LISTS, 'canWrite')
  async createList(
    @Body() dto: CreateListDto,
    @CurrentUser('id') userId: number,
    @CurrentUser('tenantId') tenantId: number,
  ): Promise<InventoryListRow> {
    const created = await this.listsService.create(dto, userId);
    void this.activityLogger.log({
      tenantId,
      userId,
      action: 'create',
      entityType: 'inventory_list',
      details: `Inventarliste erstellt: "${created.title}" (${created.code_prefix})`,
      newValues: { id: created.id, title: created.title, codePrefix: created.code_prefix },
    });
    return created;
  }

  @Get('lists/:id')
  @RequirePermission(ADDON, MOD_LISTS, 'canRead')
  async getList(@Param('id') id: string): Promise<{
    list: InventoryListWithCounts;
    fields: InventoryCustomFieldRow[];
  }> {
    return await this.listsService.findById(id);
  }

  @Patch('lists/:id')
  @RequirePermission(ADDON, MOD_LISTS, 'canWrite')
  async updateList(
    @Param('id') id: string,
    @Body() dto: UpdateListDto,
    @CurrentUser('id') userId: number,
    @CurrentUser('tenantId') tenantId: number,
  ): Promise<InventoryListRow> {
    const updated = await this.listsService.update(id, dto);
    void this.activityLogger.log({
      tenantId,
      userId,
      action: 'update',
      entityType: 'inventory_list',
      details: `Inventarliste aktualisiert: "${updated.title}"`,
      newValues: { id: updated.id, title: updated.title },
    });
    return updated;
  }

  @Delete('lists/:id')
  @RequirePermission(ADDON, MOD_LISTS, 'canDelete')
  async deleteList(
    @Param('id') id: string,
    @CurrentUser('id') userId: number,
    @CurrentUser('tenantId') tenantId: number,
  ): Promise<void> {
    await this.listsService.softDelete(id);
    void this.activityLogger.log({
      tenantId,
      userId,
      action: 'delete',
      entityType: 'inventory_list',
      details: `Inventarliste gelöscht (ID: ${id})`,
      oldValues: { id },
    });
  }

  // ── Categories ────────────────────────────────────────────────

  @Get('categories')
  @RequirePermission(ADDON, MOD_LISTS, 'canRead')
  async getCategories(@Query('q') q?: string): Promise<string[]> {
    return await this.listsService.getCategoryAutocomplete(q);
  }

  // ── Custom Fields ─────────────────────────────────────────────

  @Post('lists/:id/fields')
  @RequirePermission(ADDON, MOD_LISTS, 'canWrite')
  async createField(
    @Param('id') listId: string,
    @Body() dto: CreateCustomFieldDto,
  ): Promise<InventoryCustomFieldRow> {
    return await this.fieldsService.create(listId, dto);
  }

  @Patch('fields/:fieldId')
  @RequirePermission(ADDON, MOD_LISTS, 'canWrite')
  async updateField(
    @Param('fieldId') fieldId: string,
    @Body() dto: UpdateCustomFieldDto,
  ): Promise<InventoryCustomFieldRow> {
    return await this.fieldsService.update(fieldId, dto);
  }

  @Delete('fields/:fieldId')
  @RequirePermission(ADDON, MOD_LISTS, 'canWrite')
  async deleteField(@Param('fieldId') fieldId: string): Promise<void> {
    await this.fieldsService.softDelete(fieldId);
  }

  // ── Items ─────────────────────────────────────────────────────

  @Get('items')
  @RequirePermission(ADDON, MOD_ITEMS, 'canRead')
  async getItems(
    @Query() query: ItemsQueryDto,
  ): Promise<{ items: InventoryItemRow[]; total: number }> {
    return await this.itemsService.findByList(query.listId, {
      status: query.status,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
  }

  @Post('items')
  @RequirePermission(ADDON, MOD_ITEMS, 'canWrite')
  async createItem(
    @Body() dto: CreateItemDto,
    @CurrentUser('id') userId: number,
    @CurrentUser('tenantId') tenantId: number,
  ): Promise<InventoryItemRow> {
    const created = await this.itemsService.create(dto, userId);
    void this.activityLogger.log({
      tenantId,
      userId,
      action: 'create',
      entityType: 'inventory_item',
      details: `Inventargegenstand erstellt: "${created.name}" (${created.code})`,
      newValues: {
        id: created.id,
        code: created.code,
        name: created.name,
        listId: created.list_id,
      },
    });
    return created;
  }

  @Get('items/:uuid')
  @RequirePermission(ADDON, MOD_ITEMS, 'canRead')
  async getItem(@Param('uuid') uuid: string): Promise<{
    item: InventoryItemRow;
    photos: InventoryItemPhoto[];
    customValues: InventoryCustomValueWithField[];
  }> {
    return await this.itemsService.findByUuid(uuid);
  }

  @Patch('items/:uuid')
  @RequirePermission(ADDON, MOD_ITEMS, 'canWrite')
  async updateItem(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateItemDto,
    @CurrentUser('id') userId: number,
    @CurrentUser('tenantId') tenantId: number,
  ): Promise<InventoryItemRow> {
    const updated = await this.itemsService.update(uuid, dto);
    void this.activityLogger.log({
      tenantId,
      userId,
      action: 'update',
      entityType: 'inventory_item',
      details: `Inventargegenstand aktualisiert: "${updated.name}" (${updated.code})`,
      newValues: { id: updated.id, code: updated.code, name: updated.name, status: updated.status },
    });
    return updated;
  }

  @Delete('items/:uuid')
  @RequirePermission(ADDON, MOD_ITEMS, 'canDelete')
  async deleteItem(
    @Param('uuid') uuid: string,
    @CurrentUser('id') userId: number,
    @CurrentUser('tenantId') tenantId: number,
  ): Promise<void> {
    await this.itemsService.softDelete(uuid);
    void this.activityLogger.log({
      tenantId,
      userId,
      action: 'delete',
      entityType: 'inventory_item',
      details: `Inventargegenstand gelöscht (UUID: ${uuid})`,
      oldValues: { id: uuid },
    });
  }

  // ── Photos ────────────────────────────────────────────────────

  @Post('items/:uuid/photos')
  @RequirePermission(ADDON, MOD_ITEMS, 'canWrite')
  async uploadPhoto(
    @Param('uuid') itemId: string,
    @Body() dto: UploadPhotoDto,
    @CurrentUser('id') userId: number,
  ): Promise<InventoryItemPhotoRow> {
    return await this.photosService.create(itemId, dto.filePath, dto.caption ?? null, userId);
  }

  @Patch('photos/:photoId')
  @RequirePermission(ADDON, MOD_ITEMS, 'canWrite')
  async updatePhotoCaption(
    @Param('photoId') photoId: string,
    @Body() dto: UpdatePhotoCaptionDto,
  ): Promise<InventoryItemPhotoRow> {
    return await this.photosService.updateCaption(photoId, dto.caption);
  }

  @Put('items/:uuid/photos/reorder')
  @RequirePermission(ADDON, MOD_ITEMS, 'canWrite')
  async reorderPhotos(@Param('uuid') itemId: string, @Body() dto: ReorderPhotosDto): Promise<void> {
    await this.photosService.reorder(itemId, dto.photoIds);
  }

  @Delete('photos/:photoId')
  @RequirePermission(ADDON, MOD_ITEMS, 'canWrite')
  async deletePhoto(@Param('photoId') photoId: string): Promise<void> {
    await this.photosService.softDelete(photoId);
  }
}
