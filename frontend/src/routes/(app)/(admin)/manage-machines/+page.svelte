<script lang="ts">
  /**
   * Manage Machines - Page Component
   * @module manage-machines/+page
   *
   * Level 3 SSR: $derived for SSR data, invalidateAll() after mutations.
   * Note: Uses external state store for UI state (forms, modals, dropdowns).
   */
  import { goto, invalidateAll } from '$app/navigation';
  import { resolve } from '$app/paths';

  import HighlightText from '$lib/components/HighlightText.svelte';
  import {
    MACHINE_AVAILABILITY_LABELS,
    MACHINE_AVAILABILITY_BADGE_CLASSES,
  } from '$lib/machine-availability/constants';
  import MachineAvailabilityModal from '$lib/machine-availability/MachineAvailabilityModal.svelte';
  import { showSuccessAlert, showErrorAlert } from '$lib/stores/toast';
  import { createLogger } from '$lib/utils/logger';

  const log = createLogger('ManageMachinesPage');

  // Import from _lib/ modules
  import {
    getMachineTeams as apiGetMachineTeams,
    setMachineTeams as apiSetMachineTeams,
    saveMachine as apiSaveMachine,
    deleteMachine as apiDeleteMachine,
    updateMachineAvailability as apiUpdateMachineAvailability,
  } from './_lib/api';
  import { MESSAGES } from './_lib/constants';
  import DeleteModals from './_lib/DeleteModals.svelte';
  import { applyAllFilters } from './_lib/filters';
  import MachineFormModal from './_lib/MachineFormModal.svelte';
  import { machineState } from './_lib/state.svelte';
  import {
    getEmptyStateTitle,
    getEmptyStateDescription,
    buildMachineFormData,
    populateFormFromMachine,
    getTeamsBadgeData,
    getAreaBadgeData,
    getDepartmentBadgeData,
  } from './_lib/utils';

  import type { MachineAvailabilityStatus } from '$lib/machine-availability/constants';
  import type { PageData } from './$types';
  import type { Machine, MachineStatusFilter } from './_lib/types';

  // =============================================================================
  // SSR DATA - Level 3: $derived from props (single source of truth)
  // =============================================================================

  const { data }: { data: PageData } = $props();

  // SSR data via $derived - updates when invalidateAll() is called
  const allMachines = $derived<Machine[]>(data.machines);

  // Sync SSR data to state store for child components (departments, areas, teams)
  $effect(() => {
    machineState.setDepartments(data.departments);
    machineState.setAreas(data.areas);
    machineState.setTeams(data.teams);
  });

  // Sync machines to state store for openEditModal
  $effect(() => {
    machineState.setMachines(allMachines);
  });

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  // Derived: Filtered machines based on current filter/search state
  const filteredMachines = $derived(
    applyAllFilters(
      allMachines,
      machineState.currentStatusFilter,
      machineState.currentSearchQuery,
    ),
  );

  const emptyStateTitle = $derived(
    getEmptyStateTitle(machineState.currentStatusFilter),
  );
  const emptyStateDescription = $derived(
    getEmptyStateDescription(machineState.currentStatusFilter),
  );

  // Sync filtered machines to state store for search results dropdown
  $effect(() => {
    machineState.setFilteredMachines(filteredMachines);
  });

  // =============================================================================
  // API FUNCTIONS - Level 3: invalidateAll() after mutations
  // =============================================================================

  async function saveMachine() {
    machineState.setSubmitting(true);

    try {
      if (!machineState.formName.trim()) {
        showErrorAlert(MESSAGES.ERROR_NAME_REQUIRED);
        machineState.setSubmitting(false);
        return;
      }

      const formData = buildMachineFormData({
        name: machineState.formName,
        model: machineState.formModel,
        manufacturer: machineState.formManufacturer,
        serialNumber: machineState.formSerialNumber,
        departmentId: machineState.formDepartmentId,
        areaId: machineState.formAreaId,
        machineType: machineState.formMachineType,
        status: machineState.formStatus,
        operatingHours: machineState.formOperatingHours,
        nextMaintenance: machineState.formNextMaintenance,
      });

      const savedId = await apiSaveMachine(
        formData,
        machineState.currentEditId,
      );

      const teamsChanged =
        machineState.formTeamIds.length !==
          machineState.currentMachineTeamIds.length ||
        machineState.formTeamIds.some(
          (id) => !machineState.currentMachineTeamIds.includes(id),
        );

      if (teamsChanged) {
        await apiSetMachineTeams(savedId, machineState.formTeamIds);
      }

      showSuccessAlert(
        machineState.isEditMode ?
          MESSAGES.SUCCESS_UPDATED
        : MESSAGES.SUCCESS_CREATED,
      );
      machineState.closeMachineModal();
      // Level 3: Trigger SSR refetch
      await invalidateAll();
    } catch (err) {
      log.error({ err }, 'Error saving machine');
      showErrorAlert(
        err instanceof Error ? err.message : MESSAGES.ERROR_SAVE_FAILED,
      );
    } finally {
      machineState.setSubmitting(false);
    }
  }

  async function deleteMachine() {
    if (machineState.deleteMachineId === null) return;

    try {
      await apiDeleteMachine(machineState.deleteMachineId);
      showSuccessAlert(MESSAGES.SUCCESS_DELETED);
      machineState.closeDeleteConfirmModal();
      // Level 3: Trigger SSR refetch
      await invalidateAll();
    } catch (err) {
      log.error({ err }, 'Error deleting machine');
      showErrorAlert(MESSAGES.ERROR_DELETE_FAILED);
    }
  }

  // =============================================================================
  // MODAL HANDLERS
  // =============================================================================

  function openAddModal() {
    machineState.setCurrentEditId(null);
    machineState.resetForm();
    machineState.openMachineModal();
  }

  async function openEditModal(machineId: number) {
    const machine = machineState.allMachines.find((m) => m.id === machineId);
    if (!machine) return;

    machineState.setCurrentEditId(machineId);
    const formState = populateFormFromMachine(machine);

    machineState.setFormName(formState.name);
    machineState.setFormModel(formState.model);
    machineState.setFormManufacturer(formState.manufacturer);
    machineState.setFormSerialNumber(formState.serialNumber);
    machineState.setFormMachineType(formState.machineType);
    machineState.setFormStatus(formState.status);
    machineState.setFormOperatingHours(formState.operatingHours);
    machineState.setFormNextMaintenance(formState.nextMaintenance);
    machineState.setFormAreaId(formState.areaId);
    machineState.setFormDepartmentId(formState.departmentId);

    const machineTeams = await apiGetMachineTeams(machineId);
    const teamIds = machineTeams.map((t) => t.teamId);
    machineState.setFormTeamIds(teamIds);
    machineState.setCurrentMachineTeamIds([...teamIds]);

    machineState.openMachineModal();
  }

  // =============================================================================
  // STATUS TOGGLE HANDLER
  // =============================================================================

  function handleStatusToggle(status: MachineStatusFilter) {
    machineState.setCurrentStatusFilter(status);
    // filteredMachines is $derived - automatically updates when filter changes
  }

  // =============================================================================
  // SEARCH HANDLERS
  // =============================================================================

  function handleSearchInput(e: Event) {
    const input = e.target as HTMLInputElement;
    machineState.setCurrentSearchQuery(input.value);
    machineState.setSearchOpen(input.value.trim().length > 0);
    // filteredMachines is $derived - automatically updates when search changes
  }

  function clearSearch() {
    machineState.setCurrentSearchQuery('');
    machineState.setSearchOpen(false);
    // filteredMachines is $derived - automatically updates
  }

  function handleSearchResultClick(machineId: number) {
    void openEditModal(machineId);
    machineState.setSearchOpen(false);
    machineState.setCurrentSearchQuery('');
  }

  // =============================================================================
  // FORM SUBMIT HANDLER
  // =============================================================================

  function handleFormSubmit(e: Event) {
    e.preventDefault();
    void saveMachine();
  }

  // =============================================================================
  // MACHINE AVAILABILITY STATE & HANDLERS
  // =============================================================================

  let showAvailabilityModal = $state(false);
  let availabilityMachine = $state<{ name: string; uuid: string } | null>(null);
  let availabilitySubmitting = $state(false);
  let availabilityStatus = $state<MachineAvailabilityStatus>('maintenance');
  let availabilityStart = $state('');
  let availabilityEnd = $state('');
  let availabilityReason = $state('');
  let availabilityNotes = $state('');

  function openAvailabilityModal(machine: {
    name: string;
    uuid: string;
  }): void {
    availabilityMachine = machine;
    availabilityStatus = 'maintenance';
    availabilityStart = '';
    availabilityEnd = '';
    availabilityReason = '';
    availabilityNotes = '';
    showAvailabilityModal = true;
  }

  function closeAvailabilityModal(): void {
    showAvailabilityModal = false;
    availabilityMachine = null;
  }

  function navigateToAvailabilityHistory(uuid: string): void {
    closeAvailabilityModal();
    void goto(
      resolve('/(app)/(admin)/manage-machines/availability/[uuid]', { uuid }),
    );
  }

  /** Validate availability form, returns error message or null */
  function validateAvailabilityForm(): string | null {
    if (availabilityStatus === 'operational') return null;
    if (availabilityStart === '' || availabilityEnd === '') {
      return 'Start- und Enddatum sind erforderlich';
    }
    if (availabilityEnd < availabilityStart) {
      return 'Bis-Datum muss nach oder gleich Von-Datum sein';
    }
    return null;
  }

  async function saveAvailability(): Promise<void> {
    if (availabilityMachine === null) return;

    const validationError = validateAvailabilityForm();
    if (validationError !== null) {
      showErrorAlert(validationError);
      return;
    }

    availabilitySubmitting = true;
    try {
      await apiUpdateMachineAvailability(availabilityMachine.uuid, {
        availabilityStatus,
        ...(availabilityStart !== '' && { availabilityStart }),
        ...(availabilityEnd !== '' && { availabilityEnd }),
        ...(availabilityReason !== '' && { availabilityReason }),
        ...(availabilityNotes !== '' && { availabilityNotes }),
      });
      showSuccessAlert('Maschinenverfügbarkeit aktualisiert');
      closeAvailabilityModal();
      await invalidateAll();
    } catch (err) {
      log.error({ err }, 'Error saving machine availability');
      const errorMsg =
        err instanceof Error ? err.message : 'Fehler beim Speichern';
      showErrorAlert(errorMsg);
    } finally {
      availabilitySubmitting = false;
    }
  }

  // =============================================================================
  // OUTSIDE CLICK HANDLERS
  // =============================================================================

  // Dropdown configuration for outside click handling
  const dropdownConfigs = [
    {
      isOpen: () => machineState.departmentDropdownOpen,
      selector: '#department-dropdown',
      close: () => {
        machineState.setDepartmentDropdownOpen(false);
      },
    },
    {
      isOpen: () => machineState.areaDropdownOpen,
      selector: '#area-dropdown',
      close: () => {
        machineState.setAreaDropdownOpen(false);
      },
    },
    {
      isOpen: () => machineState.typeDropdownOpen,
      selector: '#type-dropdown',
      close: () => {
        machineState.setTypeDropdownOpen(false);
      },
    },
    {
      isOpen: () => machineState.teamsDropdownOpen,
      selector: '#teams-dropdown',
      close: () => {
        machineState.setTeamsDropdownOpen(false);
      },
    },
    {
      isOpen: () => machineState.searchOpen,
      selector: '.search-input-wrapper',
      close: () => {
        machineState.setSearchOpen(false);
      },
    },
  ];

  function isAnyDropdownOpen(): boolean {
    return dropdownConfigs.some((config) => config.isOpen());
  }

  function handleOutsideClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    for (const config of dropdownConfigs) {
      if (!config.isOpen()) continue;
      const el = document.querySelector(config.selector);
      if (el !== null && !el.contains(target)) config.close();
    }
  }

  $effect(() => {
    if (isAnyDropdownOpen()) {
      document.addEventListener('click', handleOutsideClick, true);
      return () => {
        document.removeEventListener('click', handleOutsideClick, true);
      };
    }
  });

  // =============================================================================
  // ESCAPE KEY HANDLER
  // =============================================================================

  /** Format ISO date string to German locale (dd.mm.yyyy) */
  function formatDate(isoDate: string): string {
    const [year, month, day] = isoDate.split('-');
    return `${day}.${month}.${year}`;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (showAvailabilityModal) closeAvailabilityModal();
      else if (machineState.showDeleteConfirmModal)
        machineState.closeDeleteConfirmModal();
      else if (machineState.showDeleteModal) machineState.closeDeleteModal();
      else if (machineState.showMachineModal) machineState.closeMachineModal();
    }
  }
</script>

<svelte:head>
  <title>{MESSAGES.PAGE_TITLE}</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="container">
  <div class="card">
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-cogs mr-2"></i>
        {MESSAGES.PAGE_HEADING}
      </h2>
      <p class="mt-2 text-(--color-text-secondary)">
        {MESSAGES.PAGE_DESCRIPTION}
      </p>

      <div class="alert alert--info alert--sm mt-4">
        <div class="alert__icon"><i class="fas fa-info-circle"></i></div>
        <div class="alert__content">
          <div class="alert__message">
            TPM-Wartungspläne werden hier nicht angezeigt. Diese Übersicht dient
            primär für außerordentliche Zustände wie ungeplante Reparaturen oder
            Stillstände.
          </div>
        </div>
      </div>

      <div class="mt-6 flex items-center justify-between gap-4">
        <!-- Status Toggle Group -->
        <div
          class="toggle-group"
          id="machine-status-toggle"
        >
          <button
            type="button"
            class="toggle-group__btn"
            class:active={machineState.currentStatusFilter === 'all'}
            onclick={() => {
              handleStatusToggle('all');
            }}
          >
            <i class="fas fa-list"></i>
            {MESSAGES.FILTER_ALL}
          </button>
          <button
            type="button"
            class="toggle-group__btn"
            class:active={machineState.currentStatusFilter === 'operational'}
            onclick={() => {
              handleStatusToggle('operational');
            }}
          >
            <i class="fas fa-check-circle"></i>
            {MESSAGES.FILTER_OPERATIONAL}
          </button>
          <button
            type="button"
            class="toggle-group__btn"
            class:active={machineState.currentStatusFilter === 'maintenance'}
            onclick={() => {
              handleStatusToggle('maintenance');
            }}
          >
            <i class="fas fa-wrench"></i>
            {MESSAGES.FILTER_MAINTENANCE}
          </button>
          <button
            type="button"
            class="toggle-group__btn"
            class:active={machineState.currentStatusFilter === 'repair'}
            onclick={() => {
              handleStatusToggle('repair');
            }}
          >
            <i class="fas fa-tools"></i>
            {MESSAGES.FILTER_REPAIR}
          </button>
          <button
            type="button"
            class="toggle-group__btn"
            class:active={machineState.currentStatusFilter === 'standby'}
            onclick={() => {
              handleStatusToggle('standby');
            }}
          >
            <i class="fas fa-pause-circle"></i>
            {MESSAGES.FILTER_STANDBY}
          </button>
          <button
            type="button"
            class="toggle-group__btn"
            class:active={machineState.currentStatusFilter === 'cleaning'}
            onclick={() => {
              handleStatusToggle('cleaning');
            }}
          >
            <i class="fas fa-broom"></i>
            {MESSAGES.FILTER_CLEANING}
          </button>
          <button
            type="button"
            class="toggle-group__btn"
            class:active={machineState.currentStatusFilter === 'other'}
            onclick={() => {
              handleStatusToggle('other');
            }}
          >
            <i class="fas fa-clock"></i>
            {MESSAGES.FILTER_OTHER}
          </button>
        </div>

        <!-- Search Input -->
        <div
          class="search-input-wrapper max-w-80"
          class:search-input-wrapper--open={machineState.searchOpen}
        >
          <div
            class="search-input"
            id="machine-search-container"
          >
            <i class="search-input__icon fas fa-search"></i>
            <input
              type="search"
              id="machine-search"
              class="search-input__field"
              placeholder={MESSAGES.SEARCH_PLACEHOLDER}
              autocomplete="off"
              value={machineState.currentSearchQuery}
              oninput={handleSearchInput}
            />
            <button
              class="search-input__clear"
              class:search-input__clear--visible={machineState
                .currentSearchQuery.length > 0}
              type="button"
              aria-label="Suche löschen"
              onclick={clearSearch}
            >
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div
            class="search-input__results"
            id="machine-search-results"
          >
            {#if machineState.currentSearchQuery && filteredMachines.length === 0}
              <div class="search-input__no-results">
                {MESSAGES.SEARCH_NO_RESULTS}
              </div>
            {:else if machineState.currentSearchQuery}
              {#each filteredMachines.slice(0, 5) as machine (machine.id)}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="search-input__result-item"
                  onclick={() => {
                    handleSearchResultClick(machine.id);
                  }}
                >
                  <div class="flex flex-col gap-1">
                    <div class="font-medium text-(--color-text-primary)">
                      <HighlightText
                        text={machine.name}
                        query={machineState.currentSearchQuery}
                      />
                    </div>
                    <div class="text-[0.813rem] text-(--color-text-secondary)">
                      <HighlightText
                        text={machine.model ?? ''}
                        query={machineState.currentSearchQuery}
                      />
                      {#if machine.manufacturer}
                        ·
                        <HighlightText
                          text={machine.manufacturer}
                          query={machineState.currentSearchQuery}
                        />
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
              {#if filteredMachines.length > 5}
                <div
                  class="search-input__result-item border-t border-white/5 text-center text-[0.813rem] text-(--color-primary)"
                >
                  {filteredMachines.length - 5} weitere Ergebnisse in Tabelle
                </div>
              {/if}
            {/if}
          </div>
        </div>
      </div>
    </div>

    <div class="card__body">
      {#if machineState.error}
        <div class="p-6 text-center">
          <i
            class="fas fa-exclamation-triangle mb-4 text-4xl text-(--color-danger)"
          ></i>
          <p class="text-(--color-text-secondary)">{machineState.error}</p>
          <button
            type="button"
            class="btn btn-primary mt-4"
            onclick={() => invalidateAll()}
          >
            {MESSAGES.BTN_RETRY}
          </button>
        </div>
      {:else if filteredMachines.length === 0}
        <div
          id="machines-empty"
          class="empty-state"
        >
          <div class="empty-state__icon"><i class="fas fa-cogs"></i></div>
          <h3 class="empty-state__title">{emptyStateTitle}</h3>
          <p class="empty-state__description">{emptyStateDescription}</p>
          {#if machineState.currentStatusFilter === 'all'}
            <button
              type="button"
              class="btn btn-primary"
              onclick={openAddModal}
            >
              <i class="fas fa-plus"></i>
              {MESSAGES.BTN_ADD_MACHINE}
            </button>
          {/if}
        </div>
      {:else}
        <div id="machines-table-content">
          <div class="table-responsive">
            <table
              class="data-table data-table--hover data-table--striped"
              id="machines-table"
            >
              <thead>
                <tr>
                  <th scope="col">{MESSAGES.TH_ID}</th>
                  <th scope="col">{MESSAGES.TH_NAME}</th>
                  <th scope="col">{MESSAGES.TH_MODEL}</th>
                  <th scope="col">{MESSAGES.TH_MANUFACTURER}</th>
                  <th scope="col">{MESSAGES.TH_AREA}</th>
                  <th scope="col">{MESSAGES.TH_DEPARTMENT}</th>
                  <th scope="col">{MESSAGES.TH_TEAMS}</th>
                  <th scope="col">{MESSAGES.TH_NEXT_ABSENCE}</th>
                  <th scope="col">{MESSAGES.TH_ACTIONS}</th>
                </tr>
              </thead>
              <tbody>
                {#each filteredMachines as machine (machine.id)}
                  {@const areaBadge = getAreaBadgeData(machine.areaName)}
                  {@const deptBadge = getDepartmentBadgeData(
                    machine.departmentName,
                  )}
                  {@const teamsBadge = getTeamsBadgeData(machine.teams)}
                  <tr>
                    <td><code class="text-muted">{machine.id}</code></td>
                    <td><strong>{machine.name}</strong></td>
                    <td>{machine.model ?? '-'}</td>
                    <td>{machine.manufacturer ?? '-'}</td>
                    <td>
                      <span
                        class="badge {areaBadge.class}"
                        title={areaBadge.tooltip}
                      >
                        {areaBadge.text}
                      </span>
                    </td>
                    <td>
                      <span
                        class="badge {deptBadge.class}"
                        title={deptBadge.tooltip}
                      >
                        {deptBadge.text}
                      </span>
                    </td>
                    <td>
                      <span
                        class="badge {teamsBadge.class}"
                        title={teamsBadge.tooltip}
                      >
                        {teamsBadge.text}
                      </span>
                    </td>
                    <td>
                      {#if machine.availabilityStatus !== undefined && machine.availabilityStatus !== 'operational' && machine.availabilityStart !== undefined}
                        {@const statusKey =
                          machine.availabilityStatus as MachineAvailabilityStatus}
                        <span
                          class="badge {MACHINE_AVAILABILITY_BADGE_CLASSES[
                            statusKey
                          ]}"
                          title={machine.availabilityNotes ?? ''}
                        >
                          {formatDate(machine.availabilityStart)}
                          – {MACHINE_AVAILABILITY_LABELS[statusKey]}
                        </span>
                      {:else}
                        <span class="text-(--color-text-tertiary)">–</span>
                      {/if}
                    </td>
                    <td>
                      <div class="flex gap-2">
                        <button
                          type="button"
                          class="action-icon action-icon--info"
                          title="Verfügbarkeit"
                          aria-label="Maschinenverfügbarkeit bearbeiten"
                          onclick={() => {
                            openAvailabilityModal({
                              name: machine.name,
                              uuid: machine.uuid,
                            });
                          }}
                        >
                          <i class="fas fa-calendar-alt"></i>
                        </button>
                        <button
                          type="button"
                          class="action-icon action-icon--edit"
                          title="Bearbeiten"
                          aria-label="Maschine bearbeiten"
                          onclick={() => openEditModal(machine.id)}
                        >
                          <i class="fas fa-edit"></i>
                        </button>
                        <button
                          type="button"
                          class="action-icon action-icon--delete"
                          title="Löschen"
                          aria-label="Maschine löschen"
                          onclick={() => {
                            machineState.openDeleteModal(machine.id);
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
  class="btn-float add-machine-btn"
  onclick={openAddModal}
  aria-label="Maschine hinzufügen"
>
  <i class="fas fa-plus"></i>
</button>

<!-- Modal Components -->
<MachineFormModal
  onsubmit={handleFormSubmit}
  onclose={() => {
    machineState.closeMachineModal();
  }}
/>
<DeleteModals ondelete={deleteMachine} />

<!-- Machine Availability Modal -->
<MachineAvailabilityModal
  show={showAvailabilityModal}
  machine={availabilityMachine}
  submitting={availabilitySubmitting}
  bind:availabilityStatus
  bind:availabilityStart
  bind:availabilityEnd
  bind:availabilityReason
  bind:availabilityNotes
  onclose={closeAvailabilityModal}
  onsave={() => {
    void saveAvailability();
  }}
  onmanage={navigateToAvailabilityHistory}
/>
