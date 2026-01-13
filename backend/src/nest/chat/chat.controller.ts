/**
 * Chat Controller
 * Real-time messaging API with NestJS
 * 26 endpoints for conversations, messages, participants, attachments, scheduled messages
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@webundsoehne/nest-fastify-file-upload';
import crypto from 'crypto';
import type { FastifyReply } from 'fastify';
import multer from 'fastify-multer';
import { promises as fs } from 'fs';
import path from 'path';
import { v7 as uuidv7 } from 'uuid';

import { getUploadDirectory, sanitizeFilename, validatePath } from '../../utils/pathSecurity.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import { DocumentsService } from '../documents/documents.service.js';
import { ChatService } from './chat.service.js';
import {
  AttachmentDocumentIdParamDto,
  AttachmentDownloadQueryDto,
  AttachmentFileUuidParamDto,
  AttachmentFilenameParamDto,
  AttachmentQueryDto,
  ConversationAttachmentsParamDto,
} from './dto/attachment.dto.js';
// DTOs
import {
  AddParticipantsDto,
  ConversationIdParamDto,
  CreateConversationDto,
  GetConversationsQueryDto,
  RemoveParticipantParamsDto,
  UpdateConversationDto,
} from './dto/conversation.dto.js';
import {
  EditMessageDto,
  GetMessagesQueryDto,
  MessageIdParamDto,
  SearchMessagesQueryDto,
  SendMessageDto,
} from './dto/message.dto.js';
import {
  ConversationScheduledMessagesParamDto,
  CreateScheduledMessageDto,
  ScheduledMessageIdParamDto,
} from './dto/scheduled-message.dto.js';
import { GetUsersQueryDto } from './dto/user.dto.js';

const { diskStorage, memoryStorage } = multer;

/** Multer file type for callbacks */
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size?: number;
  destination?: string;
  filename?: string;
  path?: string;
  buffer?: Buffer;
}

// Multer config for legacy disk storage
const ALLOWED_ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const diskStorageConfig = diskStorage({
  destination: (
    _req: unknown,
    _file: MulterFile,
    cb: (error: Error | null, destination: string) => void,
  ): void => {
    cb(null, getUploadDirectory('chat'));
  },
  filename: (
    _req: unknown,
    file: MulterFile,
    cb: (error: Error | null, filename: string) => void,
  ): void => {
    const sanitized = sanitizeFilename(file.originalname);
    const ext = path.extname(sanitized);
    const uniqueSuffix = `${String(Date.now())}-${String(Math.round(Math.random() * 1e9))}`;
    cb(null, `chat-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (
  _req: unknown,
  file: MulterFile,
  cb: (error: Error | null, acceptFile: boolean) => void,
): void => {
  if (ALLOWED_ATTACHMENT_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestException('File type not allowed'), false);
  }
};

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly documentsService: DocumentsService,
  ) {}

  // ============================================================
  // USERS
  // ============================================================

  @Get('users')
  async getChatUsers(@Query() query: GetUsersQueryDto): Promise<unknown> {
    return await this.chatService.getChatUsers(query);
  }

  // ============================================================
  // CONVERSATIONS
  // ============================================================

  @Get('conversations')
  async getConversations(@Query() query: GetConversationsQueryDto): Promise<unknown> {
    return await this.chatService.getConversations(query);
  }

  @Post('conversations')
  async createConversation(@Body() dto: CreateConversationDto): Promise<unknown> {
    return await this.chatService.createConversation(dto);
  }

  @Get('conversations/:id')
  async getConversation(@Param() params: ConversationIdParamDto): Promise<unknown> {
    return await this.chatService.getConversation(params.id);
  }

  @Put('conversations/:id')
  async updateConversation(
    @Param() params: ConversationIdParamDto,
    @Body() dto: UpdateConversationDto,
  ): Promise<unknown> {
    return await this.chatService.updateConversation(params.id, dto);
  }

  @Delete('conversations/:id')
  async deleteConversation(@Param() params: ConversationIdParamDto): Promise<{ message: string }> {
    return await this.chatService.deleteConversation(params.id);
  }

  // ============================================================
  // MESSAGES
  // ============================================================

  @Get('conversations/:id/messages')
  async getMessages(
    @Param() params: ConversationIdParamDto,
    @Query() query: GetMessagesQueryDto,
  ): Promise<unknown> {
    return await this.chatService.getMessages(params.id, query);
  }

  @Post('conversations/:id/messages')
  @UseInterceptors(
    FileInterceptor('attachment', {
      storage: diskStorageConfig,
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter,
    }),
  )
  async sendMessage(
    @Param() params: ConversationIdParamDto,
    @Body() dto: SendMessageDto,
    @UploadedFile() file?: MulterFile,
  ): Promise<unknown> {
    let attachment: { path: string; filename: string; mimeType: string; size: number } | undefined;

    if (file) {
      attachment = {
        path: `/api/v2/chat/attachments/${file.filename ?? 'unknown'}`,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size ?? 0,
      };
    }

    return await this.chatService.sendMessage(params.id, dto, attachment);
  }

  @Put('messages/:id')
  async editMessage(
    @Param() params: MessageIdParamDto,
    @Body() dto: EditMessageDto,
  ): Promise<unknown> {
    return await this.chatService.editMessage(params.id, dto);
  }

  @Delete('messages/:id')
  async deleteMessage(@Param() params: MessageIdParamDto): Promise<{ message: string }> {
    return await this.chatService.deleteMessage(params.id);
  }

  @Post('conversations/:id/read')
  async markAsRead(@Param() params: ConversationIdParamDto): Promise<unknown> {
    return await this.chatService.markAsRead(params.id);
  }

  @Get('unread-count')
  async getUnreadCount(): Promise<unknown> {
    return await this.chatService.getUnreadCount();
  }

  @Get('search')
  async searchMessages(@Query() query: SearchMessagesQueryDto): Promise<unknown> {
    return await this.chatService.searchMessages(query);
  }

  // ============================================================
  // PARTICIPANTS
  // ============================================================

  @Post('conversations/:id/participants')
  async addParticipants(
    @Param() params: ConversationIdParamDto,
    @Body() dto: AddParticipantsDto,
  ): Promise<unknown> {
    return await this.chatService.addParticipants(params.id, dto);
  }

  @Delete('conversations/:id/participants/:userId')
  async removeParticipant(@Param() params: RemoveParticipantParamsDto): Promise<unknown> {
    return await this.chatService.removeParticipant(params.id, params.userId);
  }

  @Post('conversations/:id/leave')
  async leaveConversation(@Param() params: ConversationIdParamDto): Promise<unknown> {
    return await this.chatService.leaveConversation(params.id);
  }

  // ============================================================
  // ATTACHMENTS (Legacy - disk based)
  // ============================================================

  @Get('attachments/:filename')
  async downloadAttachment(
    @Param() params: AttachmentFilenameParamDto,
    @Query() query: AttachmentQueryDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<StreamableFile> {
    const uploadsDir = getUploadDirectory('chat');
    const filePath = validatePath(params.filename, uploadsDir);

    if (filePath === null || filePath === '') {
      throw new BadRequestException('Invalid file path');
    }

    try {
      await fs.access(filePath);
    } catch {
      throw new NotFoundException('File not found');
    }

    const disposition = query.download === true ? 'attachment' : 'inline';
    void reply.header(
      'Content-Disposition',
      `${disposition}; filename="${path.basename(params.filename)}"`,
    );

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated via validatePath above
    const fileBuffer = await fs.readFile(filePath);
    return new StreamableFile(fileBuffer);
  }

  // ============================================================
  // SCHEDULED MESSAGES
  // ============================================================

  @Post('scheduled-messages')
  async createScheduledMessage(@Body() dto: CreateScheduledMessageDto): Promise<unknown> {
    return await this.chatService.createScheduledMessage(dto);
  }

  @Get('scheduled-messages')
  async getScheduledMessages(): Promise<unknown> {
    return await this.chatService.getScheduledMessages();
  }

  @Get('scheduled-messages/:id')
  async getScheduledMessage(@Param() params: ScheduledMessageIdParamDto): Promise<unknown> {
    return await this.chatService.getScheduledMessage(params.id);
  }

  @Delete('scheduled-messages/:id')
  async cancelScheduledMessage(
    @Param() params: ScheduledMessageIdParamDto,
  ): Promise<{ message: string }> {
    return await this.chatService.cancelScheduledMessage(params.id);
  }

  @Get('conversations/:id/scheduled-messages')
  async getConversationScheduledMessages(
    @Param() params: ConversationScheduledMessagesParamDto,
  ): Promise<unknown> {
    return await this.chatService.getConversationScheduledMessages(params.id);
  }

  // ============================================================
  // DOCUMENT-BASED ATTACHMENTS (New system)
  // Attachments are stored in documents table with conversation_id
  // ============================================================

  /**
   * POST /chat/conversations/:id/attachments
   * Upload attachment to a conversation (stored as document)
   */
  @Post('conversations/:id/attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter,
    }),
  )
  async uploadConversationAttachment(
    @Param() params: ConversationAttachmentsParamDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
    @UploadedFile() file?: MulterFile,
  ): Promise<Record<string, unknown>> {
    if (!file?.buffer) {
      throw new BadRequestException('No file uploaded');
    }

    const conversationId = params.id;
    const fileUuid = uuidv7();
    const extension = path.extname(file.originalname).toLowerCase();
    const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const storagePath = path.join(
      'uploads',
      'documents',
      tenantId.toString(),
      'chat',
      year.toString(),
      month,
      `${fileUuid}${extension}`,
    );

    return await this.documentsService.createDocument(
      {
        filename: file.originalname,
        originalName: file.originalname,
        fileSize: file.size ?? 0,
        fileContent: file.buffer,
        mimeType: file.mimetype,
        category: 'chat',
        accessScope: 'chat',
        conversationId,
        fileUuid,
        fileChecksum: checksum,
        filePath: storagePath,
        storageType: 'filesystem',
      },
      user.id,
      tenantId,
    );
  }

  /**
   * GET /chat/conversations/:id/attachments
   * Get all attachments for a conversation
   */
  @Get('conversations/:id/attachments')
  async getConversationAttachments(
    @Param() params: ConversationAttachmentsParamDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<{ documents: Record<string, unknown>[]; total: number }> {
    const result = await this.documentsService.listDocuments(tenantId, user.id, {
      conversationId: params.id,
      isActive: 1,
      page: 1,
      limit: 100,
    });

    return { documents: result.documents, total: result.pagination.total };
  }

  /**
   * GET /chat/attachments/:fileUuid/download
   * Download attachment by file UUID
   */
  @Get('attachments/:fileUuid/download')
  async downloadAttachmentByUuid(
    @Param() params: AttachmentFileUuidParamDto,
    @Query() query: AttachmentDownloadQueryDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const document = await this.documentsService.getDocumentByFileUuid(
      params.fileUuid,
      tenantId,
      user.id,
    );
    if (!document) {
      throw new NotFoundException('Attachment not found');
    }

    const documentId = document['id'] as number;
    const content = await this.documentsService.getDocumentContent(documentId, user.id, tenantId);
    const disposition = query.inline === true ? 'inline' : 'attachment';

    await reply
      .header('Content-Type', content.mimeType)
      .header('Content-Disposition', `${disposition}; filename="${content.originalName}"`)
      .header('Content-Length', content.fileSize.toString())
      .header('Cache-Control', 'private, max-age=3600')
      .send(content.content);
  }

  /**
   * DELETE /chat/attachments/:documentId
   * Delete a chat attachment
   */
  @Delete('attachments/:documentId')
  async deleteConversationAttachment(
    @Param() params: AttachmentDocumentIdParamDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<{ message: string }> {
    await this.documentsService.deleteDocument(params.documentId, tenantId, user.id);
    return { message: 'Attachment deleted successfully' };
  }
}
