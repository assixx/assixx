/**
 * Upsert Approval Config DTO — Zod schema for setting approval masters
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const baseSchema = z.object({
  addonCode: z.string().min(1).max(50),
  approverType: z.enum(['user', 'team_lead', 'area_lead', 'department_lead']),
  approverUserId: z.number().int().positive().nullable().optional(),
});

export const UpsertApprovalConfigSchema = baseSchema.refine(
  // eslint-disable-next-line @typescript-eslint/typedef -- Zod infers the type from baseSchema
  (data) => {
    if (data.approverType === 'user') {
      return data.approverUserId !== null && data.approverUserId !== undefined;
    }
    return true;
  },
  {
    message: 'approverUserId is required when approverType is "user"',
    path: ['approverUserId'],
  },
);

export class UpsertApprovalConfigDto extends createZodDto(
  UpsertApprovalConfigSchema,
) {}
