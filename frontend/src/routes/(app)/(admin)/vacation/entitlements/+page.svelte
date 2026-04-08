<script lang="ts">
  /**
   * Vacation Entitlements — Admin Page
   * Manage per-employee vacation entitlements: view balance, edit entitlement, add days.
   * SSR: Employee list loaded in +page.server.ts.
   * Client-side: Balance fetched on employee selection.
   */
  import { onDestroy } from 'svelte';

  import { onClickOutsideDropdown } from '$lib/actions/click-outside';
  import AppDatePicker from '$lib/components/AppDatePicker.svelte';
  import PermissionDenied from '$lib/components/PermissionDenied.svelte';
  import { showSuccessAlert, showErrorAlert } from '$lib/utils';
  import { createLogger } from '$lib/utils/logger';

  import EntitlementBadge from '../../../(shared)/vacation/_lib/EntitlementBadge.svelte';

  import AddDaysModal from './_lib/AddDaysModal.svelte';
  import * as api from './_lib/api';
  import { BALANCE_LABELS, ENTITLEMENT_LABELS } from './_lib/constants';
  import SearchResults from './_lib/SearchResults.svelte';
  import { entitlementsState } from './_lib/state.svelte';

  import type { PageData } from './$types';
  import type { CreateEntitlementPayload, EmployeeListItem } from './_lib/types';

  const log = createLogger('VacationEntitlements');

  // ==========================================================================
  // SSR DATA
  // ==========================================================================

  const { data }: { data: PageData } = $props();
  const permissionDenied = $derived(data.permissionDenied);

  const ssrEmployees = $derived(data.employees);
  const ssrCurrentYear = $derived(data.currentYear);

  $effect(() => {
    entitlementsState.setEmployees(ssrEmployees);
    entitlementsState.setSelectedYear(ssrCurrentYear);
    entitlementsState.setLoading(false);
  });

  onDestroy(() => {
    entitlementsState.reset();
  });

  // ==========================================================================
  // BALANCE LOADING
  // ==========================================================================

  async function loadBalance(employee: EmployeeListItem): Promise<void> {
    entitlementsState.setLoadingBalance(true);
    try {
      const bal = await api.getUserBalance(employee.id, entitlementsState.selectedYear);
      entitlementsState.setBalance(bal);
    } catch (err: unknown) {
      log.error({ err, userId: employee.id }, 'Balance load failed');
      showErrorAlert('Fehler beim Laden des Urlaubskontos');
      entitlementsState.setBalance(null);
    } finally {
      entitlementsState.setLoadingBalance(false);
    }
  }

  function handleSelectEmployee(emp: EmployeeListItem) {
    entitlementsState.selectEmployee(emp);
    void loadBalance(emp);
  }

  // ==========================================================================
  // SEARCH (local state — same pattern as manage-employees)
  // ==========================================================================

  let currentSearchQuery = $state('');
  let searchOpen = $state(false);

  /** Filtered employees based on local search query */
  const filteredEmployees = $derived.by(() => {
    if (currentSearchQuery.trim() === '') return entitlementsState.employees;
    const q = currentSearchQuery.trim().toLowerCase();
    return entitlementsState.employees.filter((emp) => {
      const name = `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.toLowerCase();
      const empNum = emp.employeeNumber?.toLowerCase() ?? '';
      const pos = emp.position?.toLowerCase() ?? '';
      return (
        name.includes(q) ||
        emp.email.toLowerCase().includes(q) ||
        empNum.includes(q) ||
        pos.includes(q)
      );
    });
  });

  function handleSearchInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    currentSearchQuery = input.value;
    searchOpen = currentSearchQuery.trim().length > 0;
  }

  function clearSearch(): void {
    currentSearchQuery = '';
    searchOpen = false;
  }

  function handleSearchResultClick(emp: EmployeeListItem): void {
    handleSelectEmployee(emp);
    searchOpen = false;
    currentSearchQuery = '';
  }

  // Dropdown state for year select
  let yearDropdownOpen = $state(false);
  const yearDisplayText = $derived(String(entitlementsState.selectedYear));

  function handleYearSelect(year: number): void {
    entitlementsState.setSelectedYear(year);
    yearDropdownOpen = false;
    if (entitlementsState.selectedEmployee !== null) {
      void loadBalance(entitlementsState.selectedEmployee);
    }
  }

  // Capture-phase click-outside: works inside modals (bypasses stopPropagation)
  $effect(() => {
    return onClickOutsideDropdown(() => {
      yearDropdownOpen = false;
    });
  });

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  function employeeName(emp: EmployeeListItem): string {
    const first = emp.firstName ?? '';
    const last = emp.lastName ?? '';
    const name = `${first} ${last}`.trim();
    return name !== '' ? name : emp.email;
  }

  function yearOptions(): number[] {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1];
  }
  // ==========================================================================
  // ENTITLEMENT FORM
  // ==========================================================================

  let formTotalDays = $state(30);
  let formCarriedOver = $state(0);
  let formAdditionalDays = $state(0);
  let formExpiresAt = $state('');
  let isSavingEntitlement = $state(false);

  $effect(() => {
    if (entitlementsState.showEntitlementForm && entitlementsState.balance !== null) {
      const bal = entitlementsState.balance;
      formTotalDays = bal.totalDays;
      formCarriedOver = bal.carriedOverDays;
      formAdditionalDays = bal.additionalDays;
      formExpiresAt = '';
    }
  });

  async function performSaveEntitlement(): Promise<void> {
    const emp = entitlementsState.selectedEmployee;
    if (emp === null) return;

    const payload: CreateEntitlementPayload = {
      userId: emp.id,
      year: entitlementsState.selectedYear,
      totalDays: formTotalDays,
      carriedOverDays: formCarriedOver,
      additionalDays: formAdditionalDays,
      carryOverExpiresAt: formExpiresAt !== '' ? formExpiresAt : undefined,
    };

    await api.createOrUpdateEntitlement(emp.id, payload);
    showSuccessAlert('Urlaubsanspruch aktualisiert');
    entitlementsState.closeEntitlementForm();
    await loadBalance(emp);
  }

  function handleSaveEntitlement() {
    if (isSavingEntitlement) return;
    isSavingEntitlement = true;
    performSaveEntitlement()
      .catch((err: unknown) => {
        log.error({ err }, 'Entitlement save failed');
        showErrorAlert('Fehler beim Speichern');
      })
      .finally(() => {
        isSavingEntitlement = false;
      });
  }

  // ==========================================================================
  // ADD DAYS (delegated to AddDaysModal)
  // ==========================================================================

  async function handleAddDays(days: number): Promise<void> {
    const emp = entitlementsState.selectedEmployee;
    if (emp === null) return;

    try {
      await api.addDays(emp.id, {
        year: entitlementsState.selectedYear,
        days,
      });
      const label = days > 0 ? 'hinzugefuegt' : 'abgezogen';
      showSuccessAlert(`${Math.abs(days)} Tage ${label}`);
      entitlementsState.closeAddDaysModal();
      await loadBalance(emp);
    } catch (err: unknown) {
      log.error({ err }, 'Add days failed');
      showErrorAlert('Fehler beim Hinzufuegen');
    }
  }
</script>

<svelte:head>
  <title>Urlaubsansprüche - Assixx</title>
</svelte:head>

{#if permissionDenied}
  <PermissionDenied addonName="die Urlaubsverwaltung" />
{:else}
  <div class="container">
    <!-- Header -->
    <div class="card mb-6">
      <div class="card__header">
        <div class="flex items-center justify-between">
          <h2 class="card__title">
            <i class="fas fa-calculator mr-2"></i>
            Urlaubsansprüche verwalten
          </h2>
          <div class="flex items-center gap-3">
            <span class="form-field__label mb-0">Jahr:</span>
            <div
              class="dropdown"
              data-dropdown="ent-year"
            >
              <button
                type="button"
                class="dropdown__trigger"
                class:active={yearDropdownOpen}
                onclick={() => {
                  yearDropdownOpen = !yearDropdownOpen;
                }}
              >
                <span>{yearDisplayText}</span>
                <i class="fas fa-chevron-down"></i>
              </button>
              <div
                class="dropdown__menu"
                class:active={yearDropdownOpen}
              >
                {#each yearOptions() as year (year)}
                  <button
                    type="button"
                    class="dropdown__option"
                    onclick={() => {
                      handleYearSelect(year);
                    }}
                  >
                    {year}
                  </button>
                {/each}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      class="flex gap-6"
      style="align-items: flex-start;"
    >
      <!-- ================================================================
         EMPLOYEE LIST (Left Panel)
         ================================================================ -->
      <div
        class="card"
        style="flex: 0 0 340px; max-height: 70vh; display: flex; flex-direction: column;"
      >
        <div class="card__header">
          <h3 class="card__title">
            <i class="fas fa-users mr-2"></i>
            Mitarbeiter
            <span class="text-muted ml-2">({filteredEmployees.length})</span>
          </h3>
          <div
            class="search-input-wrapper mt-3 mb-0"
            class:search-input-wrapper--open={searchOpen}
          >
            <div
              class="search-input"
              id="entitlement-search-container"
            >
              <i class="search-input__icon fas fa-search"></i>
              <input
                type="search"
                id="entitlement-search"
                class="search-input__field"
                placeholder="Mitarbeiter suchen..."
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
            <SearchResults
              searchQuery={currentSearchQuery}
              employees={filteredEmployees}
              onresultclick={handleSearchResultClick}
            />
          </div>
        </div>
        <div
          class="card__body"
          style="overflow-y: auto; flex: 1; padding: 0;"
        >
          {#if filteredEmployees.length === 0}
            <div
              class="empty-state empty-state--in-card"
              style="padding: var(--spacing-4);"
            >
              <p class="empty-state__description">Keine Mitarbeiter gefunden</p>
            </div>
          {:else}
            <div class="employee-list">
              {#each filteredEmployees as emp (emp.id)}
                <button
                  type="button"
                  class="employee-list__item"
                  class:active={entitlementsState.selectedEmployee?.id === emp.id}
                  onclick={() => {
                    handleSelectEmployee(emp);
                  }}
                >
                  <div class="employee-list__name">
                    {employeeName(emp)}
                  </div>
                  <div class="employee-list__meta">
                    {emp.email}
                    {#if emp.teamNames !== undefined && emp.teamNames.length > 0}
                      <span class="badge badge--info badge--sm ml-1">
                        {emp.teamNames[0]}
                      </span>
                    {/if}
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- ================================================================
         BALANCE DETAIL (Right Panel)
         ================================================================ -->
      <div style="flex: 1; min-width: 0;">
        {#if entitlementsState.selectedEmployee === null}
          <div class="card">
            <div class="card__body">
              <div class="empty-state empty-state--in-card">
                <div class="empty-state__icon">
                  <i class="fas fa-hand-pointer"></i>
                </div>
                <h3 class="empty-state__title">Mitarbeiter auswählen</h3>
                <p class="empty-state__description">
                  Waehlen Sie links einen Mitarbeiter aus, um dessen Urlaubskonto zu sehen.
                </p>
              </div>
            </div>
          </div>
        {:else}
          <!-- Employee Header -->
          <div class="card mb-4">
            <div class="card__header">
              <div class="flex items-center justify-between">
                <h3 class="card__title">
                  <i class="fas fa-user mr-2"></i>
                  {employeeName(entitlementsState.selectedEmployee)}
                  <span class="text-muted ml-2">
                    ({entitlementsState.selectedYear})
                  </span>
                </h3>
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="btn btn-cancel btn"
                    onclick={() => {
                      entitlementsState.openEntitlementForm();
                    }}
                  >
                    <i class="fas fa-edit mr-1"></i>
                    Bearbeiten
                  </button>
                  <button
                    type="button"
                    class="btn btn-secondary"
                    onclick={() => {
                      entitlementsState.openAddDaysModal();
                    }}
                  >
                    <i class="fas fa-plus mr-1"></i>
                    Tage hinzufügen
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Balance Card -->
          {#if entitlementsState.isLoadingBalance}
            <div class="card">
              <div
                class="card__body text-center"
                style="padding: var(--spacing-8);"
              >
                <div class="spinner-ring spinner-ring--sm"></div>
                <p class="text-muted mt-3">Urlaubskonto wird geladen...</p>
              </div>
            </div>
          {:else if entitlementsState.balance !== null}
            {@const bal = entitlementsState.balance}

            <!-- Progress Bar -->
            <EntitlementBadge balance={bal} />

            <!-- Balance Details -->
            <div class="card">
              <div class="card__header">
                <h4 class="card__title">
                  <i class="fas fa-chart-bar mr-2"></i>
                  Urlaubskonto Details
                </h4>
              </div>
              <div class="card__body">
                <div class="balance-grid">
                  {#each Object.entries(BALANCE_LABELS) as [key, label] (key)}
                    {@const value = bal[key as keyof typeof bal]}
                    <div class="balance-grid__row">
                      <span class="balance-grid__label">{label}</span>
                      <span
                        class="balance-grid__value"
                        class:text-success={key === 'remainingDays' && value > 0}
                        class:text-danger={key === 'remainingDays' && value <= 0}
                        class:text-warning={key === 'pendingDays' && value > 0}
                      >
                        {value}
                        {value === 1 ? 'Tag' : 'Tage'}
                      </span>
                    </div>
                  {/each}
                </div>
              </div>
            </div>
          {:else}
            <div class="card">
              <div class="card__body">
                <div class="empty-state empty-state--in-card">
                  <p class="empty-state__description">Urlaubskonto konnte nicht geladen werden.</p>
                </div>
              </div>
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </div>

  <!-- ================================================================
     ENTITLEMENT FORM MODAL
     ================================================================ -->

  {#if entitlementsState.showEntitlementForm && entitlementsState.selectedEmployee !== null}
    <div
      id="vacation-entitlement-form-modal"
      class="modal-overlay modal-overlay--active"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      onclick={() => {
        entitlementsState.closeEntitlementForm();
      }}
      onkeydown={(e: KeyboardEvent) => {
        if (e.key === 'Escape') entitlementsState.closeEntitlementForm();
      }}
    >
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <form
        class="ds-modal"
        onclick={(e) => {
          e.stopPropagation();
        }}
        onkeydown={(e) => {
          e.stopPropagation();
        }}
        onsubmit={(e) => {
          e.preventDefault();
          handleSaveEntitlement();
        }}
      >
        <div class="ds-modal__header">
          <h3 class="ds-modal__title">
            <i class="fas fa-edit mr-2"></i>
            Urlaubsanspruch bearbeiten
          </h3>
          <button
            type="button"
            class="ds-modal__close"
            aria-label="Schliessen"
            onclick={() => {
              entitlementsState.closeEntitlementForm();
            }}
          >
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="ds-modal__body">
          <p
            class="text-muted mb-4"
            style="font-size: 0.875rem;"
          >
            {employeeName(entitlementsState.selectedEmployee)} — {entitlementsState.selectedYear}
          </p>

          <div class="form-field">
            <label
              class="form-field__label"
              for="ent-total"
            >
              {ENTITLEMENT_LABELS.totalDays}
            </label>
            <input
              id="ent-total"
              type="number"
              class="form-field__control"
              min="0"
              max="365"
              step="0.5"
              bind:value={formTotalDays}
              required
            />
          </div>

          <div class="form-field">
            <label
              class="form-field__label"
              for="ent-carried"
            >
              {ENTITLEMENT_LABELS.carriedOverDays}
            </label>
            <input
              id="ent-carried"
              type="number"
              class="form-field__control"
              min="0"
              max="365"
              step="0.5"
              bind:value={formCarriedOver}
            />
          </div>

          <div class="form-field">
            <label
              class="form-field__label"
              for="ent-additional"
            >
              {ENTITLEMENT_LABELS.additionalDays}
            </label>
            <input
              id="ent-additional"
              type="number"
              class="form-field__control"
              min="0"
              max="365"
              step="0.5"
              bind:value={formAdditionalDays}
            />
          </div>

          <div class="form-field">
            <label
              class="form-field__label"
              for="ent-expires"
            >
              {ENTITLEMENT_LABELS.carryOverExpiresAt}
            </label>
            <AppDatePicker bind:value={formExpiresAt} />
          </div>
        </div>

        <div class="ds-modal__footer">
          <button
            type="button"
            class="btn btn-cancel"
            onclick={() => {
              entitlementsState.closeEntitlementForm();
            }}
          >
            Abbrechen
          </button>
          <button
            type="submit"
            class="btn btn-secondary"
            disabled={isSavingEntitlement}
          >
            <i class="fas fa-save mr-1"></i>
            Speichern
          </button>
        </div>
      </form>
    </div>
  {/if}

  {#if entitlementsState.showAddDaysModal && entitlementsState.selectedEmployee !== null}
    <AddDaysModal
      employeeName={employeeName(entitlementsState.selectedEmployee)}
      year={entitlementsState.selectedYear}
      onclose={() => {
        entitlementsState.closeAddDaysModal();
      }}
      onsave={handleAddDays}
    />
  {/if}
{/if}

<style>
  /* Employee list panel */
  .employee-list {
    display: flex;
    flex-direction: column;
  }

  .employee-list__item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: var(--spacing-3) var(--spacing-4);
    border: none;
    border-bottom: 1px solid var(--color-glass-border);
    background: transparent;
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: background var(--transition-fast);
  }

  .employee-list__item:hover {
    background: var(--glass-bg);
  }

  .employee-list__item.active {
    background: var(--glass-bg);
    border-left: 3px solid var(--color-primary-500);
  }

  .employee-list__name {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text-primary);
  }

  .employee-list__meta {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: 2px;
  }

  /* Balance grid */
  .balance-grid {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  .balance-grid__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-2) 0;
    border-bottom: 1px solid var(--color-glass-border);
  }

  .balance-grid__row:last-child {
    border-bottom: none;
  }

  .balance-grid__label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-muted);
  }

  .balance-grid__value {
    font-size: 0.938rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  /* Responsive: stack on small screens */
  @media (width <= 768px) {
    .employee-list__item.active {
      border-left: none;
      border-bottom: 2px solid var(--color-primary-500);
    }
  }
</style>
