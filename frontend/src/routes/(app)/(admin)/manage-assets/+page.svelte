<script lang="ts">
  /**
   * Manage Assets - Page Component
   * @module manage-assets/+page
   *
   * Level 3 SSR: $derived for SSR data, invalidateAll() after mutations.
   * Note: Uses external state store for UI state (forms, modals, dropdowns).
   */
  import { goto, invalidateAll } from '$app/navigation';
  import { resolve } from '$app/paths';

  import AssetAvailabilityModal from '$lib/asset-availability/AssetAvailabilityModal.svelte';
  import {
    MACHINE_AVAILABILITY_LABELS,
    MACHINE_AVAILABILITY_BADGE_CLASSES,
  } from '$lib/asset-availability/constants';
  import HighlightText from '$lib/components/HighlightText.svelte';
  import { showSuccessAlert, showErrorAlert } from '$lib/stores/toast';
  import { createLogger } from '$lib/utils/logger';

  const log = createLogger('ManageAssetsPage');

  // Import from _lib/ modules
  import {
    getAssetTeams as apiGetAssetTeams,
    setAssetTeams as apiSetAssetTeams,
    saveAsset as apiSaveAsset,
    deleteAsset as apiDeleteAsset,
    updateAssetAvailability as apiUpdateAssetAvailability,
  } from './_lib/api';
  import AssetFormModal from './_lib/AssetFormModal.svelte';
  import { MESSAGES } from './_lib/constants';
  import DeleteModals from './_lib/DeleteModals.svelte';
  import { applyAllFilters } from './_lib/filters';
  import { assetState } from './_lib/state.svelte';
  import {
    getEmptyStateTitle,
    getEmptyStateDescription,
    buildAssetFormData,
    populateFormFromAsset,
    getTeamsBadgeData,
    getAreaBadgeData,
    getDepartmentBadgeData,
  } from './_lib/utils';

  import type { AssetAvailabilityStatus } from '$lib/asset-availability/constants';
  import type { PageData } from './$types';
  import type { Asset, AssetStatusFilter } from './_lib/types';

  // =============================================================================
  // SSR DATA - Level 3: $derived from props (single source of truth)
  // =============================================================================

  const { data }: { data: PageData } = $props();

  // SSR data via $derived - updates when invalidateAll() is called
  const allAssets = $derived<Asset[]>(data.assets);

  // Sync SSR data to state store for child components (departments, areas, teams)
  $effect(() => {
    assetState.setDepartments(data.departments);
    assetState.setAreas(data.areas);
    assetState.setTeams(data.teams);
  });

  // Sync assets to state store for openEditModal
  $effect(() => {
    assetState.setAssets(allAssets);
  });

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  // Derived: Filtered assets based on current filter/search state
  const filteredAssets = $derived(
    applyAllFilters(
      allAssets,
      assetState.currentStatusFilter,
      assetState.currentSearchQuery,
    ),
  );

  const emptyStateTitle = $derived(
    getEmptyStateTitle(assetState.currentStatusFilter),
  );
  const emptyStateDescription = $derived(
    getEmptyStateDescription(assetState.currentStatusFilter),
  );

  // Sync filtered assets to state store for search results dropdown
  $effect(() => {
    assetState.setFilteredAssets(filteredAssets);
  });

  // =============================================================================
  // API FUNCTIONS - Level 3: invalidateAll() after mutations
  // =============================================================================

  async function saveAsset() {
    assetState.setSubmitting(true);

    try {
      if (!assetState.formName.trim()) {
        showErrorAlert(MESSAGES.ERROR_NAME_REQUIRED);
        assetState.setSubmitting(false);
        return;
      }

      const formData = buildAssetFormData({
        name: assetState.formName,
        model: assetState.formModel,
        manufacturer: assetState.formManufacturer,
        serialNumber: assetState.formSerialNumber,
        departmentId: assetState.formDepartmentId,
        areaId: assetState.formAreaId,
        assetType: assetState.formAssetType,
        status: assetState.formStatus,
        operatingHours: assetState.formOperatingHours,
        nextMaintenance: assetState.formNextMaintenance,
      });

      const savedId = await apiSaveAsset(formData, assetState.currentEditId);

      const teamsChanged =
        assetState.formTeamIds.length !==
          assetState.currentAssetTeamIds.length ||
        assetState.formTeamIds.some(
          (id) => !assetState.currentAssetTeamIds.includes(id),
        );

      if (teamsChanged) {
        await apiSetAssetTeams(savedId, assetState.formTeamIds);
      }

      showSuccessAlert(
        assetState.isEditMode ?
          MESSAGES.SUCCESS_UPDATED
        : MESSAGES.SUCCESS_CREATED,
      );
      assetState.closeAssetModal();
      // Level 3: Trigger SSR refetch
      await invalidateAll();
    } catch (err: unknown) {
      log.error({ err }, 'Error saving asset');
      showErrorAlert(
        err instanceof Error ? err.message : MESSAGES.ERROR_SAVE_FAILED,
      );
    } finally {
      assetState.setSubmitting(false);
    }
  }

  async function deleteAsset() {
    if (assetState.deleteAssetId === null) return;

    try {
      await apiDeleteAsset(assetState.deleteAssetId);
      showSuccessAlert(MESSAGES.SUCCESS_DELETED);
      assetState.closeDeleteModal();
      // Level 3: Trigger SSR refetch
      await invalidateAll();
    } catch (err: unknown) {
      log.error({ err }, 'Error deleting asset');
      showErrorAlert(MESSAGES.ERROR_DELETE_FAILED);
    }
  }

  // =============================================================================
  // MODAL HANDLERS
  // =============================================================================

  function openAddModal() {
    assetState.setCurrentEditId(null);
    assetState.resetForm();
    assetState.openAssetModal();
  }

  async function openEditModal(assetId: number) {
    const asset = assetState.allAssets.find((m) => m.id === assetId);
    if (!asset) return;

    assetState.setCurrentEditId(assetId);
    const formState = populateFormFromAsset(asset);

    assetState.setFormName(formState.name);
    assetState.setFormModel(formState.model);
    assetState.setFormManufacturer(formState.manufacturer);
    assetState.setFormSerialNumber(formState.serialNumber);
    assetState.setFormAssetType(formState.assetType);
    assetState.setFormStatus(formState.status);
    assetState.setFormOperatingHours(formState.operatingHours);
    assetState.setFormNextMaintenance(formState.nextMaintenance);
    assetState.setFormAreaId(formState.areaId);
    assetState.setFormDepartmentId(formState.departmentId);

    const assetTeams = await apiGetAssetTeams(assetId);
    const teamIds = assetTeams.map((t) => t.teamId);
    assetState.setFormTeamIds(teamIds);
    assetState.setCurrentAssetTeamIds([...teamIds]);

    assetState.openAssetModal();
  }

  // =============================================================================
  // STATUS TOGGLE HANDLER
  // =============================================================================

  function handleStatusToggle(status: AssetStatusFilter) {
    assetState.setCurrentStatusFilter(status);
    // filteredAssets is $derived - automatically updates when filter changes
  }

  // =============================================================================
  // SEARCH HANDLERS
  // =============================================================================

  function handleSearchInput(e: Event) {
    const input = e.target as HTMLInputElement;
    assetState.setCurrentSearchQuery(input.value);
    assetState.setSearchOpen(input.value.trim().length > 0);
    // filteredAssets is $derived - automatically updates when search changes
  }

  function clearSearch() {
    assetState.setCurrentSearchQuery('');
    assetState.setSearchOpen(false);
    // filteredAssets is $derived - automatically updates
  }

  function handleSearchResultClick(assetId: number) {
    void openEditModal(assetId);
    assetState.setSearchOpen(false);
    assetState.setCurrentSearchQuery('');
  }

  // =============================================================================
  // FORM SUBMIT HANDLER
  // =============================================================================

  function handleFormSubmit(e: Event) {
    e.preventDefault();
    void saveAsset();
  }

  // =============================================================================
  // MACHINE AVAILABILITY STATE & HANDLERS
  // =============================================================================

  let showAvailabilityModal = $state(false);
  let availabilityAsset = $state<{ name: string; uuid: string } | null>(null);
  let availabilitySubmitting = $state(false);
  let availabilityStatus = $state<AssetAvailabilityStatus>('maintenance');
  let availabilityStart = $state('');
  let availabilityEnd = $state('');
  let availabilityReason = $state('');
  let availabilityNotes = $state('');

  function openAvailabilityModal(asset: { name: string; uuid: string }): void {
    availabilityAsset = asset;
    availabilityStatus = 'maintenance';
    availabilityStart = '';
    availabilityEnd = '';
    availabilityReason = '';
    availabilityNotes = '';
    showAvailabilityModal = true;
  }

  function closeAvailabilityModal(): void {
    showAvailabilityModal = false;
    availabilityAsset = null;
  }

  function navigateToAvailabilityHistory(uuid: string): void {
    closeAvailabilityModal();
    void goto(
      resolve('/(app)/(admin)/manage-assets/availability/[uuid]', { uuid }),
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
    if (availabilityAsset === null) return;

    const validationError = validateAvailabilityForm();
    if (validationError !== null) {
      showErrorAlert(validationError);
      return;
    }

    availabilitySubmitting = true;
    try {
      await apiUpdateAssetAvailability(availabilityAsset.uuid, {
        availabilityStatus,
        ...(availabilityStart !== '' && { availabilityStart }),
        ...(availabilityEnd !== '' && { availabilityEnd }),
        ...(availabilityReason !== '' && { availabilityReason }),
        ...(availabilityNotes !== '' && { availabilityNotes }),
      });
      showSuccessAlert('Anlagenverfügbarkeit aktualisiert');
      closeAvailabilityModal();
      await invalidateAll();
    } catch (err: unknown) {
      log.error({ err }, 'Error saving asset availability');
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
      isOpen: () => assetState.departmentDropdownOpen,
      selector: '#department-dropdown',
      close: () => {
        assetState.setDepartmentDropdownOpen(false);
      },
    },
    {
      isOpen: () => assetState.areaDropdownOpen,
      selector: '#area-dropdown',
      close: () => {
        assetState.setAreaDropdownOpen(false);
      },
    },
    {
      isOpen: () => assetState.typeDropdownOpen,
      selector: '#type-dropdown',
      close: () => {
        assetState.setTypeDropdownOpen(false);
      },
    },
    {
      isOpen: () => assetState.teamsDropdownOpen,
      selector: '#teams-dropdown',
      close: () => {
        assetState.setTeamsDropdownOpen(false);
      },
    },
    {
      isOpen: () => assetState.searchOpen,
      selector: '.search-input-wrapper',
      close: () => {
        assetState.setSearchOpen(false);
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
      else if (assetState.showDeleteModal) assetState.closeDeleteModal();
      else if (assetState.showAssetModal) assetState.closeAssetModal();
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
          id="asset-status-toggle"
        >
          <button
            type="button"
            class="toggle-group__btn"
            class:active={assetState.currentStatusFilter === 'all'}
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
            class:active={assetState.currentStatusFilter === 'operational'}
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
            class:active={assetState.currentStatusFilter === 'maintenance'}
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
            class:active={assetState.currentStatusFilter === 'repair'}
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
            class:active={assetState.currentStatusFilter === 'standby'}
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
            class:active={assetState.currentStatusFilter === 'cleaning'}
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
            class:active={assetState.currentStatusFilter === 'other'}
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
          class:search-input-wrapper--open={assetState.searchOpen}
        >
          <div
            class="search-input"
            id="asset-search-container"
          >
            <i class="search-input__icon fas fa-search"></i>
            <input
              type="search"
              id="asset-search"
              class="search-input__field"
              placeholder={MESSAGES.SEARCH_PLACEHOLDER}
              autocomplete="off"
              value={assetState.currentSearchQuery}
              oninput={handleSearchInput}
            />
            <button
              class="search-input__clear"
              class:search-input__clear--visible={assetState.currentSearchQuery
                .length > 0}
              type="button"
              aria-label="Suche löschen"
              onclick={clearSearch}
            >
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div
            class="search-input__results"
            id="asset-search-results"
          >
            {#if assetState.currentSearchQuery && filteredAssets.length === 0}
              <div class="search-input__no-results">
                {MESSAGES.SEARCH_NO_RESULTS}
              </div>
            {:else if assetState.currentSearchQuery}
              {#each filteredAssets.slice(0, 5) as asset (asset.id)}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="search-input__result-item"
                  onclick={() => {
                    handleSearchResultClick(asset.id);
                  }}
                >
                  <div class="flex flex-col gap-1">
                    <div class="font-medium text-(--color-text-primary)">
                      <HighlightText
                        text={asset.name}
                        query={assetState.currentSearchQuery}
                      />
                    </div>
                    <div class="text-[0.813rem] text-(--color-text-secondary)">
                      <HighlightText
                        text={asset.model ?? ''}
                        query={assetState.currentSearchQuery}
                      />
                      {#if asset.manufacturer}
                        ·
                        <HighlightText
                          text={asset.manufacturer}
                          query={assetState.currentSearchQuery}
                        />
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
              {#if filteredAssets.length > 5}
                <div
                  class="search-input__result-item border-t border-white/5 text-center text-[0.813rem] text-(--color-primary)"
                >
                  {filteredAssets.length - 5} weitere Ergebnisse in Tabelle
                </div>
              {/if}
            {/if}
          </div>
        </div>
      </div>
    </div>

    <div class="card__body">
      {#if assetState.error}
        <div class="p-6 text-center">
          <i
            class="fas fa-exclamation-triangle mb-4 text-4xl text-(--color-danger)"
          ></i>
          <p class="text-(--color-text-secondary)">{assetState.error}</p>
          <button
            type="button"
            class="btn btn-primary mt-4"
            onclick={() => invalidateAll()}
          >
            {MESSAGES.BTN_RETRY}
          </button>
        </div>
      {:else if filteredAssets.length === 0}
        <div
          id="assets-empty"
          class="empty-state"
        >
          <div class="empty-state__icon"><i class="fas fa-cogs"></i></div>
          <h3 class="empty-state__title">{emptyStateTitle}</h3>
          <p class="empty-state__description">{emptyStateDescription}</p>
          {#if assetState.currentStatusFilter === 'all'}
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
        <div id="assets-table-content">
          <div class="table-responsive">
            <table
              class="data-table data-table--hover data-table--striped"
              id="assets-table"
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
                {#each filteredAssets as asset (asset.id)}
                  {@const areaBadge = getAreaBadgeData(asset.areaName)}
                  {@const deptBadge = getDepartmentBadgeData(
                    asset.departmentName,
                  )}
                  {@const teamsBadge = getTeamsBadgeData(asset.teams)}
                  <tr>
                    <td><code class="text-muted">{asset.id}</code></td>
                    <td><strong>{asset.name}</strong></td>
                    <td>{asset.model ?? '-'}</td>
                    <td>{asset.manufacturer ?? '-'}</td>
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
                      {#if asset.availabilityStatus !== undefined && asset.availabilityStatus !== 'operational' && asset.availabilityStart !== undefined}
                        {@const statusKey =
                          asset.availabilityStatus as AssetAvailabilityStatus}
                        <span
                          class="badge {MACHINE_AVAILABILITY_BADGE_CLASSES[
                            statusKey
                          ]}"
                          title={asset.availabilityNotes ?? ''}
                        >
                          {formatDate(asset.availabilityStart)}
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
                          aria-label="Anlagenverfügbarkeit bearbeiten"
                          onclick={() => {
                            openAvailabilityModal({
                              name: asset.name,
                              uuid: asset.uuid,
                            });
                          }}
                        >
                          <i class="fas fa-calendar-alt"></i>
                        </button>
                        <button
                          type="button"
                          class="action-icon action-icon--edit"
                          title="Bearbeiten"
                          aria-label="Anlage bearbeiten"
                          onclick={() => openEditModal(asset.id)}
                        >
                          <i class="fas fa-edit"></i>
                        </button>
                        <button
                          type="button"
                          class="action-icon action-icon--delete"
                          title="Löschen"
                          aria-label="Anlage löschen"
                          onclick={() => {
                            assetState.openDeleteModal(asset.id);
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
  class="btn-float add-asset-btn"
  onclick={openAddModal}
  aria-label="Anlage hinzufügen"
>
  <i class="fas fa-plus"></i>
</button>

<!-- Modal Components -->
<AssetFormModal
  onsubmit={handleFormSubmit}
  onclose={() => {
    assetState.closeAssetModal();
  }}
/>
<DeleteModals ondelete={deleteAsset} />

<!-- Asset Availability Modal -->
<AssetAvailabilityModal
  show={showAvailabilityModal}
  asset={availabilityAsset}
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
