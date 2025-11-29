/**
 * Department Management - UI & Rendering Functions
 */

import { setSafeHTML, $$id } from '../../../utils/dom-utils';
import type { Department, DepartmentStatusFilter } from './types';

/**
 * Helper: Create count badge with native title tooltip
 */
function createCountBadge(count: number, names: string, singular: string, plural?: string): string {
  if (count === 0) {
    return '<span class="badge badge--secondary" title="Keine zugewiesen">0</span>';
  }

  const label = count === 1 ? singular : (plural ?? `${singular}s`);

  // If no names available, just show count without tooltip
  if (names === '' || names.trim() === '') {
    return `<span class="badge badge--info">${String(count)} ${label}</span>`;
  }

  // Return badge with native title tooltip
  return `<span class="badge badge--info" title="${escapeHtml(names)}">${String(count)} ${label}</span>`;
}

/**
 * Helper: Get status badge configuration
 */
function getStatusBadge(isActive: boolean): { class: string; text: string } {
  return isActive ? { class: 'badge--success', text: 'Aktiv' } : { class: 'badge--warning', text: 'Inaktiv' };
}

/**
 * Helper: Create area badge following AssignmentBadges pattern
 */
function createAreaBadge(areaName: string | null | undefined): string {
  if (areaName === undefined || areaName === null || areaName.trim() === '') {
    return '<span class="badge badge--secondary" title="Kein Bereich zugewiesen">Kein Bereich</span>';
  }
  return `<span class="badge badge--info" title="${escapeHtml(areaName)}">${escapeHtml(areaName)}</span>`;
}

/**
 * Helper: Create department lead display
 */
function createDepartmentLeadCell(leadName: string | null | undefined): string {
  if (leadName === undefined || leadName === null || leadName.trim() === '') {
    return '<span class="text-[var(--color-text-muted)]">-</span>';
  }
  return `<span class="text-[var(--color-text-primary)]">${escapeHtml(leadName)}</span>`;
}

/**
 * Helper: Create a single department table row
 */
function createDepartmentRow(dept: Department): string {
  const statusBadge = getStatusBadge(dept.isActive);

  const teamCount: number = dept.teamCount ?? 0;

  const teamNames: string = dept.teamNames ?? '';

  return `
    <tr>
      <td>
        <div style="font-weight: 500; color: var(--color-text-primary);">
          ${escapeHtml(dept.name)}
        </div>
      </td>
      <td>
        <div style="color: var(--color-text-secondary); font-size: 0.875rem;">
          ${dept.description !== undefined && dept.description !== null ? escapeHtml(dept.description) : '-'}
        </div>
      </td>
      <td>
        <span class="badge ${statusBadge.class}">${statusBadge.text}</span>
      </td>
      <td>
        ${createAreaBadge(dept.areaName)}
      </td>
      <td>
        ${createDepartmentLeadCell(dept.departmentLeadName)}
      </td>
      <td>
        <div style="text-align: center;">
          ${createCountBadge(teamCount, teamNames, 'Team', 'Teams')}
        </div>
      </td>
      <td>
        <div class="flex gap-2">
          <button
            class="action-icon action-icon--edit"
            data-action="edit-department"
            data-dept-id="${String(dept.id)}"
            title="Bearbeiten"
            aria-label="Abteilung bearbeiten"
          >
            <i class="fas fa-edit"></i>
          </button>
          <button
            class="action-icon action-icon--delete"
            data-action="delete-department"
            data-dept-id="${String(dept.id)}"
            title="Löschen"
            aria-label="Abteilung löschen"
          >
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `;
}

/**
 * Render departments table
 */
export function renderDepartmentsTable(
  departments: Department[],
  _currentFilter: DepartmentStatusFilter = 'all',
): void {
  const tableContent = $$id('departmentTableContent');
  const loading = $$id('departments-loading');
  const empty = $$id('departments-empty');

  // Hide loading
  loading?.classList.add('u-hidden');

  // Show empty state if no departments
  if (departments.length === 0) {
    empty?.classList.remove('u-hidden');
    if (tableContent !== null) {
      tableContent.innerHTML = '';
    }
    return;
  }

  // Hide empty state
  empty?.classList.add('u-hidden');

  // Render table
  const tableHTML = `
    <div class="table-responsive">
      <table class="data-table data-table--striped">
        <thead>
          <tr>
            <th>Name</th>
            <th>Beschreibung</th>
            <th>Status</th>
            <th>Bereich</th>
            <th>Abteilungsleiter</th>
            <th>Teams</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          ${departments.map((dept) => createDepartmentRow(dept)).join('')}
        </tbody>
      </table>
    </div>
  `;

  if (tableContent !== null) {
    setSafeHTML(tableContent, tableHTML);
  }
}

/**
 * Render search results dropdown
 */
export function renderSearchResults(departments: Department[], query: string): void {
  const resultsContainer = $$id('department-search-results');
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
  if (departments.length === 0) {
    const noResultsDiv = document.createElement('div');
    noResultsDiv.className = 'search-input__no-results';
    noResultsDiv.textContent = `Keine Abteilungen gefunden für "${query}"`;
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(noResultsDiv);
    return;
  }

  // Limit to 5 results for dropdown
  const limitedResults = departments.slice(0, 5);

  const resultsHTML = limitedResults
    .map((dept) => {
      const areaInfo = dept.areaName ?? 'Kein Bereich';

      const employeeCount = dept.employeeCount ?? 0;

      return `
        <div class="search-input__result-item" data-dept-id="${String(dept.id)}" data-action="edit-from-search">
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div style="font-weight: 500; color: var(--color-text-primary);">
              ${highlightMatch(escapeHtml(dept.name), query)}
            </div>
            <div style="font-size: 0.813rem; color: var(--color-text-secondary);">
              ${areaInfo}
            </div>
            <div style="font-size: 0.75rem; color: var(--color-text-muted);">
              ${String(employeeCount)} Mitarbeiter
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  // Add "show all" if more than 5 results
  const showAllHTML =
    departments.length > 5
      ? `<div class="search-input__result-item" style="font-size: 0.813rem; color: var(--color-primary); text-align: center; border-top: 1px solid rgb(255 255 255 / 5%);">
          ${String(departments.length - 5)} weitere Ergebnisse in Tabelle
        </div>`
      : '';

  setSafeHTML(resultsContainer, resultsHTML + showAllHTML);
}

/**
 * Close search results dropdown
 */
export function closeSearchResults(): void {
  const searchWrapper = document.querySelector<HTMLElement>('.search-input-wrapper');
  const resultsContainer = $$id('department-search-results');

  if (searchWrapper !== null) {
    searchWrapper.classList.remove('search-input-wrapper--open');
  }

  if (resultsContainer !== null) {
    resultsContainer.innerHTML = '';
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Escape special regex characters
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
 * Setup form submit handler
 */
export function setupFormSubmitHandler(): void {
  const form = $$id('department-form');
  if (form instanceof HTMLFormElement) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const w = window as { saveDepartment?: () => Promise<void> };
      void w.saveDepartment?.();
    });
  }
}
