/**
 * Asset ID Param DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AssetIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Asset ID must be a positive integer'),
});

export class AssetIdParamDto extends createZodDto(AssetIdParamSchema) {}
