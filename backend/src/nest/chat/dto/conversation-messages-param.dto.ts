import type { z } from 'zod';

import { IdParamDto, IdParamSchema } from '../../common/dto/index.js';

export { IdParamDto as ConversationMessagesParamDto };
export { IdParamSchema as ConversationMessagesParamSchema };
export type ConversationMessagesParam = z.infer<typeof IdParamSchema>;
