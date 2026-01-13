/**
 * Connection Ticket DTO
 *
 * Validation schema for connection ticket requests using Zod.
 * Used for WebSocket/SSE authentication without exposing JWT in URLs.
 *
 * @see docs/TOKEN-SECURITY-REFACTORING-PLAN.md
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Connection ticket request body schema
 */
export const ConnectionTicketSchema = z.object({
  purpose: z.enum(['websocket', 'sse']).describe('The intended use of the connection ticket'),
});

/**
 * Connection Ticket DTO class
 * Provides type inference and validation
 */
export class ConnectionTicketDto extends createZodDto(ConnectionTicketSchema) {}

/**
 * Connection ticket response type
 */
export interface ConnectionTicketResponse {
  ticket: string;
  expiresIn: number;
}
