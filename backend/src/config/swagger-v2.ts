/**
 * Swagger/OpenAPI Configuration for Assixx API v2
 * Enhanced specifications for the new API version
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import swaggerJsdoc from 'swagger-jsdoc';

// Type definition for package.json structure
interface PackageJson {
  version: string;
  name?: string;
  description?: string;
}

// Get project root directory
const projectRoot = process.cwd();

// Read package.json to get version
const packageJson = JSON.parse(
  readFileSync(join(projectRoot, 'package.json'), 'utf-8'),
) as PackageJson;

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Assixx API v2 Documentation',
      version: `2.0.0-${packageJson.version}`,
      description: 'Next Generation API for Assixx Multi-Tenant SaaS Platform',
      contact: {
        name: 'SCS-Technik',
        email: 'support@scs-technik.de',
      },
      license: {
        name: 'Proprietary',
        url: 'https://assixx.com/license',
      },
    },
    servers: [
      {
        url:
          process.env.NODE_ENV === 'production' ?
            'https://api.assixx.com'
          : 'http://localhost:3000',
        description:
          process.env.NODE_ENV === 'production' ? 'Production Server' : 'Development Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token in the format: Bearer <token>',
        },
      },
      schemas: {
        // Base Response Schemas
        ApiSuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
              description: 'Always true for successful responses',
            },
            data: {
              type: 'object',
              description: 'Response data',
            },
            meta: {
              type: 'object',
              properties: {
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                  example: '2025-07-24T15:30:00.000Z',
                },
                version: {
                  type: 'string',
                  example: '2.0',
                },
                pagination: {
                  $ref: '#/components/schemas/PaginationMeta',
                },
              },
            },
          },
          required: ['success', 'data'],
        },
        ApiErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
              description: 'Always false for error responses',
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  example: 'VALIDATION_ERROR',
                  description: 'Machine-readable error code',
                },
                message: {
                  type: 'string',
                  example: 'Invalid input data',
                  description: 'Human-readable error message',
                },
                details: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      field: {
                        type: 'string',
                        example: 'email',
                      },
                      message: {
                        type: 'string',
                        example: 'Email format is invalid',
                      },
                    },
                  },
                },
              },
              required: ['code', 'message'],
            },
            meta: {
              type: 'object',
              properties: {
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                },
                requestId: {
                  type: 'string',
                  format: 'uuid',
                  example: '550e8400-e29b-41d4-a716-446655440000',
                },
              },
            },
          },
          required: ['success', 'error'],
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            currentPage: {
              type: 'integer',
              example: 1,
            },
            totalPages: {
              type: 'integer',
              example: 10,
            },
            pageSize: {
              type: 'integer',
              example: 20,
            },
            totalItems: {
              type: 'integer',
              example: 195,
            },
          },
          required: ['currentPage', 'totalPages', 'pageSize', 'totalItems'],
        },

        // Auth Schemas
        LoginRequestV2: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
              description: 'User email address',
            },
            password: {
              type: 'string',
              format: 'password',
              example: 'SecurePass123!',
              description: 'User password',
            },
          },
        },
        LoginResponseV2: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    accessToken: {
                      type: 'string',
                      description: 'JWT access token (expires in 15 minutes)',
                    },
                    refreshToken: {
                      type: 'string',
                      description: 'JWT refresh token (expires in 7 days)',
                    },
                    user: {
                      $ref: '#/components/schemas/UserV2',
                    },
                  },
                  required: ['accessToken', 'refreshToken', 'user'],
                },
              },
            },
          ],
        },
        RegisterRequestV2: {
          type: 'object',
          required: ['email', 'password', 'firstName', 'lastName'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'newuser@example.com',
            },
            password: {
              type: 'string',
              format: 'password',
              minLength: 8,
              example: 'SecurePass123!',
              description: 'Must contain uppercase, lowercase, number and special character',
            },
            firstName: {
              type: 'string',
              minLength: 2,
              maxLength: 50,
              example: 'John',
            },
            lastName: {
              type: 'string',
              minLength: 2,
              maxLength: 50,
              example: 'Doe',
            },
            role: {
              type: 'string',
              enum: ['employee', 'admin'],
              default: 'employee',
              description: 'User role (admin can only create users)',
            },
          },
        },
        RefreshTokenRequestV2: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: {
              type: 'string',
              description: 'Valid refresh token',
            },
          },
        },
        RefreshTokenResponseV2: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    accessToken: {
                      type: 'string',
                      description: 'New JWT access token',
                    },
                  },
                  required: ['accessToken'],
                },
              },
            },
          ],
        },

        // User Schema (camelCase for v2)
        UserV2: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'User ID',
              example: 1,
            },
            username: {
              type: 'string',
              description: 'Username',
              example: 'johndoe',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email address',
              example: 'john.doe@example.com',
            },
            firstName: {
              type: 'string',
              description: 'First name',
              example: 'John',
            },
            lastName: {
              type: 'string',
              description: 'Last name',
              example: 'Doe',
            },
            role: {
              type: 'string',
              enum: ['root', 'admin', 'employee'],
              description: 'User role',
              example: 'employee',
            },
            tenantId: {
              type: 'integer',
              description: 'Tenant ID',
              example: 1,
            },
            departmentId: {
              type: 'integer',
              nullable: true,
              description: 'Department ID',
            },
            departmentName: {
              type: 'string',
              nullable: true,
              description: 'Department name',
            },
            position: {
              type: 'string',
              nullable: true,
              description: 'Job position',
            },
            phone: {
              type: 'string',
              nullable: true,
              description: 'Phone number',
            },
            employeeNumber: {
              type: 'string',
              nullable: true,
              description: 'Employee number',
            },
            profilePicture: {
              type: 'string',
              nullable: true,
              description: 'Profile picture URL',
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'suspended'],
              description: 'Account status',
              example: 'active',
            },
            isActive: {
              type: 'boolean',
              description: 'Whether the user is active',
            },
            isArchived: {
              type: 'boolean',
              description: 'Whether the user is archived',
              example: false,
            },
            availabilityStatus: {
              type: 'string',
              enum: ['available', 'vacation', 'sick', 'training', 'business_trip'],
              nullable: true,
              description: 'Current availability status',
              example: 'available',
            },
            availabilityStart: {
              type: 'string',
              format: 'date',
              nullable: true,
              description: 'Start date of unavailability',
            },
            availabilityEnd: {
              type: 'string',
              format: 'date',
              nullable: true,
              description: 'End date of unavailability',
            },
            availabilityNotes: {
              type: 'string',
              nullable: true,
              description: 'Notes about availability',
            },
            lastLogin: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Last login timestamp',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
            },
          },
          required: ['id', 'email', 'firstName', 'lastName', 'role', 'tenantId', 'status'],
        },

        // Calendar Schemas
        CalendarEvent: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Event ID',
              example: 1,
            },
            title: {
              type: 'string',
              description: 'Event title',
              example: 'Team Meeting',
            },
            description: {
              type: 'string',
              nullable: true,
              description: 'Event description',
              example: 'Weekly team sync meeting',
            },
            location: {
              type: 'string',
              nullable: true,
              description: 'Event location',
              example: 'Conference Room A',
            },
            startTime: {
              type: 'string',
              format: 'date-time',
              description: 'Event start time',
              example: '2025-07-25T10:00:00Z',
            },
            endTime: {
              type: 'string',
              format: 'date-time',
              description: 'Event end time',
              example: '2025-07-25T11:00:00Z',
            },
            allDay: {
              type: 'boolean',
              description: 'Whether this is an all-day event',
              example: false,
            },
            orgLevel: {
              type: 'string',
              enum: ['company', 'department', 'team', 'personal'],
              description: 'Organization level of the event',
              example: 'team',
            },
            orgId: {
              type: 'integer',
              nullable: true,
              description: 'Organization ID (required for department/team events)',
              example: 5,
            },
            status: {
              type: 'string',
              enum: ['tentative', 'confirmed', 'cancelled'],
              description: 'Event status',
              example: 'confirmed',
            },
            reminderMinutes: {
              type: 'integer',
              nullable: true,
              description: 'Reminder time in minutes before event',
              example: 15,
            },
            color: {
              type: 'string',
              nullable: true,
              description: 'Event color in hex format',
              example: '#3498db',
            },
            recurrenceRule: {
              type: 'string',
              nullable: true,
              description: 'Recurrence rule (daily, weekly, monthly, etc.)',
              example: 'weekly',
            },
            createdBy: {
              type: 'integer',
              description: 'User ID who created the event',
              example: 1,
            },
            creatorName: {
              type: 'string',
              description: 'Name of the event creator',
              example: 'John Doe',
            },
            userResponse: {
              type: 'string',
              nullable: true,
              enum: ['pending', 'accepted', 'declined', 'tentative'],
              description: "Current user's response to the event",
              example: 'accepted',
            },
            attendees: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/CalendarAttendee',
              },
              description: 'List of event attendees',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
            },
          },
          required: ['id', 'title', 'startTime', 'endTime', 'orgLevel', 'createdBy'],
        },
        CalendarAttendee: {
          type: 'object',
          properties: {
            userId: {
              type: 'integer',
              description: 'Attendee user ID',
              example: 2,
            },
            username: {
              type: 'string',
              description: 'Attendee username',
              example: 'jane.smith',
            },
            firstName: {
              type: 'string',
              description: 'Attendee first name',
              example: 'Jane',
            },
            lastName: {
              type: 'string',
              description: 'Attendee last name',
              example: 'Smith',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Attendee email',
              example: 'jane.smith@example.com',
            },
            profilePicture: {
              type: 'string',
              nullable: true,
              description: 'Attendee profile picture URL',
            },
            responseStatus: {
              type: 'string',
              enum: ['pending', 'accepted', 'declined', 'tentative'],
              description: 'Attendee response status',
              example: 'accepted',
            },
            respondedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'When the attendee responded',
            },
          },
          required: ['userId', 'responseStatus'],
        },
        CalendarEventsResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/CalendarEvent',
                      },
                    },
                    pagination: {
                      type: 'object',
                      properties: {
                        currentPage: {
                          type: 'integer',
                          example: 1,
                        },
                        totalPages: {
                          type: 'integer',
                          example: 5,
                        },
                        pageSize: {
                          type: 'integer',
                          example: 50,
                        },
                        totalItems: {
                          type: 'integer',
                          example: 234,
                        },
                        hasNext: {
                          type: 'boolean',
                          example: true,
                        },
                        hasPrev: {
                          type: 'boolean',
                          example: false,
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
        CalendarEventResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    event: {
                      $ref: '#/components/schemas/CalendarEvent',
                    },
                  },
                },
              },
            },
          ],
        },

        // Chat Schemas
        ChatUser: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            username: {
              type: 'string',
              example: 'john_doe',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'john@example.com',
            },
            firstName: {
              type: 'string',
              example: 'John',
            },
            lastName: {
              type: 'string',
              example: 'Doe',
            },
            profilePicture: {
              type: 'string',
              nullable: true,
              example: '/uploads/profile-123.jpg',
            },
            departmentId: {
              type: 'integer',
              nullable: true,
              example: 5,
            },
            departmentName: {
              type: 'string',
              nullable: true,
              example: 'Engineering',
            },
            isOnline: {
              type: 'boolean',
              example: true,
            },
            lastSeen: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2024-01-10T15:30:00Z',
            },
          },
          required: ['id', 'username', 'email', 'firstName', 'lastName', 'isOnline'],
        },
        ConversationParticipant: {
          type: 'object',
          properties: {
            userId: {
              type: 'integer',
              example: 1,
            },
            username: {
              type: 'string',
              example: 'john_doe',
            },
            firstName: {
              type: 'string',
              example: 'John',
            },
            lastName: {
              type: 'string',
              example: 'Doe',
            },
            profilePicture: {
              type: 'string',
              nullable: true,
              example: '/uploads/profile-123.jpg',
            },
            joinedAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-10T10:00:00Z',
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
          },
          required: ['userId', 'username', 'firstName', 'lastName', 'joinedAt', 'isActive'],
        },
        MessageAttachment: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              example: '/api/v2/chat/attachments/chat-123456.pdf',
            },
            filename: {
              type: 'string',
              example: 'document.pdf',
            },
            mimeType: {
              type: 'string',
              example: 'application/pdf',
            },
            size: {
              type: 'integer',
              example: 1024000,
              description: 'File size in bytes',
            },
          },
          required: ['url', 'filename', 'mimeType', 'size'],
        },
        Message: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            conversationId: {
              type: 'integer',
              example: 1,
            },
            senderId: {
              type: 'integer',
              example: 1,
            },
            senderName: {
              type: 'string',
              example: 'John Doe',
            },
            senderUsername: {
              type: 'string',
              example: 'john_doe',
            },
            senderProfilePicture: {
              type: 'string',
              nullable: true,
              example: '/uploads/profile-123.jpg',
            },
            content: {
              type: 'string',
              example: 'Hello, how are you?',
            },
            attachment: {
              nullable: true,
              $ref: '#/components/schemas/MessageAttachment',
            },
            isRead: {
              type: 'boolean',
              example: false,
            },
            readAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2024-01-10T15:35:00Z',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-10T15:30:00Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-10T15:30:00Z',
            },
          },
          required: [
            'id',
            'conversationId',
            'senderId',
            'senderName',
            'senderUsername',
            'content',
            'isRead',
            'createdAt',
            'updatedAt',
          ],
        },
        Conversation: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            name: {
              type: 'string',
              nullable: true,
              example: 'Engineering Team',
              description: 'Name for group conversations',
            },
            isGroup: {
              type: 'boolean',
              example: false,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-10T10:00:00Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-10T15:30:00Z',
            },
            lastMessage: {
              nullable: true,
              $ref: '#/components/schemas/Message',
            },
            unreadCount: {
              type: 'integer',
              example: 5,
              description: 'Number of unread messages for current user',
            },
            participants: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/ConversationParticipant',
              },
            },
          },
          required: ['id', 'isGroup', 'createdAt', 'updatedAt', 'unreadCount', 'participants'],
        },
        CreateConversationRequest: {
          type: 'object',
          required: ['participantIds'],
          properties: {
            participantIds: {
              type: 'array',
              items: {
                type: 'integer',
              },
              minItems: 1,
              example: [2, 3, 4],
              description: 'Array of user IDs to include in conversation',
            },
            name: {
              type: 'string',
              maxLength: 100,
              example: 'Project Discussion',
              description: 'Name for group conversations',
            },
            isGroup: {
              type: 'boolean',
              example: false,
              description: 'Force creation as group conversation',
            },
          },
        },
        SendMessageRequest: {
          type: 'object',
          required: ['message'],
          properties: {
            message: {
              type: 'string',
              maxLength: 5000,
              example: 'Hello everyone!',
              description: 'Message content',
            },
          },
        },
        UnreadCountSummary: {
          type: 'object',
          properties: {
            totalUnread: {
              type: 'integer',
              example: 12,
              description: 'Total number of unread messages',
            },
            conversations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  conversationId: {
                    type: 'integer',
                    example: 1,
                  },
                  conversationName: {
                    type: 'string',
                    nullable: true,
                    example: 'Engineering Team',
                  },
                  unreadCount: {
                    type: 'integer',
                    example: 5,
                  },
                  lastMessageTime: {
                    type: 'string',
                    format: 'date-time',
                    example: '2024-01-10T15:30:00Z',
                  },
                },
                required: ['conversationId', 'unreadCount', 'lastMessageTime'],
              },
            },
          },
          required: ['totalUnread', 'conversations'],
        },
        ChatUsersResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    users: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/ChatUser',
                      },
                    },
                    total: {
                      type: 'integer',
                      example: 25,
                    },
                  },
                },
              },
            },
          ],
        },
        ConversationsResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/Conversation',
                      },
                    },
                    pagination: {
                      $ref: '#/components/schemas/PaginationMeta',
                    },
                  },
                },
              },
            },
          ],
        },
        MessagesResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/Message',
                      },
                    },
                    pagination: {
                      $ref: '#/components/schemas/PaginationMeta',
                    },
                  },
                },
              },
            },
          ],
        },
        ConversationResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    conversation: {
                      $ref: '#/components/schemas/Conversation',
                    },
                  },
                },
              },
            },
          ],
        },
        MessageResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    message: {
                      $ref: '#/components/schemas/Message',
                    },
                  },
                },
              },
            },
          ],
        },
        UnreadCountResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  $ref: '#/components/schemas/UnreadCountSummary',
                },
              },
            },
          ],
        },

        // Notifications v2 Schemas
        NotificationV2: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            tenantId: {
              type: 'integer',
              example: 1,
            },
            userId: {
              type: 'integer',
              example: 5,
            },
            type: {
              type: 'string',
              enum: ['email', 'push', 'in_app'],
              example: 'in_app',
            },
            category: {
              type: 'string',
              example: 'system',
            },
            title: {
              type: 'string',
              example: 'New message received',
            },
            message: {
              type: 'string',
              example: 'You have a new message from John Doe',
            },
            data: {
              type: 'object',
              nullable: true,
              example: { conversationId: 123 },
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              example: 'medium',
            },
            readAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: null,
            },
            actionUrl: {
              type: 'string',
              nullable: true,
              example: '/chat/conversations/123',
            },
            iconUrl: {
              type: 'string',
              nullable: true,
              example: '/assets/icons/message.png',
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-12-31T23:59:59.000Z',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-01T10:00:00.000Z',
            },
          },
          required: ['id', 'tenantId', 'userId', 'type', 'title', 'message', 'priority'],
        },

        NotificationListResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    notifications: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/NotificationV2',
                      },
                    },
                    pagination: {
                      $ref: '#/components/schemas/PaginationMeta',
                    },
                    unreadCount: {
                      type: 'integer',
                      example: 5,
                    },
                  },
                },
              },
            },
          ],
        },

        NotificationResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  $ref: '#/components/schemas/NotificationV2',
                },
              },
            },
          ],
        },

        CreateNotificationRequest: {
          type: 'object',
          required: ['recipientId', 'type', 'title', 'message'],
          properties: {
            recipientId: {
              type: 'integer',
              example: 5,
              description: 'User ID to send notification to',
            },
            type: {
              type: 'string',
              enum: ['email', 'push', 'in_app'],
              example: 'in_app',
            },
            category: {
              type: 'string',
              example: 'system',
            },
            title: {
              type: 'string',
              minLength: 1,
              maxLength: 200,
              example: 'Important Update',
            },
            message: {
              type: 'string',
              minLength: 1,
              maxLength: 1000,
              example: 'Please review the latest changes',
            },
            data: {
              type: 'object',
              nullable: true,
              example: { documentId: 456 },
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              default: 'medium',
              example: 'high',
            },
            actionUrl: {
              type: 'string',
              nullable: true,
              example: '/documents/456',
            },
            iconUrl: {
              type: 'string',
              nullable: true,
              example: '/assets/icons/document.png',
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-12-31T23:59:59.000Z',
            },
          },
        },

        NotificationPreferences: {
          type: 'object',
          properties: {
            email: {
              type: 'object',
              properties: {
                enabled: {
                  type: 'boolean',
                  example: true,
                },
                categories: {
                  type: 'object',
                  additionalProperties: {
                    type: 'boolean',
                  },
                  example: {
                    system: true,
                    marketing: false,
                    updates: true,
                  },
                },
              },
            },
            push: {
              type: 'object',
              properties: {
                enabled: {
                  type: 'boolean',
                  example: true,
                },
                categories: {
                  type: 'object',
                  additionalProperties: {
                    type: 'boolean',
                  },
                  example: {
                    system: true,
                    marketing: false,
                    updates: true,
                  },
                },
              },
            },
            inApp: {
              type: 'object',
              properties: {
                enabled: {
                  type: 'boolean',
                  example: true,
                },
                categories: {
                  type: 'object',
                  additionalProperties: {
                    type: 'boolean',
                  },
                  example: {
                    system: true,
                    marketing: true,
                    updates: true,
                  },
                },
              },
            },
          },
        },

        NotificationPreferencesResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    preferences: {
                      $ref: '#/components/schemas/NotificationPreferences',
                    },
                  },
                },
              },
            },
          ],
        },

        UpdatePreferencesRequest: {
          type: 'object',
          properties: {
            email: {
              type: 'object',
              properties: {
                enabled: {
                  type: 'boolean',
                },
                categories: {
                  type: 'object',
                  additionalProperties: {
                    type: 'boolean',
                  },
                },
              },
            },
            push: {
              type: 'object',
              properties: {
                enabled: {
                  type: 'boolean',
                },
                categories: {
                  type: 'object',
                  additionalProperties: {
                    type: 'boolean',
                  },
                },
              },
            },
            inApp: {
              type: 'object',
              properties: {
                enabled: {
                  type: 'boolean',
                },
                categories: {
                  type: 'object',
                  additionalProperties: {
                    type: 'boolean',
                  },
                },
              },
            },
          },
        },

        NotificationStatsResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    total: {
                      type: 'integer',
                      example: 1500,
                    },
                    byType: {
                      type: 'object',
                      properties: {
                        email: {
                          type: 'integer',
                          example: 500,
                        },
                        push: {
                          type: 'integer',
                          example: 300,
                        },
                        inApp: {
                          type: 'integer',
                          example: 700,
                        },
                      },
                    },
                    byPriority: {
                      type: 'object',
                      properties: {
                        low: {
                          type: 'integer',
                          example: 800,
                        },
                        medium: {
                          type: 'integer',
                          example: 600,
                        },
                        high: {
                          type: 'integer',
                          example: 100,
                        },
                      },
                    },
                    last30Days: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          date: {
                            type: 'string',
                            format: 'date',
                            example: '2025-01-01',
                          },
                          count: {
                            type: 'integer',
                            example: 50,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        },

        PersonalStatsResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    total: {
                      type: 'integer',
                      example: 150,
                    },
                    unread: {
                      type: 'integer',
                      example: 12,
                    },
                    byType: {
                      type: 'object',
                      properties: {
                        email: {
                          type: 'integer',
                          example: 50,
                        },
                        push: {
                          type: 'integer',
                          example: 30,
                        },
                        inApp: {
                          type: 'integer',
                          example: 70,
                        },
                      },
                    },
                    lastRead: {
                      type: 'string',
                      format: 'date-time',
                      nullable: true,
                      example: '2025-01-01T15:30:00.000Z',
                    },
                  },
                },
              },
            },
          ],
        },

        SubscribeRequest: {
          type: 'object',
          required: ['endpoint', 'keys'],
          properties: {
            endpoint: {
              type: 'string',
              example: 'https://fcm.googleapis.com/fcm/send/...',
            },
            keys: {
              type: 'object',
              properties: {
                p256dh: {
                  type: 'string',
                  example:
                    'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM=',
                },
                auth: {
                  type: 'string',
                  example: 'tBHItJI5svbpez7KI4CCXg==',
                },
              },
              required: ['p256dh', 'auth'],
            },
          },
        },

        TemplatesResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    templates: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'integer',
                            example: 1,
                          },
                          name: {
                            type: 'string',
                            example: 'Welcome Email',
                          },
                          category: {
                            type: 'string',
                            example: 'onboarding',
                          },
                          type: {
                            type: 'string',
                            enum: ['email', 'push', 'in_app'],
                            example: 'email',
                          },
                          variables: {
                            type: 'array',
                            items: {
                              type: 'string',
                            },
                            example: ['userName', 'companyName'],
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        },

        CreateFromTemplateRequest: {
          type: 'object',
          required: ['templateId', 'recipientId', 'variables'],
          properties: {
            templateId: {
              type: 'integer',
              example: 1,
            },
            recipientId: {
              type: 'integer',
              example: 5,
            },
            variables: {
              type: 'object',
              additionalProperties: {
                type: 'string',
              },
              example: {
                userName: 'John Doe',
                companyName: 'Acme Corp',
              },
            },
          },
        },

        // Features v2 Response Schemas
        FeatureResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  $ref: '#/components/schemas/FeatureV2',
                },
              },
            },
          ],
        },

        FeaturesByCategoryResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  additionalProperties: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/FeatureV2',
                    },
                  },
                  example: {
                    basic: [
                      {
                        id: 1,
                        code: 'USER_MANAGEMENT',
                        name: 'User Management',
                        category: 'basic',
                      },
                    ],
                    premium: [
                      {
                        id: 5,
                        code: 'ADVANCED_REPORTS',
                        name: 'Advanced Reports',
                        category: 'premium',
                      },
                    ],
                  },
                },
              },
            },
          ],
        },

        TenantFeaturesResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/TenantFeatureV2',
                  },
                },
              },
            },
          ],
        },

        MyFeaturesResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      feature: {
                        $ref: '#/components/schemas/FeatureV2',
                      },
                      isActive: {
                        type: 'boolean',
                        example: true,
                      },
                      activatedAt: {
                        type: 'string',
                        format: 'date-time',
                        nullable: true,
                        example: '2025-01-01T10:00:00.000Z',
                      },
                      expiresAt: {
                        type: 'string',
                        format: 'date-time',
                        nullable: true,
                        example: null,
                      },
                    },
                  },
                },
              },
            },
          ],
        },

        TenantFeaturesSummaryResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    totalFeatures: {
                      type: 'integer',
                      example: 15,
                    },
                    activeFeatures: {
                      type: 'integer',
                      example: 8,
                    },
                    byCategory: {
                      type: 'object',
                      additionalProperties: {
                        type: 'integer',
                      },
                      example: {
                        basic: 3,
                        core: 3,
                        premium: 2,
                        enterprise: 0,
                      },
                    },
                    monthlyBillingTotal: {
                      type: 'number',
                      format: 'float',
                      example: 299.99,
                    },
                  },
                },
              },
            },
          ],
        },

        FeatureActivationRequest: {
          type: 'object',
          required: ['tenantId', 'featureCode'],
          properties: {
            tenantId: {
              type: 'integer',
              example: 1,
            },
            featureCode: {
              type: 'string',
              example: 'ADVANCED_REPORTS',
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-12-31T23:59:59.000Z',
            },
            customPrice: {
              type: 'number',
              format: 'float',
              nullable: true,
              example: 99.99,
            },
          },
        },

        FeatureDeactivationRequest: {
          type: 'object',
          required: ['tenantId', 'featureCode'],
          properties: {
            tenantId: {
              type: 'integer',
              example: 1,
            },
            featureCode: {
              type: 'string',
              example: 'ADVANCED_REPORTS',
            },
          },
        },

        UsageStatsResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    featureCode: {
                      type: 'string',
                      example: 'CHAT_MESSAGING',
                    },
                    totalUsage: {
                      type: 'integer',
                      example: 1250,
                    },
                    uniqueUsers: {
                      type: 'integer',
                      example: 45,
                    },
                    dailyUsage: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          date: {
                            type: 'string',
                            format: 'date',
                            example: '2025-01-15',
                          },
                          count: {
                            type: 'integer',
                            example: 125,
                          },
                          uniqueUsers: {
                            type: 'integer',
                            example: 15,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        },

        FeatureAccessResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    hasAccess: {
                      type: 'boolean',
                      example: true,
                    },
                    featureCode: {
                      type: 'string',
                      example: 'CHAT_MESSAGING',
                    },
                    message: {
                      type: 'string',
                      example: 'Access to feature CHAT_MESSAGING granted',
                    },
                  },
                },
              },
            },
          ],
        },

        AllTenantsWithFeaturesResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      tenantId: {
                        type: 'integer',
                        example: 1,
                      },
                      tenantName: {
                        type: 'string',
                        example: 'Acme Corp',
                      },
                      activeFeatures: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            featureCode: {
                              type: 'string',
                              example: 'CHAT_MESSAGING',
                            },
                            featureName: {
                              type: 'string',
                              example: 'Chat & Messaging',
                            },
                            activatedAt: {
                              type: 'string',
                              format: 'date-time',
                              example: '2025-01-01T10:00:00.000Z',
                            },
                            expiresAt: {
                              type: 'string',
                              format: 'date-time',
                              nullable: true,
                              example: null,
                            },
                          },
                        },
                      },
                      featureCount: {
                        type: 'integer',
                        example: 5,
                      },
                    },
                  },
                },
              },
            },
          ],
        },

        // Common Error Codes
        ErrorCodes: {
          type: 'string',
          enum: [
            'VALIDATION_ERROR',
            'UNAUTHORIZED',
            'FORBIDDEN',
            'NOT_FOUND',
            'CONFLICT',
            'INVALID_CREDENTIALS',
            'TOKEN_EXPIRED',
            'INVALID_TOKEN',
            'MISSING_TOKEN',
            'ACCOUNT_INACTIVE',
            'TENANT_ERROR',
            'SERVER_ERROR',
            'RATE_LIMIT_EXCEEDED',
          ],
          description: 'Standard error codes used across the API',
        },

        // Departments v2 Schemas
        DepartmentV2: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            name: {
              type: 'string',
              example: 'Engineering',
            },
            description: {
              type: 'string',
              nullable: true,
              example: 'Software development department',
            },
            managerId: {
              type: 'integer',
              nullable: true,
              example: 5,
            },
            parentId: {
              type: 'integer',
              nullable: true,
              example: null,
              description: 'Parent department ID for hierarchical structure',
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive'],
              example: 'active',
            },
            visibility: {
              type: 'string',
              enum: ['public', 'private'],
              example: 'public',
            },
            tenantId: {
              type: 'integer',
              example: 1,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-10T10:00:00Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-10T10:00:00Z',
            },
            // Extended fields
            managerName: {
              type: 'string',
              nullable: true,
              example: 'John Smith',
              description: "Manager's name (only included with includeExtended=true)",
            },
            employeeCount: {
              type: 'integer',
              example: 25,
              description: 'Number of employees in department (only with includeExtended=true)',
            },
            teamCount: {
              type: 'integer',
              example: 5,
              description: 'Number of teams in department (only with includeExtended=true)',
            },
          },
          required: ['id', 'name', 'tenantId'],
        },

        DepartmentMember: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            username: {
              type: 'string',
              example: 'john.smith',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'john.smith@example.com',
            },
            firstName: {
              type: 'string',
              example: 'John',
            },
            lastName: {
              type: 'string',
              example: 'Smith',
            },
            position: {
              type: 'string',
              nullable: true,
              example: 'Senior Developer',
            },
            employeeId: {
              type: 'string',
              nullable: true,
              example: 'EMP001',
            },
          },
          required: ['id', 'username', 'email', 'firstName', 'lastName'],
        },

        CreateDepartmentRequestV2: {
          type: 'object',
          required: ['name'],
          properties: {
            name: {
              type: 'string',
              minLength: 2,
              maxLength: 100,
              example: 'Engineering',
            },
            description: {
              type: 'string',
              maxLength: 500,
              nullable: true,
              example: 'Software development department',
            },
            managerId: {
              type: 'integer',
              nullable: true,
              minimum: 1,
              example: 5,
            },
            parentId: {
              type: 'integer',
              nullable: true,
              minimum: 1,
              example: 1,
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive'],
              default: 'active',
              example: 'active',
            },
            visibility: {
              type: 'string',
              enum: ['public', 'private'],
              default: 'public',
              example: 'public',
            },
          },
        },

        UpdateDepartmentRequestV2: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              minLength: 2,
              maxLength: 100,
              example: 'Engineering',
            },
            description: {
              type: 'string',
              maxLength: 500,
              nullable: true,
              example: 'Updated department description',
            },
            managerId: {
              type: 'integer',
              nullable: true,
              minimum: 1,
              example: 10,
            },
            parentId: {
              type: 'integer',
              nullable: true,
              minimum: 1,
              example: 2,
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive'],
              example: 'active',
            },
            visibility: {
              type: 'string',
              enum: ['public', 'private'],
              example: 'public',
            },
          },
        },

        DepartmentResponseV2: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  $ref: '#/components/schemas/DepartmentV2',
                },
              },
            },
          ],
        },

        DepartmentsResponseV2: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/DepartmentV2',
                  },
                },
              },
            },
          ],
        },

        DepartmentMembersResponseV2: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/DepartmentMember',
                  },
                },
              },
            },
          ],
        },

        DepartmentStatsResponseV2: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    totalDepartments: {
                      type: 'integer',
                      example: 15,
                    },
                    totalTeams: {
                      type: 'integer',
                      example: 42,
                    },
                  },
                  required: ['totalDepartments', 'totalTeams'],
                },
              },
            },
          ],
        },

        // Blackboard v2 Schemas
        BlackboardEntryV2: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            tenantId: {
              type: 'integer',
              example: 1,
            },
            title: {
              type: 'string',
              example: 'Important Company Announcement',
            },
            content: {
              type: 'string',
              example: 'Please note the new office hours starting next week...',
            },
            orgLevel: {
              type: 'string',
              enum: ['company', 'department', 'team'],
              example: 'company',
            },
            orgId: {
              type: 'integer',
              nullable: true,
              example: null,
            },
            authorId: {
              type: 'integer',
              example: 1,
            },
            authorName: {
              type: 'string',
              example: 'admin',
            },
            authorFullName: {
              type: 'string',
              example: 'John Doe',
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-12-31T23:59:59.000Z',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'urgent'],
              example: 'high',
            },
            color: {
              type: 'string',
              example: 'blue',
            },
            requiresConfirmation: {
              type: 'boolean',
              example: true,
            },
            isConfirmed: {
              type: 'boolean',
              example: false,
            },
            status: {
              type: 'string',
              enum: ['active', 'archived'],
              example: 'active',
            },
            attachmentCount: {
              type: 'integer',
              example: 2,
            },
            attachments: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/BlackboardAttachmentV2',
              },
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-01T10:00:00.000Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-01T10:00:00.000Z',
            },
          },
          required: [
            'id',
            'tenantId',
            'title',
            'content',
            'orgLevel',
            'authorId',
            'priority',
            'color',
            'requiresConfirmation',
            'status',
            'createdAt',
            'updatedAt',
          ],
        },

        BlackboardAttachmentV2: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            entryId: {
              type: 'integer',
              example: 1,
            },
            filename: {
              type: 'string',
              example: '1234567890-attachment.pdf',
            },
            originalName: {
              type: 'string',
              example: 'Company_Policy_2025.pdf',
            },
            fileSize: {
              type: 'integer',
              example: 2048576,
              description: 'File size in bytes',
            },
            mimeType: {
              type: 'string',
              example: 'application/pdf',
            },
            filePath: {
              type: 'string',
              example: '/uploads/blackboard/1/1234567890-attachment.pdf',
            },
            uploadedBy: {
              type: 'integer',
              example: 1,
            },
            uploaderName: {
              type: 'string',
              example: 'admin',
            },
            uploadedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-01T10:00:00.000Z',
            },
          },
          required: [
            'id',
            'entryId',
            'filename',
            'originalName',
            'fileSize',
            'mimeType',
            'filePath',
            'uploadedBy',
            'uploadedAt',
          ],
        },

        BlackboardTagV2: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            name: {
              type: 'string',
              example: 'Important',
            },
            tenantId: {
              type: 'integer',
              example: 1,
            },
            color: {
              type: 'string',
              example: 'red',
            },
          },
          required: ['id', 'name', 'tenantId', 'color'],
        },

        ConfirmationUserV2: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            username: {
              type: 'string',
              example: 'john.doe',
            },
            email: {
              type: 'string',
              example: 'john.doe@company.com',
            },
            firstName: {
              type: 'string',
              example: 'John',
            },
            lastName: {
              type: 'string',
              example: 'Doe',
            },
            confirmed: {
              type: 'boolean',
              example: true,
            },
            confirmedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-01-01T10:30:00.000Z',
            },
          },
          required: ['id', 'username', 'email', 'firstName', 'lastName', 'confirmed'],
        },

        CreateBlackboardEntryRequestV2: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              minLength: 1,
              maxLength: 200,
              example: 'New Office Hours',
            },
            content: {
              type: 'string',
              minLength: 1,
              maxLength: 5000,
              example: 'Starting from next Monday, our office hours will be...',
            },
            orgLevel: {
              type: 'string',
              enum: ['company', 'department', 'team'],
              example: 'company',
            },
            orgId: {
              type: 'integer',
              nullable: true,
              minimum: 1,
              example: null,
              description: 'Required for department or team level entries',
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-12-31T23:59:59.000Z',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'urgent'],
              default: 'medium',
              example: 'high',
            },
            color: {
              type: 'string',
              maxLength: 50,
              default: 'blue',
              example: 'red',
            },
            requiresConfirmation: {
              type: 'boolean',
              default: false,
              example: true,
            },
            tags: {
              type: 'array',
              items: {
                type: 'string',
                maxLength: 50,
              },
              example: ['important', 'policy'],
            },
          },
          required: ['title', 'content', 'orgLevel'],
        },

        UpdateBlackboardEntryRequestV2: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              minLength: 1,
              maxLength: 200,
              example: 'Updated Office Hours',
            },
            content: {
              type: 'string',
              minLength: 1,
              maxLength: 5000,
              example: 'Updated content...',
            },
            orgLevel: {
              type: 'string',
              enum: ['company', 'department', 'team'],
              example: 'department',
            },
            orgId: {
              type: 'integer',
              nullable: true,
              minimum: 1,
              example: 5,
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: null,
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'urgent'],
              example: 'medium',
            },
            color: {
              type: 'string',
              maxLength: 50,
              example: 'green',
            },
            status: {
              type: 'string',
              enum: ['active', 'archived'],
              example: 'active',
            },
            requiresConfirmation: {
              type: 'boolean',
              example: false,
            },
            tags: {
              type: 'array',
              items: {
                type: 'string',
                maxLength: 50,
              },
              example: ['updated'],
            },
          },
        },

        BlackboardEntryResponseV2: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  $ref: '#/components/schemas/BlackboardEntryV2',
                },
              },
            },
          ],
        },

        BlackboardEntriesResponseV2: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/BlackboardEntryV2',
                  },
                },
                meta: {
                  type: 'object',
                  properties: {
                    pagination: {
                      type: 'object',
                      properties: {
                        total: {
                          type: 'integer',
                          example: 100,
                        },
                        page: {
                          type: 'integer',
                          example: 1,
                        },
                        limit: {
                          type: 'integer',
                          example: 10,
                        },
                        totalPages: {
                          type: 'integer',
                          example: 10,
                        },
                      },
                      required: ['total', 'page', 'limit', 'totalPages'],
                    },
                  },
                },
              },
            },
          ],
        },

        DashboardEntriesResponseV2: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/BlackboardEntryV2',
                  },
                },
              },
            },
          ],
        },

        ConfirmationStatusResponseV2: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/ConfirmationUserV2',
                  },
                },
              },
            },
          ],
        },

        TagsResponseV2: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/BlackboardTagV2',
                  },
                },
              },
            },
          ],
        },

        AttachmentUploadResponseV2: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    id: {
                      type: 'integer',
                      example: 1,
                    },
                    message: {
                      type: 'string',
                      example: 'Attachment added successfully',
                    },
                  },
                  required: ['id', 'message'],
                },
              },
            },
          ],
        },

        AttachmentsResponseV2: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/BlackboardAttachmentV2',
                  },
                },
              },
            },
          ],
        },

        // KVP Schemas
        KvpSuggestionV2: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            title: {
              type: 'string',
              example: 'Optimize production line workflow',
            },
            description: {
              type: 'string',
              example: 'By reorganizing the workflow, we can reduce production time by 20%',
            },
            categoryId: {
              type: 'integer',
              example: 1,
            },
            categoryName: {
              type: 'string',
              example: 'Productivity',
            },
            categoryColor: {
              type: 'string',
              example: '#3498db',
            },
            categoryIcon: {
              type: 'string',
              example: '💡',
            },
            orgLevel: {
              type: 'string',
              enum: ['company', 'department', 'team'],
              example: 'department',
            },
            orgId: {
              type: 'integer',
              example: 5,
            },
            submittedBy: {
              type: 'integer',
              example: 42,
            },
            submittedByName: {
              type: 'string',
              example: 'John Doe',
            },
            submittedByEmail: {
              type: 'string',
              example: 'john.doe@example.com',
            },
            assignedTo: {
              type: 'integer',
              nullable: true,
              example: 1,
            },
            assignedToName: {
              type: 'string',
              nullable: true,
              example: 'Admin User',
            },
            priority: {
              type: 'string',
              enum: ['low', 'normal', 'high', 'urgent'],
              example: 'high',
            },
            expectedBenefit: {
              type: 'string',
              nullable: true,
              example: '20% reduction in production time',
            },
            estimatedCost: {
              type: 'number',
              nullable: true,
              example: 5000,
            },
            actualSavings: {
              type: 'number',
              nullable: true,
              example: 15000,
            },
            status: {
              type: 'string',
              enum: ['new', 'in_progress', 'implemented', 'rejected'],
              example: 'in_progress',
            },
            attachmentCount: {
              type: 'integer',
              example: 3,
            },
            commentCount: {
              type: 'integer',
              example: 5,
            },
            avgRating: {
              type: 'number',
              nullable: true,
              example: 4.5,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-01T10:00:00.000Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-15T15:30:00.000Z',
            },
          },
          required: [
            'id',
            'title',
            'description',
            'categoryId',
            'orgLevel',
            'orgId',
            'submittedBy',
            'status',
            'priority',
          ],
        },
        KvpCommentV2: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            comment: {
              type: 'string',
              example: 'Great idea! This could really improve our efficiency.',
            },
            isInternal: {
              type: 'boolean',
              example: false,
            },
            userId: {
              type: 'integer',
              example: 42,
            },
            firstName: {
              type: 'string',
              example: 'John',
            },
            lastName: {
              type: 'string',
              example: 'Doe',
            },
            role: {
              type: 'string',
              example: 'employee',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-01T14:30:00.000Z',
            },
          },
          required: ['id', 'comment', 'isInternal', 'userId', 'createdAt'],
        },

        // Shifts API v2 Schemas
        ShiftV2: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            planId: {
              type: 'integer',
              nullable: true,
              example: 10,
            },
            userId: {
              type: 'integer',
              example: 42,
            },
            templateId: {
              type: 'integer',
              nullable: true,
              example: 5,
            },
            date: {
              type: 'string',
              format: 'date',
              example: '2025-01-20',
            },
            startTime: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-20T08:00:00.000Z',
            },
            endTime: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-20T16:00:00.000Z',
            },
            title: {
              type: 'string',
              nullable: true,
              example: 'Morning Shift',
            },
            requiredEmployees: {
              type: 'integer',
              example: 3,
            },
            actualStart: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-01-20T08:05:00.000Z',
            },
            actualEnd: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-01-20T16:10:00.000Z',
            },
            breakMinutes: {
              type: 'integer',
              example: 30,
            },
            status: {
              type: 'string',
              enum: ['planned', 'confirmed', 'in_progress', 'completed', 'cancelled'],
              example: 'confirmed',
            },
            type: {
              type: 'string',
              enum: ['regular', 'overtime', 'standby', 'vacation', 'sick', 'holiday'],
              example: 'regular',
            },
            notes: {
              type: 'string',
              nullable: true,
              example: 'Please arrive 10 minutes early for handover',
            },
            departmentId: {
              type: 'integer',
              example: 1,
            },
            teamId: {
              type: 'integer',
              nullable: true,
              example: 3,
            },
            createdBy: {
              type: 'integer',
              example: 1,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-01T10:00:00.000Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-15T15:30:00.000Z',
            },
          },
          required: ['id', 'userId', 'date', 'startTime', 'endTime', 'departmentId'],
        },
        ShiftTemplateV2: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            name: {
              type: 'string',
              example: 'Early Shift',
            },
            startTime: {
              type: 'string',
              pattern: '^([01]\\d|2[0-3]):([0-5]\\d)$',
              example: '06:00',
            },
            endTime: {
              type: 'string',
              pattern: '^([01]\\d|2[0-3]):([0-5]\\d)$',
              example: '14:00',
            },
            breakMinutes: {
              type: 'integer',
              example: 30,
            },
            color: {
              type: 'string',
              pattern: '^#[0-9A-Fa-f]{6}$',
              example: '#3498db',
            },
            isNightShift: {
              type: 'boolean',
              example: false,
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-01T10:00:00.000Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-15T15:30:00.000Z',
            },
          },
          required: ['id', 'name', 'startTime', 'endTime'],
        },
        ShiftSwapRequestV2: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            shiftId: {
              type: 'integer',
              example: 10,
            },
            requestedBy: {
              type: 'integer',
              example: 42,
            },
            requestedWith: {
              type: 'integer',
              nullable: true,
              example: 43,
            },
            reason: {
              type: 'string',
              nullable: true,
              example: 'Medical appointment',
            },
            status: {
              type: 'string',
              enum: ['pending', 'approved', 'rejected', 'cancelled'],
              example: 'pending',
            },
            approvedBy: {
              type: 'integer',
              nullable: true,
              example: 1,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-01T10:00:00.000Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-15T15:30:00.000Z',
            },
          },
          required: ['id', 'shiftId', 'requestedBy', 'status'],
        },
        CreateShiftRequestV2: {
          type: 'object',
          properties: {
            userId: {
              type: 'integer',
              example: 42,
            },
            date: {
              type: 'string',
              format: 'date',
              example: '2025-01-20',
            },
            startTime: {
              type: 'string',
              pattern: '^([01]\\d|2[0-3]):([0-5]\\d)$',
              example: '08:00',
            },
            endTime: {
              type: 'string',
              pattern: '^([01]\\d|2[0-3]):([0-5]\\d)$',
              example: '16:00',
            },
            departmentId: {
              type: 'integer',
              example: 1,
            },
            planId: {
              type: 'integer',
              nullable: true,
            },
            templateId: {
              type: 'integer',
              nullable: true,
            },
            title: {
              type: 'string',
              nullable: true,
            },
            requiredEmployees: {
              type: 'integer',
              nullable: true,
            },
            breakMinutes: {
              type: 'integer',
              nullable: true,
            },
            status: {
              type: 'string',
              enum: ['planned', 'confirmed', 'in_progress', 'completed', 'cancelled'],
              nullable: true,
            },
            type: {
              type: 'string',
              enum: ['regular', 'overtime', 'standby', 'vacation', 'sick', 'holiday'],
              nullable: true,
            },
            notes: {
              type: 'string',
              nullable: true,
            },
            teamId: {
              type: 'integer',
              nullable: true,
            },
          },
          required: ['userId', 'date', 'startTime', 'endTime', 'departmentId'],
        },
        UpdateShiftRequestV2: {
          type: 'object',
          properties: {
            userId: {
              type: 'integer',
              nullable: true,
            },
            date: {
              type: 'string',
              format: 'date',
              nullable: true,
            },
            startTime: {
              type: 'string',
              pattern: '^([01]\\d|2[0-3]):([0-5]\\d)$',
              nullable: true,
            },
            endTime: {
              type: 'string',
              pattern: '^([01]\\d|2[0-3]):([0-5]\\d)$',
              nullable: true,
            },
            actualStart: {
              type: 'string',
              pattern: '^([01]\\d|2[0-3]):([0-5]\\d):([0-5]\\d)$',
              nullable: true,
            },
            actualEnd: {
              type: 'string',
              pattern: '^([01]\\d|2[0-3]):([0-5]\\d):([0-5]\\d)$',
              nullable: true,
            },
            departmentId: {
              type: 'integer',
              nullable: true,
            },
            planId: {
              type: 'integer',
              nullable: true,
            },
            templateId: {
              type: 'integer',
              nullable: true,
            },
            title: {
              type: 'string',
              nullable: true,
            },
            requiredEmployees: {
              type: 'integer',
              nullable: true,
            },
            breakMinutes: {
              type: 'integer',
              nullable: true,
            },
            status: {
              type: 'string',
              enum: ['planned', 'confirmed', 'in_progress', 'completed', 'cancelled'],
              nullable: true,
            },
            type: {
              type: 'string',
              enum: ['regular', 'overtime', 'standby', 'vacation', 'sick', 'holiday'],
              nullable: true,
            },
            notes: {
              type: 'string',
              nullable: true,
            },
            teamId: {
              type: 'integer',
              nullable: true,
            },
          },
        },
        CreateTemplateRequestV2: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              example: 'Early Shift',
            },
            startTime: {
              type: 'string',
              pattern: '^([01]\\d|2[0-3]):([0-5]\\d)$',
              example: '06:00',
            },
            endTime: {
              type: 'string',
              pattern: '^([01]\\d|2[0-3]):([0-5]\\d)$',
              example: '14:00',
            },
            breakMinutes: {
              type: 'integer',
              nullable: true,
              example: 30,
            },
            color: {
              type: 'string',
              pattern: '^#[0-9A-Fa-f]{6}$',
              nullable: true,
              example: '#3498db',
            },
            isNightShift: {
              type: 'boolean',
              nullable: true,
              example: false,
            },
            isActive: {
              type: 'boolean',
              nullable: true,
              example: true,
            },
          },
          required: ['name', 'startTime', 'endTime'],
        },
        UpdateTemplateRequestV2: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              nullable: true,
            },
            startTime: {
              type: 'string',
              pattern: '^([01]\\d|2[0-3]):([0-5]\\d)$',
              nullable: true,
            },
            endTime: {
              type: 'string',
              pattern: '^([01]\\d|2[0-3]):([0-5]\\d)$',
              nullable: true,
            },
            breakMinutes: {
              type: 'integer',
              nullable: true,
            },
            color: {
              type: 'string',
              pattern: '^#[0-9A-Fa-f]{6}$',
              nullable: true,
            },
            isNightShift: {
              type: 'boolean',
              nullable: true,
            },
            isActive: {
              type: 'boolean',
              nullable: true,
            },
          },
        },
        CreateSwapRequestV2: {
          type: 'object',
          properties: {
            shiftId: {
              type: 'integer',
              example: 10,
            },
            requestedWithUserId: {
              type: 'integer',
              nullable: true,
              example: 43,
            },
            reason: {
              type: 'string',
              nullable: true,
              example: 'Medical appointment',
            },
          },
          required: ['shiftId'],
        },
        ShiftResponseV2: {
          allOf: [
            { $ref: '#/components/schemas/BaseResponseV2' },
            {
              type: 'object',
              properties: {
                data: {
                  $ref: '#/components/schemas/ShiftV2',
                },
              },
            },
          ],
        },
        ShiftListResponseV2: {
          allOf: [
            { $ref: '#/components/schemas/BaseResponseV2' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/ShiftV2',
                  },
                },
                pagination: {
                  $ref: '#/components/schemas/PaginationMeta',
                },
              },
            },
          ],
        },
        TemplateResponseV2: {
          allOf: [
            { $ref: '#/components/schemas/BaseResponseV2' },
            {
              type: 'object',
              properties: {
                data: {
                  $ref: '#/components/schemas/ShiftTemplateV2',
                },
              },
            },
          ],
        },
        TemplateListResponseV2: {
          allOf: [
            { $ref: '#/components/schemas/BaseResponseV2' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/ShiftTemplateV2',
                  },
                },
              },
            },
          ],
        },
        SwapRequestResponseV2: {
          allOf: [
            { $ref: '#/components/schemas/BaseResponseV2' },
            {
              type: 'object',
              properties: {
                data: {
                  $ref: '#/components/schemas/ShiftSwapRequestV2',
                },
              },
            },
          ],
        },
        SwapRequestListResponseV2: {
          allOf: [
            { $ref: '#/components/schemas/BaseResponseV2' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/ShiftSwapRequestV2',
                  },
                },
              },
            },
          ],
        },
        OvertimeReportResponseV2: {
          allOf: [
            { $ref: '#/components/schemas/BaseResponseV2' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    userId: {
                      type: 'integer',
                      example: 42,
                    },
                    startDate: {
                      type: 'string',
                      format: 'date',
                      example: '2025-01-01',
                    },
                    endDate: {
                      type: 'string',
                      format: 'date',
                      example: '2025-01-31',
                    },
                    totalHours: {
                      type: 'number',
                      example: 45.5,
                    },
                    overtimeHours: {
                      type: 'number',
                      example: 5.5,
                    },
                    regularHours: {
                      type: 'number',
                      example: 40,
                    },
                    shifts: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/ShiftV2',
                      },
                    },
                  },
                },
              },
            },
          ],
        },

        // Features API v2 Schemas
        FeatureV2: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            code: {
              type: 'string',
              example: 'premium_reports',
            },
            name: {
              type: 'string',
              example: 'Premium Reports',
            },
            description: {
              type: 'string',
              nullable: true,
              example: 'Access to advanced reporting and analytics features',
            },
            category: {
              type: 'string',
              example: 'analytics',
            },
            price: {
              type: 'number',
              nullable: true,
              example: 49.99,
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-01T10:00:00.000Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-15T15:30:00.000Z',
            },
          },
          required: ['id', 'code', 'name', 'category', 'isActive'],
        },
        TenantFeatureV2: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            tenantId: {
              type: 'integer',
              example: 10,
            },
            featureId: {
              type: 'integer',
              example: 1,
            },
            featureCode: {
              type: 'string',
              example: 'premium_reports',
            },
            featureName: {
              type: 'string',
              example: 'Premium Reports',
            },
            status: {
              type: 'string',
              enum: ['active', 'trial', 'disabled'],
              example: 'active',
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
            validFrom: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-01-01T00:00:00.000Z',
            },
            validUntil: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-12-31T23:59:59.000Z',
            },
            customPrice: {
              type: 'number',
              nullable: true,
              example: 39.99,
            },
            trialDays: {
              type: 'integer',
              nullable: true,
              example: 30,
            },
            usageLimit: {
              type: 'integer',
              nullable: true,
              example: 1000,
            },
            currentUsage: {
              type: 'integer',
              example: 250,
            },
            activatedBy: {
              type: 'integer',
              nullable: true,
              example: 1,
            },
            activatedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-01-01T10:00:00.000Z',
            },
            customConfig: {
              type: 'object',
              nullable: true,
              additionalProperties: true,
            },
          },
          required: ['id', 'tenantId', 'featureId', 'status', 'isActive'],
        },
        FeatureActivationRequestV2: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'integer',
              example: 10,
              description: 'ID of the tenant to activate feature for',
            },
            featureCode: {
              type: 'string',
              example: 'premium_reports',
              description: 'Unique code of the feature to activate',
            },
            options: {
              type: 'object',
              properties: {
                expiresAt: {
                  type: 'string',
                  format: 'date-time',
                  nullable: true,
                  example: '2025-12-31T23:59:59.000Z',
                },
                customPrice: {
                  type: 'number',
                  nullable: true,
                  example: 39.99,
                },
                trialDays: {
                  type: 'integer',
                  nullable: true,
                  example: 30,
                },
                usageLimit: {
                  type: 'integer',
                  nullable: true,
                  example: 1000,
                },
                customConfig: {
                  type: 'object',
                  nullable: true,
                  additionalProperties: true,
                },
              },
            },
          },
          required: ['tenantId', 'featureCode'],
        },

        // Surveys API v2 Schemas
        SurveyV2: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            title: {
              type: 'string',
              example: 'Employee Satisfaction Survey',
            },
            description: {
              type: 'string',
              nullable: true,
              example: 'Annual survey to gauge employee satisfaction and engagement',
            },
            status: {
              type: 'string',
              enum: ['draft', 'active', 'closed'],
              example: 'active',
            },
            isAnonymous: {
              type: 'boolean',
              example: true,
            },
            isMandatory: {
              type: 'boolean',
              example: false,
            },
            startDate: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-01-01T00:00:00Z',
            },
            endDate: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-01-31T23:59:59Z',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-01T12:00:00Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-01T12:00:00Z',
            },
            createdBy: {
              type: 'integer',
              example: 10,
            },
            responseCount: {
              type: 'integer',
              example: 42,
            },
            completedCount: {
              type: 'integer',
              example: 35,
            },
            questions: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/SurveyQuestionV2',
              },
            },
            assignments: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/SurveyAssignmentV2',
              },
            },
          },
        },
        SurveyListItemV2: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            title: {
              type: 'string',
              example: 'Employee Satisfaction Survey',
            },
            description: {
              type: 'string',
              nullable: true,
              example: 'Annual survey to gauge employee satisfaction',
            },
            status: {
              type: 'string',
              enum: ['draft', 'active', 'closed'],
              example: 'active',
            },
            isAnonymous: {
              type: 'boolean',
              example: true,
            },
            isMandatory: {
              type: 'boolean',
              example: false,
            },
            startDate: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-01-01T00:00:00Z',
            },
            endDate: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-01-31T23:59:59Z',
            },
            responseCount: {
              type: 'integer',
              example: 42,
            },
            completedCount: {
              type: 'integer',
              example: 35,
            },
            creatorFirstName: {
              type: 'string',
              example: 'Max',
            },
            creatorLastName: {
              type: 'string',
              example: 'Mustermann',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-01T12:00:00Z',
            },
          },
        },
        SurveyQuestionV2: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            questionText: {
              type: 'string',
              example: 'How satisfied are you with your current role?',
            },
            questionType: {
              type: 'string',
              enum: ['text', 'single_choice', 'multiple_choice', 'rating', 'number'],
              example: 'rating',
            },
            isRequired: {
              type: 'boolean',
              example: true,
            },
            orderPosition: {
              type: 'integer',
              example: 1,
            },
            options: {
              type: 'array',
              nullable: true,
              items: {
                type: 'string',
              },
              example: [
                'Very Dissatisfied',
                'Dissatisfied',
                'Neutral',
                'Satisfied',
                'Very Satisfied',
              ],
            },
          },
        },
        SurveyAssignmentV2: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            type: {
              type: 'string',
              enum: ['company', 'department', 'team', 'individual'],
              example: 'department',
            },
            departmentId: {
              type: 'integer',
              nullable: true,
              example: 5,
            },
            teamId: {
              type: 'integer',
              nullable: true,
              example: null,
            },
            userId: {
              type: 'integer',
              nullable: true,
              example: null,
            },
          },
        },
        SurveyTemplateV2: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            name: {
              type: 'string',
              example: 'Employee Satisfaction Template',
            },
            description: {
              type: 'string',
              example: 'Standard template for measuring employee satisfaction',
            },
            category: {
              type: 'string',
              example: 'HR',
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
            questionCount: {
              type: 'integer',
              example: 10,
            },
          },
        },
        SurveyStatisticsV2: {
          type: 'object',
          properties: {
            surveyId: {
              type: 'integer',
              example: 1,
            },
            totalResponses: {
              type: 'integer',
              example: 42,
            },
            completedResponses: {
              type: 'integer',
              example: 35,
            },
            completionRate: {
              type: 'number',
              format: 'float',
              example: 83.33,
            },
            firstResponse: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-01-02T09:00:00Z',
            },
            lastResponse: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-01-15T17:30:00Z',
            },
            questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {
                    type: 'integer',
                    example: 1,
                  },
                  questionText: {
                    type: 'string',
                    example: 'How satisfied are you with your current role?',
                  },
                  questionType: {
                    type: 'string',
                    enum: ['text', 'single_choice', 'multiple_choice', 'rating', 'number'],
                    example: 'rating',
                  },
                  responses: {
                    type: 'integer',
                    example: 40,
                  },
                  options: {
                    type: 'array',
                    nullable: true,
                    items: {
                      type: 'object',
                      properties: {
                        optionId: {
                          type: 'integer',
                          example: 1,
                        },
                        optionText: {
                          type: 'string',
                          example: 'Very Satisfied',
                        },
                        count: {
                          type: 'integer',
                          example: 15,
                        },
                      },
                    },
                  },
                  statistics: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      average: {
                        type: 'number',
                        format: 'float',
                        example: 4.2,
                      },
                      min: {
                        type: 'number',
                        example: 1,
                      },
                      max: {
                        type: 'number',
                        example: 5,
                      },
                      totalResponses: {
                        type: 'integer',
                        example: 40,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        SurveyCreateRequestV2: {
          type: 'object',
          required: ['title'],
          properties: {
            title: {
              type: 'string',
              minLength: 1,
              maxLength: 255,
              example: 'Employee Satisfaction Survey 2025',
            },
            description: {
              type: 'string',
              maxLength: 1000,
              example: 'Annual survey to gauge employee satisfaction and engagement',
            },
            status: {
              type: 'string',
              enum: ['draft', 'active', 'closed'],
              default: 'draft',
              example: 'draft',
            },
            isAnonymous: {
              type: 'boolean',
              default: false,
              example: true,
            },
            isMandatory: {
              type: 'boolean',
              default: false,
              example: false,
            },
            startDate: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-01-01T00:00:00Z',
            },
            endDate: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-01-31T23:59:59Z',
            },
            questions: {
              type: 'array',
              items: {
                type: 'object',
                required: ['questionText', 'questionType'],
                properties: {
                  questionText: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 500,
                    example: 'How satisfied are you with your current role?',
                  },
                  questionType: {
                    type: 'string',
                    enum: ['text', 'single_choice', 'multiple_choice', 'rating', 'number'],
                    example: 'rating',
                  },
                  isRequired: {
                    type: 'boolean',
                    default: true,
                    example: true,
                  },
                  orderPosition: {
                    type: 'integer',
                    minimum: 1,
                    example: 1,
                  },
                  options: {
                    type: 'array',
                    items: {
                      type: 'string',
                    },
                    example: [
                      'Very Dissatisfied',
                      'Dissatisfied',
                      'Neutral',
                      'Satisfied',
                      'Very Satisfied',
                    ],
                  },
                },
              },
            },
            assignments: {
              type: 'array',
              items: {
                type: 'object',
                required: ['type'],
                properties: {
                  type: {
                    type: 'string',
                    enum: ['company', 'department', 'team', 'individual'],
                    example: 'department',
                  },
                  departmentId: {
                    type: 'integer',
                    nullable: true,
                    example: 5,
                  },
                  teamId: {
                    type: 'integer',
                    nullable: true,
                    example: null,
                  },
                  userId: {
                    type: 'integer',
                    nullable: true,
                    example: null,
                  },
                },
              },
            },
          },
        },
        SurveyUpdateRequestV2: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              minLength: 1,
              maxLength: 255,
              example: 'Updated Employee Satisfaction Survey',
            },
            description: {
              type: 'string',
              maxLength: 1000,
              example: 'Updated description for the survey',
            },
            status: {
              type: 'string',
              enum: ['draft', 'active', 'closed'],
              example: 'active',
            },
            isAnonymous: {
              type: 'boolean',
              example: true,
            },
            isMandatory: {
              type: 'boolean',
              example: false,
            },
            startDate: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-01-01T00:00:00Z',
            },
            endDate: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-01-31T23:59:59Z',
            },
            questions: {
              type: 'array',
              items: {
                type: 'object',
                required: ['questionText', 'questionType'],
                properties: {
                  questionText: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 500,
                    example: 'Updated question text',
                  },
                  questionType: {
                    type: 'string',
                    enum: ['text', 'single_choice', 'multiple_choice', 'rating', 'number'],
                    example: 'rating',
                  },
                  isRequired: {
                    type: 'boolean',
                    example: true,
                  },
                  orderPosition: {
                    type: 'integer',
                    minimum: 1,
                    example: 1,
                  },
                  options: {
                    type: 'array',
                    items: {
                      type: 'string',
                    },
                    example: ['Option 1', 'Option 2', 'Option 3'],
                  },
                },
              },
            },
          },
        },
        // Survey Response Schemas
        SurveyResponseV2: {
          allOf: [
            { $ref: '#/components/schemas/BaseResponseV2' },
            {
              type: 'object',
              properties: {
                data: {
                  $ref: '#/components/schemas/SurveyV2',
                },
              },
            },
          ],
        },
        SurveyListResponseV2: {
          allOf: [
            { $ref: '#/components/schemas/BaseResponseV2' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/SurveyListItemV2',
                  },
                },
                pagination: {
                  $ref: '#/components/schemas/PaginationMeta',
                },
              },
            },
          ],
        },
        SurveyTemplateResponseV2: {
          allOf: [
            { $ref: '#/components/schemas/BaseResponseV2' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/SurveyTemplateV2',
                  },
                },
              },
            },
          ],
        },
        SurveyStatisticsResponseV2: {
          allOf: [
            { $ref: '#/components/schemas/BaseResponseV2' },
            {
              type: 'object',
              properties: {
                data: {
                  $ref: '#/components/schemas/SurveyStatisticsV2',
                },
              },
            },
          ],
        },

        // Root API v2 Schemas
        AdminUser: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            username: {
              type: 'string',
              example: 'admin.smith',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'admin@company.com',
            },
            firstName: {
              type: 'string',
              example: 'John',
            },
            lastName: {
              type: 'string',
              example: 'Smith',
            },
            company: {
              type: 'string',
              nullable: true,
              example: 'Acme Corp',
            },
            notes: {
              type: 'string',
              nullable: true,
              example: 'Main admin for production',
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
            tenantId: {
              type: 'integer',
              example: 1,
            },
            tenantName: {
              type: 'string',
              nullable: true,
              example: 'Acme Corp',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-15T10:00:00.000Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-15T10:00:00.000Z',
            },
            lastLogin: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-01-20T14:30:00.000Z',
            },
          },
        },

        CreateAdminRequest: {
          type: 'object',
          required: ['username', 'email', 'password'],
          properties: {
            username: {
              type: 'string',
              example: 'admin.smith',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'admin@company.com',
            },
            password: {
              type: 'string',
              format: 'password',
              minLength: 6,
              example: 'SecurePassword123!',
            },
            firstName: {
              type: 'string',
              example: 'John',
            },
            lastName: {
              type: 'string',
              example: 'Smith',
            },
            company: {
              type: 'string',
              example: 'Acme Corp',
            },
            notes: {
              type: 'string',
              example: 'Main admin for production',
            },
          },
        },

        UpdateAdminRequest: {
          type: 'object',
          properties: {
            username: {
              type: 'string',
              example: 'admin.smith',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'admin@company.com',
            },
            password: {
              type: 'string',
              format: 'password',
              minLength: 6,
              example: 'NewPassword123!',
            },
            firstName: {
              type: 'string',
              example: 'John',
            },
            lastName: {
              type: 'string',
              example: 'Smith',
            },
            company: {
              type: 'string',
              example: 'Acme Corp',
            },
            notes: {
              type: 'string',
              example: 'Updated notes',
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
          },
        },

        RootUser: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            username: {
              type: 'string',
              example: 'root.admin',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'root@company.com',
            },
            firstName: {
              type: 'string',
              example: 'Super',
            },
            lastName: {
              type: 'string',
              example: 'Admin',
            },
            position: {
              type: 'string',
              nullable: true,
              example: 'System Administrator',
            },
            notes: {
              type: 'string',
              nullable: true,
              example: 'Primary root user',
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
            employeeId: {
              type: 'string',
              nullable: true,
              example: 'ROOT-001',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-01T00:00:00.000Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-15T10:00:00.000Z',
            },
          },
        },

        CreateRootUserRequest: {
          type: 'object',
          required: ['username', 'email', 'password', 'firstName', 'lastName'],
          properties: {
            username: {
              type: 'string',
              example: 'root.admin',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'root@company.com',
            },
            password: {
              type: 'string',
              format: 'password',
              minLength: 6,
              example: 'SuperSecure123!',
            },
            firstName: {
              type: 'string',
              example: 'Super',
            },
            lastName: {
              type: 'string',
              example: 'Admin',
            },
            position: {
              type: 'string',
              example: 'System Administrator',
            },
            notes: {
              type: 'string',
              example: 'Primary root user',
            },
            isActive: {
              type: 'boolean',
              default: true,
              example: true,
            },
          },
        },

        UpdateRootUserRequest: {
          type: 'object',
          properties: {
            firstName: {
              type: 'string',
              example: 'Super',
            },
            lastName: {
              type: 'string',
              example: 'Admin',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'root@company.com',
            },
            position: {
              type: 'string',
              example: 'System Administrator',
            },
            notes: {
              type: 'string',
              example: 'Updated notes',
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
          },
        },

        Tenant: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            companyName: {
              type: 'string',
              example: 'Acme Corporation',
            },
            subdomain: {
              type: 'string',
              example: 'acme',
            },
            currentPlan: {
              type: 'string',
              nullable: true,
              example: 'professional',
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'suspended', 'deleted'],
              example: 'active',
            },
            maxUsers: {
              type: 'integer',
              nullable: true,
              example: 100,
            },
            maxAdmins: {
              type: 'integer',
              nullable: true,
              example: 5,
            },
            industry: {
              type: 'string',
              nullable: true,
              example: 'Manufacturing',
            },
            country: {
              type: 'string',
              nullable: true,
              example: 'DE',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-01T00:00:00.000Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-15T10:00:00.000Z',
            },
            adminCount: {
              type: 'integer',
              example: 3,
            },
            employeeCount: {
              type: 'integer',
              example: 85,
            },
            storageUsed: {
              type: 'integer',
              example: 2147483648,
              description: 'Storage used in bytes',
            },
          },
        },

        TenantDeletionRequest: {
          type: 'object',
          properties: {
            reason: {
              type: 'string',
              example: 'Company closure',
            },
          },
        },

        TenantDeletionStatus: {
          type: 'object',
          properties: {
            queueId: {
              type: 'integer',
              example: 1,
            },
            tenantId: {
              type: 'integer',
              example: 1,
            },
            status: {
              type: 'string',
              enum: [
                'pending',
                'approved',
                'executing',
                'completed',
                'failed',
                'cancelled',
                'stopped',
              ],
              example: 'pending',
            },
            requestedBy: {
              type: 'integer',
              example: 1,
            },
            requestedByName: {
              type: 'string',
              nullable: true,
              example: 'root.admin',
            },
            requestedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-20T10:00:00.000Z',
            },
            approvedBy: {
              type: 'integer',
              nullable: true,
              example: 2,
            },
            approvedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-01-20T11:00:00.000Z',
            },
            scheduledFor: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-02-20T10:00:00.000Z',
            },
            reason: {
              type: 'string',
              nullable: true,
              example: 'Company closure',
            },
            errorMessage: {
              type: 'string',
              nullable: true,
              example: null,
            },
            canCancel: {
              type: 'boolean',
              example: true,
            },
            canApprove: {
              type: 'boolean',
              example: true,
            },
          },
        },

        DeletionApproval: {
          type: 'object',
          properties: {
            queueId: {
              type: 'integer',
              example: 1,
            },
            tenantId: {
              type: 'integer',
              example: 1,
            },
            companyName: {
              type: 'string',
              example: 'Acme Corporation',
            },
            subdomain: {
              type: 'string',
              example: 'acme',
            },
            requesterId: {
              type: 'integer',
              example: 1,
            },
            requesterName: {
              type: 'string',
              example: 'root.admin',
            },
            requesterEmail: {
              type: 'string',
              format: 'email',
              example: 'root@company.com',
            },
            requestedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-20T10:00:00.000Z',
            },
            reason: {
              type: 'string',
              nullable: true,
              example: 'Company closure',
            },
            status: {
              type: 'string',
              example: 'pending',
            },
          },
        },

        DashboardStats: {
          type: 'object',
          properties: {
            adminCount: {
              type: 'integer',
              example: 5,
            },
            employeeCount: {
              type: 'integer',
              example: 95,
            },
            totalUsers: {
              type: 'integer',
              example: 101,
              description: 'Total users including root',
            },
            tenantCount: {
              type: 'integer',
              nullable: true,
              example: 25,
            },
            activeFeatures: {
              type: 'array',
              nullable: true,
              items: {
                type: 'string',
              },
              example: ['CHAT_MESSAGING', 'ADVANCED_REPORTS', 'SHIFT_PLANNING'],
            },
            systemHealth: {
              type: 'object',
              nullable: true,
              properties: {
                database: {
                  type: 'string',
                  enum: ['healthy', 'degraded', 'down'],
                  example: 'healthy',
                },
                storage: {
                  type: 'string',
                  enum: ['healthy', 'degraded', 'down'],
                  example: 'healthy',
                },
                services: {
                  type: 'string',
                  enum: ['healthy', 'degraded', 'down'],
                  example: 'healthy',
                },
              },
            },
          },
        },

        StorageInfo: {
          type: 'object',
          properties: {
            used: {
              type: 'integer',
              example: 2147483648,
              description: 'Used storage in bytes',
            },
            total: {
              type: 'integer',
              example: 26843545600,
              description: 'Total storage in bytes',
            },
            percentage: {
              type: 'integer',
              example: 8,
              description: 'Usage percentage',
            },
            plan: {
              type: 'string',
              example: 'professional',
            },
            breakdown: {
              type: 'object',
              nullable: true,
              properties: {
                documents: {
                  type: 'integer',
                  example: 1073741824,
                  description: 'Documents storage in bytes',
                },
                attachments: {
                  type: 'integer',
                  example: 536870912,
                  description: 'Attachments storage in bytes',
                },
                logs: {
                  type: 'integer',
                  example: 268435456,
                  description: 'Logs storage in bytes',
                },
                backups: {
                  type: 'integer',
                  example: 268435456,
                  description: 'Backups storage in bytes',
                },
              },
            },
          },
        },

        AdminLog: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            userId: {
              type: 'integer',
              example: 1,
            },
            action: {
              type: 'string',
              example: 'user_created',
            },
            entityType: {
              type: 'string',
              example: 'user',
            },
            entityId: {
              type: 'integer',
              nullable: true,
              example: 123,
            },
            description: {
              type: 'string',
              nullable: true,
              example: 'Created new user: john.doe',
            },
            ipAddress: {
              type: 'string',
              nullable: true,
              example: '192.168.1.100',
            },
            userAgent: {
              type: 'string',
              nullable: true,
              example: 'Mozilla/5.0...',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-20T14:30:00.000Z',
            },
          },
        },

        DeletionDryRunReport: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'integer',
              example: 1,
            },
            companyName: {
              type: 'string',
              example: 'Acme Corporation',
            },
            estimatedDuration: {
              type: 'string',
              example: '10-15 minutes',
            },
            affectedRecords: {
              type: 'object',
              properties: {
                users: {
                  type: 'integer',
                  example: 101,
                },
                documents: {
                  type: 'integer',
                  example: 2456,
                },
                departments: {
                  type: 'integer',
                  example: 15,
                },
                teams: {
                  type: 'integer',
                  example: 28,
                },
                shifts: {
                  type: 'integer',
                  example: 856,
                },
                kvpSuggestions: {
                  type: 'integer',
                  example: 234,
                },
                surveys: {
                  type: 'integer',
                  example: 45,
                },
                logs: {
                  type: 'integer',
                  example: 125678,
                },
                total: {
                  type: 'integer',
                  example: 129243,
                },
              },
            },
            storageToFree: {
              type: 'integer',
              example: 2147483648,
              description: 'Storage to be freed in bytes',
            },
            warnings: {
              type: 'array',
              items: {
                type: 'string',
              },
              example: [
                'Large number of log entries will be deleted',
                'Active shifts will be cancelled',
              ],
            },
            canProceed: {
              type: 'boolean',
              example: true,
            },
          },
        },
      },

      // Common Parameters
      parameters: {
        PageParam: {
          name: 'page',
          in: 'query',
          description: 'Page number for pagination',
          schema: {
            type: 'integer',
            minimum: 1,
            default: 1,
          },
        },
        LimitParam: {
          name: 'limit',
          in: 'query',
          description: 'Number of items per page',
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 20,
          },
        },
        SortParam: {
          name: 'sort',
          in: 'query',
          description: "Sort field and direction (e.g., 'createdAt:desc')",
          schema: {
            type: 'string',
            pattern: '^[a-zA-Z]+:(asc|desc)$',
          },
        },
        SearchParam: {
          name: 'search',
          in: 'query',
          description: 'Search query string',
          schema: {
            type: 'string',
          },
        },
      },

      // Common Responses
      responses: {
        UnauthorizedError: {
          description: 'Authentication failed or token missing',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiErrorResponse',
              },
              example: {
                success: false,
                error: {
                  code: 'UNAUTHORIZED',
                  message: 'Authentication required',
                },
                meta: {
                  timestamp: '2025-07-24T15:30:00.000Z',
                  requestId: '550e8400-e29b-41d4-a716-446655440000',
                },
              },
            },
          },
        },
        ForbiddenError: {
          description: 'Access denied - insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiErrorResponse',
              },
              example: {
                success: false,
                error: {
                  code: 'FORBIDDEN',
                  message: "You don't have permission to perform this action",
                },
              },
            },
          },
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiErrorResponse',
              },
              example: {
                success: false,
                error: {
                  code: 'NOT_FOUND',
                  message: 'The requested resource was not found',
                },
              },
            },
          },
        },
        ValidationError: {
          description: 'Validation failed',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiErrorResponse',
              },
              example: {
                success: false,
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'Input validation failed',
                  details: [
                    {
                      field: 'email',
                      message: 'Invalid email format',
                    },
                  ],
                },
              },
            },
          },
        },
        ServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiErrorResponse',
              },
              example: {
                success: false,
                error: {
                  code: 'SERVER_ERROR',
                  message: 'An unexpected error occurred',
                },
              },
            },
          },
        },
        // v2 Common Responses
        UnauthorizedV2: {
          description: 'Authentication failed or token missing',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiErrorResponse',
              },
              example: {
                success: false,
                error: {
                  code: 'UNAUTHORIZED',
                  message: 'Authentication required',
                },
                meta: {
                  timestamp: '2025-07-24T15:30:00.000Z',
                  requestId: '550e8400-e29b-41d4-a716-446655440000',
                },
              },
            },
          },
        },
        ForbiddenV2: {
          description: 'Access denied - insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiErrorResponse',
              },
              example: {
                success: false,
                error: {
                  code: 'FORBIDDEN',
                  message: "You don't have permission to perform this action",
                },
              },
            },
          },
        },
        NotFoundV2: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiErrorResponse',
              },
              example: {
                success: false,
                error: {
                  code: 'NOT_FOUND',
                  message: 'The requested resource was not found',
                },
              },
            },
          },
        },
        BadRequestV2: {
          description: 'Invalid request data',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiErrorResponse',
              },
              example: {
                success: false,
                error: {
                  code: 'BAD_REQUEST',
                  message: 'Invalid request data',
                  details: [
                    {
                      field: 'name',
                      message: 'Name is required',
                    },
                  ],
                },
              },
            },
          },
        },
        InternalServerErrorV2: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiErrorResponse',
              },
              example: {
                success: false,
                error: {
                  code: 'SERVER_ERROR',
                  message: 'An unexpected error occurred',
                },
              },
            },
          },
        },
        SuccessResponseV2: {
          description: 'Success response without data',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiSuccessResponse',
              },
              example: {
                success: true,
                data: null,
                meta: {
                  timestamp: '2025-07-24T15:30:00.000Z',
                  version: '2.0',
                },
              },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: 'Auth v2',
        description: 'Authentication API v2 with improved standards',
        'x-displayName': 'Authentication v2',
      },
      {
        name: 'Users v2',
        description: 'User management API v2',
        'x-displayName': 'Users v2',
      },
      {
        name: 'Departments v2',
        description: 'Department management API v2',
        'x-displayName': 'Departments v2',
      },
      {
        name: 'Teams v2',
        description: 'Team management API v2',
        'x-displayName': 'Teams v2',
      },
      {
        name: 'Calendar v2',
        description: 'Calendar and events API v2',
        'x-displayName': 'Calendar v2',
      },
      {
        name: 'Chat v2',
        description: 'Real-time messaging API v2',
        'x-displayName': 'Chat v2',
      },
      {
        name: 'Documents v2',
        description: 'Document management API v2',
        'x-displayName': 'Documents v2',
      },
      {
        name: 'Blackboard v2',
        description: 'Company announcements API v2',
        'x-displayName': 'Blackboard v2',
      },
      {
        name: 'Shifts v2',
        description: 'Shift planning API v2',
        'x-displayName': 'Shifts v2',
      },
      {
        name: 'KVP v2',
        description:
          'Continuous improvement process (Kontinuierlicher Verbesserungsprozess) API v2',
        'x-displayName': 'KVP v2',
      },
      {
        name: 'Surveys v2',
        description: 'Survey management API v2',
        'x-displayName': 'Surveys v2',
      },
      {
        name: 'Plans',
        description: 'Subscription plans and billing API v2',
        'x-displayName': 'Plans v2',
      },
      {
        name: 'Features v2',
        description: 'Feature flags and tenant features API v2',
        'x-displayName': 'Features v2',
      },
      {
        name: 'Notifications',
        description: 'Push and email notifications API v2',
        'x-displayName': 'Notifications v2',
      },
      {
        name: 'Root',
        description: 'Root user administration and tenant management API v2',
        'x-displayName': 'Root v2',
      },
    ],
  },
  apis: [
    // Include v2 routes
    join(projectRoot, 'backend/src/routes/v2/**/*.ts'),
    join(projectRoot, 'backend/src/routes/v2/**/*.js'),
  ],
};

export const swaggerSpecV2 = swaggerJsdoc(options);
