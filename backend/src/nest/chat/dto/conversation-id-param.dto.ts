import type { z } from 'zod';

import { IdParamDto, IdParamSchema } from '../../common/dto/index.js';

export { IdParamDto as ConversationIdParamDto };
export { IdParamSchema as ConversationIdParamSchema };
export type ConversationIdParam = z.infer<typeof IdParamSchema>;
