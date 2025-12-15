/**
 * Chat API v2 Validation with Zod
 * Centralized validation schemas for all chat endpoints
 * Provides type-safe validation for messages, conversations,
 * participants, attachments, and scheduled messages
 */
import { z } from 'zod';

import {
  validate,
  validateBody,
  validateParams,
  validateQuery,
} from '../../../middleware/validation.zod.js';

// ============================================================
// CONSTANTS
// ============================================================

/** Maximum message length in characters */
const MAX_MESSAGE_LENGTH = 5000;

/** Maximum scheduled message length */
const MAX_SCHEDULED_MESSAGE_LENGTH = 10000;

/** Maximum conversation name length */
const MAX_CONVERSATION_NAME_LENGTH = 100;

/** Maximum search query length */
const MAX_SEARCH_LENGTH = 200;

/** Minimum search term length */
const MIN_SEARCH_LENGTH = 2;

/** Maximum items per page */
const MAX_PAGE_LIMIT = 100;

/** Minimum time in minutes before a message can be scheduled */
const MIN_SCHEDULE_MINUTES = 5;

/** Maximum time in days a message can be scheduled in advance */
const MAX_SCHEDULE_DAYS = 30;

// ============================================================
// BASE SCHEMAS (Reusable)
// ============================================================

/**
 * Conversation ID - coerces string to number (from URL params)
 */
const ConversationIdSchema = z.coerce
  .number()
  .int('Conversation ID must be an integer')
  .min(1, 'Invalid conversation ID');

/**
 * User ID - coerces string to number
 */
const UserIdSchema = z.coerce.number().int('User ID must be an integer').min(1, 'Invalid user ID');

/**
 * Message ID - coerces string to number
 */
const MessageIdSchema = z.coerce
  .number()
  .int('Message ID must be an integer')
  .min(1, 'Invalid message ID');

/**
 * UUID schema for scheduled messages
 */
const UuidSchema = z.uuid({ message: 'Invalid UUID format' });

/**
 * Pagination - page number
 */
const PageSchema = z.coerce.number().int().min(1, 'Invalid page number').optional();

/**
 * Pagination - items per page
 */
const LimitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_PAGE_LIMIT, `Limit must be between 1 and ${MAX_PAGE_LIMIT}`)
  .optional();

/**
 * Optional search string
 */
const SearchSchema = z.string().max(MAX_SEARCH_LENGTH).optional();

/**
 * Boolean coercion from query string
 */
const BooleanQuerySchema = z.coerce.boolean().optional();

// ============================================================
// PARAM SCHEMAS
// ============================================================

/**
 * Conversation ID parameter
 */
export const ConversationIdParamSchema = z.object({
  id: ConversationIdSchema,
});

/**
 * Message ID parameter
 */
export const MessageIdParamSchema = z.object({
  id: MessageIdSchema,
});

/**
 * Scheduled message ID parameter (UUID)
 */
export const ScheduledMessageIdParamSchema = z.object({
  id: UuidSchema,
});

/**
 * Attachment filename parameter (legacy)
 */
export const AttachmentFilenameParamSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
});

/**
 * Attachment file UUID parameter (new document-based system)
 */
export const AttachmentFileUuidParamSchema = z.object({
  fileUuid: z.uuid({ message: 'Invalid file UUID format' }),
});

/**
 * Document ID parameter for attachment deletion
 */
export const AttachmentDocumentIdParamSchema = z.object({
  documentId: z.coerce.number().int().min(1, 'Invalid document ID'),
});

/**
 * Remove participant parameters (conversationId + userId)
 */
export const RemoveParticipantParamsSchema = z.object({
  id: ConversationIdSchema,
  userId: UserIdSchema,
});

// ============================================================
// QUERY SCHEMAS
// ============================================================

/**
 * Get chat users query
 */
export const GetUsersQuerySchema = z.object({
  search: z
    .string()
    .min(MIN_SEARCH_LENGTH, `Search term must be at least ${MIN_SEARCH_LENGTH} characters`)
    .optional(),
});

/**
 * Get conversations query with filters
 */
export const GetConversationsQuerySchema = z.object({
  page: PageSchema,
  limit: LimitSchema,
  search: SearchSchema,
  isGroup: BooleanQuerySchema,
  hasUnread: BooleanQuerySchema,
});

/**
 * Get messages query with filters
 */
export const GetMessagesQuerySchema = z.object({
  page: PageSchema,
  limit: LimitSchema,
  search: SearchSchema,
  startDate: z.iso.datetime().optional(),
  endDate: z.iso.datetime().optional(),
  hasAttachment: BooleanQuerySchema,
});

/**
 * Search messages query (global search)
 */
export const SearchMessagesQuerySchema = z.object({
  q: z
    .string()
    .min(MIN_SEARCH_LENGTH, `Search query must be at least ${MIN_SEARCH_LENGTH} characters`)
    .max(MAX_SEARCH_LENGTH),
  page: PageSchema,
  limit: LimitSchema,
});

/**
 * Attachment download query (legacy)
 */
export const AttachmentQuerySchema = z.object({
  download: BooleanQuerySchema,
});

/**
 * Attachment download query (new document-based system)
 */
export const AttachmentDownloadQuerySchema = z.object({
  inline: BooleanQuerySchema,
});

// ============================================================
// BODY SCHEMAS
// ============================================================

/**
 * Create conversation request body
 * Supports lazy creation: if initialMessage is provided, conversation is created with first message
 */
export const CreateConversationBodySchema = z.object({
  participantIds: z
    .array(z.number().int().min(1, 'Invalid participant ID'))
    .min(1, 'At least one participant is required'),
  name: z
    .string()
    .min(1)
    .max(
      MAX_CONVERSATION_NAME_LENGTH,
      `Name must be at most ${MAX_CONVERSATION_NAME_LENGTH} characters`,
    )
    .optional(),
  isGroup: z.boolean().optional(),
  /** Initial message content for lazy creation - conversation is created WITH this message */
  initialMessage: z
    .string()
    .min(1, 'Initial message cannot be empty')
    .max(MAX_MESSAGE_LENGTH, `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`)
    .optional(),
});

/**
 * Update conversation request body
 */
export const UpdateConversationBodySchema = z.object({
  name: z
    .string()
    .min(1, 'Name cannot be empty')
    .max(
      MAX_CONVERSATION_NAME_LENGTH,
      `Name must be at most ${MAX_CONVERSATION_NAME_LENGTH} characters`,
    )
    .optional(),
});

/**
 * Send message request body
 * NOTE: message is optional because attachment-only messages are allowed
 */
export const SendMessageBodySchema = z.object({
  message: z
    .string()
    .max(MAX_MESSAGE_LENGTH, `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`)
    .optional(),
});

/**
 * Edit message request body
 */
export const EditMessageBodySchema = z.object({
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(MAX_MESSAGE_LENGTH, `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`),
});

/**
 * Add participants request body
 */
export const AddParticipantsBodySchema = z.object({
  participantIds: z
    .array(z.number().int().min(1, 'Invalid participant ID'))
    .min(1, 'At least one participant is required'),
});

/**
 * Create scheduled message request body
 */
export const CreateScheduledMessageBodySchema = z.object({
  conversationId: z
    .number()
    .int('conversationId must be an integer')
    .positive('conversationId must be positive'),

  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(
      MAX_SCHEDULED_MESSAGE_LENGTH,
      `Message is too long (max ${MAX_SCHEDULED_MESSAGE_LENGTH} characters)`,
    ),

  scheduledFor: z.iso
    .datetime({ message: 'Invalid date format (ISO 8601 expected)' })
    .refine(
      (dateStr: string): boolean => {
        const scheduledDate = new Date(dateStr);
        const minTime = new Date(Date.now() + MIN_SCHEDULE_MINUTES * 60 * 1000);
        return scheduledDate > minTime;
      },
      {
        message: `Time must be at least ${MIN_SCHEDULE_MINUTES} minutes in the future`,
      },
    )
    .refine(
      (dateStr: string): boolean => {
        const scheduledDate = new Date(dateStr);
        const maxTime = new Date(Date.now() + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000);
        return scheduledDate <= maxTime;
      },
      { message: `Time must be at most ${MAX_SCHEDULE_DAYS} days in the future` },
    ),

  attachmentPath: z.string().max(500).optional(),
  attachmentName: z.string().max(255).optional(),
  attachmentType: z.string().max(100).optional(),
  attachmentSize: z.number().int().nonnegative().optional(),
});

// ============================================================
// TYPE EXPORTS
// ============================================================

export type ConversationIdParam = z.infer<typeof ConversationIdParamSchema>;
export type MessageIdParam = z.infer<typeof MessageIdParamSchema>;
export type ScheduledMessageIdParam = z.infer<typeof ScheduledMessageIdParamSchema>;
export type AttachmentFilenameParam = z.infer<typeof AttachmentFilenameParamSchema>;
export type AttachmentFileUuidParam = z.infer<typeof AttachmentFileUuidParamSchema>;
export type AttachmentDocumentIdParam = z.infer<typeof AttachmentDocumentIdParamSchema>;
export type RemoveParticipantParams = z.infer<typeof RemoveParticipantParamsSchema>;

export type GetUsersQuery = z.infer<typeof GetUsersQuerySchema>;
export type GetConversationsQuery = z.infer<typeof GetConversationsQuerySchema>;
export type GetMessagesQuery = z.infer<typeof GetMessagesQuerySchema>;
export type SearchMessagesQuery = z.infer<typeof SearchMessagesQuerySchema>;
export type AttachmentQuery = z.infer<typeof AttachmentQuerySchema>;
export type AttachmentDownloadQuery = z.infer<typeof AttachmentDownloadQuerySchema>;

export type CreateConversationBody = z.infer<typeof CreateConversationBodySchema>;
export type UpdateConversationBody = z.infer<typeof UpdateConversationBodySchema>;
export type SendMessageBody = z.infer<typeof SendMessageBodySchema>;
export type EditMessageBody = z.infer<typeof EditMessageBodySchema>;
export type AddParticipantsBody = z.infer<typeof AddParticipantsBodySchema>;
export type CreateScheduledMessageBody = z.infer<typeof CreateScheduledMessageBodySchema>;

// ============================================================
// VALIDATION MIDDLEWARE EXPORTS
// ============================================================

/**
 * Pre-configured validation middleware for chat routes
 * Usage: router.get('/users', chatValidation.getUsers, handler)
 */
export const chatValidation = {
  // Users
  getUsers: validateQuery(GetUsersQuerySchema),

  // Conversations
  getConversations: validateQuery(GetConversationsQuerySchema),
  createConversation: validateBody(CreateConversationBodySchema),
  getConversation: validateParams(ConversationIdParamSchema),
  updateConversation: [
    validateParams(ConversationIdParamSchema),
    validateBody(UpdateConversationBodySchema),
  ],
  deleteConversation: validateParams(ConversationIdParamSchema),

  // Messages
  getMessages: validate({
    params: ConversationIdParamSchema,
    query: GetMessagesQuerySchema,
  }),
  sendMessage: validate({
    params: ConversationIdParamSchema,
    body: SendMessageBodySchema,
  }),
  editMessage: [validateParams(MessageIdParamSchema), validateBody(EditMessageBodySchema)],
  deleteMessage: validateParams(MessageIdParamSchema),
  markAsRead: validateParams(ConversationIdParamSchema),

  // Participants
  addParticipants: [
    validateParams(ConversationIdParamSchema),
    validateBody(AddParticipantsBodySchema),
  ],
  removeParticipant: validateParams(RemoveParticipantParamsSchema),
  leaveConversation: validateParams(ConversationIdParamSchema),

  // Attachments (legacy)
  downloadAttachment: validate({
    params: AttachmentFilenameParamSchema,
    query: AttachmentQuerySchema,
  }),

  // Document-based attachments (new)
  getConversationAttachments: validateParams(ConversationIdParamSchema),
  uploadConversationAttachment: validateParams(ConversationIdParamSchema),
  downloadAttachmentByUuid: validate({
    params: AttachmentFileUuidParamSchema,
    query: AttachmentDownloadQuerySchema,
  }),
  deleteConversationAttachment: validateParams(AttachmentDocumentIdParamSchema),

  // Search
  searchMessages: validateQuery(SearchMessagesQuerySchema),

  // Scheduled Messages
  createScheduledMessage: validateBody(CreateScheduledMessageBodySchema),
  getScheduledMessage: validateParams(ScheduledMessageIdParamSchema),
  cancelScheduledMessage: validateParams(ScheduledMessageIdParamSchema),
  getConversationScheduledMessages: validateParams(ConversationIdParamSchema),
};
