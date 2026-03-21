/**
 * TPM Available Slots Query DTO
 *
 * Date range query parameters for GET /tpm/plans/:uuid/available-slots.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AvailableSlotsQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate muss im Format YYYY-MM-DD sein'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate muss im Format YYYY-MM-DD sein'),
});

export class AvailableSlotsQueryDto extends createZodDto(AvailableSlotsQuerySchema) {}
