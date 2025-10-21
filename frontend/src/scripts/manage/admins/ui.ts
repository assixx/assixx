/**
 * Admin Management - UI and Rendering Functions
 * Contains all UI rendering and display helpers
 */

import type { Admin, AdminStatusFilter } from './types';
import { $$, setHTML } from '../../../utils/dom-utils';
import { getPositionDisplay, getStatusBadge, getDepartmentsBadge } from './forms';

/**
 * Generate HTML for a single admin table row
 */
export function generateAdminRow(admin: Admin): string {
  console.info(`Rendering admin row - ID: ${String(admin.id)}, isActive: ${String(admin.isActive)}`);

  const deptBadge = getDepartmentsBadge(admin);
  const statusBadge = getStatusBadge(admin);
  const employeeNumber = admin.employeeNumber ?? '-';

  console.info(`Admin ${admin.username} - statusBadge: ${statusBadge}`);

  return `
    <tr>
      <td>${String(admin.id)}</td>
      <td>
        <div class="flex items-center gap-2">
          <div class="avatar avatar--sm avatar--color-${admin.id % 10}">
            <span>${admin.firstName.charAt(0)}${admin.lastName.charAt(0)}</span>
          </div>
          <span>${admin.firstName} ${admin.lastName}</span>
        </div>
      </td>
      <td>${admin.email}</td>
      <td>${employeeNumber}</td>
      <td>${getPositionDisplay(admin.position ?? '')}</td>
      <td>${statusBadge}</td>
      <td>${deptBadge}</td>
      <td>
        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm" data-action="edit-admin" data-admin-id="${String(admin.id)}">
            <i class="fas fa-edit"></i>
            Bearbeiten
          </button>
          <button class="btn btn-secondary btn-sm" data-action="show-permissions" data-admin-id="${String(admin.id)}">
            <i class="fas fa-key"></i>
            Berechtigungen
          </button>
          <button class="btn btn-danger btn-sm" data-action="delete-admin" data-admin-id="${String(admin.id)}">
            <i class="fas fa-trash"></i>
            Löschen
          </button>
        </div>
      </td>
    </tr>
  `;
}

/**
 * Get empty state title based on filter
 */
export function getEmptyStateTitle(statusFilter: AdminStatusFilter): string {
  if (statusFilter === 'inactive') return 'Keine inaktiven Administratoren';
  if (statusFilter === 'archived') return 'Keine archivierten Administratoren';
  return 'Keine Administratoren gefunden';
}

/**
 * Get empty state description based on filter
 */
export function getEmptyStateDescription(statusFilter: AdminStatusFilter): string {
  if (statusFilter === 'inactive' || statusFilter === 'archived') {
    return 'Es gibt aktuell keine Administratoren in dieser Kategorie.';
  }
  return 'Erstellen Sie Ihren ersten Administrator, um das System zu verwalten.';
}

/**
 * Check if add button should be hidden for current filter
 */
export function shouldHideAddButton(statusFilter: AdminStatusFilter): boolean {
  return statusFilter === 'inactive' || statusFilter === 'archived';
}

/**
 * Update empty state content based on current filter
 */
export function updateEmptyStateContent(statusFilter: AdminStatusFilter): void {
  const emptyDiv = $$('#admins-empty');
  if (emptyDiv === null) return;

  const emptyStateTitle = emptyDiv.querySelector<HTMLElement>('.empty-state__title');
  const emptyStateDesc = emptyDiv.querySelector<HTMLElement>('.empty-state__description');
  const emptyStateAddBtn = emptyDiv.querySelector<HTMLButtonElement>('#empty-state-add-btn');

  if (emptyStateTitle !== null) {
    emptyStateTitle.textContent = getEmptyStateTitle(statusFilter);
  }

  if (emptyStateDesc !== null) {
    emptyStateDesc.textContent = getEmptyStateDescription(statusFilter);
  }

  if (emptyStateAddBtn !== null) {
    if (shouldHideAddButton(statusFilter)) {
      emptyStateAddBtn.classList.add('u-hidden');
    } else {
      emptyStateAddBtn.classList.remove('u-hidden');
    }
  }
}

/**
 * Show search no results message
 */
export function showSearchNoResults(searchValue: string): void {
  const adminsTableContent = $$('#admins-table-content');
  if (adminsTableContent === null) return;

  setHTML(
    adminsTableContent,
    '<div class="empty-state"><p class="empty-state__description">Keine Administratoren gefunden für "' +
      searchValue +
      '"</p></div>',
  );
}

/**
 * Show empty state with filter-specific content
 */
export function showEmptyState(statusFilter: AdminStatusFilter): void {
  const adminsTableContent = $$('#admins-table-content');
  const emptyDiv = $$('#admins-empty');

  if (adminsTableContent === null) return;

  setHTML(adminsTableContent, '');
  emptyDiv?.classList.remove('u-hidden');
  updateEmptyStateContent(statusFilter);
}

/**
 * Render admin table with data
 */
export function renderAdminTable(
  adminsToRender: Admin[],
  statusFilter: AdminStatusFilter,
  initTooltipsCallback: () => void,
): void {
  console.info('renderAdminTable called');

  const adminsTableContent = $$('#admins-table-content');
  const loadingDiv = $$('#admins-loading');
  const emptyDiv = $$('#admins-empty');
  const searchInput = $$('#admin-search') as HTMLInputElement | null;

  if (adminsTableContent === null) {
    console.error('adminsTableContent not found');
    return;
  }

  loadingDiv?.classList.add('u-hidden');

  // Handle empty results
  if (adminsToRender.length === 0) {
    const searchValue = searchInput?.value ?? '';
    if (searchValue !== '' && searchValue.trim() !== '') {
      showSearchNoResults(searchValue);
    } else {
      showEmptyState(statusFilter);
    }
    return;
  }

  // Hide empty state and render table
  emptyDiv?.classList.add('u-hidden');
  console.info('Admins to render:', adminsToRender);

  const tableHTML = `
    <div class="overflow-x-auto">
      <table class="data-table data-table--hover data-table--striped" id="admins-table">
        <thead>
          <tr>
            <th scope="col">ID</th>
            <th scope="col">Name</th>
            <th scope="col">E-Mail</th>
            <th scope="col">Personalnummer</th>
            <th scope="col">Position</th>
            <th scope="col">Status</th>
            <th scope="col">Abteilungen</th>
            <th scope="col">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          ${adminsToRender.map((admin) => generateAdminRow(admin)).join('')}
        </tbody>
      </table>
    </div>
  `;

  setHTML(adminsTableContent, tableHTML);

  // Re-initialize tooltips for dynamically added elements
  initTooltipsCallback();
}

/**
 * Escape special regex characters in a string
 * Prevents regex injection attacks
 */
export function escapeRegex(str: string): string {
  return str.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&');
}

/**
 * Highlight search term in text
 * Wraps matches in <strong> tags for highlighting
 */
export function highlightMatch(text: string, query: string): string {
  if (query === '' || query.trim() === '') {
    return text;
  }

  // Escape special regex characters to prevent injection
  const escapedQuery = escapeRegex(query);
  // eslint-disable-next-line security/detect-non-literal-regexp -- Safe: escapedQuery is sanitized by escapeRegex() which escapes all special regex characters
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return text.replace(regex, '<strong>$1</strong>');
}

/**
 * Generate HTML for a single search result item
 */
export function generateSearchResultItem(admin: Admin, query: string): string {
  const fullName = `${admin.firstName} ${admin.lastName}`;
  const position = getPositionDisplay(admin.position ?? '');
  const employeeNumber = admin.employeeNumber ?? '';

  return `
    <div class="search-input__result-item" data-admin-id="${String(admin.id)}" data-action="edit-from-search">
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <div style="font-weight: 500; color: var(--color-text-primary);">
          ${highlightMatch(fullName, query)}
        </div>
        <div style="font-size: 0.813rem; color: var(--color-text-secondary);">
          ${highlightMatch(admin.email, query)}
        </div>
        <div style="font-size: 0.75rem; color: var(--color-text-muted); display: flex; gap: 8px;">
          <span>${highlightMatch(position, query)}</span>
          ${employeeNumber !== '' ? `<span>• ${highlightMatch(employeeNumber, query)}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render search results dropdown
 */
export function renderSearchResults(results: Admin[], query: string): void {
  const resultsContainer = $$('#admin-search-results');
  const searchWrapper = $$('.search-input-wrapper');

  if (resultsContainer === null || searchWrapper === null) {
    return;
  }

  // If no query, hide results
  if (query === '' || query.trim() === '') {
    searchWrapper.classList.remove('search-input-wrapper--open');
    setHTML(resultsContainer, '');
    return;
  }

  // Show results dropdown
  searchWrapper.classList.add('search-input-wrapper--open');

  // If no results
  if (results.length === 0) {
    setHTML(
      resultsContainer,
      `<div class="search-input__no-results">Keine Administratoren gefunden für "${query}"</div>`,
    );
    return;
  }

  // Limit to 5 results for dropdown
  const limitedResults = results.slice(0, 5);

  const resultsHTML = limitedResults.map((admin) => generateSearchResultItem(admin, query)).join('');

  // Add "show all" if more than 5 results
  const showAllHTML =
    results.length > 5
      ? `<div class="search-input__result-item" style="font-size: 0.813rem; color: var(--color-primary); text-align: center; border-top: 1px solid rgb(255 255 255 / 5%);">
          ${String(results.length - 5)} weitere Ergebnisse in Tabelle
        </div>`
      : '';

  setHTML(resultsContainer, resultsHTML + showAllHTML);
}

/**
 * Close search results dropdown
 */
export function closeSearchResults(): void {
  const searchWrapper = $$('.search-input-wrapper');
  searchWrapper?.classList.remove('search-input-wrapper--open');
}

/**
 * Show delete confirmation modal
 */
export async function showDeleteConfirmationModal(admin: Admin): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay modal-overlay--active';
    const modalHTML = `
        <div class="ds-modal ds-modal--sm">
          <div class="ds-modal__header">
            <h3 class="ds-modal__title">Administrator löschen</h3>
          </div>
          <div class="ds-modal__body">
            <p>Möchten Sie den Administrator "${admin.username}" wirklich löschen?</p>
          </div>
          <div class="ds-modal__footer">
            <button class="btn btn-danger" id="confirm-delete">Löschen</button>
            <button class="btn btn-secondary" id="cancel-delete">Abbrechen</button>
          </div>
        </div>
      `;
    setHTML(modal, modalHTML);
    document.body.appendChild(modal);

    const confirmBtn = modal.querySelector('#confirm-delete');
    const cancelBtn = modal.querySelector('#cancel-delete');

    const cleanup = () => {
      modal.remove();
    };

    confirmBtn?.addEventListener('click', () => {
      cleanup();
      resolve(true);
    });

    cancelBtn?.addEventListener('click', () => {
      cleanup();
      resolve(false);
    });
  });
}
