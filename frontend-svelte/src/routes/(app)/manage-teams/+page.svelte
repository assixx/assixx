<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { showErrorAlert } from '$lib/stores/toast.js';

  // Page-specific CSS
  import '../../../styles/manage-teams.css';

  // Local modules
  import type {
    Team,
    Department,
    Admin,
    TeamMember,
    Machine,
    StatusFilter,
    FormIsActiveStatus,
  } from './_lib/types';
  import { MESSAGES } from './_lib/constants';
  import {
    loadTeams as apiLoadTeams,
    loadDepartments as apiLoadDepartments,
    loadAdmins as apiLoadAdmins,
    loadEmployees as apiLoadEmployees,
    loadMachines as apiLoadMachines,
    saveTeam as apiSaveTeam,
    deleteTeam as apiDeleteTeam,
    forceDeleteTeam as apiForceDeleteTeam,
    updateTeamRelations,
    buildTeamPayload,
    checkSessionExpired,
  } from './_lib/api';
  import { applyAllFilters } from './_lib/filters';
  import {
    getStatusBadgeClass,
    getStatusLabel,
    formatDate,
    highlightMatch,
    getMembersDisplayText,
    getMachinesDisplayText,
    getDepartmentDisplayText,
    getLeaderDisplayText,
    populateFormFromTeam,
    getDefaultFormValues,
    toggleIdInArray,
  } from './_lib/utils';

  // =============================================================================
  // SVELTE 5 RUNES - State
  // =============================================================================

  // Team Data
  let allTeams = $state<Team[]>([]);
  let filteredTeams = $state<Team[]>([]);

  // Reference Data
  let allDepartments = $state<Department[]>([]);
  let allAdmins = $state<Admin[]>([]);
  let allEmployees = $state<TeamMember[]>([]);
  let allMachines = $state<Machine[]>([]);

  // Loading and Error States
  let loading = $state(true);
  let error = $state<string | null>(null);

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

  // Dropdown States
  let departmentDropdownOpen = $state(false);
  let leaderDropdownOpen = $state(false);
  let membersDropdownOpen = $state(false);
  let machinesDropdownOpen = $state(false);
  let statusDropdownOpen = $state(false);

  // Form Submit Loading
  let submitting = $state(false);

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const isEditMode = $derived(currentEditId !== null);
  const modalTitle = $derived(isEditMode ? MESSAGES.MODAL_TITLE_EDIT : MESSAGES.MODAL_TITLE_ADD);

  // =============================================================================
  // DATA LOADING
  // =============================================================================

  async function loadTeams(): Promise<void> {
    loading = true;
    error = null;

    try {
      allTeams = await apiLoadTeams();
      applyFilters();
    } catch (err) {
      console.error('[ManageTeams] Error loading teams:', err);
      if (checkSessionExpired(err)) return;
      error = err instanceof Error ? err.message : MESSAGES.ERROR_LOADING;
    } finally {
      loading = false;
    }
  }

  async function loadReferenceData(): Promise<void> {
    allDepartments = await apiLoadDepartments();
    allAdmins = await apiLoadAdmins();
    allEmployees = await apiLoadEmployees();
    allMachines = await apiLoadMachines();
  }

  // =============================================================================
  // FILTER APPLICATION
  // =============================================================================

  function applyFilters(): void {
    filteredTeams = applyAllFilters(allTeams, currentStatusFilter, currentSearchQuery);
  }

  // =============================================================================
  // SAVE & DELETE OPERATIONS
  // =============================================================================

  async function saveTeam(): Promise<void> {
    submitting = true;

    try {
      const payload = buildTeamPayload({
        name: formName,
        description: formDescription,
        departmentId: formDepartmentId,
        leaderId: formLeaderId,
        isActive: formIsActive,
      });

      const teamId = await apiSaveTeam(payload, currentEditId);

      if (teamId) {
        await updateTeamRelations(teamId, formMemberIds, formMachineIds, isEditMode);
      }

      closeTeamModal();
      await loadTeams();
    } catch (err) {
      console.error('[ManageTeams] Error saving team:', err);
      showErrorAlert(err instanceof Error ? err.message : MESSAGES.ERROR_SAVING);
    } finally {
      submitting = false;
    }
  }

  async function deleteTeam(): Promise<void> {
    if (deleteTeamId === null) return;

    try {
      const result = await apiDeleteTeam(deleteTeamId);

      if (result.success) {
        showDeleteConfirmModal = false;
        deleteTeamId = null;
        await loadTeams();
      } else if (result.hasMembers) {
        forceDeleteMemberCount = result.memberCount;
        showDeleteConfirmModal = false;
        showForceDeleteModal = true;
      }
    } catch (err) {
      console.error('[ManageTeams] Error deleting team:', err);
      showErrorAlert(MESSAGES.ERROR_DELETING);
    }
  }

  async function forceDeleteTeam(): Promise<void> {
    if (deleteTeamId === null) return;

    try {
      await apiForceDeleteTeam(deleteTeamId);
      showForceDeleteModal = false;
      deleteTeamId = null;
      await loadTeams();
    } catch (err) {
      console.error('[ManageTeams] Error force deleting team:', err);
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

  function openEditModal(teamId: number): void {
    const team = allTeams.find((t) => t.id === teamId);
    if (!team) return;

    currentEditId = teamId;
    const formData = populateFormFromTeam(team);

    formName = formData.name;
    formDescription = formData.description;
    formDepartmentId = formData.departmentId;
    formLeaderId = formData.leaderId;
    formMemberIds = formData.memberIds;
    formMachineIds = formData.machineIds;
    formIsActive = formData.isActive;
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
    departmentDropdownOpen = false;
    leaderDropdownOpen = false;
    membersDropdownOpen = false;
    machinesDropdownOpen = false;
    statusDropdownOpen = false;
  }

  // =============================================================================
  // DROPDOWN HANDLERS
  // =============================================================================

  function closeOtherDropdowns(except: string): void {
    if (except !== 'department') departmentDropdownOpen = false;
    if (except !== 'leader') leaderDropdownOpen = false;
    if (except !== 'members') membersDropdownOpen = false;
    if (except !== 'machines') machinesDropdownOpen = false;
    if (except !== 'status') statusDropdownOpen = false;
  }

  function toggleDepartmentDropdown(e: MouseEvent): void {
    e.stopPropagation();
    closeOtherDropdowns('department');
    departmentDropdownOpen = !departmentDropdownOpen;
  }

  function selectDepartment(id: number | null): void {
    formDepartmentId = id;
    departmentDropdownOpen = false;
  }

  function toggleLeaderDropdown(e: MouseEvent): void {
    e.stopPropagation();
    closeOtherDropdowns('leader');
    leaderDropdownOpen = !leaderDropdownOpen;
  }

  function selectLeader(id: number | null): void {
    formLeaderId = id;
    leaderDropdownOpen = false;
  }

  function toggleMembersDropdown(e: MouseEvent): void {
    e.stopPropagation();
    closeOtherDropdowns('members');
    membersDropdownOpen = !membersDropdownOpen;
  }

  function toggleMember(id: number): void {
    formMemberIds = toggleIdInArray(formMemberIds, id);
  }

  function toggleMachinesDropdown(e: MouseEvent): void {
    e.stopPropagation();
    closeOtherDropdowns('machines');
    machinesDropdownOpen = !machinesDropdownOpen;
  }

  function toggleMachine(id: number): void {
    formMachineIds = toggleIdInArray(formMachineIds, id);
  }

  function toggleStatusDropdown(e: MouseEvent): void {
    e.stopPropagation();
    closeOtherDropdowns('status');
    statusDropdownOpen = !statusDropdownOpen;
  }

  function selectStatus(status: FormIsActiveStatus): void {
    formIsActive = status;
    statusDropdownOpen = false;
  }

  // =============================================================================
  // STATUS TOGGLE HANDLER
  // =============================================================================

  function handleStatusToggle(status: StatusFilter): void {
    currentStatusFilter = status;
    applyFilters();
  }

  // =============================================================================
  // SEARCH HANDLERS
  // =============================================================================

  function handleSearchInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    currentSearchQuery = input.value;
    searchOpen = currentSearchQuery.trim().length > 0;
    applyFilters();
  }

  function clearSearch(): void {
    currentSearchQuery = '';
    searchOpen = false;
    applyFilters();
  }

  function handleSearchResultClick(teamId: number): void {
    openEditModal(teamId);
    searchOpen = false;
    currentSearchQuery = '';
  }

  // =============================================================================
  // FORM SUBMIT HANDLER
  // =============================================================================

  function handleFormSubmit(e: Event): void {
    e.preventDefault();
    saveTeam();
  }

  // =============================================================================
  // OVERLAY CLICK HANDLERS
  // =============================================================================

  function handleModalOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) closeTeamModal();
  }

  function handleDeleteOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) closeDeleteModal();
  }

  function handleDeleteConfirmOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) closeDeleteConfirmModal();
  }

  function handleForceDeleteOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) closeForceDeleteModal();
  }

  // =============================================================================
  // OUTSIDE CLICK HANDLERS
  // =============================================================================

  $effect(() => {
    if (
      departmentDropdownOpen ||
      leaderDropdownOpen ||
      membersDropdownOpen ||
      machinesDropdownOpen ||
      statusDropdownOpen ||
      searchOpen
    ) {
      const handleOutsideClick = (e: MouseEvent): void => {
        const target = e.target as HTMLElement;

        if (departmentDropdownOpen) {
          const el = document.getElementById('department-dropdown');
          if (el && !el.contains(target)) departmentDropdownOpen = false;
        }

        if (leaderDropdownOpen) {
          const el = document.getElementById('team-lead-dropdown');
          if (el && !el.contains(target)) leaderDropdownOpen = false;
        }

        if (membersDropdownOpen) {
          const el = document.getElementById('team-members-dropdown');
          if (el && !el.contains(target)) membersDropdownOpen = false;
        }

        if (machinesDropdownOpen) {
          const el = document.getElementById('team-machines-dropdown');
          if (el && !el.contains(target)) machinesDropdownOpen = false;
        }

        if (statusDropdownOpen) {
          const el = document.getElementById('status-dropdown');
          if (el && !el.contains(target)) statusDropdownOpen = false;
        }

        if (searchOpen) {
          const el = document.querySelector('.search-input-wrapper');
          if (el && !el.contains(target)) searchOpen = false;
        }
      };

      document.addEventListener('click', handleOutsideClick);
      return () => document.removeEventListener('click', handleOutsideClick);
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

  // =============================================================================
  // LIFECYCLE
  // =============================================================================

  onMount(() => {
    const token = localStorage.getItem('accessToken');
    const activeRole = localStorage.getItem('activeRole');

    // Admin or Root can manage teams
    if (!token || (activeRole !== 'admin' && activeRole !== 'root')) {
      goto(`${base}/login`);
      return;
    }

    loadTeams();
    loadReferenceData();
  });
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
      <p class="text-[var(--color-text-secondary)] mt-2">Alle Teams verwalten und bearbeiten</p>

      <div class="flex gap-4 items-center justify-between mt-6">
        <!-- Status Toggle Group -->
        <div class="toggle-group" id="team-status-toggle">
          <button
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'active'}
            title="Aktive Teams"
            onclick={() => handleStatusToggle('active')}
          >
            <i class="fas fa-check-circle"></i>
            Aktive
          </button>
          <button
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'inactive'}
            title="Inaktive Teams"
            onclick={() => handleStatusToggle('inactive')}
          >
            <i class="fas fa-times-circle"></i>
            Inaktive
          </button>
          <button
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'archived'}
            title="Archivierte Teams"
            onclick={() => handleStatusToggle('archived')}
          >
            <i class="fas fa-archive"></i>
            Archiviert
          </button>
          <button
            class="toggle-group__btn"
            class:active={currentStatusFilter === 'all'}
            title="Alle Teams"
            onclick={() => handleStatusToggle('all')}
          >
            <i class="fas fa-users"></i>
            Alle
          </button>
        </div>

        <!-- Search Input -->
        <div class="search-input-wrapper max-w-80" class:search-input-wrapper--open={searchOpen}>
          <div class="search-input" id="team-search-container">
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
          <div class="search-input__results" id="team-search-results">
            {#if currentSearchQuery && filteredTeams.length === 0}
              <div class="search-input__no-results">
                {MESSAGES.SEARCH_NO_RESULTS} "{currentSearchQuery}"
              </div>
            {:else if currentSearchQuery}
              {#each filteredTeams.slice(0, 5) as team (team.id)}
                <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                <div
                  class="search-input__result-item"
                  onclick={() => handleSearchResultClick(team.id)}
                >
                  <i class="fas fa-users-cog text-blue-500"></i>
                  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                  <span>{@html highlightMatch(team.name, currentSearchQuery)}</span>
                  {#if team.departmentName}
                    <span class="text-[var(--color-text-secondary)] text-sm ml-2"
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
      {#if loading}
        <div id="teams-loading" class="spinner-container">
          <div class="spinner-ring spinner-ring--md"></div>
          <p class="mt-2 text-[var(--color-text-secondary)]">{MESSAGES.LOADING_TEAMS}</p>
        </div>
      {:else if error}
        <div class="text-center p-6">
          <i class="fas fa-exclamation-triangle text-4xl text-[var(--color-danger)] mb-4"></i>
          <p class="text-[var(--color-text-secondary)]">{error}</p>
          <button class="btn btn-primary mt-4" onclick={() => loadTeams()}>Erneut versuchen</button>
        </div>
      {:else if filteredTeams.length === 0}
        <div id="teams-empty" class="empty-state">
          <div class="empty-state__icon">
            <i class="fas fa-users-cog"></i>
          </div>
          <h3 class="empty-state__title">{MESSAGES.NO_TEAMS_FOUND}</h3>
          <p class="empty-state__description">{MESSAGES.CREATE_FIRST_TEAM}</p>
          <button class="btn btn-primary" onclick={openAddModal}>
            <i class="fas fa-plus"></i>
            Team hinzufügen
          </button>
        </div>
      {:else}
        <div id="teams-table-content">
          <div class="table-responsive">
            <table class="data-table data-table--hover data-table--striped" id="teams-table">
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
                  <tr>
                    <td>
                      <div class="flex items-center gap-2">
                        <i class="fas fa-users text-blue-500"></i>
                        <span class="font-medium">{team.name}</span>
                      </div>
                    </td>
                    <td>{team.departmentName ?? '-'}</td>
                    <td>{team.leaderName ?? '-'}</td>
                    <td>
                      <span
                        class="badge badge--info"
                        title={team.memberNames ?? 'Keine Mitglieder'}
                      >
                        {team.memberCount ?? 0}
                      </span>
                    </td>
                    <td>
                      <span
                        class="badge badge--secondary"
                        title={team.machineNames ?? 'Keine Maschinen'}
                      >
                        {team.machineCount ?? 0}
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
                          class="action-icon action-icon--edit"
                          title="Bearbeiten"
                          aria-label="Team bearbeiten"
                          onclick={() => openEditModal(team.id)}
                        >
                          <i class="fas fa-edit"></i>
                        </button>
                        <button
                          class="action-icon action-icon--delete"
                          title="Löschen"
                          aria-label="Team löschen"
                          onclick={() => openDeleteModal(team.id)}
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
<button class="btn-float" onclick={openAddModal} aria-label="Team hinzufügen">
  <i class="fas fa-plus"></i>
</button>

<!-- Add/Edit Team Modal -->
<div
  id="team-modal"
  class="modal-overlay"
  class:modal-overlay--active={showTeamModal}
  role="dialog"
  aria-modal="true"
  aria-labelledby="team-modal-title"
  tabindex="-1"
  onclick={handleModalOverlayClick}
  onkeydown={(e) => e.key === 'Escape' && closeTeamModal()}
>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <form
    id="team-form"
    class="ds-modal"
    onclick={(e) => e.stopPropagation()}
    onsubmit={handleFormSubmit}
  >
    <div class="ds-modal__header">
      <h3 class="ds-modal__title" id="team-modal-title">{modalTitle}</h3>
      <button type="button" class="ds-modal__close" aria-label="Schließen" onclick={closeTeamModal}>
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="ds-modal__body">
      <div class="form-field">
        <label class="form-field__label" for="team-name">
          Name <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="team-name"
          name="name"
          class="form-field__control"
          required
          bind:value={formName}
        />
      </div>

      <div class="form-field">
        <label class="form-field__label" for="team-description">Beschreibung</label>
        <textarea
          id="team-description"
          name="description"
          class="form-field__control"
          rows="3"
          bind:value={formDescription}
        ></textarea>
      </div>

      <div class="form-field">
        <label class="form-field__label" for="team-department">Abteilung</label>
        <input
          type="hidden"
          id="team-department"
          name="departmentId"
          value={formDepartmentId ?? ''}
        />
        <div class="dropdown" id="department-dropdown">
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div
            class="dropdown__trigger"
            class:active={departmentDropdownOpen}
            onclick={toggleDepartmentDropdown}
          >
            <span>{getDepartmentDisplayText(formDepartmentId, allDepartments)}</span>
            <i class="fas fa-chevron-down"></i>
          </div>
          <div class="dropdown__menu" class:active={departmentDropdownOpen}>
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div class="dropdown__option" onclick={() => selectDepartment(null)}>
              {MESSAGES.NO_DEPARTMENT}
            </div>
            {#each allDepartments as dept (dept.id)}
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
              <div class="dropdown__option" onclick={() => selectDepartment(dept.id)}>
                {dept.name}
              </div>
            {/each}
          </div>
        </div>
      </div>

      <div class="form-field">
        <label class="form-field__label" for="team-lead">Team-Leiter (Admin)</label>
        <input type="hidden" id="team-lead" name="leaderId" value={formLeaderId ?? ''} />
        <div class="dropdown" id="team-lead-dropdown">
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div
            class="dropdown__trigger"
            class:active={leaderDropdownOpen}
            onclick={toggleLeaderDropdown}
          >
            <span>{getLeaderDisplayText(formLeaderId, allAdmins)}</span>
            <i class="fas fa-chevron-down"></i>
          </div>
          <div class="dropdown__menu" class:active={leaderDropdownOpen}>
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div class="dropdown__option" onclick={() => selectLeader(null)}>
              {MESSAGES.NO_LEADER}
            </div>
            {#each allAdmins as admin (admin.id)}
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
              <div class="dropdown__option" onclick={() => selectLeader(admin.id)}>
                {admin.firstName}
                {admin.lastName}
              </div>
            {/each}
          </div>
        </div>
      </div>

      <div class="form-field">
        <label class="form-field__label" for="team-members">Team-Mitglieder</label>
        <input type="hidden" id="team-members" name="memberIds" value={formMemberIds.join(',')} />
        <div class="dropdown" id="team-members-dropdown">
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div
            class="dropdown__trigger"
            class:active={membersDropdownOpen}
            onclick={toggleMembersDropdown}
          >
            <span>{getMembersDisplayText(formMemberIds, allEmployees)}</span>
            <i class="fas fa-chevron-down"></i>
          </div>
          <div class="dropdown__menu dropdown__menu--scrollable" class:active={membersDropdownOpen}>
            {#each allEmployees as employee (employee.id)}
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
              <div
                class="dropdown__option dropdown__option--checkbox"
                onclick={() => toggleMember(employee.id)}
              >
                <input
                  type="checkbox"
                  checked={formMemberIds.includes(employee.id)}
                  class="mr-2"
                  onclick={(e) => e.stopPropagation()}
                  onchange={() => toggleMember(employee.id)}
                />
                {employee.firstName}
                {employee.lastName}
              </div>
            {/each}
            {#if allEmployees.length === 0}
              <div class="dropdown__option dropdown__option--disabled">
                {MESSAGES.NO_EMPLOYEES_AVAILABLE}
              </div>
            {/if}
          </div>
        </div>
      </div>

      <div class="form-field">
        <label class="form-field__label" for="team-machines">Zugewiesene Maschinen</label>
        <input
          type="hidden"
          id="team-machines"
          name="machineIds"
          value={formMachineIds.join(',')}
        />
        <div class="dropdown" id="team-machines-dropdown">
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div
            class="dropdown__trigger"
            class:active={machinesDropdownOpen}
            onclick={toggleMachinesDropdown}
          >
            <span>{getMachinesDisplayText(formMachineIds, allMachines)}</span>
            <i class="fas fa-chevron-down"></i>
          </div>
          <div
            class="dropdown__menu dropdown__menu--scrollable"
            class:active={machinesDropdownOpen}
          >
            {#each allMachines as machine (machine.id)}
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
              <div
                class="dropdown__option dropdown__option--checkbox"
                onclick={() => toggleMachine(machine.id)}
              >
                <input
                  type="checkbox"
                  checked={formMachineIds.includes(machine.id)}
                  class="mr-2"
                  onclick={(e) => e.stopPropagation()}
                  onchange={() => toggleMachine(machine.id)}
                />
                {machine.name}
              </div>
            {/each}
            {#if allMachines.length === 0}
              <div class="dropdown__option dropdown__option--disabled">
                {MESSAGES.NO_MACHINES_AVAILABLE}
              </div>
            {/if}
          </div>
        </div>
      </div>

      {#if isEditMode}
        <div class="form-field mt-6" id="status-field-group">
          <label class="form-field__label" for="team-is-active">
            Status <span class="text-red-500">*</span>
          </label>
          <input type="hidden" id="team-is-active" name="isActive" value={formIsActive} />
          <div class="dropdown" id="status-dropdown">
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div
              class="dropdown__trigger"
              class:active={statusDropdownOpen}
              onclick={toggleStatusDropdown}
            >
              <span class="badge {getStatusBadgeClass(formIsActive)}"
                >{getStatusLabel(formIsActive)}</span
              >
              <i class="fas fa-chevron-down"></i>
            </div>
            <div class="dropdown__menu" class:active={statusDropdownOpen}>
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
              <div class="dropdown__option" onclick={() => selectStatus(1)}>
                <span class="badge badge--success">Aktiv</span>
              </div>
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
              <div class="dropdown__option" onclick={() => selectStatus(0)}>
                <span class="badge badge--warning">Inaktiv</span>
              </div>
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
              <div class="dropdown__option" onclick={() => selectStatus(3)}>
                <span class="badge badge--error">Archiviert</span>
              </div>
            </div>
          </div>
          <span class="form-field__message text-[var(--color-text-secondary)] mt-1 block">
            {MESSAGES.STATUS_HINT}
          </span>
        </div>
      {/if}
    </div>

    <div class="ds-modal__footer">
      <button type="button" class="btn btn-cancel" onclick={closeTeamModal}>Abbrechen</button>
      <button type="submit" class="btn btn-modal" disabled={submitting}>
        {#if submitting}<span class="spinner-ring spinner-ring--sm mr-2"></span>{/if}
        Speichern
      </button>
    </div>
  </form>
</div>

<!-- Delete Modal Step 1 -->
<div
  id="delete-team-modal"
  class="modal-overlay"
  class:modal-overlay--active={showDeleteModal}
  role="dialog"
  aria-modal="true"
  aria-labelledby="delete-modal-title"
  tabindex="-1"
  onclick={handleDeleteOverlayClick}
  onkeydown={(e) => e.key === 'Escape' && closeDeleteModal()}
>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="ds-modal ds-modal--sm" onclick={(e) => e.stopPropagation()}>
    <div class="ds-modal__header">
      <h3 class="ds-modal__title" id="delete-modal-title">
        <i class="fas fa-trash-alt text-red-500 mr-2"></i>
        {MESSAGES.DELETE_TITLE}
      </h3>
      <button
        type="button"
        class="ds-modal__close"
        aria-label="Schließen"
        onclick={closeDeleteModal}
      >
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="ds-modal__body">
      <p class="text-[var(--color-text-secondary)]">Möchten Sie dieses Team wirklich löschen?</p>
    </div>
    <div class="ds-modal__footer">
      <button type="button" class="btn btn-cancel" onclick={closeDeleteModal}>Abbrechen</button>
      <button type="button" class="btn btn-danger" onclick={proceedToDeleteConfirm}>Löschen</button>
    </div>
  </div>
</div>

<!-- Delete Modal Step 2 -->
<div
  id="delete-team-confirm-modal"
  class="modal-overlay"
  class:modal-overlay--active={showDeleteConfirmModal}
  role="dialog"
  aria-modal="true"
  aria-labelledby="delete-confirm-title"
  tabindex="-1"
  onclick={handleDeleteConfirmOverlayClick}
  onkeydown={(e) => e.key === 'Escape' && closeDeleteConfirmModal()}
>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="confirm-modal confirm-modal--danger" onclick={(e) => e.stopPropagation()}>
    <div class="confirm-modal__icon">
      <i class="fas fa-exclamation-triangle"></i>
    </div>
    <h3 class="confirm-modal__title" id="delete-confirm-title">{MESSAGES.DELETE_CONFIRM_TITLE}</h3>
    <p class="confirm-modal__message">
      <strong>ACHTUNG:</strong>
      {MESSAGES.DELETE_CONFIRM_MESSAGE}
    </p>
    <div class="confirm-modal__actions">
      <button
        type="button"
        class="confirm-modal__btn confirm-modal__btn--cancel"
        onclick={closeDeleteConfirmModal}>Abbrechen</button
      >
      <button
        type="button"
        class="confirm-modal__btn confirm-modal__btn--danger"
        onclick={deleteTeam}
      >
        Endgültig löschen
      </button>
    </div>
  </div>
</div>

<!-- Force Delete Warning Modal -->
<div
  id="force-delete-warning-modal"
  class="modal-overlay"
  class:modal-overlay--active={showForceDeleteModal}
  role="dialog"
  aria-modal="true"
  aria-labelledby="force-delete-title"
  tabindex="-1"
  onclick={handleForceDeleteOverlayClick}
  onkeydown={(e) => e.key === 'Escape' && closeForceDeleteModal()}
>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="confirm-modal confirm-modal--warning" onclick={(e) => e.stopPropagation()}>
    <div class="confirm-modal__icon">
      <i class="fas fa-exclamation-triangle"></i>
    </div>
    <h3 class="confirm-modal__title" id="force-delete-title">{MESSAGES.FORCE_DELETE_TITLE}</h3>
    <p class="confirm-modal__message">
      {MESSAGES.FORCE_DELETE_MESSAGE(forceDeleteMemberCount)}
    </p>
    <div class="confirm-modal__actions">
      <button
        type="button"
        class="confirm-modal__btn confirm-modal__btn--cancel"
        onclick={closeForceDeleteModal}>Abbrechen</button
      >
      <button
        type="button"
        class="confirm-modal__btn confirm-modal__btn--confirm"
        onclick={forceDeleteTeam}>Team löschen</button
      >
    </div>
  </div>
</div>
