/**
 * List Machines Query DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const MachineStatusEnum = z.enum([
  'operational',
  'maintenance',
  'repair',
  'standby',
  'decommissioned',
]);

const MachineTypeEnum = z.enum([
  'production',
  'packaging',
  'quality_control',
  'logistics',
  'utility',
  'other',
]);

const SortByEnum = z.enum([
  'created_at',
  'updated_at',
  'name',
  'next_maintenance',
]);
const SortOrderEnum = z.enum(['asc', 'desc']);

export const ListMachinesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.string().optional(),
  status: MachineStatusEnum.optional(),
  machineType: MachineTypeEnum.optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  teamId: z.coerce.number().int().positive().optional(),
  needsMaintenance: z
    .string()
    .transform((val: string) => val === 'true')
    .optional(),
  sortBy: SortByEnum.optional().default('created_at'),
  sortOrder: SortOrderEnum.optional().default('desc'),
});

export class ListMachinesQueryDto extends createZodDto(
  ListMachinesQuerySchema,
) {}
