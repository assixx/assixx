/**
 * Team Members Query DTO
 *
 * Optional date range for availability filtering.
 * If provided, returns availability entries that overlap with the date range.
 * If not provided, checks against CURRENT_DATE for backwards compatibility.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * ISO date string pattern (YYYY-MM-DD)
 */
const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Team members query parameters
 */
export const TeamMembersQuerySchema = z.object({
  startDate: z.string().regex(isoDateRegex, 'startDate must be in YYYY-MM-DD format').optional(),
  endDate: z.string().regex(isoDateRegex, 'endDate must be in YYYY-MM-DD format').optional(),
});

/**
 * Team Members Query DTO class
 */
export class TeamMembersQueryDto extends createZodDto(TeamMembersQuerySchema) {}
