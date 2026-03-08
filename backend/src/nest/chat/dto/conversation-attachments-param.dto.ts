import type { z } from 'zod';

import { IdParamDto, IdParamSchema } from '../../common/dto/index.js';

export { IdParamDto as ConversationAttachmentsParamDto };
export { IdParamSchema as ConversationAttachmentsParamSchema };
export type ConversationAttachmentsParam = z.infer<typeof IdParamSchema>;
