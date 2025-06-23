/**
 * Swagger/OpenAPI Configuration for Assixx API
 */

import swaggerJsdoc from 'swagger-jsdoc';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory for ESM modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json to get version
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../../package.json'), 'utf-8')
);

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Assixx API Documentation',
      version: packageJson.version,
      description: 'Multi-Tenant SaaS Platform für Industrieunternehmen',
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
          process.env.NODE_ENV === 'production'
            ? 'https://api.assixx.com/api'
            : 'http://localhost:3000/api',
        description:
          process.env.NODE_ENV === 'production'
            ? 'Production Server'
            : 'Development Server',
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
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
            message: {
              type: 'string',
              description: 'Error message (alternative field)',
            },
            code: {
              type: 'string',
              description: 'Error code',
            },
            details: {
              type: 'object',
              description: 'Additional error details',
            },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              description: 'Success message',
            },
            data: {
              type: 'object',
              description: 'Response data',
            },
          },
        },
        PaginationInfo: {
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
            totalItems: {
              type: 'integer',
              example: 100,
            },
            itemsPerPage: {
              type: 'integer',
              example: 10,
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
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'User ID',
            },
            username: {
              type: 'string',
              description: 'Username',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email address',
            },
            first_name: {
              type: 'string',
              description: 'First name',
            },
            last_name: {
              type: 'string',
              description: 'Last name',
            },
            role: {
              type: 'string',
              enum: ['root', 'admin', 'employee'],
              description: 'User role',
            },
            tenant_id: {
              type: 'integer',
              description: 'Tenant ID',
            },
            department_id: {
              type: 'integer',
              nullable: true,
              description: 'Department ID',
            },
            is_active: {
              type: 'boolean',
              description: 'Whether the user is active',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
            },
          },
          required: ['id', 'username', 'email', 'role', 'tenant_id'],
        },
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: {
              type: 'string',
              description: 'Username for authentication',
              example: 'admin',
            },
            password: {
              type: 'string',
              format: 'password',
              description: 'User password',
              example: 'SecurePass123!',
            },
            fingerprint: {
              type: 'string',
              description: 'Browser fingerprint for session isolation',
              example: 'abc123def456',
            },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Login erfolgreich',
            },
            token: {
              type: 'string',
              description: 'JWT token (also set as httpOnly cookie)',
            },
            role: {
              type: 'string',
              enum: ['root', 'admin', 'employee'],
            },
            user: {
              $ref: '#/components/schemas/User',
            },
          },
        },
        BlackboardEntry: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Entry ID',
            },
            title: {
              type: 'string',
              description: 'Entry title',
            },
            content: {
              type: 'string',
              description: 'Entry content',
            },
            priority: {
              type: 'string',
              enum: ['low', 'normal', 'high', 'urgent'],
              description: 'Entry priority',
            },
            visibility: {
              type: 'string',
              enum: ['company', 'department', 'team', 'personal'],
              description: 'Visibility scope',
            },
            status: {
              type: 'string',
              enum: ['active', 'archived'],
              description: 'Entry status',
            },
            created_by: {
              type: 'integer',
              description: 'User ID who created the entry',
            },
            tenant_id: {
              type: 'integer',
              description: 'Tenant ID',
            },
            department_id: {
              type: 'integer',
              nullable: true,
              description: 'Department ID (for department visibility)',
            },
            team_id: {
              type: 'integer',
              nullable: true,
              description: 'Team ID (for team visibility)',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
            },
            can_edit: {
              type: 'boolean',
              description: 'Whether current user can edit this entry',
            },
            can_delete: {
              type: 'boolean',
              description: 'Whether current user can delete this entry',
            },
            is_read: {
              type: 'boolean',
              description: 'Whether current user has read this entry',
            },
          },
          required: [
            'id',
            'title',
            'content',
            'priority',
            'visibility',
            'status',
            'created_by',
            'tenant_id',
          ],
        },
        KvpSuggestion: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Suggestion ID',
            },
            title: {
              type: 'string',
              description: 'Suggestion title',
            },
            description: {
              type: 'string',
              description: 'Detailed description',
            },
            category: {
              type: 'string',
              enum: [
                'Sicherheit',
                'Produktivität',
                'Qualität',
                'Kosten',
                'Umwelt',
                'Sonstiges',
              ],
              description: 'Suggestion category',
            },
            status: {
              type: 'string',
              enum: ['pending', 'approved', 'implemented', 'rejected'],
              description: 'Current status',
            },
            is_shared: {
              type: 'boolean',
              description: 'Whether the suggestion is shared publicly',
            },
            created_by: {
              type: 'integer',
              description: 'User ID who created the suggestion',
            },
            tenant_id: {
              type: 'integer',
              description: 'Tenant ID',
            },
            potential_savings: {
              type: 'number',
              nullable: true,
              description: 'Estimated savings in EUR',
            },
            implementation_effort: {
              type: 'string',
              nullable: true,
              enum: ['low', 'medium', 'high'],
              description: 'Effort required to implement',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
            },
            comment_count: {
              type: 'integer',
              description: 'Number of comments',
            },
            attachment_count: {
              type: 'integer',
              description: 'Number of attachments',
            },
          },
          required: [
            'id',
            'title',
            'description',
            'category',
            'status',
            'created_by',
            'tenant_id',
          ],
        },
        CalendarEvent: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Event ID',
            },
            title: {
              type: 'string',
              description: 'Event title',
            },
            description: {
              type: 'string',
              nullable: true,
              description: 'Event description',
            },
            start_date: {
              type: 'string',
              format: 'date-time',
              description: 'Event start date and time',
            },
            end_date: {
              type: 'string',
              format: 'date-time',
              description: 'Event end date and time',
            },
            all_day: {
              type: 'boolean',
              description: 'Whether this is an all-day event',
            },
            location: {
              type: 'string',
              nullable: true,
              description: 'Event location',
            },
            visibility: {
              type: 'string',
              enum: ['company', 'department', 'team', 'personal'],
              description: 'Event visibility scope',
            },
            status: {
              type: 'string',
              enum: ['active', 'cancelled'],
              description: 'Event status',
            },
            created_by: {
              type: 'integer',
              description: 'User ID who created the event',
            },
            tenant_id: {
              type: 'integer',
              description: 'Tenant ID',
            },
            department_id: {
              type: 'integer',
              nullable: true,
              description: 'Department ID (for department events)',
            },
            team_id: {
              type: 'integer',
              nullable: true,
              description: 'Team ID (for team events)',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
            },
            can_edit: {
              type: 'boolean',
              description: 'Whether current user can edit this event',
            },
            can_delete: {
              type: 'boolean',
              description: 'Whether current user can delete this event',
            },
          },
          required: [
            'id',
            'title',
            'start_date',
            'end_date',
            'visibility',
            'status',
            'created_by',
            'tenant_id',
          ],
        },
        ShiftTemplate: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Template ID',
            },
            name: {
              type: 'string',
              description: 'Template name',
            },
            start_time: {
              type: 'string',
              format: 'time',
              description: 'Shift start time (HH:mm)',
              example: '08:00',
            },
            end_time: {
              type: 'string',
              format: 'time',
              description: 'Shift end time (HH:mm)',
              example: '16:00',
            },
            break_duration: {
              type: 'integer',
              description: 'Break duration in minutes',
              example: 30,
            },
            required_staff: {
              type: 'integer',
              description: 'Number of required staff',
              example: 3,
            },
            description: {
              type: 'string',
              nullable: true,
              description: 'Template description',
            },
            color: {
              type: 'string',
              nullable: true,
              description: 'Display color (hex)',
              example: '#4CAF50',
            },
            is_active: {
              type: 'boolean',
              description: 'Whether template is active',
            },
            tenant_id: {
              type: 'integer',
              description: 'Tenant ID',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
          },
          required: ['id', 'name', 'start_time', 'end_time', 'tenant_id'],
        },
        ShiftPlan: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Plan ID',
            },
            name: {
              type: 'string',
              description: 'Plan name',
            },
            start_date: {
              type: 'string',
              format: 'date',
              description: 'Plan start date',
            },
            end_date: {
              type: 'string',
              format: 'date',
              description: 'Plan end date',
            },
            department_id: {
              type: 'integer',
              nullable: true,
              description: 'Department ID',
            },
            team_id: {
              type: 'integer',
              nullable: true,
              description: 'Team ID',
            },
            description: {
              type: 'string',
              nullable: true,
              description: 'Plan description',
            },
            status: {
              type: 'string',
              enum: ['draft', 'published', 'archived'],
              description: 'Plan status',
            },
            tenant_id: {
              type: 'integer',
              description: 'Tenant ID',
            },
            created_by: {
              type: 'integer',
              description: 'User ID who created the plan',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
            },
          },
          required: [
            'id',
            'name',
            'start_date',
            'end_date',
            'status',
            'tenant_id',
            'created_by',
          ],
        },
        Survey: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Survey ID',
            },
            title: {
              type: 'string',
              description: 'Survey title',
            },
            description: {
              type: 'string',
              nullable: true,
              description: 'Survey description',
            },
            status: {
              type: 'string',
              enum: ['draft', 'active', 'closed'],
              description: 'Survey status',
            },
            start_date: {
              type: 'string',
              format: 'date',
              nullable: true,
              description: 'Survey start date',
            },
            end_date: {
              type: 'string',
              format: 'date',
              nullable: true,
              description: 'Survey end date',
            },
            is_anonymous: {
              type: 'boolean',
              description: 'Whether responses are anonymous',
            },
            is_mandatory: {
              type: 'boolean',
              description: 'Whether survey is mandatory',
            },
            questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {
                    type: 'integer',
                  },
                  question: {
                    type: 'string',
                  },
                  type: {
                    type: 'string',
                    enum: ['text', 'radio', 'checkbox', 'scale', 'date'],
                  },
                  required: {
                    type: 'boolean',
                  },
                  options: {
                    type: 'array',
                    items: {
                      type: 'string',
                    },
                  },
                },
              },
              description: 'Survey questions',
            },
            response_count: {
              type: 'integer',
              description: 'Number of responses',
            },
            created_by: {
              type: 'integer',
              description: 'User ID who created the survey',
            },
            tenant_id: {
              type: 'integer',
              description: 'Tenant ID',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
            },
          },
          required: ['id', 'title', 'status', 'tenant_id', 'created_by'],
        },
        Document: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Document ID',
            },
            title: {
              type: 'string',
              description: 'Document title',
            },
            description: {
              type: 'string',
              description: 'Document description',
            },
            file_name: {
              type: 'string',
              description: 'Original filename',
            },
            file_path: {
              type: 'string',
              description: 'Server file path',
            },
            file_size: {
              type: 'integer',
              description: 'File size in bytes',
            },
            file_type: {
              type: 'string',
              description: 'MIME type',
            },
            category: {
              type: 'string',
              enum: ['personal', 'company', 'department', 'team', 'payroll'],
              description: 'Document category',
            },
            year: {
              type: 'integer',
              nullable: true,
              description: 'Year (for payroll documents)',
            },
            month: {
              type: 'integer',
              nullable: true,
              description: 'Month (for payroll documents)',
            },
            uploaded_by: {
              type: 'integer',
              description: 'User ID who uploaded the document',
            },
            target_user_id: {
              type: 'integer',
              nullable: true,
              description: 'Target user (for personal documents)',
            },
            target_department_id: {
              type: 'integer',
              nullable: true,
              description: 'Target department',
            },
            target_team_id: {
              type: 'integer',
              nullable: true,
              description: 'Target team',
            },
            tenant_id: {
              type: 'integer',
              description: 'Tenant ID',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Upload timestamp',
            },
            is_read: {
              type: 'boolean',
              description: 'Whether the current user has read this document',
            },
          },
          required: ['id', 'title', 'file_name', 'category', 'tenant_id'],
        },
        Conversation: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Conversation ID',
            },
            name: {
              type: 'string',
              nullable: true,
              description: 'Conversation name (for group chats)',
            },
            is_group: {
              type: 'boolean',
              description: 'Whether this is a group conversation',
            },
            created_by: {
              type: 'integer',
              description: 'User ID who created the conversation',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              description: 'Last activity timestamp',
            },
            participants: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  user_id: {
                    type: 'integer',
                  },
                  username: {
                    type: 'string',
                  },
                  first_name: {
                    type: 'string',
                  },
                  last_name: {
                    type: 'string',
                  },
                  is_online: {
                    type: 'boolean',
                  },
                  joined_at: {
                    type: 'string',
                    format: 'date-time',
                  },
                },
              },
              description: 'List of conversation participants',
            },
            last_message: {
              type: 'object',
              nullable: true,
              properties: {
                id: {
                  type: 'integer',
                },
                message: {
                  type: 'string',
                },
                sender_name: {
                  type: 'string',
                },
                sent_at: {
                  type: 'string',
                  format: 'date-time',
                },
              },
              description: 'Preview of the last message',
            },
            unread_count: {
              type: 'integer',
              description: 'Number of unread messages for current user',
            },
          },
          required: [
            'id',
            'is_group',
            'created_by',
            'created_at',
            'participants',
          ],
        },
        ChatMessage: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Message ID',
            },
            conversation_id: {
              type: 'integer',
              description: 'Conversation ID',
            },
            sender_id: {
              type: 'integer',
              description: 'Sender user ID',
            },
            sender_name: {
              type: 'string',
              description: 'Sender display name',
            },
            message: {
              type: 'string',
              description: 'Message content',
            },
            attachment: {
              type: 'object',
              nullable: true,
              properties: {
                filename: {
                  type: 'string',
                  description: 'Attachment filename',
                },
                original_name: {
                  type: 'string',
                  description: 'Original filename',
                },
                file_size: {
                  type: 'integer',
                  description: 'File size in bytes',
                },
                mime_type: {
                  type: 'string',
                  description: 'MIME type',
                },
              },
              description: 'File attachment information',
            },
            sent_at: {
              type: 'string',
              format: 'date-time',
              description: 'Message timestamp',
            },
            is_read: {
              type: 'boolean',
              description: 'Whether the current user has read this message',
            },
            read_at: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'When the message was read',
            },
            is_edited: {
              type: 'boolean',
              description: 'Whether the message has been edited',
            },
            edited_at: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'When the message was edited',
            },
          },
          required: [
            'id',
            'conversation_id',
            'sender_id',
            'message',
            'sent_at',
          ],
        },
        Department: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Department ID',
            },
            name: {
              type: 'string',
              description: 'Department name',
            },
            description: {
              type: 'string',
              nullable: true,
              description: 'Department description',
            },
            manager_id: {
              type: 'integer',
              nullable: true,
              description: 'User ID of department manager',
            },
            manager_name: {
              type: 'string',
              nullable: true,
              description: 'Manager display name',
            },
            parent_id: {
              type: 'integer',
              nullable: true,
              description: 'Parent department ID',
            },
            parent_name: {
              type: 'string',
              nullable: true,
              description: 'Parent department name',
            },
            location: {
              type: 'string',
              nullable: true,
              description: 'Physical location',
            },
            cost_center: {
              type: 'string',
              nullable: true,
              description: 'Cost center code',
            },
            employee_count: {
              type: 'integer',
              description: 'Number of employees in department',
            },
            tenant_id: {
              type: 'integer',
              description: 'Tenant ID',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
            },
          },
          required: ['id', 'name', 'tenant_id'],
        },
        Team: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Team ID',
            },
            name: {
              type: 'string',
              description: 'Team name',
            },
            description: {
              type: 'string',
              nullable: true,
              description: 'Team description',
            },
            department_id: {
              type: 'integer',
              nullable: true,
              description: 'Department ID this team belongs to',
            },
            department_name: {
              type: 'string',
              nullable: true,
              description: 'Department name',
            },
            leader_id: {
              type: 'integer',
              nullable: true,
              description: 'User ID of team leader',
            },
            leader_name: {
              type: 'string',
              nullable: true,
              description: 'Leader display name',
            },
            max_members: {
              type: 'integer',
              nullable: true,
              description: 'Maximum team size',
            },
            member_count: {
              type: 'integer',
              description: 'Current number of team members',
            },
            location: {
              type: 'string',
              nullable: true,
              description: 'Team location',
            },
            budget: {
              type: 'number',
              nullable: true,
              description: 'Team budget',
            },
            is_active: {
              type: 'boolean',
              description: 'Whether team is active',
            },
            goals: {
              type: 'string',
              nullable: true,
              description: 'Team goals and objectives',
            },
            tenant_id: {
              type: 'integer',
              description: 'Tenant ID',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
            },
          },
          required: ['id', 'name', 'tenant_id', 'is_active'],
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
        name: 'Authentication',
        description: 'User authentication and authorization',
      },
      { name: 'Admin', description: 'Admin-specific operations' },
      { name: 'Employee', description: 'Employee-specific operations' },
      { name: 'Documents', description: 'Document management' },
      {
        name: 'Blackboard',
        description: 'Company announcements (Schwarzes Brett)',
      },
      { name: 'Calendar', description: 'Event and calendar management' },
      { name: 'Chat', description: 'Real-time messaging' },
      { name: 'KVP', description: 'Continuous improvement process (KVP)' },
      { name: 'Shifts', description: 'Shift planning and management' },
      { name: 'Survey', description: 'Survey creation and management' },
      { name: 'Features', description: 'Feature management' },
      {
        name: 'Departments',
        description: 'Department management and organization structure',
      },
      {
        name: 'Teams',
        description: 'Team management and team member operations',
      },
    ],
  },
  apis: [
    join(__dirname, '../routes/*.ts'),
    join(__dirname, '../routes/*.js'),
    join(__dirname, '../routes/**/*.ts'),
    join(__dirname, '../routes/**/*.js'),
    join(__dirname, '../models/*.ts'),
    join(__dirname, '../models/*.js'),
    join(__dirname, '../types/*.ts'),
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
