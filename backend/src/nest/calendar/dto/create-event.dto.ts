/**
 * Create Event DTO
 *
 * Validation schema for creating calendar events.
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
 * Hex color validation
 */
const HexColorSchema = z
  .string()
  .regex(/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color')
  .optional();

/**
 * Create event request body schema
 */
export const CreateEventSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    startTime: z.iso.datetime({ message: 'Valid start time is required' }),
    endTime: z.iso.datetime({ message: 'Valid end time is required' }),
    allDay: z.boolean().optional(),
    departmentIds: z.array(z.number().int().positive()).optional().default([]),
    teamIds: z.array(z.number().int().positive()).optional().default([]),
    areaIds: z.array(z.number().int().positive()).optional().default([]),
    orgLevel: OrgLevelSchema.optional(),
    orgId: IdSchema.optional(),
    description: z.string().optional(),
    location: z.string().optional(),
    reminderMinutes: z.number().int().min(0).optional(),
    color: HexColorSchema,
    recurrenceRule: z.string().optional(),
    attendeeIds: z.array(IdSchema).optional(),
  })
  .refine(
    (data: { startTime: string; endTime: string }) =>
      new Date(data.endTime) > new Date(data.startTime),
    {
      message: 'End time must be after start time',
      path: ['endTime'],
    },
  );

/**
 * Create Event DTO class
 */
export class CreateEventDto extends createZodDto(CreateEventSchema) {}
