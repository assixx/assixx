/**
 * Chat Module - Utilities
 * Helper functions and utility methods
 */

import type { ChatUser, ConversationParticipant, Message, NotificationType } from './types';
import { $$, escapeHtml } from '../../utils/dom-utils';

// ============================================================================
// Text Processing
// ============================================================================

/**
 * Convert URLs in text to clickable links
 */
export function linkify(text: string): string {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, (match) => {
    const escapedUrl = escapeHtml(match);
    return `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer">${escapedUrl}</a>`;
  });
}

// ============================================================================
// Date & Time Formatting
// ============================================================================

/**
 * Check if date string is today
 */
export function isToday(dateString: string): boolean {
  const today = new Date();
  const messageDate = new Date(dateString.split('.').reverse().join('-'));
  return messageDate.toDateString() === today.toDateString();
}

/**
 * Check if date string is yesterday
 */
export function isYesterday(dateString: string): boolean {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const messageDate = new Date(dateString.split('.').reverse().join('-'));
  return messageDate.toDateString() === yesterday.toDateString();
}

/**
 * Get valid message date string or null
 */
export function getValidMessageDate(message: Message): string | null {
  const createdAt = message.createdAt;
  if (createdAt === '') {
    console.warn('Message without created date:', message);
    return null;
  }

  const parsedDate = new Date(createdAt);
  if (Number.isNaN(parsedDate.getTime())) {
    console.error('Invalid date for message:', createdAt, message);
    return null;
  }

  return parsedDate.toLocaleDateString('de-DE');
}

// ============================================================================
// File Size Formatting
// ============================================================================

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  // eslint-disable-next-line security/detect-object-injection -- i is calculated index (0-3), not user input
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i] ?? 'Bytes'}`;
}

// ============================================================================
// User Display
// ============================================================================

/**
 * Get initials from first and last name
 */
export function getInitials(firstName?: string, lastName?: string): string {
  const firstInitial = firstName !== undefined && firstName !== '' ? firstName.charAt(0).toUpperCase() : '';
  const lastInitial = lastName !== undefined && lastName !== '' ? lastName.charAt(0).toUpperCase() : '';
  const initials = `${firstInitial}${lastInitial}`;
  return initials !== '' ? initials : 'U';
}

/**
 * Get display name for a role
 */
export function getRoleDisplayName(role: string): string {
  const roleMap: Record<string, string> = {
    admin: 'Administrator',
    employee: 'Mitarbeiter',
    root: 'Root',
  };
  // eslint-disable-next-line security/detect-object-injection -- role is from JWT token (validated user role), not user input
  return roleMap[role] ?? role;
}

/**
 * Get full name or username from user
 * Accepts ChatUser or ConversationParticipant (both have firstName, lastName, username)
 */
export function getUserDisplayName(user: ChatUser | ConversationParticipant): string {
  const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  return fullName !== '' ? fullName : user.username;
}

/**
 * Ensure URL path is absolute (starts with /)
 * Required for proper resolution when URL changes (e.g., /chat → /chat/:uuid)
 */
function ensureAbsolutePath(path: string): string {
  if (path.startsWith('/') || path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `/${path}`;
}

/**
 * Get profile image URL from user
 * Checks multiple field names for compatibility with different API responses
 * Returns absolute path to prevent issues with URL-based routing
 */
export function getProfileImageUrl(user: Partial<ChatUser>): string | null {
  let url: string | null = null;

  // Check all possible field names for profile picture
  if (user.profilePicture !== undefined && user.profilePicture !== '') {
    url = user.profilePicture;
  } else if (user.profileImageUrl !== undefined && user.profileImageUrl !== '') {
    url = user.profileImageUrl;
  } else {
    // Also check profilePictureUrl (used by chat participants API)
    const userAny = user as Record<string, unknown>;
    if (typeof userAny['profilePictureUrl'] === 'string' && userAny['profilePictureUrl'] !== '') {
      url = userAny['profilePictureUrl'];
    }
  }

  // Return absolute path or null
  return url !== null ? ensureAbsolutePath(url) : null;
}

/**
 * Check if user has a name set
 */
export function hasName(user: Partial<ChatUser>): boolean {
  return (
    (user.firstName !== undefined && user.firstName !== '') || (user.lastName !== undefined && user.lastName !== '')
  );
}

// ============================================================================
// Notifications
// ============================================================================

/**
 * Show in-app notification
 */
export function showNotification(message: string, type: NotificationType = 'info'): void {
  const notification = $$('#notification');
  if (!notification) return;

  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.display = 'block';

  setTimeout(() => {
    notification.style.display = 'none';
  }, 3000);
}

/**
 * Play notification sound
 * NOTE: Disabled until notification.mp3 is added to /sounds/
 */
export async function playNotificationSound(): Promise<void> {
  // TODO: Add /sounds/notification.mp3 to enable notification sounds
  // const audio = new Audio('/sounds/notification.mp3');
  // try {
  //   await audio.play();
  // } catch (error) {
  //   console.info('Could not play notification sound:', error);
  // }
}

/**
 * Show desktop notification
 */
export function showDesktopNotification(message: Message): void {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    const notification = new Notification('Neue Nachricht', {
      body: `${message.sender?.username ?? 'Unknown'}: ${message.content}`,
      icon: '/images/logo.png',
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } else if (Notification.permission !== 'denied') {
    void Notification.requestPermission();
  }
}

// ============================================================================
// Confirm Dialog
// ============================================================================

/**
 * Show custom confirm dialog (Design System)
 * Uses confirm-modal component with glassmorphic styling
 */
export async function showConfirmDialog(message: string): Promise<boolean> {
  console.log('[DEBUG] showConfirmDialog called with message:', message);

  return await new Promise((resolve) => {
    // Modal overlay - MUST include --active class to be visible (Design System)
    const modal = document.createElement('div');
    modal.className = 'modal-overlay modal-overlay--active';
    console.log('[DEBUG] Created modal overlay element with --active class');

    // Dialog container (Design System: confirm-modal--danger for delete actions)
    const dialog = document.createElement('div');
    dialog.className = 'confirm-modal confirm-modal--danger';

    // Icon (Design System structure)
    const icon = document.createElement('div');
    icon.className = 'confirm-modal__icon';
    const iconI = document.createElement('i');
    iconI.className = 'fas fa-exclamation-triangle';
    icon.append(iconI);

    // Title (Design System structure)
    const title = document.createElement('h3');
    title.className = 'confirm-modal__title';
    title.textContent = 'Löschen bestätigen';

    // Message (Design System structure)
    const messageEl = document.createElement('p');
    messageEl.className = 'confirm-modal__message';
    messageEl.textContent = message;

    // Actions (Design System structure)
    const actions = document.createElement('div');
    actions.className = 'confirm-modal__actions';

    const cancelButton = document.createElement('button');
    cancelButton.className = 'confirm-modal__btn confirm-modal__btn--cancel';
    cancelButton.textContent = 'Abbrechen';

    const confirmButton = document.createElement('button');
    confirmButton.className = 'confirm-modal__btn confirm-modal__btn--danger';
    confirmButton.textContent = 'Löschen';

    actions.append(cancelButton, confirmButton);

    // Assemble dialog (Design System order: icon, title, message, actions)
    dialog.append(icon, title, messageEl, actions);
    modal.append(dialog);
    document.body.append(modal);
    console.log('[DEBUG] Modal appended to body:', modal);
    console.log('[DEBUG] Modal in DOM:', document.body.contains(modal));

    const cleanup = () => {
      modal.remove();
    };

    cancelButton.addEventListener('click', () => {
      cleanup();
      resolve(false);
    });

    confirmButton.addEventListener('click', () => {
      cleanup();
      resolve(true);
    });

    // Click outside to cancel
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        cleanup();
        resolve(false);
      }
    });

    // ESC key to cancel
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup();
        document.removeEventListener('keydown', handleEsc);
        resolve(false);
      }
    };
    document.addEventListener('keydown', handleEsc);
  });
}
