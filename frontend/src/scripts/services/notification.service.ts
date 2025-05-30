/**
 * Notification Service for Assixx
 * Handles toast notifications and alerts
 */

import type { Notification } from '../../types/utils.types';

export class NotificationService {
  private container: HTMLElement | null = null;
  private notifications: Map<string, Notification> = new Map();
  private defaultDuration: number = 5000; // 5 seconds

  constructor() {
    this.init();
  }

  /**
   * Initialize notification container
   */
  private init(): void {
    if (typeof document === 'undefined') return;

    // Create container if it doesn't exist
    if (!document.getElementById('notification-container')) {
      this.container = document.createElement('div');
      this.container.id = 'notification-container';
      this.container.className = 'notification-container';
      this.container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        max-width: 400px;
      `;
      document.body.appendChild(this.container);
    } else {
      this.container = document.getElementById('notification-container');
    }
  }

  /**
   * Show notification
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
    if (fullNotification.duration && fullNotification.duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, fullNotification.duration);
    }

    return id;
  }

  /**
   * Show success notification
   */
  success(title: string, message?: string, duration?: number): string {
    return this.show({
      type: 'success',
      title,
      message,
      duration: duration || this.defaultDuration,
    });
  }

  /**
   * Show error notification
   */
  error(title: string, message?: string, duration?: number): string {
    return this.show({
      type: 'error',
      title,
      message,
      duration: duration || this.defaultDuration * 2, // Errors stay longer
    });
  }

  /**
   * Show warning notification
   */
  warning(title: string, message?: string, duration?: number): string {
    return this.show({
      type: 'warning',
      title,
      message,
      duration: duration || this.defaultDuration,
    });
  }

  /**
   * Show info notification
   */
  info(title: string, message?: string, duration?: number): string {
    return this.show({
      type: 'info',
      title,
      message,
      duration: duration || this.defaultDuration,
    });
  }

  /**
   * Dismiss notification
   */
  dismiss(id: string): void {
    const element = document.getElementById(`notification-${id}`);
    if (element) {
      element.classList.add('notification-fade-out');
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
   * Render notification
   */
  private render(notification: Notification): void {
    if (!this.container) return;

    const element = document.createElement('div');
    element.id = `notification-${notification.id}`;
    element.className = `notification notification-${notification.type}`;
    element.style.cssText = `
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
      margin-bottom: 12px;
      padding: 16px;
      position: relative;
      animation: slideInRight 0.3s ease-out;
      border-left: 4px solid ${this.getTypeColor(notification.type)};
    `;

    const iconMap = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ',
    };

    let actionsHtml = '';
    if (notification.actions && notification.actions.length > 0) {
      actionsHtml = `
        <div class="notification-actions" style="margin-top: 12px;">
          ${notification.actions
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
              ${action.label}
            </button>
          `
            )
            .join('')}
        </div>
      `;
    }

    element.innerHTML = `
      <button 
        class="notification-close" 
        style="
          position: absolute;
          top: 8px;
          right: 8px;
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #666;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        "
      >
        ✕
      </button>
      <div style="display: flex; align-items: flex-start;">
        <span style="
          font-size: 24px;
          margin-right: 12px;
          color: ${this.getTypeColor(notification.type)};
        ">
          ${iconMap[notification.type]}
        </span>
        <div style="flex: 1;">
          <h4 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #333;">
            ${notification.title}
          </h4>
          ${notification.message ? `<p style="margin: 0; font-size: 14px; color: #666;">${notification.message}</p>` : ''}
          ${actionsHtml}
        </div>
      </div>
    `;

    // Add event listeners
    const closeBtn = element.querySelector('.notification-close') as HTMLElement;
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.dismiss(notification.id));
    }

    // Add action listeners
    if (notification.actions) {
      notification.actions.forEach((action) => {
        const btn = element.querySelector(`[data-action="${action.label}"]`) as HTMLElement;
        if (btn) {
          btn.addEventListener('click', () => {
            action.handler();
            this.dismiss(notification.id);
          });
        }
      });
    }

    this.container.appendChild(element);
  }

  /**
   * Get color for notification type
   */
  private getTypeColor(type: Notification['type']): string {
    const colors = {
      success: '#4caf50',
      error: '#f44336',
      warning: '#ff9800',
      info: '#2196f3',
    };
    return colors[type];
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set default duration
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
    animation: fadeOut 0.3s ease-out forwards;
  }
  
  @keyframes fadeOut {
    to {
      opacity: 0;
      transform: translateX(100%);
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
document.head.appendChild(style);

// Create default instance
const notificationService = new NotificationService();

// Export default instance
export default notificationService;

// Export for backwards compatibility
if (typeof window !== 'undefined') {
  (window as any).NotificationService = NotificationService;
  (window as any).notificationService = notificationService;
  
  // Also export shorthand functions
  (window as any).notify = {
    success: (title: string, message?: string) => notificationService.success(title, message),
    error: (title: string, message?: string) => notificationService.error(title, message),
    warning: (title: string, message?: string) => notificationService.warning(title, message),
    info: (title: string, message?: string) => notificationService.info(title, message),
  };
}