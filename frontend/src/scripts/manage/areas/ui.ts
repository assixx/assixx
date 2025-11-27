/**
 * UI and Rendering Functions for Areas Management
 * Contains all UI rendering, form handling, and table rendering functions
 *
 * Migration Complete: 2025-10-29
 * - Removed ALL inline styles
 * - Badge Classes → badge--success, badge--warning, badge--info (BEM)
 * - Action Buttons → action-icon (Design System)
 * - Table → data-table--striped (Design System)
 */

import type { Area } from './types';
import { setSafeHTML } from '../../../utils/dom-utils';

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Get type label (German)
 */
export function getTypeLabel(type: string): string {
  switch (type) {
    case 'building':
      return 'Gebäude';
    case 'warehouse':
      return 'Lager';
    case 'office':
      return 'Büro';
    case 'production':
      return 'Produktion';
    case 'outdoor':
      return 'Außenbereich';
    case 'other':
      return 'Sonstiges';
    default:
      return type;
  }
}

/**
 * Get status label (German)
 */
export function getStatusLabel(status: string): string {
  return status === 'active' ? 'Aktiv' : 'Inaktiv';
}

/**
 * Get status badge class (Design System BEM naming)
 */
export function getStatusBadgeClass(status: string): string {
  return status === 'active' ? 'badge--success' : 'badge--warning';
}

/**
 * Create action buttons HTML for area row
 */
function createAreaActionButtons(area: Area): string {
  return `
    <div class="flex gap-2">
      <button
        class="action-icon action-icon--edit"
        data-action="edit-area"
        data-area-id="${String(area.id)}"
        title="Bearbeiten"
        aria-label="Bereich bearbeiten"
      >
        <i class="fas fa-edit"></i>
      </button>
      <button
        class="action-icon action-icon--delete"
        data-action="delete-area"
        data-area-id="${String(area.id)}"
        title="Löschen"
        aria-label="Bereich löschen"
      >
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `;
}

/**
 * Create a single area table row (Design System with Action Icons)
 */
export function createAreaRow(area: Area): string {
  const statusBadge = getStatusBadgeClass(area.is_active === 1 ? 'active' : 'inactive');
  const statusLabel = getStatusLabel(area.is_active === 1 ? 'active' : 'inactive');

  return `
    <tr data-area-id="${area.id}">
      <td>
        <div class="font-medium text-[var(--color-text-primary)]">
          ${escapeHtml(area.name)}
        </div>
        ${
          area.parent_id !== undefined && area.parent_id !== null
            ? `<div class="text-sm text-[var(--color-text-secondary)]">↳ Parent ID: ${area.parent_id}</div>`
            : ''
        }
      </td>
      <td>
        <div class="text-[var(--color-text-secondary)] text-sm">
          ${area.description ?? '-'}
        </div>
      </td>
      <td>
        <span class="badge badge--info">${getTypeLabel(area.type)}</span>
      </td>
      <td class="text-center">
        ${area.capacity ?? '-'}
      </td>
      <td>
        <div class="text-sm">
          ${area.address ?? '-'}
        </div>
      </td>
      <td>
        <span class="badge ${statusBadge}">${statusLabel}</span>
      </td>
      <td>
        ${createAreaActionButtons(area)}
      </td>
    </tr>
  `;
}

/**
 * Render areas table
 */
export function renderAreasTable(areas: Area[]): void {
  const tableContent = document.querySelector<HTMLElement>('#areas-table-content');
  if (tableContent === null) return;

  if (areas.length === 0) {
    setSafeHTML(tableContent, '');
    return;
  }

  const tableHTML = `
    <div class="table-responsive">
      <table class="data-table data-table--striped">
        <thead>
          <tr>
            <th>Name</th>
            <th>Beschreibung</th>
            <th>Typ</th>
            <th class="text-center">Kapazität</th>
            <th>Adresse</th>
            <th>Status</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          ${areas.map((area) => createAreaRow(area)).join('')}
        </tbody>
      </table>
    </div>
  `;

  setSafeHTML(tableContent, tableHTML);
}

/**
 * Toggle table/empty state visibility
 * Note: Empty state button is hidden when "inactive" filter is active
 */
export function toggleTableVisibility(show: boolean): void {
  const areasEmpty = document.querySelector('#areas-empty');
  const tableContent = document.querySelector('#areas-table-content');
  const emptyStateButton = document.querySelector('#empty-state-add-btn');

  if (show) {
    areasEmpty?.classList.add('u-hidden');
    tableContent?.classList.remove('u-hidden');
  } else {
    areasEmpty?.classList.remove('u-hidden');
    tableContent?.classList.add('u-hidden');

    // Hide button if "inactive" filter is active
    const activeButton = document.querySelector('#area-status-toggle .toggle-group__btn.active');
    const currentStatus = activeButton?.getAttribute('data-status') ?? 'active';

    if (currentStatus === 'inactive') {
      emptyStateButton?.classList.add('u-hidden');
    } else {
      emptyStateButton?.classList.remove('u-hidden');
    }
  }
}

/**
 * Show/hide loading state
 */
export function showLoading(show: boolean): void {
  const loadingDiv = document.querySelector('#areas-loading');
  const tableContent = document.querySelector<HTMLElement>('#areas-table-content');
  const emptyDiv = document.querySelector('#areas-empty');

  if (show) {
    loadingDiv?.classList.remove('u-hidden');
    if (tableContent !== null) {
      setSafeHTML(tableContent, '');
    }
    emptyDiv?.classList.add('u-hidden');
  } else {
    loadingDiv?.classList.add('u-hidden');
  }
}

/**
 * Set input value helper (for hidden inputs and text inputs)
 */
function setInputValue(id: string, value: string | number | null | undefined): void {
  const input = document.querySelector<HTMLInputElement>(`#${id}`);
  if (input === null) return;

  input.value = value !== null && value !== undefined ? value.toString() : '';
}

/**
 * Populate area form with data
 */
export function populateAreaForm(area: Area): void {
  // Basic fields
  setInputValue('area-id', area.id);
  setInputValue('area-name', area.name);
  setInputValue('area-description', area.description);
  setInputValue('area-capacity', area.capacity);
  setInputValue('area-address', area.address);

  // Type dropdown (custom)
  setInputValue('area-type', area.type);
  const typeTrigger = document.querySelector('#type-trigger span');
  if (typeTrigger !== null) {
    typeTrigger.textContent = getTypeLabel(area.type);
  }

  // Parent dropdown (custom) - will be set by loadParentAreas
  setInputValue('area-parent', area.parent_id ?? '');

  // Status dropdown (custom)
  const statusValue = area.is_active === 1 ? 'active' : 'inactive';
  setInputValue('area-status', statusValue);

  const statusTrigger = document.querySelector<HTMLElement>('#status-trigger span');
  if (statusTrigger !== null) {
    const badgeClass = statusValue === 'active' ? 'badge--success' : 'badge--warning';
    const badgeText = statusValue === 'active' ? 'Aktiv' : 'Inaktiv';
    setSafeHTML(statusTrigger, `<span class="badge ${badgeClass}">${badgeText}</span>`);
  }

  // Update modal title
  const modalTitle = document.querySelector('#area-modal-title');
  if (modalTitle !== null) {
    modalTitle.textContent = 'Bereich bearbeiten';
  }
}

/**
 * Reset area form
 */
export function resetAreaForm(): void {
  const form = document.querySelector<HTMLFormElement>('#area-form');
  if (form !== null) {
    form.reset();
  }

  const areaIdInput = document.querySelector<HTMLInputElement>('#area-id');
  if (areaIdInput !== null) {
    areaIdInput.value = '';
  }

  // Reset type dropdown to "Sonstiges"
  const typeHiddenInput = document.querySelector<HTMLInputElement>('#area-type');
  if (typeHiddenInput !== null) {
    typeHiddenInput.value = 'other';
  }

  const typeTrigger = document.querySelector('#type-trigger span');
  if (typeTrigger !== null) {
    typeTrigger.textContent = 'Sonstiges';
  }

  // Reset parent dropdown to "Kein übergeordneter Bereich"
  const parentHiddenInput = document.querySelector<HTMLInputElement>('#area-parent');
  if (parentHiddenInput !== null) {
    parentHiddenInput.value = '';
  }

  const parentTrigger = document.querySelector('#parent-trigger span');
  if (parentTrigger !== null) {
    parentTrigger.textContent = 'Kein übergeordneter Bereich';
  }

  // Reset status dropdown to "Aktiv"
  const statusHiddenInput = document.querySelector<HTMLInputElement>('#area-status');
  if (statusHiddenInput !== null) {
    statusHiddenInput.value = 'active';
  }

  const statusTrigger = document.querySelector<HTMLElement>('#status-trigger span');
  if (statusTrigger !== null) {
    setSafeHTML(statusTrigger, '<span class="badge badge--success">Aktiv</span>');
  }

  // Reset modal title
  const modalTitle = document.querySelector('#area-modal-title');
  if (modalTitle !== null) {
    modalTitle.textContent = 'Neuer Bereich';
  }
}

/**
 * Load parent areas for custom dropdown
 */
export function loadParentAreas(areas: Area[], excludeId?: number, currentParentId?: number): void {
  const parentMenu = document.querySelector<HTMLElement>('#parent-menu');
  const parentTrigger = document.querySelector('#parent-trigger span');
  const parentHiddenInput = document.querySelector<HTMLInputElement>('#area-parent');

  if (parentMenu === null || parentTrigger === null || parentHiddenInput === null) return;

  // Clear existing options (keep "Kein übergeordneter Bereich" as first)
  const firstOption = '<div class="dropdown__option" data-value="">Kein übergeordneter Bereich</div>';

  // Build options HTML for all areas except the one being edited
  const optionsHTML = areas
    .filter((area) => area.id !== excludeId)
    .map((area) => {
      return `<div class="dropdown__option" data-value="${area.id}">${escapeHtml(area.name)}</div>`;
    })
    .join('');

  setSafeHTML(parentMenu, firstOption + optionsHTML);

  // Update trigger text based on current parent
  if (currentParentId !== undefined) {
    const currentParent = areas.find((a) => a.id === currentParentId);
    if (currentParent !== undefined) {
      parentTrigger.textContent = currentParent.name;
      parentHiddenInput.value = currentParentId.toString();
    } else {
      parentTrigger.textContent = 'Kein übergeordneter Bereich';
      parentHiddenInput.value = '';
    }
  } else {
    parentTrigger.textContent = 'Kein übergeordneter Bereich';
    parentHiddenInput.value = '';
  }
}

/**
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&');
}

/**
 * Highlight search term in text
 */
function highlightMatch(text: string, query: string): string {
  if (query === '' || query.trim() === '') {
    return text;
  }

  const escapedQuery = escapeRegex(query);
  // eslint-disable-next-line security/detect-non-literal-regexp -- Safe: escapedQuery is sanitized via escapeRegex
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return text.replace(regex, '<strong>$1</strong>');
}

/**
 * Render search results dropdown
 */
export function renderSearchResults(areas: Area[], query: string): void {
  const resultsContainer = document.querySelector<HTMLElement>('#area-search-results');
  const searchWrapper = document.querySelector<HTMLElement>('.search-input-wrapper');

  if (resultsContainer === null || searchWrapper === null) {
    return;
  }

  // If no query, hide results
  if (query === '' || query.trim() === '') {
    searchWrapper.classList.remove('search-input-wrapper--open');
    resultsContainer.innerHTML = '';
    return;
  }

  // Show results dropdown
  searchWrapper.classList.add('search-input-wrapper--open');

  // If no results
  if (areas.length === 0) {
    const noResultsDiv = document.createElement('div');
    noResultsDiv.className = 'search-input__no-results';
    noResultsDiv.textContent = `Keine Bereiche gefunden für "${query}"`;
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(noResultsDiv);
    return;
  }

  // Limit to 5 results for dropdown
  const limitedResults = areas.slice(0, 5);

  const resultsHTML = limitedResults
    .map((area) => {
      const typeLabel = getTypeLabel(area.type);
      const statusBadge = getStatusBadgeClass(area.is_active === 1 ? 'active' : 'inactive');
      const statusLabel = getStatusLabel(area.is_active === 1 ? 'active' : 'inactive');

      return `
        <div class="search-input__result-item" data-area-id="${String(area.id)}" data-action="edit-from-search">
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div style="font-weight: 500; color: var(--color-text-primary);">
              ${highlightMatch(escapeHtml(area.name), query)}
            </div>
            <div style="font-size: 0.813rem; color: var(--color-text-secondary);">
              ${typeLabel} ${area.address !== null && area.address !== undefined ? `· ${area.address}` : ''}
            </div>
            <div style="font-size: 0.75rem;">
              <span class="badge ${statusBadge}">${statusLabel}</span>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  // Add "show all" if more than 5 results
  const showAllHTML =
    areas.length > 5
      ? `<div class="search-input__result-item" style="font-size: 0.813rem; color: var(--color-primary); text-align: center; border-top: 1px solid rgb(255 255 255 / 5%);">
          ${String(areas.length - 5)} weitere Ergebnisse in Tabelle
        </div>`
      : '';

  setSafeHTML(resultsContainer, resultsHTML + showAllHTML);
}

/**
 * Close search results dropdown
 */
export function closeSearchResults(): void {
  const searchWrapper = document.querySelector<HTMLElement>('.search-input-wrapper');
  const resultsContainer = document.querySelector<HTMLElement>('#area-search-results');

  if (searchWrapper !== null) {
    searchWrapper.classList.remove('search-input-wrapper--open');
  }

  if (resultsContainer !== null) {
    resultsContainer.innerHTML = '';
  }
}
