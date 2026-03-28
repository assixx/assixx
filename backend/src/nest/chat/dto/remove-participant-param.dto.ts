import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { idField } from '../../common/dto/index.js';

export const RemoveParticipantParamsSchema = z.object({
  id: idField,
  userId: idField,
});

export class RemoveParticipantParamsDto extends createZodDto(RemoveParticipantParamsSchema) {}
export type RemoveParticipantParams = z.infer<typeof RemoveParticipantParamsSchema>;
