/**
 * Shift Handover — List Entries Query DTO.
 *
 * Filters for `GET /shift-handover/entries`. Extends `PaginationSchema`
 * (ADR-007 envelope) so paging, limit, and offset behave identically
 * across the API. Date range is inclusive on both ends; validated here
 * lexically only — the service enforces `dateFrom <= dateTo`.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { PaginationSchema } from '../../../schemas/common.schema.js';
import { idField } from '../../common/dto/index.js';
import {
  SHIFT_HANDOVER_ENTRY_STATUSES,
  type ShiftHandoverEntryStatus,
} from '../shift-handover.types.js';
import { ShiftDateSchema } from './common.dto.js';

export const ListEntriesQuerySchema = PaginationSchema.extend({
  teamId: idField.optional(),
  status: z
    .enum([...SHIFT_HANDOVER_ENTRY_STATUSES] as [
      ShiftHandoverEntryStatus,
      ...ShiftHandoverEntryStatus[],
    ])
    .optional(),
  dateFrom: ShiftDateSchema.optional(),
  dateTo: ShiftDateSchema.optional(),
});

export class ListEntriesQueryDto extends createZodDto(ListEntriesQuerySchema) {}
