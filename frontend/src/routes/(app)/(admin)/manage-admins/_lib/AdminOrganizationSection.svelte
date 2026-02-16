<script lang="ts">
  import { tick } from 'svelte';

  import { MESSAGES, STATUS_OPTIONS } from './constants';
  import {
    filterAvailableDepartments,
    filterDepartmentIdsByAreas,
  } from './filters';
  import { getStatusBadgeClass, getStatusLabel } from './utils';

  import type { Area, Department, FormIsActiveStatus } from './types';

  // =============================================================================
  // PROPS
  // =============================================================================

  interface Props {
    isEditMode: boolean;
    show: boolean;
    allAreas: Area[];
    allDepartments: Department[];
    formHasFullAccess: boolean;
    formAreaIds: number[];
    formDepartmentIds: number[];
    formIsActive: FormIsActiveStatus;
    onupgrade?: () => void;
    ondowngrade?: () => void;
  }

  /* eslint-disable prefer-const, @typescript-eslint/no-useless-default-assignment -- Svelte $bindable() requires let and is not a useless default */
  let {
    isEditMode,
    show,
    allAreas,
    allDepartments,
    formHasFullAccess = $bindable(),
    formAreaIds = $bindable(),
    formDepartmentIds = $bindable(),
    formIsActive = $bindable(),
    onupgrade,
    ondowngrade,
  }: Props = $props();
  /* eslint-enable prefer-const, @typescript-eslint/no-useless-default-assignment */

  // =============================================================================
  // LOCAL STATE
  // =============================================================================

  let statusDropdownOpen = $state(false);
  let upgradeConfirmActive = $state(false);
  let downgradeConfirmActive = $state(false);
  let dangerZoneEl: HTMLDivElement | undefined = $state();

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const availableDepartments = $derived.by(() => {
    return filterAvailableDepartments(
      allDepartments,
      formAreaIds,
      formHasFullAccess,
    );
  });

  // =============================================================================
  // HANDLERS
  // =============================================================================

  function toggleStatusDropdown(e: MouseEvent) {
    e.stopPropagation();
    statusDropdownOpen = !statusDropdownOpen;
  }

  function selectStatus(status: FormIsActiveStatus) {
    formIsActive = status;
    statusDropdownOpen = false;
  }

  function handleAreaChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    formAreaIds = Array.from(select.selectedOptions).map((opt) =>
      parseInt(opt.value, 10),
    );
    formDepartmentIds = filterDepartmentIdsByAreas(
      formDepartmentIds,
      allDepartments,
      formAreaIds,
    );
  }

  function handleDepartmentChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    formDepartmentIds = Array.from(select.selectedOptions).map((opt) =>
      parseInt(opt.value, 10),
    );
  }

  // =============================================================================
  // EFFECTS
  // =============================================================================

  // Reset confirmation states when modal closes
  $effect(() => {
    if (!show) {
      upgradeConfirmActive = false;
      downgradeConfirmActive = false;
    }
  });

  // Outside click handler for status dropdown
  $effect(() => {
    if (statusDropdownOpen) {
      const handleOutsideClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const el = document.getElementById('status-dropdown');
        if (el && !el.contains(target)) statusDropdownOpen = false;
      };
      document.addEventListener('click', handleOutsideClick, true);
      return () => {
        document.removeEventListener('click', handleOutsideClick, true);
      };
    }
  });
</script>

<!-- N:M Organization Assignment Section -->
<div class="mt-6 border-t border-(--color-border) pt-6">
  <h4 class="mb-4 font-medium text-(--color-text-primary)">
    <i class="fas fa-sitemap mr-2"></i>
    Organisationszuweisung
  </h4>

  <div class="form-field mb-4">
    <label class="toggle-switch toggle-switch--danger">
      <input
        type="checkbox"
        class="toggle-switch__input"
        id="admin-full-access"
        bind:checked={formHasFullAccess}
      />
      <span class="toggle-switch__slider"></span>
      <span class="toggle-switch__label">
        <i class="fas fa-building mr-2"></i>
        {MESSAGES.FULL_ACCESS_LABEL}
      </span>
    </label>
    <span class="form-field__message mt-2 block text-(--color-danger)">
      <i class="fas fa-exclamation-triangle mr-1"></i>
      {MESSAGES.FULL_ACCESS_WARNING}
    </span>
  </div>

  <div
    class="form-field mb-4"
    id="admin-area-select-container"
    class:opacity-50={formHasFullAccess}
  >
    <label
      class="form-field__label"
      for="admin-areas"
    >
      <i class="fas fa-layer-group mr-1"></i>
      {MESSAGES.LABEL_AREAS}
    </label>
    <select
      id="admin-areas"
      name="areaIds"
      multiple
      class="form-field__control min-h-[100px]"
      disabled={formHasFullAccess}
      onchange={handleAreaChange}
    >
      {#each allAreas as area (area.id)}
        <option
          value={area.id}
          selected={formAreaIds.includes(area.id)}
        >
          {area.name}{(
            area.departmentCount !== undefined && area.departmentCount > 0
          ) ?
            ` (${area.departmentCount} Abt.)`
          : ''}
        </option>
      {/each}
    </select>
    <span class="form-field__message text-(--color-text-secondary)">
      <i class="fas fa-info-circle mr-1"></i>
      {MESSAGES.HINT_MULTISELECT}
      {MESSAGES.HINT_AREAS}
    </span>
  </div>

  <div
    class="form-field mb-4"
    id="admin-department-select-container"
    class:opacity-50={formHasFullAccess}
  >
    <label
      class="form-field__label"
      for="admin-departments"
    >
      <i class="fas fa-sitemap mr-1"></i>
      {MESSAGES.LABEL_DEPARTMENTS}
    </label>
    <select
      id="admin-departments"
      name="departmentIds"
      multiple
      class="form-field__control min-h-[120px]"
      disabled={formHasFullAccess}
      onchange={handleDepartmentChange}
    >
      {#each availableDepartments as dept (dept.id)}
        <option
          value={dept.id}
          selected={formDepartmentIds.includes(dept.id)}
        >
          {dept.name}{dept.areaName !== undefined && dept.areaName !== '' ?
            ` (${dept.areaName})`
          : ''}
        </option>
      {/each}
    </select>
    <span class="form-field__message text-(--color-text-secondary)">
      <i class="fas fa-info-circle mr-1"></i>
      {MESSAGES.HINT_MULTISELECT}
      {MESSAGES.HINT_DEPARTMENTS}
    </span>
  </div>

  <!-- svelte-ignore a11y_label_has_associated_control -->
  <div
    class="form-field"
    id="admin-team-info-container"
  >
    <label class="form-field__label">
      <i class="fas fa-users mr-1"></i>
      {MESSAGES.LABEL_TEAMS}
    </label>
    <div class="alert alert--info">
      <div class="alert__icon">
        <i class="fas fa-info-circle"></i>
      </div>
      <div class="alert__content">
        <div class="alert__message">{MESSAGES.HINT_TEAMS}</div>
      </div>
    </div>
  </div>
</div>

{#if isEditMode}
  <div
    class="form-field"
    id="active-status-group"
  >
    <label
      class="form-field__label"
      for="admin-status"
    >
      {MESSAGES.LABEL_STATUS} <span class="text-red-500">*</span>
    </label>
    <div
      class="dropdown"
      id="status-dropdown"
    >
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
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
      <div
        class="dropdown__menu"
        class:active={statusDropdownOpen}
      >
        {#each STATUS_OPTIONS as opt (opt.value)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="dropdown__option"
            onclick={() => {
              selectStatus(opt.value);
            }}
          >
            <span class="badge {opt.class}">{opt.label}</span>
          </div>
        {/each}
      </div>
    </div>
    <span class="form-field__message mt-1 block text-(--color-text-secondary)">
      {MESSAGES.HINT_STATUS}
    </span>
  </div>

  <!-- Danger Zone: Role Changes -->
  {#if onupgrade !== undefined || ondowngrade !== undefined}
    <div
      bind:this={dangerZoneEl}
      class="mt-6 border-t-2 border-(--color-danger) pt-6"
    >
      <h4 class="mb-2 font-medium text-(--color-danger)">
        <i class="fas fa-exclamation-triangle mr-2"></i>
        {MESSAGES.UPGRADE_TITLE}
      </h4>

      <!-- Upgrade: Admin -> Root -->
      {#if onupgrade}
        <p class="mb-4 text-sm text-(--color-text-secondary)">
          {MESSAGES.UPGRADE_DESCRIPTION}
        </p>
        {#if !upgradeConfirmActive}
          <button
            type="button"
            class="btn btn-status-active"
            onclick={async () => {
              upgradeConfirmActive = true;
              downgradeConfirmActive = false;
              await tick();
              dangerZoneEl?.scrollIntoView({
                behavior: 'smooth',
                block: 'end',
              });
            }}
          >
            <i class="fas fa-arrow-up mr-1"></i>
            {MESSAGES.UPGRADE_BUTTON}
          </button>
        {:else}
          <div class="alert alert--danger mb-4">
            <div class="alert__icon">
              <i class="fas fa-exclamation-triangle"></i>
            </div>
            <div class="alert__content">
              <p class="alert__message">
                {MESSAGES.UPGRADE_CONFIRM_MESSAGE}
              </p>
            </div>
          </div>
          <div class="flex gap-3">
            <button
              type="button"
              class="btn btn-cancel"
              onclick={() => {
                upgradeConfirmActive = false;
              }}
            >
              {MESSAGES.BTN_CANCEL}
            </button>
            <button
              type="button"
              class="btn btn-danger"
              onclick={onupgrade}
            >
              <i class="fas fa-check mr-1"></i>
              {MESSAGES.UPGRADE_CONFIRM_BUTTON}
            </button>
          </div>
        {/if}
      {/if}

      <!-- Downgrade: Admin -> Employee -->
      {#if ondowngrade}
        <div class="mt-4 border-t border-(--color-border) pt-4">
          <p class="mb-4 text-sm text-(--color-text-secondary)">
            {MESSAGES.DOWNGRADE_DESCRIPTION}
          </p>
          {#if !downgradeConfirmActive}
            <button
              type="button"
              class="btn btn-status-active"
              onclick={async () => {
                downgradeConfirmActive = true;
                upgradeConfirmActive = false;
                await tick();
                dangerZoneEl?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'end',
                });
              }}
            >
              <i class="fas fa-arrow-down mr-1"></i>
              {MESSAGES.DOWNGRADE_BUTTON}
            </button>
          {:else}
            <div class="alert alert--danger mb-4">
              <div class="alert__icon">
                <i class="fas fa-exclamation-triangle"></i>
              </div>
              <div class="alert__content">
                <p class="alert__message">
                  {MESSAGES.DOWNGRADE_CONFIRM_MESSAGE}
                </p>
              </div>
            </div>
            <div class="flex gap-3">
              <button
                type="button"
                class="btn btn-cancel"
                onclick={() => {
                  downgradeConfirmActive = false;
                }}
              >
                {MESSAGES.BTN_CANCEL}
              </button>
              <button
                type="button"
                class="btn btn-danger"
                onclick={ondowngrade}
              >
                <i class="fas fa-check mr-1"></i>
                {MESSAGES.DOWNGRADE_CONFIRM_BUTTON}
              </button>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
{/if}
