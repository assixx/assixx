/**
 * Update Event DTO
 *
 * Validation schema for updating calendar events.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { IdSchema } from '../../../schemas/common.schema.js';

/**
 * Organization level enum for event visibility
 */
const OrgLevelSchema = z.enum(['company', 'department', 'team', 'area', 'personal'], {
  message: 'Valid organization level is required',
});

/**
 * Event status for updates
 */
const UpdateEventStatusSchema = z.enum(['tentative', 'confirmed', 'cancelled'], {
  message: 'Valid event status is required',
});

/**
 * Hex color validation
 */
const HexColorSchema = z
  .string()
  .regex(/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color')
  .optional();

/**
 * Base update event schema (before refinements)
 */
const UpdateEventBaseSchema = z.object({
  title: z.string().min(1).optional(),
  startTime: z.iso.datetime().optional(),
  endTime: z.iso.datetime().optional(),
  allDay: z.boolean().optional(),
  departmentIds: z.array(z.number().int().positive()).optional(),
  teamIds: z.array(z.number().int().positive()).optional(),
  areaIds: z.array(z.number().int().positive()).optional(),
  orgLevel: OrgLevelSchema.optional(),
  orgId: IdSchema.optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  reminderMinutes: z.number().int().min(0).optional(),
  color: HexColorSchema,
  recurrenceRule: z.string().optional(),
  status: UpdateEventStatusSchema.optional(),
});

/**
 * Update event request body schema with refinements
 */
export const UpdateEventSchema = UpdateEventBaseSchema.refine(
  (data: z.infer<typeof UpdateEventBaseSchema>) => {
    if (data.startTime !== undefined && data.endTime !== undefined) {
      return new Date(data.endTime) > new Date(data.startTime);
    }
    return true;
  },
  {
    message: 'End time must be after start time',
    path: ['endTime'],
  },
);

/**
 * Update Event DTO class
 */
export class UpdateEventDto extends createZodDto(UpdateEventSchema) {}
