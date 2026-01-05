/**
 * Machine Management - UI and Rendering Functions
 * Contains all UI rendering and display helpers
 */

import type { Machine, MachineStatusFilter } from './types';
import { $$, setHTML, setSafeHTML, escapeHtml } from '../../../utils/dom-utils';

/**
 * Get status badge class based on machine status
 */
export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'operational':
      return 'badge--success';
    case 'maintenance':
      return 'badge--warning';
    case 'repair':
      return 'badge--danger';
    case 'standby':
      return 'badge--error';
    case 'decommissioned':
      return 'badge--error';
    default:
      return 'badge--error';
  }
}

/**
 * Get human-readable status label
 */
export function getStatusLabel(status: string): string {
  switch (status) {
    case 'operational':
      return 'Betriebsbereit';
    case 'maintenance':
      return 'In Wartung';
    case 'repair':
      return 'In Reparatur';
    case 'standby':
      return 'Standby';
    case 'decommissioned':
      return 'Außer Betrieb';
    default:
      return status;
  }
}

/**
 * Get maintenance warning icon if maintenance is due soon or overdue
 */
export function getMaintenanceWarning(nextMaintenance?: string): string {
  if (nextMaintenance === undefined || nextMaintenance === '') return '';

  const maintenanceDate = new Date(nextMaintenance);
  const today = new Date();
  const daysUntil = Math.floor((maintenanceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) {
    return '<i class="fas fa-exclamation-triangle text-red-500 ms-2" title="Wartung überfällig"></i>';
  } else if (daysUntil <= 7) {
    return '<i class="fas fa-exclamation-circle text-yellow-500 ms-2" title="Wartung bald fällig"></i>';
  }

  return '';
}

/**
 * Generate action buttons HTML for machine row
 */
function generateMachineActionButtons(machineId: number): string {
  return `
    <div class="flex gap-2">
      <button
        class="action-icon action-icon--edit"
        data-action="edit-machine"
        data-machine-id="${machineId}"
        title="Bearbeiten"
        aria-label="Maschine bearbeiten"
      >
        <i class="fas fa-edit"></i>
      </button>
      <button
        class="action-icon action-icon--delete"
        data-action="delete-machine"
        data-machine-id="${machineId}"
        title="Löschen"
        aria-label="Maschine löschen"
      >
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `;
}

/**
 * Helper: Create count badge with native title tooltip
 * ASSIXX STANDARD: Follows BADGE-ASSIGNMENT-SYSTEM.md
 */
function createCountBadge(count: number, names: string, singular: string, plural?: string): string {
  if (count === 0) {
    return `<span class="badge badge--secondary" title="Keine ${plural ?? singular + 's'} zugewiesen">Keine</span>`;
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
 * Generate Teams badge HTML following ASSIXX badge standard
 */
function generateTeamsBadge(machine: Machine): string {
  const teams = machine.teams ?? [];
  const teamNames = teams.map((t) => t.name).join(', ');
  return createCountBadge(teams.length, teamNames, 'Team', 'Teams');
}

/**
 * Generate Area badge HTML following ASSIXX badge standard
 */
function generateAreaBadge(machine: Machine): string {
  if (machine.areaName !== undefined && machine.areaName !== '') {
    return `<span class="badge badge--info" title="${escapeHtml(machine.areaName)}">1 Bereich</span>`;
  }
  return '<span class="badge badge--secondary" title="Kein Bereich zugewiesen">Keine</span>';
}

/**
 * Generate Department badge HTML following ASSIXX badge standard
 */
function generateDepartmentBadge(machine: Machine): string {
  if (machine.departmentName !== undefined && machine.departmentName !== '') {
    return `<span class="badge badge--info" title="${escapeHtml(machine.departmentName)}">1 Abteilung</span>`;
  }
  return '<span class="badge badge--secondary" title="Keine Abteilung zugewiesen">Keine</span>';
}

/**
 * Generate HTML for a single machine table row
 */
export function generateMachineRow(machine: Machine): string {
  const statusBadgeClass = getStatusBadgeClass(machine.status);
  const statusLabel = getStatusLabel(machine.status);
  const maintenanceWarning = getMaintenanceWarning(machine.nextMaintenance);

  const maintenanceDisplay =
    machine.nextMaintenance !== undefined && machine.nextMaintenance.length > 0
      ? escapeHtml(new Date(machine.nextMaintenance).toLocaleDateString('de-DE'))
      : '-';

  const operatingHoursDisplay =
    machine.operatingHours !== undefined && machine.operatingHours > 0 ? escapeHtml(`${machine.operatingHours}h`) : '-';

  return `
    <tr>
      <td><code class="text-muted">${machine.id}</code></td>
      <td>
        <strong>${escapeHtml(machine.name)}</strong>
      </td>
      <td>${escapeHtml(machine.model ?? '-')}</td>
      <td>${escapeHtml(machine.manufacturer ?? '-')}</td>
      <td>${generateAreaBadge(machine)}</td>
      <td>${generateDepartmentBadge(machine)}</td>
      <td>${generateTeamsBadge(machine)}</td>
      <td>
        <span class="badge ${statusBadgeClass}">
          ${escapeHtml(statusLabel)}
        </span>
      </td>
      <td>${operatingHoursDisplay}</td>
      <td>
        ${maintenanceDisplay}
        ${maintenanceWarning}
      </td>
      <td>${generateMachineActionButtons(machine.id)}</td>
    </tr>
  `;
}

/**
 * Get empty state title based on filter
 */
export function getEmptyStateTitle(statusFilter: MachineStatusFilter): string {
  switch (statusFilter) {
    case 'operational':
      return 'Keine betriebsbereiten Maschinen';
    case 'maintenance':
      return 'Keine Maschinen in Wartung';
    case 'repair':
      return 'Keine Maschinen in Reparatur';
    default:
      return 'Keine Maschinen gefunden';
  }
}

/**
 * Get empty state description based on filter
 */
export function getEmptyStateDescription(statusFilter: MachineStatusFilter): string {
  if (statusFilter !== 'all') {
    return 'Es gibt aktuell keine Maschinen in dieser Kategorie.';
  }
  return 'Fügen Sie Ihre erste Maschine hinzu, um die Verwaltung zu starten.';
}

/**
 * Update empty state content based on current filter
 */
export function updateEmptyStateContent(statusFilter: MachineStatusFilter): void {
  const emptyDiv = $$('#machines-empty');
  if (emptyDiv === null) return;

  const emptyStateTitle = emptyDiv.querySelector<HTMLElement>('.empty-state__title');
  const emptyStateDesc = emptyDiv.querySelector<HTMLElement>('.empty-state__description');

  if (emptyStateTitle !== null) {
    emptyStateTitle.textContent = getEmptyStateTitle(statusFilter);
  }

  if (emptyStateDesc !== null) {
    emptyStateDesc.textContent = getEmptyStateDescription(statusFilter);
  }
}

/**
 * Show search no results message
 */
export function showSearchNoResults(searchValue: string): void {
  const machinesTableContent = $$('#machines-table-content');
  if (machinesTableContent === null) return;

  setHTML(
    machinesTableContent,
    '<div class="empty-state"><p class="empty-state__description">Keine Maschinen gefunden für "' +
      searchValue +
      '"</p></div>',
  );
}

/**
 * Show empty state with filter-specific content
 */
export function showEmptyState(statusFilter: MachineStatusFilter): void {
  const emptyDiv = $$('#machines-empty');
  const loadingDiv = $$('#machines-loading');

  // Hide loading
  loadingDiv?.classList.add('u-hidden');

  // Update and show empty state
  if (emptyDiv !== null) {
    updateEmptyStateContent(statusFilter);
    emptyDiv.classList.remove('u-hidden');
  }
}

/**
 * Render machines table with data
 */
export function renderMachinesTable(
  machines: Machine[],
  statusFilter: MachineStatusFilter,
  initTooltipsCallback?: () => void,
): void {
  const tableContent = $$('#machines-table-content');
  const machinesEmpty = $$('#machines-empty');
  const loadingDiv = $$('#machines-loading');

  console.info('[MachinesUI] Rendering table, machines count:', machines.length);

  // Hide loading
  loadingDiv?.classList.add('u-hidden');

  if (machines.length === 0) {
    // Hide table and show empty state
    console.info('[MachinesUI] No machines, showing empty state');
    showEmptyState(statusFilter);
    if (tableContent !== null) {
      tableContent.innerHTML = '';
    }
    return;
  }

  // Show table and hide empty state
  console.info('[MachinesUI] Has machines, showing table');
  machinesEmpty?.classList.add('u-hidden');

  // Generate complete table HTML
  const tableHTML = `
    <div class="table-responsive">
      <table class="data-table data-table--striped">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Modell</th>
            <th>Hersteller</th>
            <th>Bereich</th>
            <th>Abteilung</th>
            <th>Teams</th>
            <th>Status</th>
            <th>Betriebsstunden</th>
            <th>Nächste Wartung</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          ${machines.map((machine) => generateMachineRow(machine)).join('')}
        </tbody>
      </table>
    </div>
  `;

  setSafeHTML(tableContent, tableHTML);

  // Initialize tooltips if callback provided
  if (initTooltipsCallback !== undefined) {
    initTooltipsCallback();
  }
}

/**
 * Render search results dropdown
 */
export function renderSearchResults(machines: Machine[], query: string): void {
  const resultsContainer = $$('#machine-search-results');
  const searchWrapper = document.querySelector<HTMLElement>('.search-input-wrapper');

  if (resultsContainer === null || searchWrapper === null) {
    return;
  }

  if (query === '' || query.trim() === '') {
    searchWrapper.classList.remove('search-input-wrapper--open');
    resultsContainer.innerHTML = '';
    return;
  }

  // Show results dropdown
  searchWrapper.classList.add('search-input-wrapper--open');

  if (machines.length === 0) {
    resultsContainer.innerHTML = '<div class="search-input__no-results">Keine Maschinen gefunden</div>';
    return;
  }

  const resultsHTML = machines
    .slice(0, 5) // Show max 5 results
    .map(
      (machine) => `
      <div class="search-input__result-item" data-action="edit-from-search" data-machine-id="${machine.id}">
        <div class="font-medium">${escapeHtml(machine.name)}</div>
        <div class="text-sm text-[var(--color-text-secondary)]">
          ${escapeHtml(machine.model ?? '')} ${machine.manufacturer !== undefined ? '· ' + escapeHtml(machine.manufacturer) : ''}
        </div>
      </div>
    `,
    )
    .join('');

  // eslint-disable-next-line no-unsanitized/property -- All user data is escaped with escapeHtml()
  resultsContainer.innerHTML = resultsHTML;
}

/**
 * Close search results dropdown
 */
export function closeSearchResults(): void {
  const resultsContainer = $$('#machine-search-results');
  const searchWrapper = document.querySelector<HTMLElement>('.search-input-wrapper');

  if (searchWrapper !== null) {
    searchWrapper.classList.remove('search-input-wrapper--open');
  }

  if (resultsContainer !== null) {
    resultsContainer.innerHTML = '';
  }
}

/**
 * Show delete confirmation modal
 */
export async function showDeleteConfirmationModal(machine: Machine): Promise<boolean> {
  return await new Promise((resolve) => {
    const modal = $$('#delete-machine-modal');
    const deleteIdInput = $$('#delete-machine-id') as HTMLInputElement | null;

    if (modal === null || deleteIdInput === null) {
      resolve(false);
      return;
    }

    // Set machine ID
    deleteIdInput.value = String(machine.id);

    // Show modal
    modal.classList.add('modal-overlay--active');

    // Setup one-time listeners for Step 1 modal
    const proceedBtn = $$('#proceed-delete-machine');
    const cancelBtn = $$('#cancel-delete-modal');
    const closeBtn = $$('#close-delete-modal');

    // Step 2 modal elements
    const confirmModal = $$('#delete-machine-confirm-modal');
    const confirmFinalBtn = $$('#confirm-delete-machine-final');
    const cancelConfirmBtn = $$('#cancel-delete-confirm');

    const cleanupStep1 = () => {
      modal.classList.remove('modal-overlay--active');
      proceedBtn?.removeEventListener('click', handleProceed);
      cancelBtn?.removeEventListener('click', handleCancel);
      closeBtn?.removeEventListener('click', handleCancel);
    };

    const cleanupStep2 = () => {
      confirmModal?.classList.remove('modal-overlay--active');
      confirmFinalBtn?.removeEventListener('click', handleFinalConfirm);
      cancelConfirmBtn?.removeEventListener('click', handleCancelConfirm);
    };

    const handleProceed = () => {
      // Close first modal, show second modal (double-check pattern)
      cleanupStep1();
      confirmModal?.classList.add('modal-overlay--active');
    };

    const handleFinalConfirm = () => {
      cleanupStep2();
      resolve(true);
    };

    const handleCancel = () => {
      cleanupStep1();
      resolve(false);
    };

    const handleCancelConfirm = () => {
      cleanupStep2();
      resolve(false);
    };

    proceedBtn?.addEventListener('click', handleProceed);
    cancelBtn?.addEventListener('click', handleCancel);
    closeBtn?.addEventListener('click', handleCancel);
    confirmFinalBtn?.addEventListener('click', handleFinalConfirm);
    cancelConfirmBtn?.addEventListener('click', handleCancelConfirm);
  });
}
