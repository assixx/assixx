import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { uuidField } from '../../common/dto/param.factory.js';

export const OrgEntityTypeSchema = z.enum(['area', 'department', 'team', 'asset'], {
  message: 'entityType must be area, department, team, or asset',
});

export const NodeDetailParamSchema = z.object({
  entityType: OrgEntityTypeSchema,
  entityUuid: uuidField,
});

export class NodeDetailParamDto extends createZodDto(NodeDetailParamSchema) {}
