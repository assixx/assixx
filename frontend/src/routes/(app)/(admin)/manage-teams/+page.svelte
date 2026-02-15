<script lang="ts">
  /**
   * Manage Teams - Page Component
   * @module manage-teams/+page
   *
   * Level 3 SSR: $derived for SSR data, invalidateAll() after mutations.
   */
  import { invalidateAll } from '$app/navigation';

  import HighlightText from '$lib/components/HighlightText.svelte';
  import { showErrorAlert, showSuccessAlert } from '$lib/stores/toast';
  import { createLogger } from '$lib/utils/logger';

  const log = createLogger('ManageTeamsPage');

  // Local modules
  import {
    saveTeam as apiSaveTeam,
    deleteTeam as apiDeleteTeam,
    forceDeleteTeam as apiForceDeleteTeam,
    updateTeamRelations,
    buildTeamPayload,
    fetchTeamMembers,
    fetchTeamMachines,
  } from './_lib/api';
  import { MESSAGES } from './_lib/constants';
  import { applyAllFilters } from './_lib/filters';
  import TeamDeleteModals from './_lib/TeamDeleteModals.svelte';
  import TeamFormModal from './_lib/TeamFormModal.svelte';
  import {
    getStatusBadgeClass,
    getStatusLabel,
    formatDate,
    getDefaultFormValues,
    getDepartmentBadge,
    getMembersBadge,
    getMachinesBadge,
  } from './_lib/utils';

  import type { PageData } from './$types';
  import type {
    Team,
    Department,
    Admin,
    TeamMember,
    Machine,
    StatusFilter,
    FormIsActiveStatus,
  } from './_lib/types';

  // =============================================================================
  // SSR DATA - Level 3: $derived from props (single source of truth)
  // =============================================================================

  const { data }: { data: PageData } = $props();

  // SSR data via $derived - updates when invalidateAll() is called
  const allTeams = $derived<Team[]>(data.teams);
  const allDepartments = $derived<Department[]>(data.departments);
  const allAdmins = $derived<Admin[]>(data.admins);
  const allEmployees = $derived<TeamMember[]>(data.employees);
  const allMachines = $derived<Machine[]>(data.machines);

  // =============================================================================
  // UI STATE - Filtering and form state (client-side only)
  // =============================================================================

  // Error state
  const error = $state<string | null>(null);

  // Filter State
  let currentStatusFilter = $state<StatusFilter>('active');
  let currentSearchQuery = $state('');

  // Search State
  let searchOpen = $state(false);

  // Modal States
  let showTeamModal = $state(false);
  let showDeleteModal = $state(false);
  let showDeleteConfirmModal = $state(false);
  let showForceDeleteModal = $state(false);

  // Edit State
  let currentEditId = $state<number | null>(null);
  let deleteTeamId = $state<number | null>(null);
  let forceDeleteMemberCount = $state(0);

  // Form Fields
  let formName = $state('');
  let formDescription = $state('');
  let formDepartmentId = $state<number | null>(null);
  let formLeaderId = $state<number | null>(null);
  let formMemberIds = $state<number[]>([]);
  let formMachineIds = $state<number[]>([]);
  let formIsActive = $state<FormIsActiveStatus>(1);

  // Form Submit Loading
  let submitting = $state(false);

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const isEditMode = $derived(currentEditId !== null);
  const modalTitle = $derived(
    isEditMode ? MESSAGES.MODAL_TITLE_EDIT : MESSAGES.MODAL_TITLE_ADD,
  );

  // Derived: Filtered teams based on current filter/search state
  const filteredTeams = $derived(
    applyAllFilters(allTeams, currentStatusFilter, currentSearchQuery),
  );

  // =============================================================================
  // API FUNCTIONS - Level 3: invalidateAll() after mutations
  // =============================================================================

  async function handleFormSubmit(formData: {
    name: string;
    description: string;
    departmentId: number | null;
    leaderId: number | null;
    memberIds: number[];
    machineIds: number[];
    isActive: FormIsActiveStatus;
  }): Promise<void> {
    submitting = true;

    try {
      const payload = buildTeamPayload({
        name: formData.name,
        description: formData.description,
        departmentId: formData.departmentId,
        leaderId: formData.leaderId,
        isActive: formData.isActive,
      });

      const teamId = await apiSaveTeam(payload, currentEditId);

      if (teamId) {
        await updateTeamRelations(
          teamId,
          formData.memberIds,
          formData.machineIds,
          isEditMode,
        );
      }

      closeTeamModal();
      // Level 3: Trigger SSR refetch
      await invalidateAll();
      showSuccessAlert(isEditMode ? 'Team aktualisiert' : 'Team erstellt');
    } catch (err) {
      log.error({ err }, 'Error saving team');
      showErrorAlert(
        err instanceof Error ? err.message : MESSAGES.ERROR_SAVING,
      );
    } finally {
      submitting = false;
    }
  }

  async function deleteTeam(): Promise<void> {
    const teamId = deleteTeamId;
    if (teamId === null) return;

    try {
      const result = await apiDeleteTeam(teamId);

      if (result.success) {
        showDeleteConfirmModal = false;
        // Only reset if unchanged during async operation
        if (deleteTeamId === teamId) deleteTeamId = null;
        // Level 3: Trigger SSR refetch
        await invalidateAll();
        showSuccessAlert('Team gelöscht');
      } else if (result.hasMembers) {
        forceDeleteMemberCount = result.memberCount;
        showDeleteConfirmModal = false;
        showForceDeleteModal = true;
      }
    } catch (err) {
      log.error({ err }, 'Error deleting team');
      showErrorAlert(MESSAGES.ERROR_DELETING);
    }
  }

  async function forceDeleteTeam(): Promise<void> {
    const teamId = deleteTeamId;
    if (teamId === null) return;

    try {
      await apiForceDeleteTeam(teamId);
      showForceDeleteModal = false;
      // Only reset if unchanged during async operation
      if (deleteTeamId === teamId) deleteTeamId = null;
      // Level 3: Trigger SSR refetch
      await invalidateAll();
      showSuccessAlert('Team gelöscht');
    } catch (err) {
      log.error({ err }, 'Error force deleting team');
      showErrorAlert(MESSAGES.ERROR_DELETING);
    }
  }

  // =============================================================================
  // MODAL HANDLERS
  // =============================================================================

  function openAddModal(): void {
    currentEditId = null;
    resetForm();
    showTeamModal = true;
  }

  /**
   * Open edit modal - fetches members and machines from separate endpoints
   * The /teams list endpoint only returns summary data (memberCount, memberNames)
   * but NOT the full members[] and machines[] arrays needed for form population.
   * Backend exposes separate endpoints: /teams/:id/members and /teams/:id/machines
   */
  async function openEditModal(teamId: number): Promise<void> {
    const team = allTeams.find((t) => t.id === teamId);
    if (!team) return;

    currentEditId = teamId;

    // Fetch members and machines from separate endpoints in parallel
    const [members, machines] = await Promise.all([
      fetchTeamMembers(teamId),
      fetchTeamMachines(teamId),
    ]);

    // Populate form from basic team data
    formName = team.name;
    formDescription = team.description ?? '';
    formDepartmentId = team.departmentId ?? null;
    formLeaderId = team.leaderId ?? null;
    formIsActive = (
      team.isActive === 4 ?
        0
      : team.isActive) as FormIsActiveStatus;

    // Set member and machine IDs from fetched data
    formMemberIds = members.map((m) => m.id);
    formMachineIds = machines.map((m) => m.id);

    showTeamModal = true;
  }

  function openDeleteModal(teamId: number): void {
    deleteTeamId = teamId;
    showDeleteModal = true;
  }

  function proceedToDeleteConfirm(): void {
    showDeleteModal = false;
    showDeleteConfirmModal = true;
  }

  function closeTeamModal(): void {
    showTeamModal = false;
    currentEditId = null;
    resetForm();
  }

  function closeDeleteModal(): void {
    showDeleteModal = false;
    deleteTeamId = null;
  }

  function closeDeleteConfirmModal(): void {
    showDeleteConfirmModal = false;
    deleteTeamId = null;
  }

  function closeForceDeleteModal(): void {
    showForceDeleteModal = false;
    deleteTeamId = null;
    forceDeleteMemberCount = 0;
  }

  function resetForm(): void {
    const defaults = getDefaultFormValues();
    formName = defaults.name;
    formDescription = defaults.description;
    formDepartmentId = defaults.departmentId;
    formLeaderId = defaults.leaderId;
    formMemberIds = defaults.memberIds;
    formMachineIds = defaults.machineIds;
    formIsActive = defaults.isActive;
  }

  // =============================================================================
  // STATUS TOGGLE HANDLER
  // =============================================================================

  function handleStatusToggle(status: StatusFilter): void {
    currentStatusFilter = status;
    // filteredTeams is $derived - automatically updates when filter changes
  }

  // =============================================================================
  // SEARCH HANDLERS
  // =============================================================================

  function handleSearchInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    currentSearchQuery = input.value;
    searchOpen = currentSearchQuery.trim().length > 0;
    // filteredTeams is $derived - automatically updates when search changes
  }

  function clearSearch(): void {
    currentSearchQuery = '';
    searchOpen = false;
    // filteredTeams is $derived - automatically updates
  }

  async function handleSearchResultClick(teamId: number): Promise<void> {
    searchOpen = false;
    currentSearchQuery = '';
    await openEditModal(teamId);
  }

  // =============================================================================
  // OUTSIDE CLICK HANDLER FOR SEARCH
  // =============================================================================

  $effect(() => {
    if (searchOpen) {
      const handleOutsideClick = (e: MouseEvent): void => {
        const target = e.target as HTMLElement;
        const el = document.querySelector('.search-input-wrapper');
        if (el && !el.contains(target)) searchOpen = false;
      };

      document.addEventListener('click', handleOutsideClick, true);
      return () => {
        document.removeEventListener('click', handleOutsideClick, true);
      };
    }
  });

  // =============================================================================
  // ESCAPE KEY HANDLER
  // =============================================================================

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (showForceDeleteModal) closeForceDeleteModal();
      else if (showDeleteConfirmModal) closeDeleteConfirmModal();
      else if (showDeleteModal) closeDeleteModal();
      else if (showTeamModal) closeTeamModal();
    }
  }
</script>

<svelte:head>
  <title>Teamverwaltung - Assixx</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="container">
  <div class="card">
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-users-cog mr-2"></i>
        Teamübersicht
      </h2>
      <p class="mt-2 text-(--color-text-secondary)">
        Alle Teams verwalten und bearbeiten
      </p>

      <div class="mt-6 flex items-center justify-between gap-4">
        <!-- Status Toggle Group -->
        <div
          class="toggle-group"
          id="team-status-toggle"
        >
          <button
            type="button"
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'active'}
            title="Aktive Teams"
            onclick={() => {
              handleStatusToggle('active');
            }}
          >
            <i class="fas fa-check-circle"></i>
            Aktive
          </button>
          <button
            type="button"
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'inactive'}
            title="Inaktive Teams"
            onclick={() => {
              handleStatusToggle('inactive');
            }}
          >
            <i class="fas fa-times-circle"></i>
            Inaktive
          </button>
          <button
            type="button"
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'archived'}
            title="Archivierte Teams"
            onclick={() => {
              handleStatusToggle('archived');
            }}
          >
            <i class="fas fa-archive"></i>
            Archiviert
          </button>
          <button
            type="button"
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'all'}
            title="Alle Teams"
            onclick={() => {
              handleStatusToggle('all');
            }}
          >
            <i class="fas fa-users"></i>
            Alle
          </button>
        </div>

        <!-- Search Input -->
        <div
          class="search-input-wrapper max-w-80"
          class:search-input-wrapper--open={searchOpen}
        >
          <div
            class="search-input"
            id="team-search-container"
          >
            <i class="search-input__icon fas fa-search"></i>
            <input
              type="search"
              id="team-search"
              class="search-input__field"
              placeholder={MESSAGES.SEARCH_PLACEHOLDER}
              autocomplete="off"
              value={currentSearchQuery}
              oninput={handleSearchInput}
            />
            <button
              class="search-input__clear"
              class:search-input__clear--visible={currentSearchQuery.length > 0}
              type="button"
              aria-label="Suche löschen"
              onclick={clearSearch}
            >
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div
            class="search-input__results"
            id="team-search-results"
          >
            {#if currentSearchQuery && filteredTeams.length === 0}
              <div class="search-input__no-results">
                {MESSAGES.SEARCH_NO_RESULTS} "{currentSearchQuery}"
              </div>
            {:else if currentSearchQuery}
              {#each filteredTeams.slice(0, 5) as team (team.id)}
                <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                <div
                  class="search-input__result-item"
                  onclick={() => {
                    void handleSearchResultClick(team.id);
                  }}
                >
                  <i class="fas fa-users-cog text-blue-500"></i>
                  <span>
                    <HighlightText
                      text={team.name}
                      query={currentSearchQuery}
                    />
                  </span>
                  {#if team.departmentName}
                    <span class="ml-2 text-sm text-(--color-text-secondary)"
                      >&rarr; {team.departmentName}</span
                    >
                  {/if}
                </div>
              {/each}
            {/if}
          </div>
        </div>
      </div>
    </div>

    <div class="card__body">
      {#if error}
        <div class="p-6 text-center">
          <i
            class="fas fa-exclamation-triangle mb-4 text-4xl text-(--color-danger)"
          ></i>
          <p class="text-(--color-text-secondary)">{error}</p>
          <button
            type="button"
            class="btn btn-primary mt-4"
            onclick={() => void invalidateAll()}>Erneut versuchen</button
          >
        </div>
      {:else if filteredTeams.length === 0}
        <div
          id="teams-empty"
          class="empty-state"
        >
          <div class="empty-state__icon">
            <i class="fas fa-users-cog"></i>
          </div>
          <h3 class="empty-state__title">{MESSAGES.NO_TEAMS_FOUND}</h3>
          <p class="empty-state__description">{MESSAGES.CREATE_FIRST_TEAM}</p>
          <button
            type="button"
            class="btn btn-primary"
            onclick={openAddModal}
          >
            <i class="fas fa-plus"></i>
            Team hinzufügen
          </button>
        </div>
      {:else}
        <div id="teams-table-content">
          <div class="table-responsive">
            <table
              class="data-table data-table--hover data-table--striped"
              id="teams-table"
            >
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Abteilung</th>
                  <th scope="col">Team-Lead</th>
                  <th scope="col">Mitglieder</th>
                  <th scope="col">Maschinen</th>
                  <th scope="col">Status</th>
                  <th scope="col">Erstellt am</th>
                  <th scope="col">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {#each filteredTeams as team (team.id)}
                  {@const deptBadge = getDepartmentBadge(team, allDepartments)}
                  {@const membersBadge = getMembersBadge(team)}
                  {@const machinesBadge = getMachinesBadge(team)}
                  <tr>
                    <td>
                      <div class="flex items-center gap-2">
                        <i class="fas fa-users text-blue-500"></i>
                        <span class="font-medium">{team.name}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        class="badge {deptBadge.class}"
                        title={deptBadge.title}
                      >
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -- Safe: internal badge, no user input -->
                        {@html deptBadge.text}
                      </span>
                    </td>
                    <td>{team.leaderName ?? '-'}</td>
                    <td>
                      <span
                        class="badge {membersBadge.class}"
                        title={membersBadge.title}
                      >
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -- Safe: internal badge, no user input -->
                        {@html membersBadge.text}
                      </span>
                    </td>
                    <td>
                      <span
                        class="badge {machinesBadge.class}"
                        title={machinesBadge.title}
                      >
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -- Safe: internal badge, no user input -->
                        {@html machinesBadge.text}
                      </span>
                    </td>
                    <td>
                      <span class="badge {getStatusBadgeClass(team.isActive)}"
                        >{getStatusLabel(team.isActive)}</span
                      >
                    </td>
                    <td>{formatDate(team.createdAt)}</td>
                    <td>
                      <div class="flex gap-2">
                        <button
                          type="button"
                          class="action-icon action-icon--edit"
                          title="Bearbeiten"
                          aria-label="Team bearbeiten"
                          onclick={() => void openEditModal(team.id)}
                        >
                          <i class="fas fa-edit"></i>
                        </button>
                        <button
                          type="button"
                          class="action-icon action-icon--delete"
                          title="Löschen"
                          aria-label="Team löschen"
                          onclick={() => {
                            openDeleteModal(team.id);
                          }}
                        >
                          <i class="fas fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Floating Action Button -->
<button
  type="button"
  class="btn-float"
  onclick={openAddModal}
  aria-label="Team hinzufügen"
>
  <i class="fas fa-plus"></i>
</button>

<!-- Add/Edit Team Modal -->
{#if showTeamModal}
  <TeamFormModal
    {isEditMode}
    {modalTitle}
    {formName}
    {formDescription}
    {formDepartmentId}
    {formLeaderId}
    {formMemberIds}
    {formMachineIds}
    {formIsActive}
    {allDepartments}
    {allAdmins}
    {allEmployees}
    {allMachines}
    {submitting}
    onclose={closeTeamModal}
    onsubmit={handleFormSubmit}
  />
{/if}

<!-- Delete Modals -->
<TeamDeleteModals
  {showDeleteModal}
  {showDeleteConfirmModal}
  {showForceDeleteModal}
  {forceDeleteMemberCount}
  oncloseDelete={closeDeleteModal}
  oncloseDeleteConfirm={closeDeleteConfirmModal}
  oncloseForceDelete={closeForceDeleteModal}
  onproceedToConfirm={proceedToDeleteConfirm}
  onconfirmDelete={deleteTeam}
  onforceDelete={forceDeleteTeam}
/>
