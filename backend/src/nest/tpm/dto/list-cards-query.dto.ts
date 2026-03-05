/**
 * TPM List Cards Query DTO
 *
 * Filter + pagination query parameters for GET /tpm/cards.
 * At least one of assetUuid, planUuid, or status is required
 * (enforced in controller, not in schema — keeps schema composable).
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  LimitSchema,
  PageSchema,
  TpmCardCategorySchema,
  TpmCardRoleSchema,
  TpmCardStatusSchema,
  TpmIntervalTypeSchema,
} from './common.dto.js';

export const ListCardsQuerySchema = z.object({
  assetUuid: z.uuid().optional(),
  planUuid: z.uuid().optional(),
  status: TpmCardStatusSchema.optional(),
  intervalType: TpmIntervalTypeSchema.optional(),
  cardRole: TpmCardRoleSchema.optional(),
  cardCategory: TpmCardCategorySchema.optional(),
  page: PageSchema,
  limit: LimitSchema,
});

export class ListCardsQueryDto extends createZodDto(ListCardsQuerySchema) {}
