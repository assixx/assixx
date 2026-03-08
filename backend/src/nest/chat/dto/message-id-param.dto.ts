import type { z } from 'zod';

import { IdParamDto, IdParamSchema } from '../../common/dto/index.js';

export { IdParamDto as MessageIdParamDto };
export { IdParamSchema as MessageIdParamSchema };
export type MessageIdParam = z.infer<typeof IdParamSchema>;
