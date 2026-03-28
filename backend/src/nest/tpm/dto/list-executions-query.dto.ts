/**
 * TPM List Executions Query DTO
 *
 * Pagination query parameters for execution list endpoints:
 * - GET /tpm/executions/pending-approvals
 * - GET /tpm/cards/:uuid/executions (card history — via plans controller)
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { LimitSchema, PageSchema } from './common.dto.js';

export const ListExecutionsQuerySchema = z.object({
  page: PageSchema,
  limit: LimitSchema,
});

export class ListExecutionsQueryDto extends createZodDto(ListExecutionsQuerySchema) {}
