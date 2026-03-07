import type { z } from 'zod';

import { UuidIdParamDto, UuidIdParamSchema } from '../../common/dto/index.js';

export { UuidIdParamDto as ScheduledMessageIdParamDto };
export { UuidIdParamSchema as ScheduledMessageIdParamSchema };
export type ScheduledMessageIdParam = z.infer<typeof UuidIdParamSchema>;
