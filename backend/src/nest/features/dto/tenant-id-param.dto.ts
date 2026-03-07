import { createZodDto } from 'nestjs-zod';

import { createIdParamSchema } from '../../common/dto/index.js';

export const TenantIdParamSchema = createIdParamSchema('tenantId');
export class TenantIdParamDto extends createZodDto(TenantIdParamSchema) {}
