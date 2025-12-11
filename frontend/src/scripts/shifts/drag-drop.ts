/**
 * Drag and Drop Utilities for Shift Planning System
 * Pure drag & drop helper functions
 */

import { CSS_SELECTORS } from './constants';

// ============== DRAG DATA HANDLING ==============

/**
 * Set drag data on a drag event
 */
export function setDragData(dataTransfer: DataTransfer, employeeId: string | number, employeeName?: string): void {
  dataTransfer.effectAllowed = 'move';
  dataTransfer.setData('text/plain', String(employeeId));
  dataTransfer.setData('employeeId', String(employeeId));
  if (employeeName !== undefined) {
    dataTransfer.setData('employeeName', employeeName);
  }
}

/**
 * Get employee ID from drag event
 */
export function getEmployeeIdFromDrag(dataTransfer: DataTransfer | null): string | null {
  if (dataTransfer === null) return null;

  // Try to get employee ID from different data types
  let employeeId = dataTransfer.getData('employeeId');
  if (employeeId === '') {
    employeeId = dataTransfer.getData('text/plain');
  }
  if (employeeId === '') {
    employeeId = dataTransfer.getData('userId');
  }

  return employeeId !== '' ? employeeId : null;
}

/**
 * Get employee data from drag event
 */
export function getEmployeeDataFromDrag(dataTransfer: DataTransfer | null): {
  id: string;
  name: string;
} | null {
  if (dataTransfer === null) return null;

  const id = getEmployeeIdFromDrag(dataTransfer);
  if (id === null) return null;

  const name = dataTransfer.getData('employeeName');

  return { id, name };
}

// ============== DRAG STATE MANAGEMENT ==============

/**
 * Add dragging class to element
 */
export function startDragging(element: Element): void {
  element.classList.add('dragging');
}

/**
 * Remove dragging class from element
 */
export function stopDragging(element: Element): void {
  element.classList.remove('dragging');
}

/**
 * Add drag-over class to element
 */
export function addDragOverClass(element: Element): void {
  element.classList.add('drag-over');
}

/**
 * Remove drag-over class from element
 */
export function removeDragOverClass(element: Element): void {
  element.classList.remove('drag-over');
}

// ============== DROP ZONE HANDLING ==============

/**
 * Check if element is a valid drop zone
 */
export function isDropZone(element: Element | null): boolean {
  if (element === null) return false;
  return element.classList.contains('drop-zone') || element.closest('.drop-zone') !== null;
}

/**
 * Check if element is a shift cell
 */
export function isShiftCell(element: Element | null): element is HTMLElement {
  if (element === null) return false;
  return element.closest(CSS_SELECTORS.SHIFT_CELL) !== null;
}

/**
 * Get shift cell from target element
 */
export function getShiftCellFromTarget(target: Element): HTMLElement | null {
  return target.closest(CSS_SELECTORS.SHIFT_CELL);
}

/**
 * Get shift data from cell element
 */
export function getShiftDataFromCell(cell: HTMLElement): {
  date: string | undefined;
  day: string | undefined;
  shift: string | undefined;
  shiftType: string | undefined;
} {
  return {
    date: cell.dataset['date'],
    day: cell.dataset['day'],
    shift: cell.dataset['shift'],
    shiftType: cell.dataset['shiftType'],
  };
}

// ============== DRAGGABLE SETUP ==============

/**
 * Make an element draggable with data
 */
export function makeDraggable(
  element: HTMLElement,
  employeeId: number,
  employeeName: string,
  onDragStart?: () => void,
  onDragEnd?: () => void,
): void {
  element.draggable = true;
  element.dataset['employeeId'] = String(employeeId);
  element.dataset['employeeName'] = employeeName;

  element.addEventListener('dragstart', (e) => {
    if (e.dataTransfer !== null) {
      setDragData(e.dataTransfer, employeeId, employeeName);
      startDragging(element);
      onDragStart?.();
    }
  });

  element.addEventListener('dragend', () => {
    stopDragging(element);
    onDragEnd?.();
  });
}

/**
 * Setup draggable employee item in a list
 */
export function setupDraggableEmployee(
  element: HTMLElement,
  canDrag: () => boolean,
  onDragAttemptBlocked?: () => void,
): void {
  element.addEventListener('dragstart', (e) => {
    if (!canDrag()) {
      e.preventDefault();
      onDragAttemptBlocked?.();
      return;
    }

    const employeeId = element.dataset['employeeId'];
    if (employeeId !== undefined && employeeId !== '' && e.dataTransfer !== null) {
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', employeeId);
      startDragging(element);
    }
  });

  element.addEventListener('dragend', () => {
    stopDragging(element);
  });
}

// ============== DROP TARGET SETUP ==============

/**
 * Setup drop target for shift cells
 */
export function setupDropTarget(element: Element, onDrop: (employeeId: number, cell: HTMLElement) => void): void {
  element.addEventListener('dragover', (e) => {
    e.preventDefault();
    const dragEvent = e as DragEvent;
    if (dragEvent.dataTransfer !== null) {
      dragEvent.dataTransfer.dropEffect = 'copy';
    }
    addDragOverClass(element);
  });

  element.addEventListener('dragleave', () => {
    removeDragOverClass(element);
  });

  element.addEventListener('drop', (e) => {
    e.preventDefault();
    removeDragOverClass(element);

    const dragEvent = e as DragEvent;
    const employeeId = getEmployeeIdFromDrag(dragEvent.dataTransfer);

    if (employeeId !== null) {
      onDrop(Number.parseInt(employeeId, 10), element as HTMLElement);
    }
  });
}

/**
 * Setup drop zone for rotation modal
 */
export function setupRotationDropZone(
  dropZone: HTMLElement,
  _zoneId: string,
  onDrop: (employeeData: { id: string; name: string }) => void,
): {
  dragenter: (e: Event) => void;
  dragover: (e: Event) => void;
  dragleave: (e: Event) => void;
  drop: (e: Event) => void;
} {
  const handlers = {
    dragenter: (e: Event) => {
      e.preventDefault();
      // Allow drop by preventing default
    },
    dragover: (e: Event) => {
      e.preventDefault();
      const dragEvent = e as DragEvent;
      if (dragEvent.dataTransfer !== null) {
        dragEvent.dataTransfer.dropEffect = 'move';
      }
      if (!dropZone.classList.contains('drag-over')) {
        addDragOverClass(dropZone);
      }
    },
    dragleave: (e: Event) => {
      const dragEvent = e as DragEvent;
      const relatedTarget = dragEvent.relatedTarget as HTMLElement | null;

      if (relatedTarget === null || !dropZone.contains(relatedTarget)) {
        removeDragOverClass(dropZone);
      }
    },
    drop: (e: Event) => {
      const dragEvent = e as DragEvent;
      dragEvent.preventDefault();
      dragEvent.stopPropagation();
      dragEvent.stopImmediatePropagation();
      removeDragOverClass(dropZone);

      const employeeData = getEmployeeDataFromDrag(dragEvent.dataTransfer);
      if (employeeData !== null) {
        onDrop(employeeData);
      }
    },
  };

  // Register handlers in capture phase for rotation zones
  dropZone.addEventListener('dragenter', handlers.dragenter, true);
  dropZone.addEventListener('dragover', handlers.dragover, true);
  dropZone.addEventListener('dragleave', handlers.dragleave, true);
  dropZone.addEventListener('drop', handlers.drop, true);

  return handlers;
}

/**
 * Remove rotation drop zone handlers
 */
export function removeRotationDropZoneHandlers(
  dropZone: HTMLElement,
  handlers: {
    dragenter: (e: Event) => void;
    dragover: (e: Event) => void;
    dragleave: (e: Event) => void;
    drop: (e: Event) => void;
  },
): void {
  dropZone.removeEventListener('dragenter', handlers.dragenter, true);
  dropZone.removeEventListener('dragover', handlers.dragover, true);
  dropZone.removeEventListener('dragleave', handlers.dragleave, true);
  dropZone.removeEventListener('drop', handlers.drop, true);
}

// ============== GLOBAL DRAG HANDLERS ==============

/**
 * Setup global drag start handler for employee items
 */
export function setupGlobalDragStart(
  canDrag: () => boolean,
  onDragStart: (employeeId: string) => void,
  onBlockedDragAttempt: () => void,
): void {
  document.addEventListener('dragstart', (e) => {
    const target = e.target as HTMLElement;

    // Skip handling for rotation modals - they manage their own drag events
    const rotationModal = target.closest('#rotation-setup-modal');
    const customRotationModal = target.closest('#custom-rotation-modal');
    if (rotationModal !== null || customRotationModal !== null) {
      return; // Let the modal's own handlers deal with it
    }

    const employeeItem = target.closest(CSS_SELECTORS.EMPLOYEE_ITEM);

    if (employeeItem !== null) {
      if (employeeItem.getAttribute('draggable') === 'false') {
        e.preventDefault();
        onBlockedDragAttempt();
        return;
      }

      if (!canDrag()) {
        e.preventDefault();
        onBlockedDragAttempt();
        return;
      }

      const employeeId = (employeeItem as HTMLElement).dataset['employeeId'];
      if (employeeId !== undefined && employeeId !== '' && e.dataTransfer !== null) {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', employeeId);
        startDragging(employeeItem);
        onDragStart(employeeId);
      }
    }
  });
}

/**
 * Setup global drag end handler
 */
export function setupGlobalDragEnd(onDragEnd: () => void): void {
  document.addEventListener('dragend', (e) => {
    const target = e.target as HTMLElement;

    // Skip handling for rotation modals - they manage their own drag events
    const rotationModal = target.closest('#rotation-setup-modal');
    const customRotationModal = target.closest('#custom-rotation-modal');
    if (rotationModal !== null || customRotationModal !== null) {
      return; // Let the modal's own handlers deal with it
    }

    const employeeItem = target.closest(CSS_SELECTORS.EMPLOYEE_ITEM);

    if (employeeItem !== null) {
      stopDragging(employeeItem);
      onDragEnd();
    }
  });
}

/**
 * Setup global dragover handler
 */
export function setupGlobalDragOver(): void {
  document.addEventListener('dragover', (e) => {
    const target = e.target as HTMLElement;

    // Check for rotation modals - let them handle their own events
    // Both standard rotation modal AND custom rotation modal need to be excluded
    const rotationModal = target.closest('#rotation-setup-modal');
    const customRotationModal = target.closest('#custom-rotation-modal');
    if (rotationModal !== null || customRotationModal !== null) {
      e.preventDefault();
      return;
    }

    // Check for drop zones
    if (isDropZone(target)) {
      e.preventDefault();
      if (e.dataTransfer !== null) {
        e.dataTransfer.dropEffect = 'move';
      }
      return;
    }

    // Check for shift cells
    const shiftCell = getShiftCellFromTarget(target);
    if (shiftCell !== null) {
      e.preventDefault();
      if (e.dataTransfer !== null) {
        e.dataTransfer.dropEffect = 'copy';
      }
      addDragOverClass(shiftCell);
    }
  });
}

/**
 * Setup global dragleave handler
 */
export function setupGlobalDragLeave(): void {
  document.addEventListener('dragleave', (e) => {
    const target = e.target as HTMLElement;
    const shiftCell = getShiftCellFromTarget(target);

    if (shiftCell !== null) {
      removeDragOverClass(shiftCell);
    }
  });
}

/**
 * Setup global drop handler
 */
export function setupGlobalDrop(onShiftCellDrop: (employeeId: number, cell: HTMLElement) => void): void {
  document.addEventListener(
    'drop',
    (e) => {
      const target = e.target as HTMLElement;

      // Skip if dropping on rotation zones
      if (isDropZone(target)) {
        return;
      }

      const shiftCell = getShiftCellFromTarget(target);
      if (shiftCell !== null) {
        e.preventDefault();
        removeDragOverClass(shiftCell);

        const employeeId = getEmployeeIdFromDrag(e.dataTransfer);
        if (employeeId !== null) {
          onShiftCellDrop(Number.parseInt(employeeId, 10), shiftCell);
        }
      }
    },
    false,
  );
}
