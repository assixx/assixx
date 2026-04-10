/**
 * Inventory Controller
 *
 * 18 REST endpoints for the inventory addon.
 * All endpoints require @RequireAddon('inventory') + per-method @RequirePermission.
 * See docs/FEAT_INVENTORY_MASTERPLAN.md Step 2.6 for the full endpoint table.
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@webundsoehne/nest-fastify-file-upload';
import multer from 'fastify-multer';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { v7 as uuidv7 } from 'uuid';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequireAddon } from '../common/decorators/require-addon.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import type { MulterFile } from '../common/interfaces/multer.interface.js';
import { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import {
  CreateCustomFieldDto,
  CreateItemDto,
  CreateListDto,
  CreateTagDto,
  ItemsQueryDto,
  ListsQueryDto,
  ReorderPhotosDto,
  UpdateCustomFieldDto,
  UpdateItemDto,
  UpdateListDto,
  UpdatePhotoCaptionDto,
  UpdateTagDto,
} from './dto/index.js';
import { InventoryCustomFieldsService } from './inventory-custom-fields.service.js';
import { InventoryItemsService } from './inventory-items.service.js';
import { InventoryListsService } from './inventory-lists.service.js';
import { InventoryPhotosService } from './inventory-photos.service.js';
import { InventoryTagsService } from './inventory-tags.service.js';
import type {
  InventoryCustomField,
  InventoryCustomValueWithField,
  InventoryItemPhoto,
  InventoryItemPhotoRow,
  InventoryItemRow,
  InventoryList,
  InventoryListWithCounts,
  InventoryTag,
  InventoryTagWithUsage,
} from './inventory.types.js';
import { MAX_PHOTO_FILE_SIZE } from './inventory.types.js';

const { memoryStorage } = multer;

/** Multer options for inventory item photos (max 5MB, single file) */
const inventoryPhotoOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: MAX_PHOTO_FILE_SIZE,
    files: 1,
  },
};

/** Write uploaded photo to disk, return relative path */
async function writeInventoryPhotoToDisk(
  tenantId: number,
  itemUuid: string,
  file: MulterFile,
): Promise<string> {
  const fileUuid = uuidv7();
  const extension = path.extname(file.originalname).toLowerCase();
  const relativePath = path.join(
    'uploads',
    'inventory',
    tenantId.toString(),
    itemUuid,
    `${fileUuid}${extension}`,
  );
  const absolutePath = path.join(process.cwd(), relativePath);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, file.buffer);

  return relativePath;
}

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
    private readonly tagsService: InventoryTagsService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  // ── Lists ─────────────────────────────────────────────────────

  @Get('lists')
  @RequirePermission(ADDON, MOD_LISTS, 'canRead')
  async getLists(@Query() query: ListsQueryDto): Promise<InventoryListWithCounts[]> {
    return await this.listsService.findAll(
      query.tagIds === undefined ? undefined : { tagIds: query.tagIds },
    );
  }

  @Post('lists')
  @RequirePermission(ADDON, MOD_LISTS, 'canWrite')
  async createList(
    @Body() dto: CreateListDto,
    @CurrentUser('id') userId: number,
    @CurrentUser('tenantId') tenantId: number,
  ): Promise<InventoryList> {
    const created = await this.listsService.create(dto, userId);
    void this.activityLogger.log({
      tenantId,
      userId,
      action: 'create',
      entityType: 'inventory_list',
      details: `Inventarliste erstellt: "${created.title}" (${created.codePrefix})`,
      newValues: { id: created.id, title: created.title, codePrefix: created.codePrefix },
    });
    return created;
  }

  @Get('lists/:id')
  @RequirePermission(ADDON, MOD_LISTS, 'canRead')
  async getList(@Param('id') id: string): Promise<{
    list: InventoryListWithCounts;
    fields: InventoryCustomField[];
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
  ): Promise<InventoryList> {
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

  // ── Tags ──────────────────────────────────────────────────────

  @Get('tags')
  @RequirePermission(ADDON, MOD_LISTS, 'canRead')
  async getTags(): Promise<InventoryTagWithUsage[]> {
    return await this.tagsService.findAll();
  }

  @Post('tags')
  @RequirePermission(ADDON, MOD_LISTS, 'canWrite')
  async createTag(
    @Body() dto: CreateTagDto,
    @CurrentUser('id') userId: number,
    @CurrentUser('tenantId') tenantId: number,
  ): Promise<InventoryTag> {
    const created = await this.tagsService.create(dto, userId);
    void this.activityLogger.log({
      tenantId,
      userId,
      action: 'create',
      entityType: 'inventory_tag',
      details: `Inventory-Tag erstellt: "${created.name}"`,
      newValues: { id: created.id, name: created.name, icon: created.icon },
    });
    return created;
  }

  @Patch('tags/:tagId')
  @RequirePermission(ADDON, MOD_LISTS, 'canWrite')
  async updateTag(
    @Param('tagId') tagId: string,
    @Body() dto: UpdateTagDto,
    @CurrentUser('id') userId: number,
    @CurrentUser('tenantId') tenantId: number,
  ): Promise<InventoryTag> {
    const updated = await this.tagsService.update(tagId, dto);
    void this.activityLogger.log({
      tenantId,
      userId,
      action: 'update',
      entityType: 'inventory_tag',
      details: `Inventory-Tag aktualisiert: "${updated.name}"`,
      newValues: { id: updated.id, name: updated.name, icon: updated.icon },
    });
    return updated;
  }

  @Delete('tags/:tagId')
  @RequirePermission(ADDON, MOD_LISTS, 'canDelete')
  async deleteTag(
    @Param('tagId') tagId: string,
    @CurrentUser('id') userId: number,
    @CurrentUser('tenantId') tenantId: number,
  ): Promise<void> {
    await this.tagsService.delete(tagId);
    void this.activityLogger.log({
      tenantId,
      userId,
      action: 'delete',
      entityType: 'inventory_tag',
      details: `Inventory-Tag gelöscht (ID: ${tagId})`,
      oldValues: { id: tagId },
    });
  }

  // ── Custom Fields ─────────────────────────────────────────────

  @Post('lists/:id/fields')
  @RequirePermission(ADDON, MOD_LISTS, 'canWrite')
  async createField(
    @Param('id') listId: string,
    @Body() dto: CreateCustomFieldDto,
  ): Promise<InventoryCustomField> {
    return await this.fieldsService.create(listId, dto);
  }

  @Patch('fields/:fieldId')
  @RequirePermission(ADDON, MOD_LISTS, 'canWrite')
  async updateField(
    @Param('fieldId') fieldId: string,
    @Body() dto: UpdateCustomFieldDto,
  ): Promise<InventoryCustomField> {
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
  async getItems(@Query() query: ItemsQueryDto): Promise<{
    items: InventoryItemRow[];
    total: number;
    customValuesByItem: Record<string, InventoryCustomValueWithField[]>;
  }> {
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
    fields: InventoryCustomField[];
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
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', inventoryPhotoOptions))
  @RequirePermission(ADDON, MOD_ITEMS, 'canWrite')
  async uploadPhoto(
    @Param('uuid') itemId: string,
    @UploadedFile() file: MulterFile | undefined,
    @CurrentUser('id') userId: number,
    @CurrentUser('tenantId') tenantId: number,
  ): Promise<InventoryItemPhotoRow> {
    if (file === undefined) {
      throw new BadRequestException('Keine Datei hochgeladen');
    }

    const storagePath = await writeInventoryPhotoToDisk(tenantId, itemId, file);
    return await this.photosService.create(itemId, storagePath, null, userId);
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
