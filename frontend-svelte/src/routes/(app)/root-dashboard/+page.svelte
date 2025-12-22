<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base, resolve } from '$app/paths';
  import { showWarningAlert, showErrorAlert } from '$lib/stores/toast.js';

  // Page-specific CSS
  import '../../../styles/root-dashboard.css';

  // Module imports
  import {
    loadDashboardData,
    loadActivityLogs,
    checkEmployeeNumber,
    saveEmployeeNumber as saveEmployeeNumberApi,
  } from './_lib/api';
  import {
    getActionLabel,
    getActionBadgeClass,
    getRoleLabel,
    getRoleBadgeClass,
    getDisplayName,
    filterEmployeeNumberInput,
  } from './_lib/utils';
  import { EMPLOYEE_NUMBER, MESSAGES } from './_lib/constants';

  /** @typedef {import('./_lib/types').DashboardData} DashboardData */
  /** @typedef {import('./_lib/types').ActivityLog} ActivityLog */
  /** @typedef {import('./_lib/types').UserData} UserData */

  // =============================================================================
  // SVELTE 5 RUNES - State
  // =============================================================================

  // Dashboard Data State
  /** @type {DashboardData | null} */
  let dashboardData = $state(null);
  let loading = $state(true);
  /** @type {string | null} */
  let error = $state(null);

  // Activity Logs State
  /** @type {ActivityLog[]} */
  let activityLogs = $state([]);
  let logsLoading = $state(true);

  // Employee Number Modal State
  let showEmployeeModal = $state(false);
  let employeeNumberInput = $state('');
  let employeeNumberSaving = $state(false);

  // =============================================================================
  // API HANDLERS
  // =============================================================================

  async function fetchDashboardData() {
    const result = await loadDashboardData();

    if (result.unauthorized) {
      goto(resolve('/login'));
      return;
    }

    dashboardData = result.data;
    error = result.error;
    loading = false;
  }

  async function fetchActivityLogs() {
    activityLogs = await loadActivityLogs();
    logsLoading = false;
  }

  async function fetchEmployeeNumber() {
    const result = await checkEmployeeNumber();
    showEmployeeModal = result.showModal;
  }

  async function saveEmployeeNumber() {
    const trimmed = employeeNumberInput.trim();
    if (!trimmed) {
      showWarningAlert(MESSAGES.employeeNumberRequired);
      return;
    }

    employeeNumberSaving = true;

    const result = await saveEmployeeNumberApi(trimmed);

    if (result.success) {
      showEmployeeModal = false;
      employeeNumberInput = '';
    } else if (result.error) {
      showErrorAlert(result.error);
    }

    employeeNumberSaving = false;
  }

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  /**
   * Handle employee number input (filter invalid chars)
   * @param {Event} e
   */
  function handleEmployeeNumberInput(e) {
    const target = /** @type {HTMLInputElement} */ (e.target);
    target.value = filterEmployeeNumberInput(target.value);
    employeeNumberInput = target.value;
  }

  /**
   * Handle employee number form submit
   * @param {Event} e
   */
  function handleEmployeeNumberSubmit(e) {
    e.preventDefault();
    saveEmployeeNumber();
  }

  // =============================================================================
  // LIFECYCLE
  // =============================================================================

  onMount(() => {
    fetchDashboardData();
    fetchActivityLogs();
    fetchEmployeeNumber();
  });
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
          Bitte geben Sie Ihre Personalnummer ein. Diese kann bis zu {EMPLOYEE_NUMBER.maxLength} Zeichen
          lang sein und Buchstaben, Zahlen sowie Bindestriche enthalten.
        </p>
        <form id="employeeNumberForm" onsubmit={handleEmployeeNumberSubmit}>
          <div class="form-field">
            <label class="form-field__label form-field__label--required" for="employeeNumberInput"
              >Personalnummer</label
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
              >Erlaubt: Buchstaben, Zahlen und Bindestrich (-), max. {EMPLOYEE_NUMBER.maxLength} Zeichen</span
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
  <!-- Dashboard Data Container -->
  <div id="dashboard-data">
    {#if loading}
      <div class="stats-grid">
        {#each [1, 2, 3] as i (i)}
          <div class="card-stat">
            <div class="card-stat__icon">
              <i class="fas fa-spinner fa-spin"></i>
            </div>
            <div class="card-stat__value">--</div>
            <div class="card-stat__label">{MESSAGES.loading}</div>
          </div>
        {/each}
      </div>
    {:else if error}
      <div class="alert alert--error">
        <span class="alert__icon">
          <i class="fas fa-exclamation-circle"></i>
        </span>
        <div class="alert__content">
          <div class="alert__message">{error}</div>
        </div>
      </div>
    {:else if dashboardData}
      <div class="stats-grid">
        <div class="card-stat">
          <div class="card-stat__icon">
            <i class="fas fa-user-shield"></i>
          </div>
          <div class="card-stat__value">{dashboardData.adminCount}</div>
          <div class="card-stat__label">Admins</div>
        </div>
        <div class="card-stat">
          <div class="card-stat__icon">
            <i class="fas fa-users"></i>
          </div>
          <div class="card-stat__value">{dashboardData.employeeCount}</div>
          <div class="card-stat__label">Mitarbeiter</div>
        </div>
        <div class="card-stat">
          <div class="card-stat__icon">
            <i class="fas fa-user-friends"></i>
          </div>
          <div class="card-stat__value">{dashboardData.totalUsers}</div>
          <div class="card-stat__label">Gesamte Benutzer</div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Activity Logs Card with Data Table (Design System) -->
  <div class="card">
    <div class="card__header flex items-center justify-between">
      <h2 class="card__title">
        <i class="fas fa-history mr-2"></i>
        Aktivitätsverlauf
      </h2>
      <!-- eslint-disable svelte/no-navigation-without-resolve -- /logs route doesn't exist yet -->
      <a href={`${base}/logs`} class="btn btn-link">
        <i class="fas fa-external-link-alt mr-1.5"></i>
        Alle Logs anzeigen
      </a>
      <!-- eslint-enable svelte/no-navigation-without-resolve -->
    </div>
    <div class="card__body">
      <div class="table-responsive">
        <table class="data-table data-table--hover data-table--striped" id="activity-logs-table">
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Benutzer</th>
              <th scope="col">Personalnr.</th>
              <th scope="col">Aktion</th>
            </tr>
          </thead>
          <tbody id="activity-logs">
            {#if logsLoading}
              <tr>
                <td colspan="4" class="text-center py-8">
                  <i class="fas fa-spinner fa-spin mr-2"></i>
                  {MESSAGES.loading}
                </td>
              </tr>
            {:else if activityLogs.length === 0}
              <tr>
                <td colspan="4" class="text-center text-gray-400 py-8">{MESSAGES.noActivities}</td>
              </tr>
            {:else}
              {#each activityLogs as log (log.id)}
                <tr>
                  <td class="text-muted">{log.id}</td>
                  <td>
                    <div class="user-info">
                      <span class="user-name">{getDisplayName(log)}</span>
                      <span class="badge badge--sm badge--{getRoleBadgeClass(log.userRole ?? '')}"
                        >{getRoleLabel(log.userRole ?? '')}</span
                      >
                    </div>
                  </td>
                  <td class="text-muted">{log.employeeNumber ?? '-'}</td>
                  <td
                    ><span class="badge badge--{getActionBadgeClass(log.action)}"
                      >{getActionLabel(log.action)}</span
                    ></td
                  >
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>
