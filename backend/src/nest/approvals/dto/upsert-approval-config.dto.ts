/**
 * Upsert Approval Config DTO — Zod schema for setting approval masters
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const HIERARCHY_TYPES = ['team_lead', 'area_lead', 'department_lead'] as const;

const baseSchema = z.object({
  addonCode: z.string().min(1).max(50),
  approverType: z.enum(['user', 'team_lead', 'area_lead', 'department_lead', 'position']),
  approverUserId: z.number().int().positive().nullable().optional(),
  approverPositionId: z.uuid().nullable().optional(),
  scopeAreaIds: z.array(z.number().int().positive()).nullable().optional(),
  scopeDepartmentIds: z.array(z.number().int().positive()).nullable().optional(),
  scopeTeamIds: z.array(z.number().int().positive()).nullable().optional(),
});

export const UpsertApprovalConfigSchema = baseSchema
  .refine(
    // eslint-disable-next-line @typescript-eslint/typedef -- Zod infers the type from baseSchema
    (data) => {
      if (data.approverType === 'user') {
        return data.approverUserId !== null && data.approverUserId !== undefined;
      }
      if (data.approverType === 'position') {
        return data.approverPositionId !== null && data.approverPositionId !== undefined;
      }
      return true;
    },
    {
      message:
        'approverUserId required for type "user", approverPositionId required for type "position"',
      path: ['approverType'],
    },
  )
  .refine(
    // eslint-disable-next-line @typescript-eslint/typedef -- Zod infers the type from baseSchema
    (data) => {
      if ((HIERARCHY_TYPES as readonly string[]).includes(data.approverType)) {
        const hasScope =
          (Array.isArray(data.scopeAreaIds) && data.scopeAreaIds.length > 0) ||
          (Array.isArray(data.scopeDepartmentIds) && data.scopeDepartmentIds.length > 0) ||
          (Array.isArray(data.scopeTeamIds) && data.scopeTeamIds.length > 0);
        return !hasScope;
      }
      return true;
    },
    {
      message:
        'Scope fields must be empty for hierarchy-based approver types — scope is implicit via org membership',
      path: ['scopeAreaIds'],
    },
  );

export class UpsertApprovalConfigDto extends createZodDto(UpsertApprovalConfigSchema) {}
