/**
 * Chat Module
 * Real-time messaging functionality
 *
 * Note: File upload is handled via \@fastify/multipart registered in main.ts
 * File size limits are enforced in the controller via fastify-multer
 */
import { Module } from '@nestjs/common';

import { DocumentsModule } from '../documents/documents.module.js';
import { ChatConversationsService } from './chat-conversations.service.js';
import { ChatMessagesService } from './chat-messages.service.js';
import { ChatPermissionRegistrar } from './chat-permission.registrar.js';
import { ChatScheduledService } from './chat-scheduled.service.js';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { ScheduledMessageProcessorService } from './scheduled-message-processor.service.js';

@Module({
  imports: [DocumentsModule],
  controllers: [ChatController],
  providers: [
    ChatConversationsService,
    ChatMessagesService,
    ChatScheduledService,
    ChatService,
    ScheduledMessageProcessorService,
    // Permission registration (ADR-020)
    ChatPermissionRegistrar,
  ],
  exports: [ChatService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS module pattern requires empty class
export class ChatModule {}
