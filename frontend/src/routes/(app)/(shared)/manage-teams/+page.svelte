<script lang="ts">
  /**
   * Manage Teams - Page Component
   * @module manage-teams/+page
   *
   * Level 3 SSR: $derived for SSR data, invalidateAll() after mutations.
   */
  import { invalidateAll } from '$app/navigation';

  import HighlightText from '$lib/components/HighlightText.svelte';
  import PermissionDenied from '$lib/components/PermissionDenied.svelte';
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
    fetchTeamAssets,
    assignTeamHall,
  } from './_lib/api';
  import { createMessages } from './_lib/constants';
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
    getAssetsBadge,
  } from './_lib/utils';

  import type { PageData } from './$types';
  import type {
    Team,
    Department,
    Admin,
    TeamMember,
    Asset,
    Hall,
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
  const allLeaders = $derived<Admin[]>(data.leaders);
  const allEmployees = $derived<TeamMember[]>(data.employees);
  const allAssets = $derived<Asset[]>(data.assets);
  const allHalls = $derived<Hall[]>(data.halls);

  // Hierarchy labels from layout data inheritance (A6)
  const labels = $derived(data.hierarchyLabels);
  const messages = $derived(createMessages(labels));

  // Lead-View: Employees can Read+Edit but NOT Create/Delete
  const canMutate = $derived(data.user?.role === 'root' || data.user?.role === 'admin');

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
  let formDeputyLeaderId = $state<number | null>(null);
  let formMemberIds = $state<number[]>([]);
  let formAssetIds = $state<number[]>([]);
  let formHallId = $state<number | null>(null);
  let formIsActive = $state<FormIsActiveStatus>(1);

  // Form Submit Loading
  let submitting = $state(false);

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const isEditMode = $derived(currentEditId !== null);
  const modalTitle = $derived(isEditMode ? messages.MODAL_TITLE_EDIT : messages.MODAL_TITLE_ADD);

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
    deputyLeaderId: number | null;
    memberIds: number[];
    assetIds: number[];
    hallId: number | null;
    isActive: FormIsActiveStatus;
  }): Promise<void> {
    submitting = true;

    try {
      const payload = buildTeamPayload({
        name: formData.name,
        description: formData.description,
        departmentId: formData.departmentId,
        leaderId: formData.leaderId,
        teamDeputyLeadId: formData.deputyLeaderId,
        isActive: formData.isActive,
      });

      const teamId = await apiSaveTeam(payload, currentEditId);

      if (teamId) {
        await updateTeamRelations(teamId, formData.memberIds, formData.assetIds, isEditMode);
        await assignTeamHall(teamId, formData.hallId);
      }

      closeTeamModal();
      // Level 3: Trigger SSR refetch
      await invalidateAll();
      showSuccessAlert(isEditMode ? messages.SUCCESS_UPDATED : messages.SUCCESS_CREATED);
    } catch (err: unknown) {
      log.error({ err }, 'Error saving team');
      showErrorAlert(err instanceof Error ? err.message : messages.ERROR_SAVING);
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
        showDeleteModal = false;
        // Only reset if unchanged during async operation
        if (deleteTeamId === teamId) deleteTeamId = null;
        // Level 3: Trigger SSR refetch
        await invalidateAll();
        showSuccessAlert(messages.SUCCESS_DELETED);
      } else if (result.hasMembers) {
        forceDeleteMemberCount = result.memberCount;
        showDeleteModal = false;
        showForceDeleteModal = true;
      }
    } catch (err: unknown) {
      log.error({ err }, 'Error deleting team');
      showErrorAlert(messages.ERROR_DELETING);
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
      showSuccessAlert(messages.SUCCESS_DELETED);
    } catch (err: unknown) {
      log.error({ err }, 'Error force deleting team');
      showErrorAlert(messages.ERROR_DELETING);
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
   * Open edit modal - fetches members and assets from separate endpoints
   * The /teams list endpoint only returns summary data (memberCount, memberNames)
   * but NOT the full members[] and assets[] arrays needed for form population.
   * Backend exposes separate endpoints: /teams/:id/members and /teams/:id/assets
   */
  async function openEditModal(teamId: number): Promise<void> {
    const team = allTeams.find((t) => t.id === teamId);
    if (!team) return;

    currentEditId = teamId;

    // Fetch members and assets from separate endpoints in parallel
    const [members, assets] = await Promise.all([
      fetchTeamMembers(teamId),
      fetchTeamAssets(teamId),
    ]);

    // Populate form from basic team data
    formName = team.name;
    formDescription = team.description ?? '';
    formDepartmentId = team.departmentId ?? null;
    formLeaderId = team.leaderId ?? null;
    formDeputyLeaderId = team.teamDeputyLeadId ?? null;
    formIsActive = (team.isActive === 4 ? 0 : team.isActive) as FormIsActiveStatus;

    // Set member and asset IDs from fetched data
    formMemberIds = members.map((m) => m.id);
    formAssetIds = assets.map((m) => m.id);
    formHallId = team.hallIds?.[0] ?? null;

    showTeamModal = true;
  }

  function openDeleteModal(teamId: number): void {
    deleteTeamId = teamId;
    showDeleteModal = true;
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
    formDeputyLeaderId = null;
    formMemberIds = defaults.memberIds;
    formAssetIds = defaults.assetIds;
    formHallId = null;
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
</script>

<svelte:head>
  <title>{messages.PAGE_TITLE} - Assixx</title>
</svelte:head>

{#if data.permissionDenied}
  <PermissionDenied addonName="die Teamverwaltung" />
{:else}
  <div class="container">
    <div class="card">
      <div class="card__header">
        <h2 class="card__title">
          <i class="fas fa-users-cog mr-2"></i>
          {messages.PAGE_TITLE}
        </h2>
        <p class="mt-2 text-(--color-text-secondary)">
          {messages.PAGE_DESCRIPTION}
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
              title={messages.FILTER_ACTIVE_TITLE}
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
              title={messages.FILTER_INACTIVE_TITLE}
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
              title={messages.FILTER_ARCHIVED_TITLE}
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
              title={messages.FILTER_ALL_TITLE}
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
                placeholder={messages.SEARCH_PLACEHOLDER}
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
                  {messages.SEARCH_NO_RESULTS} "{currentSearchQuery}"
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
            <i class="fas fa-exclamation-triangle mb-4 text-4xl text-(--color-danger)"></i>
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
            <h3 class="empty-state__title">{messages.NO_TEAMS_FOUND}</h3>
            <p class="empty-state__description">{messages.CREATE_FIRST_TEAM}</p>
            {#if canMutate}
              <button
                type="button"
                class="btn btn-primary"
                onclick={openAddModal}
              >
                <i class="fas fa-plus"></i>
                {messages.BTN_ADD}
              </button>
            {/if}
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
                    <th scope="col">ID</th>
                    <th scope="col">Name</th>
                    <th scope="col">{messages.TH_DEPARTMENT}</th>
                    <th scope="col">{labels.area}</th>
                    <th scope="col">Leiter</th>
                    <th scope="col">Mitglieder</th>
                    <th scope="col">{messages.TH_ASSETS}</th>
                    <th scope="col">{labels.hall}</th>
                    <th scope="col">Status</th>
                    <th scope="col">Erstellt am</th>
                    <th scope="col">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {#each filteredTeams as team (team.id)}
                    {@const deptBadge = getDepartmentBadge(team, allDepartments, labels)}
                    {@const membersBadge = getMembersBadge(team)}
                    {@const assetsBadge = getAssetsBadge(team, labels)}
                    <tr>
                      <td><code class="text-muted">{team.id}</code></td>
                      <td>
                        <div class="flex items-center gap-2">
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
                      <td>
                        {#if team.departmentAreaName}
                          <span
                            class="badge badge--info"
                            title={team.departmentAreaName}
                          >
                            <i class="fas fa-sitemap mr-1"></i>{team.departmentAreaName}
                          </span>
                        {:else}
                          <span
                            class="badge badge--secondary"
                            title="Keine Zuordnung">Keine Zuordnung</span
                          >
                        {/if}
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
                          class="badge {assetsBadge.class}"
                          title={assetsBadge.title}
                        >
                          <!-- eslint-disable-next-line svelte/no-at-html-tags -- Safe: internal badge, no user input -->
                          {@html assetsBadge.text}
                        </span>
                      </td>
                      <td>
                        {#if team.hallNames}
                          <span
                            class="badge badge--info"
                            title={team.hallNames}
                          >
                            {team.hallNames}
                          </span>
                        {:else}
                          <span class="badge badge--secondary">—</span>
                        {/if}
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
                            aria-label="Bearbeiten"
                            onclick={() => void openEditModal(team.id)}
                          >
                            <i class="fas fa-edit"></i>
                          </button>
                          {#if canMutate}
                            <button
                              type="button"
                              class="action-icon action-icon--delete"
                              title="Löschen"
                              aria-label="Löschen"
                              onclick={() => {
                                openDeleteModal(team.id);
                              }}
                            >
                              <i class="fas fa-trash"></i>
                            </button>
                          {/if}
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

  {#if canMutate}
    <!-- Floating Action Button (Root/Admin only) -->
    <button
      type="button"
      class="btn-float"
      onclick={openAddModal}
      aria-label="Hinzufügen"
    >
      <i class="fas fa-plus"></i>
    </button>
  {/if}

  <!-- Add/Edit Team Modal -->
  {#if showTeamModal}
    <TeamFormModal
      {isEditMode}
      {modalTitle}
      {labels}
      {formName}
      {formDescription}
      {formDepartmentId}
      {formLeaderId}
      {formDeputyLeaderId}
      {formMemberIds}
      {formAssetIds}
      {formHallId}
      {formIsActive}
      {allDepartments}
      {allLeaders}
      {allEmployees}
      {allAssets}
      {allHalls}
      {submitting}
      onclose={closeTeamModal}
      onsubmit={handleFormSubmit}
    />
  {/if}

  <!-- Delete Modals -->
  <TeamDeleteModals
    show={showDeleteModal}
    {showForceDeleteModal}
    {forceDeleteMemberCount}
    oncancel={closeDeleteModal}
    onconfirm={deleteTeam}
    oncloseForceDelete={closeForceDeleteModal}
    onforceDelete={forceDeleteTeam}
  />
{/if}
