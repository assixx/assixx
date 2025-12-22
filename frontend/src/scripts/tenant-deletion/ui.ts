/**
 * UI Rendering functions for Tenant Deletion Status
 *
 * All DOM rendering and HTML generation for the deletion status page.
 * Uses Design System components (badges, progress, empty-state).
 * NO inline styles - all styling via CSS classes.
 * API v2 only - uses camelCase field names
 */

import type { DeletionStatusItem, TimelineItem } from './types';
import { STATUS_BADGE_CLASS } from './types';
import {
  getStatusText,
  calculateCoolingOff,
  getCurrentUserId,
  getRequesterName,
  isCurrentUserCreator,
  formatDate,
  formatDateOnly,
} from './utils';
import { setHTML } from '../../utils/dom-utils';

/**
 * Display deletion status in the container
 *
 * @param container - The DOM element to render into
 * @param statusData - Array of deletion status items
 */
export function displayStatus(container: HTMLElement, statusData: DeletionStatusItem[]): void {
  if (statusData.length === 0) {
    setHTML(container, createEmptyState());
    return;
  }

  const html = statusData.map((item) => createStatusCard(item)).join('');
  setHTML(container, html);
}

/**
 * Create empty state HTML when no deletion requests exist
 *
 * Uses Design System empty-state component
 */
function createEmptyState(): string {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">
        <i class="fas fa-inbox"></i>
      </div>
      <h3 class="empty-state__title">Keine Löschanfragen vorhanden</h3>
      <p class="empty-state__description">
        Es gibt derzeit keine ausstehenden Tenant-Löschanfragen.
      </p>
    </div>
  `;
}

/**
 * Create a status card for a deletion request
 *
 * @param item - The deletion status item
 * @returns HTML string for the status card
 */
function createStatusCard(item: DeletionStatusItem): string {
  const createdAt = new Date(item.requestedAt);
  const coolingOffRemaining = calculateCoolingOff(item);
  const currentUserId = getCurrentUserId();
  const isCreator = isCurrentUserCreator(item);

  const badgeClass = STATUS_BADGE_CLASS[item.status];

  return `
    <div class="status-card">
      <div class="status-header">
        ${createTenantInfo(item, currentUserId, createdAt)}
        <span class="badge badge--uppercase ${badgeClass}">
          ${getStatusText(item.status)}
        </span>
      </div>

      ${createPermissionInfoBox(isCreator, item.canApprove)}
      ${createCoolingOffWarning(item, coolingOffRemaining)}
      ${createGracePeriodInfo(item)}

      <div class="timeline">
        <h4>Status Timeline</h4>
        ${createTimeline(item)}
      </div>

      ${createActionButtons(item)}
      ${createEmergencyStopButton(item)}
    </div>
  `;
}

/**
 * Create tenant info section
 */
function createTenantInfo(item: DeletionStatusItem, currentUserId: number | null, createdAt: Date): string {
  const requesterName = getRequesterName(item);

  return `
    <div class="tenant-info">
      <h3>Tenant ${item.tenantId}</h3>
      <p>Tenant ID: ${item.tenantId}</p>
      <p>Beantragt von: ${requesterName} (User ID: ${item.requestedBy})</p>
      <p>Beantragt am: ${formatDate(createdAt)}</p>
      <p><strong>Aktueller User ID:</strong> ${currentUserId ?? 'N/A'}</p>
      <p><strong>Status Info:</strong> canApprove=${item.canApprove}, canCancel=${item.canCancel}</p>
    </div>
  `;
}

/**
 * Create permission info box
 *
 * Shows different messages for creator vs approver
 */
function createPermissionInfoBox(isCreator: boolean, canApprove: boolean): string {
  if (isCreator) {
    return `
      <div class="info-box info-box--warning">
        <i class="fas fa-info-circle"></i>
        <div>
          <strong>Sie sind der Ersteller dieser Löschanfrage.</strong><br>
          Das Zwei-Personen-Prinzip erfordert, dass ein anderer Root-Benutzer die Löschung genehmigt.
        </div>
      </div>
    `;
  }

  if (canApprove) {
    return `
      <div class="info-box info-box--success">
        <i class="fas fa-user-shield"></i>
        <div>
          <strong>Sie können diese Löschanfrage genehmigen oder ablehnen.</strong><br>
          Die Anfrage wurde von einem anderen Root-Benutzer erstellt.
        </div>
      </div>
    `;
  }

  return '';
}

/**
 * Create cooling-off warning section
 *
 * Shows remaining time before approval is possible
 */
function createCoolingOffWarning(item: DeletionStatusItem, coolingOffRemaining: number): string {
  const isPending = item.status === 'pending' || item.status === 'pending_approval';

  if (!isPending || coolingOffRemaining <= 0) {
    return '';
  }

  return `
    <div class="cooling-off-warning">
      <i class="fas fa-clock"></i>
      <div>
        <strong>Cooling-off Periode aktiv</strong><br>
        Noch ${Math.ceil(coolingOffRemaining)} Stunden bis zur Genehmigung möglich<br>
        <small class="text-muted">Für Entwicklung: Cooling-off kann in der DB auf 0 gesetzt werden</small>
      </div>
    </div>
  `;
}

/**
 * Create grace period info section
 *
 * Shows information about the 30-day grace period
 */
function createGracePeriodInfo(item: DeletionStatusItem): string {
  if (item.status !== 'approved' && item.status !== 'queued') {
    return '';
  }

  const scheduledDate = formatDateOnly(item.scheduledFor);

  return `
    <div class="info-box info-box--info">
      <i class="fas fa-calendar-alt"></i>
      <div>
        <strong>30 Tage Grace Period läuft!</strong>
        <p class="mt-2 mb-2"><strong>Geplante Löschung:</strong> ${scheduledDate}</p>
        <p class="mb-2">Der Tenant kann innerhalb von 30 Tagen noch reaktiviert werden.</p>
        <p class="mb-2">Nach Ablauf der Grace Period erfolgt die automatische, unwiderrufliche Löschung.</p>
        <small class="text-muted">Deletion Worker prüft alle 30 Sekunden nach abgelaufenen Grace Periods.</small>
      </div>
    </div>
  `;
}

/**
 * Create timeline visualization
 *
 * Shows the deletion process steps with completion status
 */
function createTimeline(item: DeletionStatusItem): string {
  const timeline: TimelineItem[] = [];

  // Request created
  timeline.push({
    icon: 'fa-plus-circle',
    title: 'Löschung beantragt',
    date: new Date(item.requestedAt),
    completed: true,
  });

  // Approval
  if (item.approvedAt !== undefined) {
    timeline.push({
      icon: 'fa-check-circle',
      title: 'Genehmigt',
      date: new Date(item.approvedAt),
      completed: true,
    });
  }

  // Scheduled deletion
  if (item.scheduledFor !== undefined && item.status !== 'completed') {
    timeline.push({
      icon: 'fa-calendar-check',
      title: 'Geplante Löschung',
      date: new Date(item.scheduledFor),
      completed: false,
    });
  }

  // Completed
  if (item.status === 'completed') {
    timeline.push({
      icon: 'fa-check-double',
      title: 'Löschung abgeschlossen',
      date: null,
      completed: true,
    });
  }

  return timeline.map((timelineItem) => createTimelineItem(timelineItem)).join('');
}

/**
 * Create a single timeline item
 */
function createTimelineItem(item: TimelineItem): string {
  return `
    <div class="timeline-item">
      <div class="timeline-icon ${item.completed ? 'timeline-icon--completed' : 'timeline-icon--pending'}">
        <i class="fas ${item.icon}"></i>
      </div>
      <div class="timeline-content">
        <h4>${item.title}</h4>
        <p>${formatDate(item.date)}</p>
      </div>
    </div>
  `;
}

/**
 * Create action buttons (approve, reject, cancel)
 */
function createActionButtons(item: DeletionStatusItem): string {
  if (!item.canApprove && !item.canCancel) {
    return '';
  }

  const queueIdStr = String(item.queueId);

  const approveRejectButtons = item.canApprove
    ? `
      <button class="btn btn-danger" data-action="reject" data-queue-id="${queueIdStr}">
        <i class="fas fa-times mr-2"></i> Ablehnen
      </button>
      <a href="/tenant-deletion-approve?queueId=${queueIdStr}" class="btn btn-success">
        <i class="fas fa-check mr-2"></i> Genehmigen
      </a>
    `
    : '';

  const cancelButton = item.canCancel
    ? `
      <button class="btn btn-cancel" data-action="cancel" data-queue-id="${queueIdStr}">
        <i class="fas fa-ban mr-2"></i> Abbrechen (als Ersteller)
      </button>
    `
    : '';

  return `
    <div class="action-buttons">
      ${approveRejectButtons}
      ${cancelButton}
    </div>
  `;
}

/**
 * Create emergency stop button
 *
 * Available for queued, approved, or processing statuses
 */
function createEmergencyStopButton(item: DeletionStatusItem): string {
  const showEmergencyStop = item.status === 'queued' || item.status === 'approved' || item.status === 'processing';

  if (!showEmergencyStop) {
    return '';
  }

  const queueIdStr = String(item.queueId);
  const helpText =
    item.status === 'processing' ? 'Stoppt den laufenden Löschvorgang' : 'Stoppt die geplante Löschung sofort';

  return `
    <div class="action-buttons mt-6">
      <button class="btn btn-warning" data-action="emergency-stop" data-queue-id="${queueIdStr}">
        <i class="fas fa-stop-circle mr-2"></i> Emergency Stop
      </button>
      <small class="text-muted block mt-2">${helpText}</small>
    </div>
  `;
}

// Note: Approval functionality moved to separate page /tenant-deletion-approve
