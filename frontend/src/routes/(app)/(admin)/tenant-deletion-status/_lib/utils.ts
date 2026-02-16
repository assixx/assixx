/**
 * Tenant Deletion Status - Utility Functions
 * @module tenant-deletion-status/_lib/utils
 */

import {
  showSuccessAlert,
  showErrorAlert,
  showWarningAlert,
  showInfoAlert,
} from '$lib/stores/toast';

import {
  STATUS_TEXT_MAP,
  STATUS_BADGE_CLASS,
  TIMELINE_ICONS,
  MESSAGES,
} from './constants';

import type {
  DeletionStatus,
  DeletionStatusItem,
  TimelineItem,
  ToastType,
} from './types';

/** Get status text in German */
export function getStatusText(status: DeletionStatus): string {
  return STATUS_TEXT_MAP[status];
}

/** Get badge class for status */
export function getBadgeClass(status: DeletionStatus): string {
  return STATUS_BADGE_CLASS[status];
}

/** Calculate remaining cooling-off hours */
export function calculateCoolingOff(item: DeletionStatusItem): number {
  const requestedAt = new Date(item.requestedAt);
  const hoursSince = (Date.now() - requestedAt.getTime()) / (1000 * 60 * 60);
  return Math.max(0, item.coolingOffHours - hoursSince);
}

/** Check if current user is the creator of the deletion request */
export function isCurrentUserCreator(
  item: DeletionStatusItem,
  currentUserId: number | null,
): boolean {
  return currentUserId !== null && currentUserId === item.requestedBy;
}

/** Get requester name */
export function getRequesterName(item: DeletionStatusItem): string {
  return item.requestedByName ?? `ID: ${item.requestedBy}`;
}

/** Format date for German locale */
export function formatDate(date: Date | null): string {
  if (date === null) {
    return MESSAGES.pendingApproval;
  }
  return date.toLocaleString('de-DE');
}

/** Format date string for German locale (date only) */
export function formatDateOnly(dateString: string | undefined): string {
  if (dateString === undefined || dateString === '') {
    return MESSAGES.gracePeriodDefault;
  }
  return new Date(dateString).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/** Build timeline for a deletion status item */
export function buildTimeline(item: DeletionStatusItem): TimelineItem[] {
  const timeline: TimelineItem[] = [];

  // Request created
  timeline.push({
    icon: TIMELINE_ICONS.requested,
    title: 'Löschung beantragt',
    date: new Date(item.requestedAt),
    completed: true,
  });

  // Approval
  if (item.approvedAt !== undefined) {
    timeline.push({
      icon: TIMELINE_ICONS.approved,
      title: 'Genehmigt',
      date: new Date(item.approvedAt),
      completed: true,
    });
  }

  // Scheduled deletion
  if (item.scheduledFor !== undefined && item.status !== 'completed') {
    timeline.push({
      icon: TIMELINE_ICONS.scheduled,
      title: 'Geplante Löschung',
      date: new Date(item.scheduledFor),
      completed: false,
    });
  }

  // Completed
  if (item.status === 'completed') {
    timeline.push({
      icon: TIMELINE_ICONS.completed,
      title: 'Löschung abgeschlossen',
      date: null,
      completed: true,
    });
  }

  return timeline;
}

/** Check if cooling-off warning should be shown */
export function shouldShowCoolingOff(item: DeletionStatusItem): boolean {
  const isPending =
    item.status === 'pending' || item.status === 'pending_approval';
  return isPending && calculateCoolingOff(item) > 0;
}

/** Check if grace period info should be shown */
export function shouldShowGracePeriod(item: DeletionStatusItem): boolean {
  return item.status === 'approved' || item.status === 'queued';
}

/** Check if emergency stop button should be shown */
export function shouldShowEmergencyStop(item: DeletionStatusItem): boolean {
  return (
    item.status === 'queued' ||
    item.status === 'approved' ||
    item.status === 'processing'
  );
}

/** Toast type to store function mapping */
const TOAST_FN_MAP: Record<ToastType, (msg: string) => string> = {
  success: showSuccessAlert,
  error: showErrorAlert,
  warning: showWarningAlert,
  info: showInfoAlert,
};

/** Show toast notification via toast store */
export function showToast(message: string, type: ToastType = 'info'): void {
  TOAST_FN_MAP[type](message);
}
