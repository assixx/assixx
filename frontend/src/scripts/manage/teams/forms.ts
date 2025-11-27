/**
 * Team Management - Forms & Modal Handling
 * Modal management, form population, and window handler setup
 */

import { setSafeHTML } from '../../../utils/dom-utils';
import { getTeamsManager, updateTeamRelations } from './data';
import {
  loadDepartmentsForDropdown,
  loadAdminsForDropdown,
  loadMachinesForDropdown,
  loadUsersForDropdown,
  setupDropdownListeners,
  populateTeamForm,
  processTeamFormData,
} from './ui';
import type { WindowWithTeamHandlers } from './types';

// Constants
const MODAL_ACTIVE_CLASS = 'modal-overlay--active';

// ===== HELPER FUNCTIONS FOR FORM RESET =====

/**
 * Reset all hidden form input fields to default values
 * Prevents data contamination when switching from edit to add mode
 */
function resetTeamFormInputs(): void {
  const teamIdField = document.querySelector<HTMLInputElement>('#team-id');
  const departmentField = document.querySelector<HTMLInputElement>('#team-department');
  const teamLeadField = document.querySelector<HTMLInputElement>('#team-lead');
  const membersField = document.querySelector<HTMLInputElement>('#team-members-select');
  const machinesField = document.querySelector<HTMLInputElement>('#team-machines-select');
  const statusField = document.querySelector<HTMLInputElement>('#team-status');

  if (teamIdField !== null) teamIdField.value = '';
  if (departmentField !== null) departmentField.value = '';
  if (teamLeadField !== null) teamLeadField.value = '';
  if (membersField !== null) membersField.value = '';
  if (machinesField !== null) machinesField.value = '';
  if (statusField !== null) statusField.value = 'active';
}

/**
 * Reset all dropdown display elements to default text
 * Clears visible UI state in custom dropdowns
 */
function resetTeamDropdownDisplays(): void {
  const departmentTrigger = document.querySelector<HTMLElement>('#department-trigger span');
  const teamLeadTrigger = document.querySelector<HTMLElement>('#team-lead-trigger span');
  const membersTrigger = document.querySelector<HTMLElement>('#team-members-display');
  const machinesTrigger = document.querySelector<HTMLElement>('#team-machines-display');
  const statusTrigger = document.querySelector<HTMLElement>('#status-trigger span');

  if (departmentTrigger !== null) departmentTrigger.textContent = 'Keine Abteilung';
  if (teamLeadTrigger !== null) teamLeadTrigger.textContent = 'Kein Team-Leiter';
  if (membersTrigger !== null) membersTrigger.textContent = 'Keine Mitglieder zugewiesen';
  if (machinesTrigger !== null) machinesTrigger.textContent = 'Keine Maschinen zugewiesen';
  if (statusTrigger !== null) {
    setSafeHTML(statusTrigger, '<span class="badge badge--success">Aktiv</span>');
  }
}

/**
 * Uncheck all checkboxes in multi-select dropdowns
 * Clears member and machine selections
 */
function resetTeamMemberCheckboxes(): void {
  document.querySelectorAll('#team-members-menu input[type="checkbox"]').forEach((checkbox) => {
    (checkbox as HTMLInputElement).checked = false;
  });
  document.querySelectorAll('#team-machines-menu input[type="checkbox"]').forEach((checkbox) => {
    (checkbox as HTMLInputElement).checked = false;
  });
}

// ===== EDIT TEAM MODAL =====

/**
 * Setup Edit Team Handler
 * Opens modal in edit mode with team data pre-populated
 */
export function setupEditTeam(): void {
  const w = window as unknown as WindowWithTeamHandlers;
  w.editTeam = async (id: number) => {
    const manager = getTeamsManager();
    if (manager === null) return;

    const team = await manager.getTeamDetails(id);
    if (team === null) return;

    const modal = document.querySelector('#team-modal');
    if (modal === null) return;

    modal.classList.add(MODAL_ACTIVE_CLASS);

    // Load all dropdowns in parallel
    const apiClient = manager.apiClient;
    await Promise.all([
      loadDepartmentsForDropdown(apiClient, team.departmentId),
      loadAdminsForDropdown(apiClient, team.leaderId),
      loadMachinesForDropdown(apiClient, team),
      loadUsersForDropdown(apiClient, team),
    ]);

    // Populate form with team data
    populateTeamForm(team);

    // Setup dropdown listeners
    setupDropdownListeners();
  };
}

// ===== DELETE TEAM HANDLER =====

/**
 * Setup Delete Team Handler
 * Delegates to TeamsManager.deleteTeam()
 */
export function setupDeleteTeam(): void {
  const w = window as unknown as WindowWithTeamHandlers;
  w.deleteTeam = (id: number) => {
    const manager = getTeamsManager();
    manager?.deleteTeam(id);
  };
}

// ===== ADD TEAM MODAL (CLEAN STATE) =====

/**
 * Setup Show Team Modal Handler
 * Opens modal in ADD mode with clean/reset form
 */
export function setupShowTeamModal(): void {
  const w = window as unknown as WindowWithTeamHandlers;
  w.showTeamModal = async () => {
    const manager = getTeamsManager();
    if (manager === null) return;

    const modal = document.querySelector('#team-modal');
    if (modal === null) return;

    modal.classList.add(MODAL_ACTIVE_CLASS);

    // Load all dropdowns in parallel
    const apiClient = manager.apiClient;
    await Promise.all([
      loadDepartmentsForDropdown(apiClient),
      loadAdminsForDropdown(apiClient),
      loadMachinesForDropdown(apiClient),
      loadUsersForDropdown(apiClient),
    ]);

    // Reset form to clean state
    const form = document.querySelector<HTMLFormElement>('#team-form');
    if (form !== null) {
      form.reset();
    }

    // Reset all form fields and UI elements (prevents edit data contamination)
    resetTeamFormInputs();
    resetTeamDropdownDisplays();
    resetTeamMemberCheckboxes();

    // Reset modal title
    const modalTitle = document.querySelector('#team-modal-title');
    if (modalTitle !== null) {
      modalTitle.textContent = 'Neues Team';
    }

    // Setup dropdown listeners
    setupDropdownListeners();
  };
}

// ===== CLOSE MODAL =====

/**
 * Setup Close Team Modal Handler
 * Closes the team modal
 */
export function setupCloseTeamModal(): void {
  const w = window as unknown as WindowWithTeamHandlers;
  w.closeTeamModal = () => {
    const modal = document.querySelector('#team-modal');
    if (modal !== null) {
      modal.classList.remove(MODAL_ACTIVE_CLASS);
    }
  };
}

// ===== SAVE TEAM (CREATE/UPDATE) =====

/**
 * Setup Save Team Handler
 * Handles both team creation and updates
 * Updates team members and machines after save
 */
export function setupSaveTeam(): void {
  const w = window as unknown as WindowWithTeamHandlers;
  w.saveTeam = async () => {
    const manager = getTeamsManager();
    const form = document.querySelector<HTMLFormElement>('#team-form');
    if (form === null || manager === null) return;

    const formData = new FormData(form);
    const { teamData, machineIds, userIds } = processTeamFormData(formData);

    try {
      const savedTeam = await ('id' in teamData
        ? manager.updateTeam(Number(teamData['id']), teamData)
        : manager.createTeam(teamData));

      // savedTeam is guaranteed to be Team here (throws on error, never returns null)
      await updateTeamRelations(savedTeam, teamData, userIds, machineIds);

      w.closeTeamModal?.();
      await manager.loadTeams();
    } catch (error) {
      console.error('Error saving team:', error);
    }
  };
}
