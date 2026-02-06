<script lang="ts">
  /**
   * Root Dashboard - Page Component
   * @module root-dashboard/+page
   *
   * SSR: Data loaded in +page.server.ts (no onMount fetching)
   */
  import { invalidateAll } from '$app/navigation';
  import { resolve } from '$app/paths';

  import {
    showWarningAlert,
    showErrorAlert,
    showSuccessAlert,
  } from '$lib/stores/toast';

  // Page-specific CSS
  import '../../../../styles/root-dashboard.css';
  import '../../../../styles/logs.css';

  // Module imports
  import { saveEmployeeNumber as saveEmployeeNumberApi } from './_lib/api';
  import { EMPLOYEE_NUMBER, MESSAGES } from './_lib/constants';
  import {
    filterEmployeeNumberInput,
    getActionLabel,
    getDisplayName,
    getRoleBadgeClass,
    getRoleLabel,
  } from './_lib/utils';

  import type { PageData } from './$types';

  /** Resolve path with base prefix (for dynamic runtime paths) */
  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

  // =============================================================================
  // SSR DATA - Loaded server-side in +page.server.ts
  // Data is INSTANTLY available - no loading states for initial render!
  // =============================================================================

  /** Props from server load function */
  const { data }: { data: PageData } = $props();

  // SSR data (always populated by server load function)
  const stats = $derived(data.stats);
  const activityLogs = $derived(data.activityLogs);

  // Employee Number Modal State (initialized from SSR, can change client-side)
  let showEmployeeModal = $state(false);
  let employeeNumberInput = $state('');
  let employeeNumberSaving = $state(false);

  // Sync SSR showEmployeeModal to local state on first render
  $effect(() => {
    if (data.showEmployeeModal) {
      showEmployeeModal = true;
    }
  });

  // =============================================================================
  // API HANDLERS (Client-side only - for form submissions)
  // =============================================================================

  async function saveEmployeeNumber(): Promise<void> {
    const trimmed = employeeNumberInput.trim();
    if (trimmed === '') {
      showWarningAlert(MESSAGES.employeeNumberRequired);
      return;
    }

    employeeNumberSaving = true;
    // Clear immediately after capturing value to prevent race conditions
    employeeNumberInput = '';
    showEmployeeModal = false;

    const result = await saveEmployeeNumberApi(trimmed);

    if (result.success) {
      showSuccessAlert(MESSAGES.employeeNumberSaved);
      // Level 3: Refresh SSR data after mutation
      await invalidateAll();
    } else if (result.error !== null) {
      showErrorAlert(result.error);
    }

    employeeNumberSaving = false;
  }

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  function handleEmployeeNumberInput(e: Event): void {
    const target = e.target as HTMLInputElement;
    target.value = filterEmployeeNumberInput(target.value);
    employeeNumberInput = target.value;
  }

  function handleEmployeeNumberSubmit(e: Event): void {
    e.preventDefault();
    void saveEmployeeNumber();
  }
</script>

<svelte:head>
  <title>Root Dashboard - Assixx</title>
</svelte:head>

<!-- Employee Number Modal (Design System) -->
{#if showEmployeeModal}
  <div class="modal-overlay modal-overlay--active">
    <div class="ds-modal ds-modal--sm">
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">Personalnummer eingeben</h3>
        <!-- No close button - modal is mandatory -->
      </div>
      <div class="ds-modal__body">
        <p class="mb-4 text-[var(--color-text-secondary)]">
          Bitte geben Sie Ihre Personalnummer ein. Diese kann bis zu {EMPLOYEE_NUMBER.maxLength}
          Zeichen lang sein und Buchstaben, Zahlen sowie Bindestriche enthalten.
        </p>
        <form
          id="employeeNumberForm"
          onsubmit={handleEmployeeNumberSubmit}
        >
          <div class="form-field">
            <label
              class="form-field__label form-field__label--required"
              for="employeeNumberInput">Personalnummer</label
            >
            <input
              type="text"
              id="employeeNumberInput"
              class="form-field__control text-center text-sm tracking-wider"
              placeholder="z.B. ABC-123 oder 2025-001"
              maxlength={EMPLOYEE_NUMBER.maxLength}
              pattern={EMPLOYEE_NUMBER.pattern}
              required
              value={employeeNumberInput}
              oninput={handleEmployeeNumberInput}
              disabled={employeeNumberSaving}
            />
            <span class="form-field__message"
              >Erlaubt: Buchstaben, Zahlen und Bindestrich (-), max. {EMPLOYEE_NUMBER.maxLength}
              Zeichen</span
            >
          </div>
        </form>
      </div>
      <div class="ds-modal__footer">
        <button
          type="submit"
          form="employeeNumberForm"
          class="btn btn-primary"
          disabled={employeeNumberSaving}
        >
          {employeeNumberSaving ? MESSAGES.saving : 'Personalnummer speichern'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Page Content (Layout provides <main> wrapper) -->
<div class="container">
  <!-- Dashboard Data Container - SSR: Data instantly available -->
  <div id="dashboard-data">
    <div class="stats-grid">
      <div class="card-stat">
        <div class="card-stat__icon">
          <i class="fas fa-user-shield"></i>
        </div>
        <div class="card-stat__value">{stats.adminCount}</div>
        <div class="card-stat__label">Admins</div>
      </div>
      <div class="card-stat">
        <div class="card-stat__icon">
          <i class="fas fa-users"></i>
        </div>
        <div class="card-stat__value">{stats.employeeCount}</div>
        <div class="card-stat__label">Mitarbeiter</div>
      </div>
      <div class="card-stat">
        <div class="card-stat__icon">
          <i class="fas fa-user-friends"></i>
        </div>
        <div class="card-stat__value">{stats.totalUsers}</div>
        <div class="card-stat__label">Gesamte Benutzer</div>
      </div>
    </div>
  </div>

  <!-- Activity Logs Card with Data Table (Design System) -->
  <div class="card">
    <div class="card__header flex items-center justify-between">
      <h2 class="card__title">
        <i class="fas fa-history mr-2"></i>
        Aktivitätsverlauf
      </h2>
      <a
        href={resolvePath('/logs')}
        class="btn btn-link"
      >
        <i class="fas fa-external-link-alt mr-1.5"></i>
        Alle Logs anzeigen
      </a>
    </div>
    <div class="card__body">
      <div class="table-responsive">
        <table
          class="data-table data-table--hover data-table--striped"
          id="activity-logs-table"
        >
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Benutzer</th>
              <th scope="col">Personalnr.</th>
              <th scope="col">Aktion</th>
            </tr>
          </thead>
          <tbody id="activity-logs">
            {#if activityLogs.length === 0}
              <tr>
                <td
                  colspan="4"
                  class="py-8 text-center text-gray-400"
                  >{MESSAGES.noActivities}</td
                >
              </tr>
            {:else}
              {#each activityLogs as log (log.id)}
                <tr>
                  <td class="text-muted">{log.id}</td>
                  <td>
                    <div class="user-info">
                      <span class="user-name">{getDisplayName(log)}</span>
                      <span
                        class="badge badge--sm badge--{getRoleBadgeClass(
                          log.userRole ?? '',
                        )}">{getRoleLabel(log.userRole ?? '')}</span
                      >
                    </div>
                  </td>
                  <td class="text-muted">{log.employeeNumber ?? '-'}</td>
                  <td>{getActionLabel(log.action)}</td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>
