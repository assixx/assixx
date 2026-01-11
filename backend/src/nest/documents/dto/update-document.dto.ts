/**
 * DTOs for Document Updates
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Update document schema
 */
const updateDocumentSchema = z.object({
  filename: z.string().min(1).max(255).optional(),
  category: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  isPublic: z.boolean().optional(),
  expiresAt: z.iso.datetime().optional(),
});

export class UpdateDocumentDto extends createZodDto(updateDocumentSchema) {}
