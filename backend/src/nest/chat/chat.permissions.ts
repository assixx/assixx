/**
 * Chat Permission Definitions
 *
 * Defines which permission modules the chat addon exposes.
 * Registered via ChatPermissionRegistrar (OnModuleInit).
 *
 * @see docs/USER-PERMISSIONS-PLAN.md
 */
import type { PermissionCategoryDef } from '../common/permission-registry/permission.types.js';

export const CHAT_PERMISSIONS: PermissionCategoryDef = {
  code: 'chat',
  label: 'Chat',
  icon: 'fa-comments',
  modules: [
    {
      code: 'chat-conversations',
      label: 'Gespräche',
      icon: 'fa-comment-dots',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
    {
      code: 'chat-messages',
      label: 'Nachrichten',
      icon: 'fa-envelope',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
  ],
};
