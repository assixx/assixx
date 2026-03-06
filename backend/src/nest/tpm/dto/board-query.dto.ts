/**
 * TPM Board Query DTO
 *
 * Filter + pagination query parameters for GET /tpm/plans/:uuid/board.
 * Higher default limit (50) than standard (20) for board view.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  PageSchema,
  TpmCardRoleSchema,
  TpmCardStatusSchema,
  TpmIntervalTypeSchema,
} from './common.dto.js';

export const BoardQuerySchema = z.object({
  status: TpmCardStatusSchema.optional(),
  intervalType: TpmIntervalTypeSchema.optional(),
  cardRole: TpmCardRoleSchema.optional(),
  page: PageSchema,
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export class BoardQueryDto extends createZodDto(BoardQuerySchema) {}
