/**
 * TPM List Plan Revisions Query DTO
 *
 * Pagination query parameters for GET /tpm/plans/:uuid/revisions.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { LimitSchema, PageSchema } from './common.dto.js';

export const ListRevisionsQuerySchema = z.object({
  page: PageSchema,
  limit: LimitSchema,
});

export class ListRevisionsQueryDto extends createZodDto(ListRevisionsQuerySchema) {}
