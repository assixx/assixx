// =============================================================================
// SHIFTS - DRAG & DROP UTILITIES
// Based on: frontend/src/scripts/shifts/drag-drop.ts
// Adapted for Svelte 5 (event handler helpers)
// =============================================================================

// =============================================================================
// TYPES
// =============================================================================

/**
 * Drag data for employee transfer
 */
export interface EmployeeDragData {
  employeeId: number;
  employeeName: string;
}

/**
 * Drop target data
 */
export interface DropTargetData {
  date: string;
  shiftType: string;
  day: string;
}

// =============================================================================
// DRAG DATA HANDLING
// =============================================================================

/**
 * Set drag data on a drag event
 */
export function setDragData(
  dataTransfer: DataTransfer,
  employeeId: number,
  employeeName: string,
): void {
  dataTransfer.effectAllowed = 'move';
  dataTransfer.setData('text/plain', String(employeeId));
  dataTransfer.setData('employeeId', String(employeeId));
  dataTransfer.setData('employeeName', employeeName);
}

/**
 * Get employee ID from drag event
 */
export function getEmployeeIdFromDrag(dataTransfer: DataTransfer | null): number | null {
  if (dataTransfer === null) return null;

  // Try to get employee ID from different data types
  let employeeId = dataTransfer.getData('employeeId');
  if (employeeId === '') {
    employeeId = dataTransfer.getData('text/plain');
  }
  if (employeeId === '') {
    employeeId = dataTransfer.getData('userId');
  }

  if (employeeId === '') return null;

  const parsedId = Number.parseInt(employeeId, 10);
  return Number.isNaN(parsedId) ? null : parsedId;
}

/**
 * Get employee data from drag event
 */
export function getEmployeeDataFromDrag(
  dataTransfer: DataTransfer | null,
): EmployeeDragData | null {
  if (dataTransfer === null) return null;

  const employeeId = getEmployeeIdFromDrag(dataTransfer);
  if (employeeId === null) return null;

  const employeeName = dataTransfer.getData('employeeName');

  return {
    employeeId,
    employeeName: employeeName !== '' ? employeeName : `Mitarbeiter ${employeeId}`,
  };
}

// =============================================================================
// DROP TARGET HELPERS
// =============================================================================

/**
 * Get drop target data from element dataset
 */
export function getDropTargetData(element: HTMLElement): DropTargetData | null {
  const date = element.dataset.date;
  const shiftType = element.dataset.shift;
  const day = element.dataset.day;

  if (date === undefined || shiftType === undefined || day === undefined) {
    return null;
  }

  return { date, shiftType, day };
}

/**
 * Check if element is a valid drop target (shift cell)
 */
export function isValidDropTarget(element: HTMLElement | null): boolean {
  if (element === null) return false;
  return element.classList.contains('shift-cell');
}

/**
 * Get the shift cell from a target element (handles nested elements)
 */
export function getShiftCellFromTarget(target: HTMLElement): HTMLElement | null {
  // If target itself is a shift cell
  if (target.classList.contains('shift-cell')) {
    return target;
  }

  // Look for parent shift cell
  return target.closest('.shift-cell');
}

// =============================================================================
// DRAG HANDLERS FOR SVELTE
// =============================================================================

/**
 * Create drag start handler for employee items
 */
export function createDragStartHandler(
  employeeId: number,
  employeeName: string,
  onDragStart?: () => void,
): (e: DragEvent) => void {
  return (e: DragEvent) => {
    if (e.dataTransfer !== null) {
      setDragData(e.dataTransfer, employeeId, employeeName);
      const target = e.target as HTMLElement;
      target.classList.add('dragging');
      onDragStart?.();
    }
  };
}

/**
 * Create drag end handler for employee items
 */
export function createDragEndHandler(onDragEnd?: () => void): (e: DragEvent) => void {
  return (e: DragEvent) => {
    const target = e.target as HTMLElement;
    target.classList.remove('dragging');
    onDragEnd?.();
  };
}

/**
 * Create dragover handler for drop targets
 */
export function createDragOverHandler(allowDrop: boolean = true): (e: DragEvent) => void {
  return (e: DragEvent) => {
    if (!allowDrop) return;

    e.preventDefault();
    if (e.dataTransfer !== null) {
      e.dataTransfer.dropEffect = 'copy';
    }

    const shiftCell = getShiftCellFromTarget(e.target as HTMLElement);
    if (shiftCell !== null) {
      shiftCell.classList.add('drag-over');
    }
  };
}

/**
 * Create dragleave handler for drop targets
 */
export function createDragLeaveHandler(): (e: DragEvent) => void {
  return (e: DragEvent) => {
    const shiftCell = getShiftCellFromTarget(e.target as HTMLElement);
    if (shiftCell !== null) {
      shiftCell.classList.remove('drag-over');
    }
  };
}

/**
 * Create drop handler for shift cells
 */
export function createDropHandler(
  onDrop: (employeeId: number, dropData: DropTargetData) => void,
): (e: DragEvent) => void {
  return (e: DragEvent) => {
    e.preventDefault();

    const shiftCell = getShiftCellFromTarget(e.target as HTMLElement);
    if (shiftCell === null) return;

    shiftCell.classList.remove('drag-over');

    const employeeId = getEmployeeIdFromDrag(e.dataTransfer);
    const dropData = getDropTargetData(shiftCell);

    if (employeeId !== null && dropData !== null) {
      onDrop(employeeId, dropData);
    }
  };
}

// =============================================================================
// ROTATION DROP ZONE HELPERS
// =============================================================================

/**
 * Create handlers for rotation modal drop zones
 */
export function createRotationDropZoneHandlers(
  onDrop: (employeeData: EmployeeDragData, shiftGroup: string) => void,
  shiftGroup: string,
): {
  onDragOver: (e: DragEvent) => void;
  onDragLeave: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
} {
  return {
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer !== null) {
        e.dataTransfer.dropEffect = 'move';
      }
      const target = e.currentTarget as HTMLElement;
      target.classList.add('drag-over');
    },
    onDragLeave: (e: DragEvent) => {
      e.stopPropagation();
      const target = e.currentTarget as HTMLElement;
      const relatedTarget = e.relatedTarget as Node | null;
      if (relatedTarget === null || !target.contains(relatedTarget)) {
        target.classList.remove('drag-over');
      }
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const target = e.currentTarget as HTMLElement;
      target.classList.remove('drag-over');

      const employeeData = getEmployeeDataFromDrag(e.dataTransfer);
      if (employeeData !== null) {
        onDrop(employeeData, shiftGroup);
      }
    },
  };
}
