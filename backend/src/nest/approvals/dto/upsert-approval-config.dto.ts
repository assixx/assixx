/**
 * Upsert Approval Config DTO — Zod schema for setting approval masters
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const baseSchema = z.object({
  addonCode: z.string().min(1).max(50),
  approverType: z.enum([
    'user',
    'team_lead',
    'area_lead',
    'department_lead',
    'position',
  ]),
  approverUserId: z.number().int().positive().nullable().optional(),
  approverPositionId: z.uuid().nullable().optional(),
});

export const UpsertApprovalConfigSchema = baseSchema.refine(
  // eslint-disable-next-line @typescript-eslint/typedef -- Zod infers the type from baseSchema
  (data) => {
    if (data.approverType === 'user') {
      return data.approverUserId !== null && data.approverUserId !== undefined;
    }
    if (data.approverType === 'position') {
      return (
        data.approverPositionId !== null &&
        data.approverPositionId !== undefined
      );
    }
    return true;
  },
  {
    message:
      'approverUserId required for type "user", approverPositionId required for type "position"',
    path: ['approverType'],
  },
);

export class UpsertApprovalConfigDto extends createZodDto(
  UpsertApprovalConfigSchema,
) {}
