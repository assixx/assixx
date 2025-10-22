/**
 * Department Management - Modal & Form Handling
 */

import { $$id, setSafeHTML } from '../../../utils/dom-utils';
import type { Department, Area } from './types';

// Constants
const MODAL_ACTIVE_CLASS = 'modal-overlay--active';

/**
 * Show Add Department Modal
 */
export function showAddDepartmentModal(): void {
  const modal = $$id('department-modal');
  const form = $$id('department-form') as HTMLFormElement | null;
  const title = $$id('department-modal-title');
  const deptIdInput = $$id('department-id') as HTMLInputElement | null;

  if (form !== null) {
    form.reset();
  }

  if (title !== null) {
    title.textContent = 'Neue Abteilung';
  }

  if (deptIdInput !== null) {
    deptIdInput.value = '';
  }

  modal?.classList.add(MODAL_ACTIVE_CLASS);
}

/**
 * Helper: Set Area Dropdown value and display
 */
function setAreaDropdown(department: Department): void {
  const areaInput = $$id('department-area') as HTMLInputElement | null;
  const areaTrigger = $$id('area-trigger');

  if (areaInput === null || areaTrigger === null) {
    return;
  }

  const areaValue = department.areaId !== null && department.areaId !== undefined ? String(department.areaId) : '';
  areaInput.value = areaValue;

  const areaTriggerSpan = areaTrigger.querySelector('span');
  if (areaTriggerSpan !== null) {
    areaTriggerSpan.textContent = department.areaName ?? 'Kein Bereich';
  }
}

/**
 * Helper: Set Status Dropdown value and display (with badge)
 */
function setStatusDropdown(department: Department): void {
  const statusInput = $$id('department-status') as HTMLInputElement | null;
  const statusTrigger = $$id('status-trigger');

  if (statusInput === null || statusTrigger === null) {
    return;
  }

  statusInput.value = department.status;

  const statusTriggerSpan = statusTrigger.querySelector('span');
  if (statusTriggerSpan !== null) {
    const badgeClass = department.status === 'active' ? 'badge--success' : 'badge--warning';
    const badgeText = department.status === 'active' ? 'Aktiv' : 'Inaktiv';
    setSafeHTML(statusTriggerSpan, `<span class="badge ${badgeClass}">${badgeText}</span>`);
  }
}

/**
 * Helper: Set Visibility Dropdown value and display
 */
function setVisibilityDropdown(department: Department): void {
  const visibilityInput = $$id('department-visibility') as HTMLInputElement | null;
  const visibilityTrigger = $$id('visibility-trigger');

  if (visibilityInput === null || visibilityTrigger === null) {
    return;
  }

  const visibilityValue = department.visibility ?? 'public';
  visibilityInput.value = visibilityValue;

  const visibilityTriggerSpan = visibilityTrigger.querySelector('span');
  if (visibilityTriggerSpan !== null) {
    visibilityTriggerSpan.textContent = visibilityValue === 'public' ? 'Öffentlich' : 'Privat';
  }
}

/**
 * Show Edit Department Modal
 */
export function showEditDepartmentModal(department: Department): void {
  const modal = $$id('department-modal');
  const form = $$id('department-form') as HTMLFormElement | null;
  const title = $$id('department-modal-title');
  const deptIdInput = $$id('department-id') as HTMLInputElement | null;

  // Set modal title
  if (title !== null) {
    title.textContent = 'Abteilung bearbeiten';
  }

  // Set department ID
  if (deptIdInput !== null) {
    deptIdInput.value = String(department.id);
  }

  // Populate basic form fields
  if (form !== null) {
    const nameInput = form.querySelector<HTMLInputElement>('#department-name');
    const descInput = form.querySelector<HTMLTextAreaElement>('#department-description');

    if (nameInput !== null) {
      nameInput.value = department.name;
    }
    if (descInput !== null) {
      descInput.value = department.description ?? '';
    }
  }

  // Set custom dropdowns
  setAreaDropdown(department);
  setStatusDropdown(department);
  setVisibilityDropdown(department);

  modal?.classList.add(MODAL_ACTIVE_CLASS);
}

/**
 * Close Department Modal
 */
export function closeDepartmentModal(): void {
  const modal = $$id('department-modal');
  modal?.classList.remove(MODAL_ACTIVE_CLASS);
}

/**
 * Show Delete Modal
 */
export function showDeleteModal(id: number, _name: string): void {
  const modal = $$id('delete-department-modal');
  const deleteInput = $$id('delete-department-id') as HTMLInputElement | null;

  if (deleteInput !== null) {
    deleteInput.value = String(id);
  }

  modal?.classList.add(MODAL_ACTIVE_CLASS);
}

/**
 * Close Delete Modal
 */
export function closeDeleteModal(): void {
  const modal = $$id('delete-department-modal');
  modal?.classList.remove(MODAL_ACTIVE_CLASS);
}

/**
 * Load and populate areas dropdown (Custom Dropdown)
 */
export function loadAndPopulateAreas(areas: Area[]): void {
  const areaMenu = $$id('area-menu');

  if (areaMenu === null) {
    return;
  }

  // Clear existing options and add default
  areaMenu.innerHTML = '<div class="dropdown__option" data-value="">Kein Bereich</div>';

  // Add area options
  areas.forEach((area) => {
    const option = document.createElement('div');
    option.className = 'dropdown__option';
    option.dataset.value = String(area.id);
    option.textContent = area.name;
    areaMenu.appendChild(option);
  });
}
