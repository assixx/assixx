/**
 * Work Orders — Common Schemas
 *
 * Reusable Zod schemas for work order validation.
 * Used across all work order DTOs for consistency.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** UUID path parameter — validates standard UUID format */
export const UuidParamSchema = z.object({
  uuid: z.uuid(),
});

export class UuidParamDto extends createZodDto(UuidParamSchema) {}

/** Work order status enum — mirrors PostgreSQL work_order_status */
export const WorkOrderStatusSchema = z.enum(['open', 'in_progress', 'completed', 'verified'], {
  message: 'Ungültiger Auftragsstatus',
});

/** Work order priority enum — mirrors PostgreSQL work_order_priority */
export const WorkOrderPrioritySchema = z.enum(['low', 'medium', 'high'], {
  message: 'Ungültige Priorität',
});

/** Work order source type enum — mirrors PostgreSQL work_order_source_type */
export const WorkOrderSourceTypeSchema = z.enum(['tpm_defect', 'kvp_proposal', 'manual'], {
  message: 'Ungültiger Quellentyp',
});

/** Pagination — page parameter (coerced from query string) */
export const PageSchema = z.coerce.number().int().positive().default(1);

/** Pagination — limit parameter (coerced from query string) */
export const LimitSchema = z.coerce.number().int().min(1).max(500).default(20);
