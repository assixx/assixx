// =============================================================================
// SHIFTS - MODAL UTILITIES
// Based on: frontend/src/scripts/shifts/modals.ts
// Adapted for Svelte 5 (state-based modal management)
// =============================================================================

import { getShiftLabel, formatDateGerman } from './utils';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Modal types
 */
export type ModalType =
  | 'rotation-setup'
  | 'custom-rotation'
  | 'shift-details'
  | 'confirm'
  | 'info'
  | 'delete-rotation';

/**
 * Confirm modal options
 */
export interface ConfirmModalOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
}

/**
 * Info modal options
 */
export interface InfoModalOptions {
  title: string;
  message: string;
  autoClose?: boolean;
  duration?: number;
}

/**
 * Shift details modal data
 */
export interface ShiftDetailsData {
  shiftType: string;
  date: string;
  employees: { id: number; name: string }[];
}

/**
 * Delete rotation modal options
 */
export interface DeleteRotationOptions {
  teamId: number;
  teamName: string;
  weekStart: string;
  weekEnd: string;
  deleteType: 'week' | 'all';
}

// =============================================================================
// MODAL CONTENT HELPERS
// =============================================================================

/**
 * Create shift details content for display
 */
export function createShiftDetailsContent(
  shiftType: string,
  date: string,
  employees: { id: number; name: string }[],
): { title: string; dateStr: string; employees: { id: number; name: string }[]; isEmpty: boolean } {
  const parsedDate = new Date(date);

  return {
    title: getShiftLabel(shiftType),
    dateStr: formatDateGerman(parsedDate),
    employees,
    isEmpty: employees.length === 0,
  };
}

/**
 * Get shift label for modal display
 */
export function getShiftModalLabel(shiftType: string): string {
  return getShiftLabel(shiftType);
}

/**
 * Format date for modal display
 */
export function formatModalDate(dateString: string): string {
  const date = new Date(dateString);
  return formatDateGerman(date);
}

// =============================================================================
// ROTATION MODAL HELPERS
// =============================================================================

/**
 * Get rotation modal title based on edit mode
 */
export function getRotationModalTitle(editMode: boolean): string {
  return editMode ? 'Schichtrotation bearbeiten' : 'Schichtrotation einrichten';
}

/**
 * Get custom rotation modal title
 */
export function getCustomRotationModalTitle(editMode: boolean): string {
  return editMode ? '2-Wochen-Schichtplan bearbeiten' : '2-Wochen-Schichtplan einrichten';
}

// =============================================================================
// CONFIRM MODAL HELPERS
// =============================================================================

/**
 * Default confirm modal texts (German)
 */
export const CONFIRM_MODAL_DEFAULTS = {
  confirmText: 'Bestätigen',
  cancelText: 'Abbrechen',
};

/**
 * Get confirm modal for deleting a shift assignment
 */
export function getDeleteShiftConfirmOptions(employeeName: string): ConfirmModalOptions {
  return {
    title: 'Schichtzuweisung löschen',
    message: `Möchten Sie die Schichtzuweisung für "${employeeName}" wirklich löschen?`,
    confirmText: 'Löschen',
    cancelText: 'Abbrechen',
    isDangerous: true,
  };
}

/**
 * Get confirm modal for deleting a plan
 */
export function getDeletePlanConfirmOptions(): ConfirmModalOptions {
  return {
    title: 'Schichtplan löschen',
    message:
      'Möchten Sie diesen Schichtplan wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
    confirmText: 'Löschen',
    cancelText: 'Abbrechen',
    isDangerous: true,
  };
}

/**
 * Get confirm modal for deleting rotation
 */
export function getDeleteRotationConfirmOptions(
  deleteType: 'week' | 'all',
  teamName: string,
): ConfirmModalOptions {
  if (deleteType === 'week') {
    return {
      title: 'Rotationswoche löschen',
      message: `Möchten Sie die Rotationsdaten für diese Woche (Team: ${teamName}) wirklich löschen?`,
      confirmText: 'Woche löschen',
      cancelText: 'Abbrechen',
      isDangerous: true,
    };
  }

  return {
    title: 'Alle Rotationsdaten löschen',
    message: `Möchten Sie ALLE Rotationsdaten für Team "${teamName}" wirklich löschen? Dies umfasst alle Wochen, Muster und Zuweisungen.`,
    confirmText: 'Alles löschen',
    cancelText: 'Abbrechen',
    isDangerous: true,
  };
}

/**
 * Get confirm modal for discarding changes
 */
export function getDiscardChangesConfirmOptions(): ConfirmModalOptions {
  return {
    title: 'Änderungen verwerfen',
    message: 'Sie haben ungespeicherte Änderungen. Möchten Sie diese wirklich verwerfen?',
    confirmText: 'Verwerfen',
    cancelText: 'Weiter bearbeiten',
    isDangerous: true,
  };
}

/**
 * Get confirm modal for saving plan
 */
export function getSavePlanConfirmOptions(): ConfirmModalOptions {
  return {
    title: 'Schichtplan speichern',
    message: 'Möchten Sie den aktuellen Schichtplan speichern?',
    confirmText: 'Speichern',
    cancelText: 'Abbrechen',
    isDangerous: false,
  };
}

// =============================================================================
// INFO MODAL HELPERS
// =============================================================================

/**
 * Get info modal for successful save
 */
export function getSaveSuccessInfoOptions(): InfoModalOptions {
  return {
    title: 'Gespeichert',
    message: 'Der Schichtplan wurde erfolgreich gespeichert.',
    autoClose: true,
    duration: 3000,
  };
}

/**
 * Get info modal for error
 */
export function getErrorInfoOptions(errorMessage: string): InfoModalOptions {
  return {
    title: 'Fehler',
    message: errorMessage,
    autoClose: false,
  };
}

/**
 * Get info modal for autofill result
 */
export function getAutofillResultInfoOptions(
  filledCount: number,
  shiftName: string,
): InfoModalOptions {
  return {
    title: 'Autofill abgeschlossen',
    message: `${filledCount} weitere Tage mit ${shiftName} ausgefüllt.`,
    autoClose: true,
    duration: 3000,
  };
}

// =============================================================================
// ESCAPE KEY HANDLER
// =============================================================================

/**
 * Create an escape key handler for closing modals
 */
export function createEscapeHandler(onEscape: () => void): (e: KeyboardEvent) => void {
  return (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onEscape();
    }
  };
}

/**
 * Add escape key listener
 */
export function addEscapeListener(handler: (e: KeyboardEvent) => void): () => void {
  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
    };
  }
  return () => {
    /* no-op cleanup for SSR */
  };
}

// =============================================================================
// FOCUS TRAP HELPER
// =============================================================================

/**
 * Get focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    'a[href]',
  ];

  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors.join(', ')));
}

/**
 * Trap focus within a modal container
 */
export function trapFocus(container: HTMLElement, e: KeyboardEvent): void {
  if (e.key !== 'Tab') return;

  const focusableElements = getFocusableElements(container);
  if (focusableElements.length === 0) return;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (e.shiftKey) {
    // Shift + Tab
    if (document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    }
  } else {
    // Tab
    if (document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }
}
