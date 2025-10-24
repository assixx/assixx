/**
 * Department Groups UI - DOM Rendering Functions
 */

import { $$id, setSafeHTML } from '../../../utils/dom-utils';
import type { DepartmentGroup } from './types';

/**
 * Show loading state
 */
export function showLoading(): void {
  const loading = $$id('groups-loading');
  const content = $$id('groups-content');
  const empty = $$id('groups-empty');

  loading?.classList.remove('u-hidden');
  content?.classList.add('u-hidden');
  empty?.classList.add('u-hidden');
}

/**
 * Hide loading state
 */
export function hideLoading(): void {
  const loading = $$id('groups-loading');
  loading?.classList.add('u-hidden');
}

/**
 * Show empty state
 */
export function showEmptyState(): void {
  const loading = $$id('groups-loading');
  const content = $$id('groups-content');
  const empty = $$id('groups-empty');

  loading?.classList.add('u-hidden');
  content?.classList.add('u-hidden');
  empty?.classList.remove('u-hidden');
}

/**
 * Show content (hide loading and empty state)
 */
export function showContent(): void {
  const loading = $$id('groups-loading');
  const content = $$id('groups-content');
  const empty = $$id('groups-empty');

  loading?.classList.add('u-hidden');
  content?.classList.remove('u-hidden');
  empty?.classList.add('u-hidden');
}

/**
 * Render group tree structure
 */
export function renderGroupTree(groups: DepartmentGroup[], selectedId: number | null): void {
  const container = $$id('groupTree');
  if (container === null) {
    console.warn('[renderGroupTree] Container not found');
    return;
  }

  if (groups.length === 0) {
    setSafeHTML(
      container,
      `
      <div class="empty-state">
        <div class="empty-state__icon">
          <i class="fas fa-folder-tree"></i>
        </div>
        <h3 class="empty-state__title">Keine Gruppen vorhanden</h3>
        <p class="empty-state__description">Erstellen Sie Ihre erste Gruppe</p>
      </div>
    `,
    );
    return;
  }

  const html = renderGroupItems(groups, selectedId, 0);
  setSafeHTML(container, html);
}

/**
 * Recursively render group tree items
 * NO inline styles - using Tailwind ml-{level} classes
 */
function renderGroupItems(items: DepartmentGroup[], selectedId: number | null, level: number): string {
  // Map level to Tailwind margin class (0=ml-0, 1=ml-5, 2=ml-10, 3=ml-16, 4=ml-20)
  const marginClass = level === 0 ? '' : `ml-${level * 5}`;

  return items
    .map(
      (group) => `
      <div class="${marginClass}">
        <div class="tree-item ${selectedId === group.id ? 'tree-item--active' : ''}"
             data-action="select-group"
             data-group-id="${group.id}">
          <i class="fas fa-folder tree-item__icon"></i>
          <span class="tree-item__name">${group.name}</span>
          ${
            group.departments !== undefined && group.departments.length > 0
              ? `<span class="tree-item__count">${group.departments.length}</span>`
              : ''
          }
        </div>
        ${
          group.subgroups !== undefined && group.subgroups.length > 0
            ? `<div class="tree-children">${renderGroupItems(group.subgroups, selectedId, level + 1)}</div>`
            : ''
        }
      </div>
    `,
    )
    .join('');
}

/**
 * Render parent group section
 */
function renderParentGroupSection(group: DepartmentGroup): string {
  if (group.parentName === undefined || group.parentName === '') {
    return '';
  }

  return `
    <div>
      <h4 class="font-medium mb-2 text-sm">Übergeordnete Gruppe</h4>
      <div class="flex items-center gap-2">
        <i class="fas fa-folder-open text-blue-500"></i>
        <span>${group.parentName}</span>
      </div>
    </div>
  `;
}

/**
 * Render departments section
 */
function renderDepartmentsSection(group: DepartmentGroup): string {
  const departmentsHtml =
    group.departments !== undefined && group.departments.length > 0
      ? `
        <div class="space-y-2">
          ${group.departments
            .map(
              (dept) => `
            <div class="flex items-center gap-2">
              <i class="fas fa-building text-blue-500"></i>
              <span>${dept.name}</span>
            </div>
          `,
            )
            .join('')}
        </div>
      `
      : '<p class="text-[var(--color-text-secondary)]">Keine Abteilungen zugeordnet</p>';

  return `
    <div>
      <h4 class="font-medium mb-2 text-sm">Zugeordnete Abteilungen (${group.departments?.length ?? 0})</h4>
      ${departmentsHtml}
    </div>
  `;
}

/**
 * Render subgroups section
 */
function renderSubgroupsSection(group: DepartmentGroup): string {
  if (group.subgroups === undefined || group.subgroups.length === 0) {
    return '';
  }

  return `
    <div>
      <h4 class="font-medium mb-2 text-sm">Untergruppen (${group.subgroups.length})</h4>
      <div class="space-y-2">
        ${group.subgroups
          .map(
            (subgroup) => `
          <div class="flex items-center gap-2">
            <i class="fas fa-folder text-orange-500"></i>
            <span>${subgroup.name}</span>
          </div>
        `,
          )
          .join('')}
      </div>
    </div>
  `;
}

/**
 * Render action buttons
 */
function renderActionButtons(groupId: number): string {
  return `
    <div class="flex gap-2 pt-2">
      <button class="btn btn-edit" data-action="edit-group" data-group-id="${groupId}">
        <i class="fas fa-edit"></i> Bearbeiten
      </button>
      <button class="btn btn-danger" data-action="delete-group" data-group-id="${groupId}">
        <i class="fas fa-trash"></i> Löschen
      </button>
    </div>
  `;
}

/**
 * Render group details panel
 */
export function renderGroupDetails(group: DepartmentGroup): void {
  const container = $$id('groupDetails');
  if (container === null) {
    console.warn('[renderGroupDetails] Container not found');
    return;
  }

  const html = `
    <div class="space-y-4">
      <!-- Group Header -->
      <div>
        <h3 class="text-lg font-semibold">${group.name}</h3>
        ${group.description !== null && group.description !== undefined && group.description !== '' ? `<p class="text-[var(--color-text-secondary)] mt-1">${group.description}</p>` : ''}
      </div>

      ${renderParentGroupSection(group)}
      ${renderDepartmentsSection(group)}
      ${renderSubgroupsSection(group)}
      ${renderActionButtons(group.id)}
    </div>
  `;

  setSafeHTML(container, html);
}

/**
 * Clear group details panel (show default message)
 */
export function clearGroupDetails(): void {
  const container = $$id('groupDetails');
  if (container === null) return;

  setSafeHTML(
    container,
    `
    <div class="empty-state">
      <div class="empty-state__icon">
        <i class="fas fa-info-circle"></i>
      </div>
      <p class="empty-state__description">Wählen Sie eine Gruppe aus, um Details anzuzeigen</p>
    </div>
  `,
  );
}
