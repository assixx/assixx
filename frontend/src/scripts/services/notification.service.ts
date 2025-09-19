/**
 * Notification Service for Assixx
 * Handles toast notifications and alerts
 */

import type { Notification } from '../../types/utils.types';

/**
 *
 */
export class NotificationService {
  private container: HTMLElement | null = null;
  private notifications = new Map<string, Notification>();
  private defaultDuration = 2000; // 2 seconds

  /**
   *
   */
  constructor() {
    this.init();
  }

  /**
   * Initialize notification container
   */
  private init(): void {
    if (typeof document === 'undefined') return;

    // Create container if it doesn't exist
    if (!document.querySelector('#notification-container')) {
      this.container = document.createElement('div');
      this.container.id = 'notification-container';
      this.container.className = 'notification-container';
      this.container.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 10000;
        pointer-events: none;
      `;
      document.body.append(this.container);
    } else {
      this.container = document.querySelector('#notification-container');
    }
  }

  /**
   * Show notification
   * @param notification
   */
  show(notification: Omit<Notification, 'id'>): string {
    const id = this.generateId();
    const fullNotification: Notification = {
      id,
      duration: this.defaultDuration,
      ...notification,
    };

    this.notifications.set(id, fullNotification);
    this.render(fullNotification);

    // Auto-dismiss if duration is set
    if (fullNotification.duration !== undefined && fullNotification.duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, fullNotification.duration);
    }

    return id;
  }

  /**
   * Show success notification
   * @param title
   * @param message
   * @param duration
   */
  success(title: string, message?: string, duration?: number): string {
    return this.show({
      type: 'success',
      title,
      message,
      duration: duration ?? this.defaultDuration,
    });
  }

  /**
   * Show error notification
   * @param title
   * @param message
   * @param duration
   */
  error(title: string, message?: string, duration?: number): string {
    return this.show({
      type: 'error',
      title,
      message,
      duration: duration ?? this.defaultDuration * 2, // Errors stay longer
    });
  }

  /**
   * Show warning notification
   * @param title
   * @param message
   * @param duration
   */
  warning(title: string, message?: string, duration?: number): string {
    return this.show({
      type: 'warning',
      title,
      message,
      duration: duration ?? this.defaultDuration,
    });
  }

  /**
   * Show info notification
   * @param title
   * @param message
   * @param duration
   */
  info(title: string, message?: string, duration?: number): string {
    return this.show({
      type: 'info',
      title,
      message,
      duration: duration ?? this.defaultDuration,
    });
  }

  /**
   * Dismiss notification
   * @param id
   */
  dismiss(id: string): void {
    const element = document.querySelector<HTMLElement>(`#notification-${id}`);
    if (element) {
      // Apply slideOutRight animation like role-switch toast
      element.style.animation = 'slideOutRight 0.3s ease-in';
      setTimeout(() => {
        element.remove();
        this.notifications.delete(id);
      }, 300);
    }
  }

  /**
   * Dismiss all notifications
   */
  dismissAll(): void {
    this.notifications.forEach((_, id) => {
      this.dismiss(id);
    });
  }

  /**
   * Get notification colors based on type
   */
  private getNotificationColors(type: Notification['type']): {
    bgColor: string;
    borderColor: string;
    textColor: string;
  } {
    switch (type) {
      case 'success':
        return {
          bgColor: 'rgba(76, 175, 80, 0.1)',
          borderColor: 'rgba(76, 175, 80, 0.2)',
          textColor: 'rgba(76, 175, 80, 0.9)',
        };
      case 'warning':
        return {
          bgColor: 'rgba(255, 152, 0, 0.1)',
          borderColor: 'rgba(255, 152, 0, 0.2)',
          textColor: 'rgba(255, 152, 0, 0.9)',
        };
      case 'error':
        return {
          bgColor: 'rgba(244, 67, 54, 0.1)',
          borderColor: 'rgba(244, 67, 54, 0.2)',
          textColor: 'rgba(244, 67, 54, 0.9)',
        };
      case 'info':
      default:
        return {
          bgColor: 'rgba(33, 150, 243, 0.1)',
          borderColor: 'rgba(33, 150, 243, 0.2)',
          textColor: 'rgba(33, 150, 243, 0.9)',
        };
    }
  }

  /**
   * Get notification icon HTML
   */
  private getNotificationIcon(type: Notification['type']): string {
    switch (type) {
      case 'success':
        return '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';
      case 'warning':
        return '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>';
      case 'error':
        return '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
      case 'info':
      default:
        return '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>';
    }
  }

  /**
   * Generate actions HTML
   */
  private generateActionsHtml(actions?: Notification['actions']): string {
    if (!actions || actions.length === 0) return '';

    const buttons = actions
      .map(
        (action) => `
        <button
          class="notification-action-btn"
          data-action="${action.label}"
          style="
            background: none;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 4px 12px;
            margin-right: 8px;
            cursor: pointer;
            font-size: 14px;
          "
        >
          ${this.escapeHtml(action.label)}
        </button>
      `,
      )
      .join('');

    return `<div class="notification-actions" style="margin-top: 12px;">${buttons}</div>`;
  }

  /**
   * Render notification
   * @param notification
   */
  private render(notification: Notification): void {
    if (!this.container) return;

    const element = document.createElement('div');
    element.id = `notification-${notification.id}`;
    element.className = `notification notification-${notification.type}`;

    // Get colors for notification type
    const { bgColor, borderColor, textColor } = this.getNotificationColors(notification.type);

    element.style.cssText = `
      position: relative;
      padding: 16px 24px;
      background: ${bgColor};
      border: 1px solid ${borderColor};
      color: ${textColor};
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      font-size: 14px;
      font-weight: 500;
      backdrop-filter: blur(10px);
      animation: slideInRight 0.3s ease-out;
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      pointer-events: auto;
      width: max-content;
      max-width: 400px;
    `;

    // Generate HTML parts
    const actionsHtml = this.generateActionsHtml(notification.actions);
    const iconHtml = this.getNotificationIcon(notification.type);

    // Combine title and message into one text
    const displayText =
      notification.message !== undefined && notification.message !== ''
        ? `${this.escapeHtml(notification.title)}: ${this.escapeHtml(notification.message)}`
        : this.escapeHtml(notification.title);

    // eslint-disable-next-line no-unsanitized/property -- iconHtml is hardcoded SVG, displayText and actionsHtml are escaped
    element.innerHTML = `
      <span style="color: ${textColor}; display: flex; align-items: center;">
        ${iconHtml}
      </span>
      <span style="flex: 1; color: ${textColor};">
        ${displayText}
      </span>
      ${actionsHtml}
    `;

    // Add action listeners
    if (notification.actions) {
      notification.actions.forEach((action) => {
        const btn = element.querySelector(`[data-action="${action.label}"]`);
        if (btn) {
          btn.addEventListener('click', () => {
            action.handler();
            this.dismiss(notification.id);
          });
        }
      });
    }

    this.container.append(element);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `notif-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Set default duration
   * @param duration
   */
  setDefaultDuration(duration: number): void {
    this.defaultDuration = duration;
  }
}

// Create styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .notification-fade-out {
    /* animation: fadeOut 0.3s ease-out forwards; */
  }

  @keyframes fadeOut {
    to {
      opacity: 0;
      transform: translateX(100%);
    }
  }

  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }

  @media (max-width: 768px) {
    #notification-container {
      left: 20px !important;
      right: 20px !important;
      max-width: none !important;
    }
  }
`;
document.head.append(style);

// Create default instance
const notificationService = new NotificationService();

// Export default instance
export default notificationService;

// Export for backwards compatibility
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).NotificationService = NotificationService;
  (window as unknown as Record<string, unknown>).notificationService = notificationService;

  // Also export shorthand functions
  (window as unknown as Record<string, unknown>).notify = {
    success: (title: string, message?: string) => notificationService.success(title, message),
    error: (title: string, message?: string) => notificationService.error(title, message),
    warning: (title: string, message?: string) => notificationService.warning(title, message),
    info: (title: string, message?: string) => notificationService.info(title, message),
  };
}
