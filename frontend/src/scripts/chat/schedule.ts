/**
 * Chat Schedule Module
 * Handles scheduling messages to be sent at a future time
 */
import { showErrorAlert, showSuccessAlert } from '../utils/alerts';
import { $$ } from '../../utils/dom-utils';
import {
  scheduleMessage,
  cancelScheduledMessage as apiCancelScheduled,
  getConversationScheduledMessages,
  type ScheduledAttachmentData,
} from './api';
import { getChatState } from './state';
import { displayScheduledMessages } from './messages';

/** Minimum time in minutes before a message can be scheduled */
const MIN_SCHEDULE_MINUTES = 5;

/** Maximum time in days a message can be scheduled in advance */
const MAX_SCHEDULE_DAYS = 30;

/** Currently scheduled time (null if not scheduled) */
let scheduledFor: Date | null = null;

/**
 * Get the currently scheduled time
 */
export function getScheduledTime(): Date | null {
  return scheduledFor;
}

/**
 * Clear the scheduled time
 */
export function clearScheduledTime(): void {
  scheduledFor = null;
  updateScheduleBadge();
}

/**
 * Format date for display in badge
 */
function formatScheduleTime(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = date.toDateString() === today.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const timeStr = date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isToday) {
    return `Heute ${timeStr}`;
  } else if (isTomorrow) {
    return `Morgen ${timeStr}`;
  } else {
    const dateStr = date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
    });
    return `${dateStr} ${timeStr}`;
  }
}

/**
 * Update the schedule badge visibility and content
 */
function updateScheduleBadge(): void {
  const badge = $$('#scheduleBadge');
  const badgeTime = $$('#scheduleBadgeTime');
  const scheduleBtn = $$('#scheduleBtn');

  if (badge === null || badgeTime === null) return;

  if (scheduledFor !== null) {
    badge.classList.remove('u-hidden');
    badgeTime.textContent = formatScheduleTime(scheduledFor);
    if (scheduleBtn !== null) {
      scheduleBtn.classList.add('u-hidden');
    }
  } else {
    badge.classList.add('u-hidden');
    badgeTime.textContent = '';
    if (scheduleBtn !== null) {
      scheduleBtn.classList.remove('u-hidden');
    }
  }
}

/**
 * Validate schedule input fields
 */
function validateScheduleInput(
  dateInput: HTMLInputElement,
  timeInput: HTMLInputElement,
): { isValid: boolean; scheduledFor: Date | null } {
  const dateValue = dateInput.value;
  const timeValue = timeInput.value;

  // 1. Check required fields
  if (dateValue === '') {
    showErrorAlert('Bitte wählen Sie ein Datum');
    dateInput.focus();
    return { isValid: false, scheduledFor: null };
  }

  if (timeValue === '') {
    showErrorAlert('Bitte wählen Sie eine Uhrzeit');
    timeInput.focus();
    return { isValid: false, scheduledFor: null };
  }

  // 2. Combine date and time
  const selectedDate = new Date(`${dateValue}T${timeValue}`);
  const now = new Date();

  // 3. Check if in past (with buffer)
  const minTime = new Date(now.getTime() + MIN_SCHEDULE_MINUTES * 60 * 1000);
  if (selectedDate <= minTime) {
    showErrorAlert(`Der Zeitpunkt muss mindestens ${MIN_SCHEDULE_MINUTES} Minuten in der Zukunft liegen`);
    return { isValid: false, scheduledFor: null };
  }

  // 4. Check if too far in future
  const maxTime = new Date(now.getTime() + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000);
  if (selectedDate > maxTime) {
    showErrorAlert(`Der Zeitpunkt darf maximal ${MAX_SCHEDULE_DAYS} Tage in der Zukunft liegen`);
    return { isValid: false, scheduledFor: null };
  }

  return { isValid: true, scheduledFor: selectedDate };
}

/**
 * Open the schedule modal
 */
export function openScheduleModal(): void {
  const overlay = $$('#scheduleOverlay');
  const dateInput = $$('#scheduleDate') as HTMLInputElement | null;
  const timeInput = $$('#scheduleTime') as HTMLInputElement | null;

  if (overlay === null || dateInput === null || timeInput === null) {
    console.error('[Schedule] Modal elements not found');
    return;
  }

  // Set min date to today
  const todayParts = new Date().toISOString().split('T');
  const today = todayParts[0] ?? '';
  dateInput.min = today;

  // Pre-fill with current scheduled time if exists
  if (scheduledFor !== null) {
    const scheduledParts = scheduledFor.toISOString().split('T');
    dateInput.value = scheduledParts[0] ?? '';
    timeInput.value = scheduledFor.toTimeString().slice(0, 5);
  } else {
    // Default to 1 hour from now
    const defaultTime = new Date(Date.now() + 60 * 60 * 1000);
    const defaultParts = defaultTime.toISOString().split('T');
    dateInput.value = defaultParts[0] ?? '';
    timeInput.value = defaultTime.toTimeString().slice(0, 5);
  }

  // Update time input min when date changes
  dateInput.addEventListener('change', () => {
    const selectedDate = dateInput.value;
    if (selectedDate === today) {
      // Today: min time = now + 5 min
      const minTime = new Date(Date.now() + MIN_SCHEDULE_MINUTES * 60 * 1000);
      timeInput.min = minTime.toTimeString().slice(0, 5);
    } else {
      // Other day: no time restriction
      timeInput.min = '';
    }
  });

  // Trigger initial min time check
  dateInput.dispatchEvent(new Event('change'));

  // Show modal
  overlay.classList.add('modal-overlay--active');
}

/**
 * Close the schedule modal
 */
export function closeScheduleModal(): void {
  const overlay = $$('#scheduleOverlay');
  if (overlay !== null) {
    overlay.classList.remove('modal-overlay--active');
  }
}

/**
 * Confirm schedule selection
 */
export function confirmSchedule(): void {
  const dateInput = $$('#scheduleDate') as HTMLInputElement | null;
  const timeInput = $$('#scheduleTime') as HTMLInputElement | null;

  if (dateInput === null || timeInput === null) {
    console.error('[Schedule] Input elements not found');
    return;
  }

  const result = validateScheduleInput(dateInput, timeInput);

  if (result.isValid && result.scheduledFor !== null) {
    scheduledFor = result.scheduledFor;
    updateScheduleBadge();
    closeScheduleModal();
    // No success alert here - just sets the time. Success alert shows only when
    // message is actually scheduled via sendScheduledMessage() API call
  }
}

/**
 * Send a scheduled message via API
 * Optionally includes attachment data (file must already be uploaded)
 */
export async function sendScheduledMessage(content: string, attachment?: ScheduledAttachmentData): Promise<boolean> {
  const state = getChatState();

  if (state.currentConversationId === null) {
    showErrorAlert('Bitte wählen Sie zuerst eine Unterhaltung');
    return false;
  }

  if (scheduledFor === null) {
    showErrorAlert('Kein Zeitpunkt ausgewählt');
    return false;
  }

  try {
    await scheduleMessage(state.currentConversationId, content, scheduledFor.toISOString(), attachment);

    // Clear scheduled time after successful send
    const sentTime = formatScheduleTime(scheduledFor);
    clearScheduledTime();

    // Reload and display scheduled messages to show the new preview
    const scheduled = await getConversationScheduledMessages(state.currentConversationId);
    state.setScheduledMessages(state.currentConversationId, scheduled);
    displayScheduledMessages(scheduled);

    const hasAttachment = attachment !== undefined;
    const successMsg = hasAttachment
      ? `Nachricht mit Anhang geplant für ${sentTime}`
      : `Nachricht geplant für ${sentTime}`;
    showSuccessAlert(successMsg);
    return true;
  } catch (error) {
    console.error('[Schedule] Failed to schedule message:', error);
    showErrorAlert('Nachricht konnte nicht geplant werden');
    return false;
  }
}

/**
 * Cancel a scheduled message from the preview
 */
async function cancelScheduledMessagePreview(scheduledId: string): Promise<void> {
  const state = getChatState();

  if (state.currentConversationId === null) {
    showErrorAlert('Keine Unterhaltung ausgewählt');
    return;
  }

  try {
    await apiCancelScheduled(scheduledId);

    // Remove from state
    state.removeScheduledMessage(state.currentConversationId, scheduledId);

    // Reload and redisplay scheduled messages
    const scheduled = await getConversationScheduledMessages(state.currentConversationId);
    state.setScheduledMessages(state.currentConversationId, scheduled);
    displayScheduledMessages(scheduled);

    showSuccessAlert('Geplante Nachricht wurde abgebrochen');
  } catch (error) {
    console.error('[Schedule] Failed to cancel scheduled message:', error);
    showErrorAlert('Nachricht konnte nicht abgebrochen werden');
  }
}

/**
 * Setup schedule event listeners
 */
export function setupScheduleHandlers(): void {
  // Open modal
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    if (target.closest('[data-action="open-schedule-modal"]') !== null) {
      openScheduleModal();
      return;
    }

    if (
      target.closest('[data-action="close-schedule-modal"]') !== null ||
      target.closest('[data-action="cancel-schedule-modal"]') !== null
    ) {
      closeScheduleModal();
      return;
    }

    if (target.closest('[data-action="confirm-schedule"]') !== null) {
      confirmSchedule();
      return;
    }

    if (target.closest('[data-action="clear-schedule"]') !== null) {
      clearScheduledTime();
      return;
    }

    // Cancel scheduled message preview
    const cancelBtn = target.closest<HTMLElement>('[data-action="cancel-scheduled"]');
    if (cancelBtn !== null) {
      const scheduledId = cancelBtn.dataset['scheduledId'];
      if (scheduledId !== undefined) {
        void cancelScheduledMessagePreview(scheduledId);
      }
    }
  });

  // Close modal on overlay click
  const overlay = $$('#scheduleOverlay');
  if (overlay !== null) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeScheduleModal();
      }
    });
  }

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeScheduleModal();
    }
  });
}
