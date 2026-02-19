/**
 * TPM List Cards Query DTO
 *
 * Filter + pagination query parameters for GET /tpm/cards.
 * At least one of machineUuid, planUuid, or status is required
 * (enforced in controller, not in schema — keeps schema composable).
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  LimitSchema,
  PageSchema,
  TpmCardRoleSchema,
  TpmCardStatusSchema,
  TpmIntervalTypeSchema,
} from './common.dto.js';

export const ListCardsQuerySchema = z.object({
  machineUuid: z.uuid().optional(),
  planUuid: z.uuid().optional(),
  status: TpmCardStatusSchema.optional(),
  intervalType: TpmIntervalTypeSchema.optional(),
  cardRole: TpmCardRoleSchema.optional(),
  page: PageSchema,
  limit: LimitSchema,
});

export class ListCardsQueryDto extends createZodDto(ListCardsQuerySchema) {}
