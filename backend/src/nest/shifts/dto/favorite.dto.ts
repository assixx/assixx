/**
 * Favorite DTO
 *
 * Zod schema for shift planning favorites.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Create favorite request body
 */
export const CreateFavoriteSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),
  areaId: z.number().int().positive('Area ID is required'),
  areaName: z.string().trim().min(1, 'Area name is required'),
  departmentId: z.number().int().positive('Department ID is required'),
  departmentName: z.string().trim().min(1, 'Department name is required'),
  machineId: z.number().int().positive('Machine ID is required'),
  machineName: z.string().trim().min(1, 'Machine name is required'),
  teamId: z.number().int().positive('Team ID is required'),
  teamName: z.string().trim().min(1, 'Team name is required'),
});

export class CreateFavoriteDto extends createZodDto(CreateFavoriteSchema) {}
