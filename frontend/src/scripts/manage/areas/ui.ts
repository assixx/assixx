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
 * Get status label from is_active value (German)
 * UPDATED: Using unified is_active status (2025-12-02)
 * Status: 0=inactive, 1=active, 3=archived, 4=deleted
 */
export function getStatusLabel(isActive: number): string {
  switch (isActive) {
    case 1:
      return 'Aktiv';
    case 0:
      return 'Inaktiv';
    case 3:
      return 'Archiviert';
    case 4:
      return 'Gelöscht';
    default:
      return 'Unbekannt';
  }
}

/**
 * Get status badge class from is_active value (Design System BEM naming)
 * UPDATED: Using unified is_active status (2025-12-02)
 */
export function getStatusBadgeClass(isActive: number): string {
  switch (isActive) {
    case 1:
      return 'badge--success';
    case 0:
      return 'badge--warning';
    case 3:
      return 'badge--secondary';
    case 4:
      return 'badge--error';
    default:
      return 'badge--secondary';
  }
}

/**
 * Create departments badge HTML
 * Shows count with tooltip listing all department names
 */
function createDepartmentsBadge(
  departmentCount: number | undefined,
  departmentNames: string | null | undefined,
): string {
  const count = departmentCount ?? 0;

  if (count === 0) {
    return '<span class="badge badge--secondary" title="Keine Abteilungen zugeordnet">Keine</span>';
  }

  const tooltip = departmentNames ?? '';
  const label = count === 1 ? '1 Abteilung' : `${String(count)} Abteilungen`;

  return `<span class="badge badge--info" title="${escapeHtml(tooltip)}">${label}</span>`;
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
 * UPDATED: Using unified is_active status (2025-12-02)
 */
export function createAreaRow(area: Area): string {
  const statusBadge = getStatusBadgeClass(area.isActive);
  const statusLabel = getStatusLabel(area.isActive);

  // NOTE: parent_id display removed (2025-11-29) - areas are now flat (non-hierarchical)
  const areaLeadDisplay =
    area.areaLeadName !== null && area.areaLeadName !== undefined && area.areaLeadName.trim() !== ''
      ? escapeHtml(area.areaLeadName)
      : '-';

  return `
    <tr data-area-id="${area.id}">
      <td>
        <div class="font-medium text-[var(--color-text-primary)]">
          ${escapeHtml(area.name)}
        </div>
      </td>
      <td>
        <div class="text-[var(--color-text-secondary)] text-sm">
          ${area.description ?? '-'}
        </div>
      </td>
      <td>
        <div class="text-[var(--color-text-secondary)]">
          ${areaLeadDisplay}
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
        ${createDepartmentsBadge(
          typeof area.departmentCount === 'string' ? Number.parseInt(area.departmentCount, 10) : area.departmentCount,
          area.departmentNames,
        )}
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
            <th>Bereichsleiter</th>
            <th>Typ</th>
            <th class="text-center">Kapazität</th>
            <th>Adresse</th>
            <th>Abteilungen</th>
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
 */
export function toggleTableVisibility(show: boolean): void {
  const areasEmpty = document.querySelector('#areas-empty');
  const tableContent = document.querySelector('#areas-table-content');

  if (show) {
    areasEmpty?.classList.add('u-hidden');
    tableContent?.classList.remove('u-hidden');
  } else {
    areasEmpty?.classList.remove('u-hidden');
    tableContent?.classList.add('u-hidden');
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

  // NOTE: parent_id removed (2025-11-29) - areas are now flat (non-hierarchical)

  // Status dropdown (custom) - UPDATED for unified is_active (2025-12-02)
  // Status: 0=inactive, 1=active, 3=archived, 4=deleted
  const statusValue =
    area.isActive === 1 ? 'active' : area.isActive === 0 ? 'inactive' : area.isActive === 3 ? 'archived' : 'active';
  setInputValue('area-status', statusValue);
  setInputValue('area-is-active', area.isActive);

  const statusTrigger = document.querySelector<HTMLElement>('#status-trigger span');
  if (statusTrigger !== null) {
    const badgeClass = getStatusBadgeClass(area.isActive);
    const badgeText = getStatusLabel(area.isActive);
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

  // NOTE: parent dropdown reset removed (2025-11-29) - areas are now flat (non-hierarchical)

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

// NOTE: loadParentAreas removed (2025-11-29) - areas are now flat (non-hierarchical)

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
      const statusBadge = getStatusBadgeClass(area.isActive);
      const statusLabel = getStatusLabel(area.isActive);

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
