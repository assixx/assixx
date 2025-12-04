/**
 * Root User Management - UI and Rendering Functions
 * Contains all UI rendering and display helpers
 */

import type { RootUser, RootStatusFilter } from './types';
import { $, setHTML } from '../../../utils/dom-utils';

/**
 * Render a single root user table row
 * UPDATED: Using unified isActive status (2025-12-02)
 */
export function renderUserRow(user: RootUser): string {
  let statusBadge: string;
  switch (user.isActive) {
    case 1:
      statusBadge = '<span class="badge badge--success">Aktiv</span>';
      break;
    case 0:
      statusBadge = '<span class="badge badge--warning">Inaktiv</span>';
      break;
    case 3:
      statusBadge = '<span class="badge badge--secondary">Archiviert</span>';
      break;
    case 4:
      statusBadge = '<span class="badge badge--error">Gelöscht</span>';
      break;
    default:
      statusBadge = '<span class="badge badge--secondary">Unbekannt</span>';
  }
  const employeeNumber = user.employeeNumber ?? '-';

  return `
    <tr>
      <td>${user.id}</td>
      <td>
        <div class="flex items-center gap-2">
          <div class="avatar avatar--sm avatar--color-${user.id % 10}">
            <span>${user.firstName.charAt(0)}${user.lastName.charAt(0)}</span>
          </div>
          <span>${user.firstName} ${user.lastName}</span>
        </div>
      </td>
      <td>${user.email}</td>
      <td>${employeeNumber}</td>
      <td>${user.position ?? '-'}</td>
      <td>${statusBadge}</td>
      <td>${new Date(user.createdAt).toLocaleDateString('de-DE')}</td>
      <td>
        <div class="flex gap-2">
          <button
            class="action-icon action-icon--edit"
            data-action="edit-root-user"
            data-user-id="${user.id}"
            title="Bearbeiten"
            aria-label="Root-User bearbeiten"
          >
            <i class="fas fa-edit"></i>
          </button>
          <button
            class="action-icon action-icon--delete"
            data-action="delete-root-user"
            data-user-id="${user.id}"
            title="Löschen"
            aria-label="Root-User löschen"
          >
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `;
}

/**
 * Display root users in a table
 */
export function displayRootUsers(users: RootUser[]): void {
  const container = $('#rootTableContent');

  setHTML(
    container,
    `
    <div class="table-responsive">
      <table class="data-table data-table--hover data-table--striped">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>E-Mail</th>
            <th>Personalnummer</th>
            <th>Position</th>
            <th>Status</th>
            <th>Erstellt am</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          ${users.map((user) => renderUserRow(user)).join('')}
        </tbody>
      </table>
    </div>
    <div class="alert alert--info mt-4">
      <div class="alert__icon">
        <i class="fas fa-info-circle"></i>
      </div>
      <div class="alert__content">
        <div class="alert__message">
          Ihr eigenes Profil wird hier nicht angezeigt. Bearbeiten Sie es über
          <a href="/root-profile" class="text-blue-500 hover:underline">Mein Profil</a>.
        </div>
      </div>
    </div>
  `,
  );
}

/**
 * Show empty state with filter-specific content
 */
export function showEmptyState(_statusFilter: RootStatusFilter): void {
  const emptyStateEl = $('#root-users-empty');
  const tableContent = $('#rootTableContent');

  emptyStateEl.classList.remove('u-hidden');
  setHTML(tableContent, '');
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

  const escapedQuery = escapeRegex(query);
  // eslint-disable-next-line security/detect-non-literal-regexp -- Safe: escapedQuery is sanitized by escapeRegex()
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return text.replace(regex, '<strong>$1</strong>');
}

/**
 * Generate HTML for a single search result item
 */
export function generateSearchResultItem(user: RootUser, query: string): string {
  const fullName = `${user.firstName} ${user.lastName}`;
  const position = user.position ?? 'Keine Position';
  const employeeNumber = user.employeeNumber ?? '';

  return `
    <div class="search-input__result-item" data-user-id="${String(user.id)}" data-action="edit-from-search">
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <div style="font-weight: 500; color: var(--color-text-primary);">
          ${highlightMatch(fullName, query)}
        </div>
        <div style="font-size: 0.813rem; color: var(--color-text-secondary);">
          ${highlightMatch(user.email, query)}
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
export function renderSearchResults(results: RootUser[], query: string): void {
  const resultsContainer = $('#root-search-results');
  const searchWrapper = resultsContainer.closest('.search-input-wrapper');

  if (searchWrapper === null) {
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
      `<div class="search-input__no-results">Keine Root-Benutzer gefunden für "${query}"</div>`,
    );
    return;
  }

  // Limit to 5 results for dropdown
  const limitedResults = results.slice(0, 5);

  const resultsHTML = limitedResults.map((user) => generateSearchResultItem(user, query)).join('');

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
  const searchWrapper = document.querySelector('.search-input-wrapper');
  const resultsContainer = $('#root-search-results');

  if (searchWrapper !== null) {
    searchWrapper.classList.remove('search-input-wrapper--open');
  }
  setHTML(resultsContainer, '');
}
