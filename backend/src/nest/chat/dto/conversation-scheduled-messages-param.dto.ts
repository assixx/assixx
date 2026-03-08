import type { z } from 'zod';

import { IdParamDto, IdParamSchema } from '../../common/dto/index.js';

export { IdParamDto as ConversationScheduledMessagesParamDto };
export { IdParamSchema as ConversationScheduledMessagesParamSchema };
export type ConversationScheduledMessagesParam = z.infer<typeof IdParamSchema>;
