/**
 * Chat Module
 * Real-time messaging functionality
 *
 * Note: File upload is handled via \@fastify/multipart registered in main.ts
 * File size limits are enforced in the controller via fastify-multer
 */
import { Module } from '@nestjs/common';

import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';

@Module({
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS module pattern requires empty class
export class ChatModule {}
