/* eslint-disable max-lines -- UI module after refactoring, contains all rendering functions */
/**
 * UI Rendering Functions for Shift Planning System
 * Pure rendering utilities for creating and updating DOM elements
 */

import { createElement, $$id, hide, show } from '../../utils/dom-utils';
import { CSS_CLASSES, CSS_SELECTORS, DISPLAY } from './constants';
import type { Employee, ShiftDetailData } from './types';
import { getCurrentWeek, getCurrentPlanId, isEditMode as getIsEditMode, canEditShifts } from './state';
import { getWeekDates } from './utils';
import { getEffectiveAvailabilityForWeek } from './validation';
import { makeDraggable } from './drag-drop';

// ============== AVAILABILITY RENDERING ==============

/**
 * Create availability icon element based on status
 */
export function createAvailabilityIcon(status: string | undefined): HTMLElement | null {
  if (status === undefined || status === 'available') {
    return null;
  }

  const iconConfig = new Map<string, { iconClass: string; statusClass: string; title: string }>([
    ['vacation', { iconClass: 'fa-plane', statusClass: 'vacation', title: 'Im Urlaub' }],
    ['sick', { iconClass: 'fa-notes-medical', statusClass: 'sick', title: 'Krank' }],
    ['unavailable', { iconClass: 'fa-ban', statusClass: 'unavailable', title: 'Nicht verfügbar' }],
    ['training', { iconClass: 'fa-graduation-cap', statusClass: 'training', title: 'Schulung' }],
    ['other', { iconClass: 'fa-clock', statusClass: 'other', title: 'Sonstiges' }],
  ]);

  const config = iconConfig.get(status);
  if (config === undefined) {
    return null;
  }

  return createElement('i', {
    className: `fas ${config.iconClass} status-icon ${config.statusClass}`,
    title: config.title,
  });
}

/**
 * Create availability badge element based on status
 */
export function createAvailabilityBadge(status: string | undefined): HTMLElement {
  const badgeConfig = new Map<string, { badgeClass: string; text: string }>([
    ['available', { badgeClass: 'badge--success', text: 'Verfügbar' }],
    ['vacation', { badgeClass: 'badge--warning', text: 'Urlaub' }],
    ['sick', { badgeClass: 'badge--danger', text: 'Krank' }],
    ['unavailable', { badgeClass: 'badge--error', text: 'Nicht verfügbar' }],
    ['training', { badgeClass: 'badge--info', text: 'Schulung' }],
    ['other', { badgeClass: 'badge--dark', text: 'Sonstiges' }],
  ]);

  const defaultConfig = { badgeClass: 'badge--success', text: 'Verfügbar' };
  const config = badgeConfig.get(status ?? 'available') ?? defaultConfig;
  const badgeClass = config.badgeClass;
  const text = config.text;

  return createElement('span', { className: `badge ${badgeClass}` }, text);
}

/**
 * Create date range element for availability period
 */
export function createAvailabilityDateRange(
  startDate: string | undefined,
  endDate: string | undefined,
): HTMLElement | null {
  if (startDate === undefined && endDate === undefined) {
    return null;
  }

  const formatDate = (dateStr: string | undefined): string => {
    if (dateStr === undefined) return '?';
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const startFormatted = formatDate(startDate);
  const endFormatted = formatDate(endDate);

  const dateRangeSpan = createElement(
    'span',
    { className: 'availability-date-range' },
    `(${startFormatted} - ${endFormatted})`,
  );

  dateRangeSpan.style.color = '#da3d3dff';

  return dateRangeSpan;
}

// ============== EMPLOYEE CARD RENDERING ==============

/**
 * Get display name for an employee
 */
export function getEmployeeDisplayName(employee: Employee): string {
  const firstName = employee.firstName ?? '';
  const lastName = employee.lastName ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName !== '' ? fullName : employee.username;
}

/**
 * Create employee card element
 */
export function createEmployeeCard(
  employee: Employee,
  isAdmin: boolean,
  isEditMode: boolean,
  currentPlanId: number | null,
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'employee-card';
  card.dataset['employeeId'] = employee.id.toString();

  const name = getEmployeeDisplayName(employee);
  const nameDiv = createElement('div', { className: CSS_CLASSES.EMPLOYEE_NAME }, name);
  card.append(nameDiv);

  if (isAdmin) {
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.dataset['action'] = 'remove-shift';
    removeBtn.dataset['employeeId'] = String(employee.id);

    const removeIcon = createElement('i', { className: 'fas fa-times' });
    removeBtn.append(removeIcon);

    if (!isEditMode && currentPlanId !== null) {
      removeBtn.style.display = DISPLAY.NONE;
    }

    card.append(removeBtn);
  }

  return card;
}

/**
 * Create fallback employee card when employee data is not found
 */
export function createFallbackEmployeeCard(employeeId: number): HTMLElement {
  const tempCard = document.createElement('div');
  tempCard.className = 'employee-card';

  const nameDiv = document.createElement('div');
  nameDiv.className = CSS_CLASSES.EMPLOYEE_NAME;
  nameDiv.textContent = `Mitarbeiter #${String(employeeId)}`;
  tempCard.append(nameDiv);

  return tempCard;
}

/**
 * Create temp employee from shift detail data
 */
export function createTempEmployeeFromShiftDetail(shiftDetail: ShiftDetailData): Employee {
  const firstName = shiftDetail.firstName !== '' ? shiftDetail.firstName : undefined;
  const lastName = shiftDetail.lastName !== '' ? shiftDetail.lastName : undefined;
  const username = shiftDetail.username !== '' ? shiftDetail.username : `Employee #${shiftDetail.employeeId}`;

  return {
    id: shiftDetail.employeeId,
    firstName,
    lastName,
    username,
    position: 'Mitarbeiter',
    email: '',
    role: 'employee' as const,
    tenantId: 0,
    createdAt: '',
    updatedAt: '',
    isActive: 1,
  };
}

// ============== DROPDOWN RENDERING ==============

/**
 * Populate a dropdown with options
 */
export function populateDropdown(
  dropdownId: string,
  items: { id: number; name: string }[],
  type: string,
  emptyMessage?: string,
): void {
  const dropdown = document.querySelector(`#${dropdownId}`);
  if (dropdown === null) {
    console.error(`Dropdown element #${dropdownId} not found`);
    return;
  }

  dropdown.innerHTML = '';

  if (items.length === 0 && emptyMessage !== undefined) {
    const message = document.createElement('div');
    message.className = CSS_CLASSES.DROPDOWN_MESSAGE;
    message.textContent = emptyMessage;
    message.style.padding = '10px';
    message.style.color = '#999';
    message.style.fontStyle = 'italic';
    dropdown.append(message);
    return;
  }

  items.forEach((item) => {
    const option = document.createElement('div');
    option.className = CSS_CLASSES.DROPDOWN_OPTION;
    option.dataset['value'] = item.id.toString();
    option.dataset['type'] = type;
    option.dataset['text'] = item.name;
    option.textContent = item.name;
    dropdown.append(option);
  });
}

/**
 * Update dropdown display text
 */
export function updateDropdownDisplay(type: string, displayText: string): void {
  const displayElement = $$id(`${type}Display`);
  if (displayElement === null) return;

  const span = displayElement.querySelector('span');
  if (span !== null) {
    span.textContent = displayText;
  }

  const dropdown = $$id(`${type}Dropdown`);
  if (dropdown !== null) {
    dropdown.classList.remove('active');
  }
  displayElement.classList.remove('active');
}

/**
 * Set dropdown disabled state
 * Disabled dropdowns are grayed out and not clickable
 */
export function setDropdownDisabled(type: string, disabled: boolean, placeholder?: string): void {
  const displayElement = $$id(`${type}Display`);
  if (displayElement === null) return;

  const dropdownContainer = displayElement.closest('.dropdown');
  if (dropdownContainer === null) return;

  if (disabled) {
    dropdownContainer.classList.add('dropdown--disabled');
    displayElement.style.pointerEvents = 'none';
    displayElement.style.opacity = '0.5';
    // Reset to placeholder text
    const span = displayElement.querySelector('span');
    if (span !== null && placeholder !== undefined) {
      span.textContent = placeholder;
    }
  } else {
    dropdownContainer.classList.remove('dropdown--disabled');
    displayElement.style.pointerEvents = '';
    displayElement.style.opacity = '';
  }
}

/**
 * Reset dropdown to initial state
 */
export function resetDropdown(type: string, placeholder: string): void {
  const displayElement = $$id(`${type}Display`);
  const dropdown = $$id(`${type}Dropdown`);

  if (displayElement !== null) {
    const span = displayElement.querySelector('span');
    if (span !== null) {
      span.textContent = placeholder;
    }
    displayElement.dataset['value'] = '';
  }

  if (dropdown !== null) {
    dropdown.innerHTML = '';
  }
}

// ============== SHIFT CELL RENDERING ==============

/**
 * Create empty slot element for shift cells
 */
export function createEmptySlot(isAdmin: boolean): HTMLElement {
  const emptySlot = document.createElement('div');
  emptySlot.className = 'empty-slot';
  emptySlot.textContent = isAdmin ? '+' : '-';
  return emptySlot;
}

/**
 * Update shift cell with assignment div containing employee cards or empty slot
 */
export function updateShiftCellContent(
  assignmentDiv: Element,
  employeeIds: number[],
  employees: Employee[],
  shiftDetails: Map<string, ShiftDetailData>,
  dateKey: string,
  shiftType: string,
  isAdmin: boolean,
  isEditMode: boolean,
  currentPlanId: number | null,
): void {
  assignmentDiv.innerHTML = '';

  if (employeeIds.length === 0) {
    const emptySlot = createEmptySlot(isAdmin);
    assignmentDiv.append(emptySlot);
    return;
  }

  employeeIds.forEach((employeeId) => {
    const employee = employees.find((e) => e.id === employeeId);
    const shiftDetailKey = `${dateKey}_${shiftType}_${String(employeeId)}`;
    const shiftDetail = shiftDetails.get(shiftDetailKey);

    if (employee !== undefined) {
      const card = createEmployeeCard(employee, isAdmin, isEditMode, currentPlanId);
      assignmentDiv.append(card);
    } else if (shiftDetail !== undefined) {
      const tempEmployee = createTempEmployeeFromShiftDetail(shiftDetail);
      const card = createEmployeeCard(tempEmployee, isAdmin, isEditMode, currentPlanId);
      assignmentDiv.append(card);
    } else {
      const fallbackCard = createFallbackEmployeeCard(employeeId);
      assignmentDiv.append(fallbackCard);
    }
  });
}

// ============== INFO BAR RENDERING ==============

/**
 * Update the info bar content
 */
export function updateInfoBar(content: string): void {
  const infoBar = document.querySelector('.shift-info-bar');
  if (infoBar === null) return;

  while (infoBar.firstChild !== null) {
    infoBar.firstChild.remove();
  }

  if (content === '') return;

  const span = document.createElement('span');

  if (content.includes('Automatische Rotation aktiv')) {
    span.style.color = '#4CAF50';
    span.textContent = 'Automatische Rotation aktiv';
  } else {
    span.textContent = content;
  }

  infoBar.append(span);
}

// ============== ELEMENT VISIBILITY ==============

/**
 * Toggle element visibility
 */
export function toggleElementVisibility(element: Element | null, shouldHide: boolean): void {
  if (element === null) return;

  const htmlElement = element as HTMLElement;
  if (shouldHide) {
    htmlElement.classList.add('hidden');
    hide(htmlElement);
  } else {
    htmlElement.classList.remove('hidden', 'u-hidden');
    show(htmlElement);
  }
}

/**
 * Show planning UI elements after team selection or favorite click
 * Removes u-hidden class from main planning elements
 * Called when:
 * 1. Team filter is selected (via handleTeamChange in dropdown.ts)
 * 2. Favorite button is clicked (via loadFavoriteWithDropdowns in favorites.ts)
 */
export function showPlanningUI(isAdmin: boolean): void {
  // Show main planning elements
  toggleElementVisibility(document.querySelector('.week-navigation'), false);
  toggleElementVisibility(document.querySelector('.shift-controls'), false);
  toggleElementVisibility($$id('mainPlanningArea'), false);

  // Show admin-only elements
  if (isAdmin) {
    toggleElementVisibility($$id('adminActions'), false);
    // Employee sidebar is inside mainPlanningArea but also has u-hidden
    toggleElementVisibility(document.querySelector('.employee-sidebar'), false);
  }

  // Hide the "select team" notice
  toggleElementVisibility($$id('departmentNotice'), true);
}

/**
 * Hide planning UI elements (initial state)
 */
export function hidePlanningUI(): void {
  toggleElementVisibility(document.querySelector('.week-navigation'), true);
  toggleElementVisibility(document.querySelector('.shift-controls'), true);
  toggleElementVisibility($$id('mainPlanningArea'), true);
  toggleElementVisibility($$id('adminActions'), true);
}

/**
 * Show edit rotation button
 */
export function showEditRotationButton(shouldShow: boolean): void {
  const editBtn = $$id('edit-rotation-btn') as HTMLButtonElement | null;
  if (editBtn !== null) {
    editBtn.style.display = shouldShow ? DISPLAY.INLINE_BLOCK : DISPLAY.NONE;
  }
}

// ============== WEEK DISPLAY ==============

/**
 * Update day header with date
 */
export function updateDayHeader(header: Element, date: Date): void {
  const dateSpan = header.querySelector('span');
  if (dateSpan !== null) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    dateSpan.textContent = `${day}.${month}`;
  }
}

/**
 * Format date for display in German format (DD.MM.YYYY)
 */
export function formatDateForDisplayGerman(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

// ============== TEAM MEMBERS PANEL ==============

/**
 * Create team member card element
 */
export function createTeamMemberCard(member: {
  id: number;
  firstName: string;
  lastName: string;
  role: 'member' | 'lead';
}): HTMLElement {
  const card = createElement('div', {
    className: 'member-card',
    draggable: true,
  });
  card.dataset['userId'] = String(member.id);

  const nameDiv = createElement('div', { className: 'member-name' }, `${member.firstName} ${member.lastName}`);
  const roleDiv = createElement('div', { className: 'member-role' }, member.role === 'lead' ? 'Team Lead' : 'Mitglied');

  card.append(nameDiv);
  card.append(roleDiv);

  return card;
}

/**
 * Render team members panel
 */
export function renderTeamMembersPanel(
  container: Element,
  members: { id: number; firstName: string; lastName: string; role: 'member' | 'lead' }[],
): void {
  container.classList.remove('hidden');

  while (container.firstChild !== null) {
    container.firstChild.remove();
  }

  const h3 = createElement('h3', {}, 'Team-Mitglieder');
  container.append(h3);

  const membersList = createElement('div', { className: 'members-list' });

  members.forEach((member) => {
    const card = createTeamMemberCard(member);
    membersList.append(card);
  });

  container.append(membersList);
}

// ============== STATUS TEXT HELPERS ==============

/**
 * Get status text for display
 */
export function getStatusText(status: string): string {
  const statusTexts = new Map<string, string>([
    ['vacation', 'im Urlaub'],
    ['sick', 'krankgemeldet'],
    ['unavailable', 'nicht verfügbar'],
    ['training', 'in Schulung'],
    ['other', 'anderweitig abwesend'],
  ]);
  return statusTexts.get(status) ?? 'nicht verfügbar';
}

/**
 * Get shift name for display
 */
export function getShiftName(shiftType: string): string {
  const shiftNames = new Map<string, string>([
    ['early', 'Frühschicht'],
    ['late', 'Spätschicht'],
    ['night', 'Nachtschicht'],
    ['F', 'Frühschicht'],
    ['S', 'Spätschicht'],
    ['N', 'Nachtschicht'],
  ]);
  return shiftNames.get(shiftType) ?? shiftType;
}

// ============== EMPLOYEE LIST RENDERING ==============

/**
 * Build availability info elements for an employee
 */
export function buildAvailabilityInfo(infoDiv: HTMLElement, employee: Employee, availabilityStatus: string): void {
  // Availability icon (if not available)
  const iconElement = createAvailabilityIcon(availabilityStatus);
  if (iconElement !== null) {
    infoDiv.append(iconElement);
  }

  // Availability badge and date range (if not available)
  if (availabilityStatus !== 'available') {
    const badgeElement = createAvailabilityBadge(availabilityStatus);
    infoDiv.append(badgeElement);

    const dateRangeElement = createAvailabilityDateRange(employee.availabilityStart, employee.availabilityEnd);
    if (dateRangeElement !== null) {
      infoDiv.append(dateRangeElement);
    }
  }
}

/**
 * Build "Verfügbar ab" return date element if employee returns within current week
 */
export function buildReturnDateElement(employee: Employee): HTMLElement | null {
  if (employee.availabilityEnd === undefined || employee.availabilityEnd === '') {
    return null;
  }

  const endDate = new Date(employee.availabilityEnd);
  endDate.setDate(endDate.getDate() + 1); // Day after absence ends

  const currentWeek = getCurrentWeek();
  const weekDates = getWeekDates(currentWeek);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  if (weekStart === undefined || weekEnd === undefined || endDate < weekStart || endDate > weekEnd) {
    return null;
  }

  const day = endDate.getDate().toString().padStart(2, '0');
  const month = (endDate.getMonth() + 1).toString().padStart(2, '0');
  const year = endDate.getFullYear();

  const returnDateDiv = document.createElement('div');
  returnDateDiv.className = 'availability-return-date';
  returnDateDiv.textContent = `Verfügbar ab ${day}.${month}.${year}`;
  returnDateDiv.style.fontSize = '11px';
  returnDateDiv.style.color = '#4caf50';
  returnDateDiv.style.marginTop = '2px';

  return returnDateDiv;
}

/**
 * Create a single employee list item element
 * Uses effective availability based on the currently selected week
 */
export function createEmployeeListItem(employee: Employee): HTMLElement {
  const item = document.createElement('div');
  item.className = CSS_CLASSES.EMPLOYEE_ITEM;
  item.dataset['employeeId'] = String(employee.id);

  // Calculate effective availability for the current week
  const currentWeek = getCurrentWeek();
  const weekDates = getWeekDates(currentWeek);
  const effectiveStatus = getEffectiveAvailabilityForWeek(employee, weekDates);

  if (effectiveStatus !== 'available') {
    item.classList.add('unavailable', `status-${effectiveStatus}`);
  }

  const canEdit = canEditShifts();
  const isDraggable = canEdit && (getCurrentPlanId() === null || getIsEditMode());
  item.draggable = isDraggable;

  // Build employee info structure
  const infoDiv = document.createElement('div');
  infoDiv.className = 'employee-info';

  const name = getEmployeeDisplayName(employee);
  const nameSpan = document.createElement('span');
  nameSpan.className = CSS_CLASSES.EMPLOYEE_NAME;
  nameSpan.textContent = name;
  infoDiv.append(nameSpan);

  // Show availability info based on EFFECTIVE status for this week
  buildAvailabilityInfo(infoDiv, employee, effectiveStatus);

  // Only show return date if employee is unavailable in this week
  if (effectiveStatus !== 'available') {
    const returnDateElement = buildReturnDateElement(employee);
    if (returnDateElement !== null) {
      infoDiv.append(returnDateElement);
    }
  }

  item.append(infoDiv);
  makeDraggable(item, employee.id, name);

  return item;
}

/**
 * Render employees list in sidebar with availability status
 */
export function renderEmployeesList(employees: Employee[], containerId: string = 'employeeList'): void {
  const container = $$id(containerId);
  if (container === null) return;

  container.innerHTML = '';

  employees.forEach((employee) => {
    const item = createEmployeeListItem(employee);
    container.append(item);
  });
}

// ============== LOCK/EDIT MODE ==============

/**
 * Lock the shift plan UI
 * Disables drag and drop, makes cells locked, hides remove buttons
 * Called when a plan exists but edit mode is not active
 * Note: Always runs (no cache check) because DOM might have new elements
 * that need locking (e.g., after renderEmployeesList)
 */
export function lockShiftPlan(): void {
  // Disable drag and drop on employee items
  const draggableEmployees = document.querySelectorAll('.employee-item[draggable="true"]');
  draggableEmployees.forEach((el) => {
    el.setAttribute('draggable', 'false');
    el.classList.add('locked');
  });

  // Add locked class to shift cells
  const shiftCells = document.querySelectorAll(CSS_SELECTORS.SHIFT_CELL);
  shiftCells.forEach((cell) => {
    cell.classList.add('locked');
  });

  // Hide remove buttons
  const removeButtons = document.querySelectorAll(`${CSS_SELECTORS.SHIFT_CELL} .remove-btn`);
  removeButtons.forEach((btn) => {
    (btn as HTMLElement).style.display = DISPLAY.NONE;
  });

  // Make notes readonly
  const notesTextarea = document.querySelector('#weeklyNotes');
  if (notesTextarea !== null) {
    notesTextarea.setAttribute('readonly', 'readonly');
  }
}

/**
 * Unlock the shift plan UI
 * Enables drag and drop, removes locked state, shows remove buttons
 * Called when entering edit mode or navigating to empty week
 * Note: Always runs (no cache check) because DOM might have .locked class
 * even when cache says unlocked (e.g., after week navigation)
 */
export function unlockShiftPlan(): void {
  // Enable drag and drop on employee items
  const draggableEmployees = document.querySelectorAll('.employee-item[draggable="false"]');
  draggableEmployees.forEach((el) => {
    el.setAttribute('draggable', 'true');
    el.classList.remove('locked');
  });

  // Also check for items that might not have draggable set but have locked class
  const lockedEmployees = document.querySelectorAll('.employee-item.locked');
  lockedEmployees.forEach((el) => {
    el.setAttribute('draggable', 'true');
    el.classList.remove('locked');
  });

  // Remove locked class from shift cells
  const shiftCells = document.querySelectorAll(CSS_SELECTORS.SHIFT_CELL);
  shiftCells.forEach((cell) => {
    cell.classList.remove('locked');
  });

  // Show remove buttons
  const removeButtons = document.querySelectorAll(`${CSS_SELECTORS.SHIFT_CELL} .remove-btn`);
  removeButtons.forEach((btn) => {
    (btn as HTMLElement).style.display = '';
  });

  // Make notes editable
  const notesTextarea = document.querySelector('#weeklyNotes');
  if (notesTextarea !== null) {
    notesTextarea.removeAttribute('readonly');
  }
}

/**
 * Reset lock state - now a no-op since we removed caching
 * Kept for API compatibility
 */
export function resetLockState(): void {
  // No-op: caching was removed because it caused bugs
  // when DOM structure changed (e.g., after renderEmployeesList)
}

/**
 * Create "Bearbeiten" (Edit) button
 * Shown when a plan exists but is not in edit mode
 */
export function createEditButton(): HTMLButtonElement {
  const editBtn = document.createElement('button');
  editBtn.id = 'editScheduleBtn';
  editBtn.className = 'btn btn-edit';
  editBtn.textContent = 'Bearbeiten';
  editBtn.title = 'Schichtplan bearbeiten';
  return editBtn;
}

/**
 * Create "Schichtplan aktualisieren" (Update) button
 * Shown when in edit mode to save changes to existing plan
 */
export function createUpdateButton(): HTMLButtonElement {
  const updateBtn = document.createElement('button');
  updateBtn.id = 'updateScheduleBtn';
  updateBtn.className = 'btn btn-success';
  updateBtn.textContent = 'Schichtplan aktualisieren';
  updateBtn.title = 'Änderungen speichern';
  return updateBtn;
}

/**
 * Remove existing edit/update buttons
 */
function removeExistingButtons(): void {
  const editBtn = $$id('editScheduleBtn');
  const updateBtn = $$id('updateScheduleBtn');
  if (editBtn !== null) editBtn.remove();
  if (updateBtn !== null) updateBtn.remove();
}

/**
 * Show buttons for empty state (no shift data)
 * Save button visible for creating new plan, Reset hidden (nothing to cancel)
 */
function showNormalButtons(saveBtn: HTMLButtonElement | null, resetBtn: HTMLButtonElement | null): void {
  if (saveBtn !== null) saveBtn.style.display = '';
  // Reset button (Abbrechen) only visible in edit mode - hide when no data
  if (resetBtn !== null) resetBtn.style.display = DISPLAY.NONE;
}

/**
 * Show buttons for editing existing plan (update button, save hidden)
 */
function showEditModeButtons(
  saveBtn: HTMLButtonElement | null,
  resetBtn: HTMLButtonElement | null,
  adminActions: HTMLElement,
  onUpdateClick: () => void,
): void {
  if (saveBtn !== null) saveBtn.style.display = DISPLAY.NONE;
  if (resetBtn !== null) resetBtn.style.display = '';

  const updateBtn = createUpdateButton();
  updateBtn.addEventListener('click', onUpdateClick);
  adminActions.append(updateBtn);
}

/**
 * Show buttons for read-only mode (edit button only)
 */
function showReadOnlyButtons(
  saveBtn: HTMLButtonElement | null,
  resetBtn: HTMLButtonElement | null,
  adminActions: HTMLElement,
  onEditClick: () => void,
): void {
  if (saveBtn !== null) saveBtn.style.display = DISPLAY.NONE;
  if (resetBtn !== null) resetBtn.style.display = DISPLAY.NONE;

  const editBtn = createEditButton();
  editBtn.addEventListener('click', onEditClick);
  adminActions.append(editBtn);
}

/**
 * Update discard buttons visibility
 * Only show in edit mode when shift data exists
 */
function updateDiscardButtonsVisibility(hasShiftData: boolean, isEditMode: boolean): void {
  const discardWeekBtn = $$id('discardWeekBtn');
  const discardTeamPlanBtn = $$id('discardTeamPlanBtn');

  const shouldShow = hasShiftData && isEditMode;

  if (discardWeekBtn !== null) {
    if (shouldShow) {
      discardWeekBtn.classList.remove('hidden');
    } else {
      discardWeekBtn.classList.add('hidden');
    }
  }

  if (discardTeamPlanBtn !== null) {
    if (shouldShow) {
      discardTeamPlanBtn.classList.remove('hidden');
    } else {
      discardTeamPlanBtn.classList.add('hidden');
    }
  }
}

/**
 * Update button visibility based on plan state
 * @param isAdmin - Whether user is admin
 * @param hasShiftData - Whether any shift data exists (from plan OR rotation)
 * @param isEditMode - Whether edit mode is active
 * @param onEditClick - Callback when edit button is clicked
 * @param onUpdateClick - Callback when update button is clicked
 */
export function updateButtonVisibility(
  isAdmin: boolean,
  hasShiftData: boolean,
  isEditMode: boolean,
  onEditClick: () => void,
  onUpdateClick: () => void,
): void {
  const saveBtn = $$id('saveScheduleBtn') as HTMLButtonElement | null;
  const resetBtn = $$id('resetScheduleBtn') as HTMLButtonElement | null;
  const adminActions = $$id('adminActions');

  if (adminActions === null || !isAdmin) return;

  // Remove any existing edit/update buttons first
  removeExistingButtons();

  // No shift data exists - show normal save/reset buttons, hide discard buttons
  if (!hasShiftData) {
    showNormalButtons(saveBtn, resetBtn);
    updateDiscardButtonsVisibility(false, false);
    return;
  }

  // Shift data exists (from plan OR rotation history)
  if (isEditMode) {
    // Edit mode active - show update button
    showEditModeButtons(saveBtn, resetBtn, adminActions, onUpdateClick);
  } else {
    // Read-only mode - show edit button
    showReadOnlyButtons(saveBtn, resetBtn, adminActions, onEditClick);
  }

  // Update discard buttons visibility (only show in edit mode with shift data)
  updateDiscardButtonsVisibility(hasShiftData, isEditMode);
}
