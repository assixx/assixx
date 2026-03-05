/**
 * Add Asset DTO
 *
 * Validation schema for adding assets to teams.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Add asset request body
 */
export const AddAssetSchema = z.object({
  assetId: z.coerce
    .number()
    .int()
    .positive('Asset ID must be a positive integer'),
});

/**
 * Add Asset DTO class
 */
export class AddAssetDto extends createZodDto(AddAssetSchema) {}
