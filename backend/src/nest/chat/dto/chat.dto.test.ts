import { describe, expect, it } from 'vitest';

import { AttachmentDocumentIdParamSchema } from './attachment-document-id-param.dto.js';
import { AttachmentDownloadQuerySchema } from './attachment-download-query.dto.js';
import { AttachmentFileUuidParamSchema } from './attachment-file-uuid-param.dto.js';
import { AttachmentFilenameParamSchema } from './attachment-filename-param.dto.js';
import { AttachmentQuerySchema } from './attachment-query.dto.js';
import { ConversationAttachmentsParamSchema } from './conversation-attachments-param.dto.js';
import { ConversationIdParamSchema } from './conversation-id-param.dto.js';
import { ConversationMessagesParamSchema } from './conversation-messages-param.dto.js';
import { AddParticipantsBodySchema } from './conversation-participants.dto.js';
import { GetConversationsQuerySchema } from './conversation-query.dto.js';
import { ConversationScheduledMessagesParamSchema } from './conversation-scheduled-messages-param.dto.js';
import { CreateConversationBodySchema } from './create-conversation.dto.js';
import { EditMessageBodySchema } from './edit-message.dto.js';
import { GetMessagesQuerySchema } from './get-messages-query.dto.js';
import { MessageIdParamSchema } from './message-id-param.dto.js';
import { RemoveParticipantParamsSchema } from './remove-participant-param.dto.js';
import { ScheduledMessageIdParamSchema } from './scheduled-message-id-param.dto.js';
import { SearchMessagesQuerySchema } from './search-messages-query.dto.js';
import { SendMessageBodySchema } from './send-message.dto.js';
import { UpdateConversationBodySchema } from './update-conversation.dto.js';
import { GetUsersQuerySchema } from './user.dto.js';

// =============================================================
// ID/Param Schemas
// =============================================================

describe('ConversationIdParamSchema', () => {
  it('should accept valid positive integer', () => {
    expect(ConversationIdParamSchema.safeParse({ id: 1 }).success).toBe(true);
  });

  it('should coerce string to number', () => {
    const result = ConversationIdParamSchema.safeParse({ id: '5' });
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: { id: number } }).data;
    expect(data.id).toBe(5);
  });

  it('should reject zero', () => {
    expect(ConversationIdParamSchema.safeParse({ id: 0 }).success).toBe(false);
  });

  it('should reject negative', () => {
    expect(ConversationIdParamSchema.safeParse({ id: -1 }).success).toBe(false);
  });
});

describe('MessageIdParamSchema', () => {
  it('should accept valid id', () => {
    expect(MessageIdParamSchema.safeParse({ id: 1 }).success).toBe(true);
  });

  it('should reject zero', () => {
    expect(MessageIdParamSchema.safeParse({ id: 0 }).success).toBe(false);
  });
});

describe('ScheduledMessageIdParamSchema', () => {
  it('should accept valid UUID', () => {
    expect(
      ScheduledMessageIdParamSchema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
      }).success,
    ).toBe(true);
  });

  it('should reject invalid UUID', () => {
    expect(
      ScheduledMessageIdParamSchema.safeParse({ id: 'not-a-uuid' }).success,
    ).toBe(false);
  });
});

describe('ConversationMessagesParamSchema', () => {
  it('should accept valid id', () => {
    expect(ConversationMessagesParamSchema.safeParse({ id: 1 }).success).toBe(
      true,
    );
  });

  it('should reject zero', () => {
    expect(ConversationMessagesParamSchema.safeParse({ id: 0 }).success).toBe(
      false,
    );
  });
});

describe('ConversationScheduledMessagesParamSchema', () => {
  it('should accept valid id', () => {
    expect(
      ConversationScheduledMessagesParamSchema.safeParse({ id: 1 }).success,
    ).toBe(true);
  });

  it('should reject zero', () => {
    expect(
      ConversationScheduledMessagesParamSchema.safeParse({ id: 0 }).success,
    ).toBe(false);
  });
});

describe('ConversationAttachmentsParamSchema', () => {
  it('should accept valid id', () => {
    expect(
      ConversationAttachmentsParamSchema.safeParse({ id: 1 }).success,
    ).toBe(true);
  });

  it('should reject zero', () => {
    expect(
      ConversationAttachmentsParamSchema.safeParse({ id: 0 }).success,
    ).toBe(false);
  });
});

describe('AttachmentDocumentIdParamSchema', () => {
  it('should accept valid documentId', () => {
    expect(
      AttachmentDocumentIdParamSchema.safeParse({ documentId: 1 }).success,
    ).toBe(true);
  });

  it('should reject zero', () => {
    expect(
      AttachmentDocumentIdParamSchema.safeParse({ documentId: 0 }).success,
    ).toBe(false);
  });
});

describe('AttachmentFilenameParamSchema', () => {
  it('should accept valid filename', () => {
    expect(
      AttachmentFilenameParamSchema.safeParse({ filename: 'report.pdf' })
        .success,
    ).toBe(true);
  });

  it('should reject empty filename', () => {
    expect(
      AttachmentFilenameParamSchema.safeParse({ filename: '' }).success,
    ).toBe(false);
  });
});

describe('AttachmentFileUuidParamSchema', () => {
  it('should accept valid UUID', () => {
    expect(
      AttachmentFileUuidParamSchema.safeParse({
        fileUuid: '550e8400-e29b-41d4-a716-446655440000',
      }).success,
    ).toBe(true);
  });

  it('should reject invalid UUID', () => {
    expect(
      AttachmentFileUuidParamSchema.safeParse({ fileUuid: 'not-uuid' }).success,
    ).toBe(false);
  });
});

describe('RemoveParticipantParamsSchema', () => {
  it('should accept valid ids', () => {
    expect(
      RemoveParticipantParamsSchema.safeParse({ id: 1, userId: 2 }).success,
    ).toBe(true);
  });

  it('should reject zero id', () => {
    expect(
      RemoveParticipantParamsSchema.safeParse({ id: 0, userId: 1 }).success,
    ).toBe(false);
  });

  it('should reject zero userId', () => {
    expect(
      RemoveParticipantParamsSchema.safeParse({ id: 1, userId: 0 }).success,
    ).toBe(false);
  });
});

// =============================================================
// Query Schemas
// =============================================================

describe('GetConversationsQuerySchema', () => {
  it('should accept empty query (all optional)', () => {
    expect(GetConversationsQuerySchema.safeParse({}).success).toBe(true);
  });

  it('should accept pagination params', () => {
    expect(
      GetConversationsQuerySchema.safeParse({ page: 1, limit: 20 }).success,
    ).toBe(true);
  });

  it('should reject limit over 100', () => {
    expect(GetConversationsQuerySchema.safeParse({ limit: 101 }).success).toBe(
      false,
    );
  });

  it('should accept boolean query params as strings', () => {
    const result = GetConversationsQuerySchema.safeParse({
      isGroup: 'true',
      hasUnread: 'false',
    });
    expect(result.success).toBe(true);
    const data = (
      result as {
        success: true;
        data: { isGroup: boolean; hasUnread: boolean };
      }
    ).data;
    expect(data.isGroup).toBe(true);
    expect(data.hasUnread).toBe(false);
  });

  it('should reject search over 200 chars', () => {
    expect(
      GetConversationsQuerySchema.safeParse({ search: 'a'.repeat(201) })
        .success,
    ).toBe(false);
  });
});

describe('GetMessagesQuerySchema', () => {
  it('should accept empty query', () => {
    expect(GetMessagesQuerySchema.safeParse({}).success).toBe(true);
  });

  it('should accept date filters', () => {
    const data = {
      startDate: '2025-06-01T00:00:00Z',
      endDate: '2025-06-30T23:59:59Z',
    };
    expect(GetMessagesQuerySchema.safeParse(data).success).toBe(true);
  });

  it('should accept hasAttachment as boolean string', () => {
    const result = GetMessagesQuerySchema.safeParse({ hasAttachment: 'true' });
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: { hasAttachment: boolean } })
      .data;
    expect(data.hasAttachment).toBe(true);
  });
});

describe('SearchMessagesQuerySchema', () => {
  it('should accept valid search', () => {
    expect(SearchMessagesQuerySchema.safeParse({ q: 'hello' }).success).toBe(
      true,
    );
  });

  it('should reject search under 2 chars', () => {
    expect(SearchMessagesQuerySchema.safeParse({ q: 'a' }).success).toBe(false);
  });

  it('should reject missing q', () => {
    expect(SearchMessagesQuerySchema.safeParse({}).success).toBe(false);
  });

  it('should accept with pagination', () => {
    expect(
      SearchMessagesQuerySchema.safeParse({ q: 'test', page: 2, limit: 50 })
        .success,
    ).toBe(true);
  });
});

describe('GetUsersQuerySchema', () => {
  it('should accept empty query', () => {
    expect(GetUsersQuerySchema.safeParse({}).success).toBe(true);
  });

  it('should accept search with min 2 chars', () => {
    expect(GetUsersQuerySchema.safeParse({ search: 'jo' }).success).toBe(true);
  });

  it('should reject search under 2 chars', () => {
    expect(GetUsersQuerySchema.safeParse({ search: 'j' }).success).toBe(false);
  });
});

describe('AttachmentDownloadQuerySchema', () => {
  it('should accept empty query', () => {
    expect(AttachmentDownloadQuerySchema.safeParse({}).success).toBe(true);
  });

  it('should accept inline as boolean string', () => {
    const result = AttachmentDownloadQuerySchema.safeParse({ inline: 'true' });
    expect(result.success).toBe(true);
  });
});

describe('AttachmentQuerySchema', () => {
  it('should accept empty query', () => {
    expect(AttachmentQuerySchema.safeParse({}).success).toBe(true);
  });

  it('should accept download as boolean string', () => {
    expect(AttachmentQuerySchema.safeParse({ download: 'true' }).success).toBe(
      true,
    );
  });
});

// =============================================================
// Body/Request Schemas
// =============================================================

describe('CreateConversationBodySchema', () => {
  const valid = { participantIds: [1, 2] };

  it('should accept valid create request', () => {
    expect(CreateConversationBodySchema.safeParse(valid).success).toBe(true);
  });

  it('should accept with optional fields', () => {
    const data = {
      ...valid,
      name: 'Team Chat',
      isGroup: true,
      initialMessage: 'Hello!',
    };
    expect(CreateConversationBodySchema.safeParse(data).success).toBe(true);
  });

  it('should reject empty participantIds', () => {
    expect(
      CreateConversationBodySchema.safeParse({ participantIds: [] }).success,
    ).toBe(false);
  });

  it('should reject name over 100 chars', () => {
    const data = { ...valid, name: 'a'.repeat(101) };
    expect(CreateConversationBodySchema.safeParse(data).success).toBe(false);
  });

  it('should reject initialMessage over 5000 chars', () => {
    const data = { ...valid, initialMessage: 'a'.repeat(5001) };
    expect(CreateConversationBodySchema.safeParse(data).success).toBe(false);
  });

  it('should reject missing participantIds', () => {
    expect(CreateConversationBodySchema.safeParse({}).success).toBe(false);
  });
});

describe('SendMessageBodySchema', () => {
  it('should accept valid message', () => {
    expect(SendMessageBodySchema.safeParse({ message: 'Hello' }).success).toBe(
      true,
    );
  });

  it('should accept empty body (message optional)', () => {
    expect(SendMessageBodySchema.safeParse({}).success).toBe(true);
  });

  it('should reject message over 5000 chars', () => {
    expect(
      SendMessageBodySchema.safeParse({ message: 'a'.repeat(5001) }).success,
    ).toBe(false);
  });
});

describe('EditMessageBodySchema', () => {
  it('should accept valid edit', () => {
    expect(
      EditMessageBodySchema.safeParse({ message: 'Updated' }).success,
    ).toBe(true);
  });

  it('should reject empty message', () => {
    expect(EditMessageBodySchema.safeParse({ message: '' }).success).toBe(
      false,
    );
  });

  it('should reject message over 5000 chars', () => {
    expect(
      EditMessageBodySchema.safeParse({ message: 'a'.repeat(5001) }).success,
    ).toBe(false);
  });
});

describe('UpdateConversationBodySchema', () => {
  it('should accept valid name update', () => {
    expect(
      UpdateConversationBodySchema.safeParse({ name: 'New Name' }).success,
    ).toBe(true);
  });

  it('should accept empty object (name optional)', () => {
    expect(UpdateConversationBodySchema.safeParse({}).success).toBe(true);
  });

  it('should reject empty name', () => {
    expect(UpdateConversationBodySchema.safeParse({ name: '' }).success).toBe(
      false,
    );
  });

  it('should reject name over 100 chars', () => {
    expect(
      UpdateConversationBodySchema.safeParse({ name: 'a'.repeat(101) }).success,
    ).toBe(false);
  });
});

describe('AddParticipantsBodySchema', () => {
  it('should accept valid participant ids', () => {
    expect(
      AddParticipantsBodySchema.safeParse({ participantIds: [1, 2, 3] })
        .success,
    ).toBe(true);
  });

  it('should reject empty array', () => {
    expect(
      AddParticipantsBodySchema.safeParse({ participantIds: [] }).success,
    ).toBe(false);
  });

  it('should reject invalid participant ids', () => {
    expect(
      AddParticipantsBodySchema.safeParse({ participantIds: [0] }).success,
    ).toBe(false);
  });
});
