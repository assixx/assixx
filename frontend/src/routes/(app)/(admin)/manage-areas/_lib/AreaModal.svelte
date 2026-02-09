<script lang="ts">
  import { TYPE_OPTIONS, MESSAGES } from './constants';
  import {
    getStatusBadgeClass,
    getStatusLabel,
    getTypeLabel,
    getAreaLeadDisplayName,
  } from './utils';

  import type {
    FormIsActiveStatus,
    AreaType,
    AdminUser,
    Department,
  } from './types';

  // Props with bindable for two-way binding
  interface Props {
    show: boolean;
    isEditMode: boolean;
    modalTitle: string;
    formName: string;
    formDescription: string;
    formAreaLeadId: number | null;
    formType: AreaType;
    formCapacity: number | null;
    formAddress: string;
    formDepartmentIds: number[];
    formIsActive: FormIsActiveStatus;
    areaLeads: AdminUser[];
    allDepartments: Department[];
    submitting: boolean;
    onclose: () => void;
    onsubmit: (e: Event) => void;
  }

  /* eslint-disable prefer-const, @typescript-eslint/no-useless-default-assignment -- Svelte $bindable() requires let and is not a useless default */
  // prettier-ignore
  let { show, isEditMode, modalTitle, formName = $bindable(), formDescription = $bindable(), formAreaLeadId = $bindable(), formType = $bindable(), formCapacity = $bindable(), formAddress = $bindable(), formDepartmentIds = $bindable(), formIsActive = $bindable(), areaLeads, allDepartments, submitting, onclose, onsubmit }: Props = $props();
  /* eslint-enable prefer-const, @typescript-eslint/no-useless-default-assignment */

  // Local dropdown states
  let typeDropdownOpen = $state(false);
  let statusDropdownOpen = $state(false);
  let areaLeadDropdownOpen = $state(false);

  // Derived area lead display name
  const areaLeadDisplayName = $derived(
    getAreaLeadDisplayName(formAreaLeadId, areaLeads),
  );

  // =============================================================================
  // DROPDOWN HANDLERS
  // =============================================================================

  function toggleTypeDropdown(e: MouseEvent): void {
    e.stopPropagation();
    statusDropdownOpen = false;
    areaLeadDropdownOpen = false;
    typeDropdownOpen = !typeDropdownOpen;
  }

  function selectType(type: AreaType): void {
    formType = type;
    typeDropdownOpen = false;
  }

  function toggleStatusDropdown(e: MouseEvent): void {
    e.stopPropagation();
    typeDropdownOpen = false;
    areaLeadDropdownOpen = false;
    statusDropdownOpen = !statusDropdownOpen;
  }

  function selectStatus(status: FormIsActiveStatus): void {
    formIsActive = status;
    statusDropdownOpen = false;
  }

  function toggleAreaLeadDropdown(e: MouseEvent): void {
    e.stopPropagation();
    typeDropdownOpen = false;
    statusDropdownOpen = false;
    areaLeadDropdownOpen = !areaLeadDropdownOpen;
  }

  function selectAreaLead(id: number | null): void {
    formAreaLeadId = id;
    areaLeadDropdownOpen = false;
  }

  function handleOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onclose();
  }

  // Reset local UI state when modal opens
  $effect(() => {
    if (show) {
      typeDropdownOpen = false;
      statusDropdownOpen = false;
      areaLeadDropdownOpen = false;
    }
  });

  // Close dropdowns on outside click
  $effect(() => {
    if (typeDropdownOpen || statusDropdownOpen || areaLeadDropdownOpen) {
      const handleClick = (e: MouseEvent): void => {
        const target = e.target as HTMLElement;
        if (typeDropdownOpen && !target.closest('#type-dropdown')) {
          typeDropdownOpen = false;
        }
        if (statusDropdownOpen && !target.closest('#status-dropdown')) {
          statusDropdownOpen = false;
        }
        if (areaLeadDropdownOpen && !target.closest('#area-lead-dropdown')) {
          areaLeadDropdownOpen = false;
        }
      };
      document.addEventListener('click', handleClick);
      return () => {
        document.removeEventListener('click', handleClick);
      };
    }
  });
</script>

{#if show}
  <div
    id="area-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="area-modal-title"
    tabindex="-1"
    onclick={handleOverlayClick}
    onkeydown={(e) => {
      if (e.key === 'Escape') onclose();
    }}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
    <form
      id="area-form"
      class="ds-modal"
      onclick={(e) => {
        e.stopPropagation();
      }}
      {onsubmit}
    >
      <div class="ds-modal__header">
        <h3
          class="ds-modal__title"
          id="area-modal-title"
        >
          {modalTitle}
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schließen"
          onclick={onclose}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="ds-modal__body">
        <!-- Name -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="area-name"
          >
            {MESSAGES.LABEL_NAME} <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="area-name"
            name="name"
            class="form-field__control"
            required
            bind:value={formName}
            placeholder={MESSAGES.PLACEHOLDER_NAME}
          />
        </div>

        <!-- Description -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="area-description">{MESSAGES.LABEL_DESCRIPTION}</label
          >
          <textarea
            id="area-description"
            name="description"
            class="form-field__control"
            rows="3"
            bind:value={formDescription}
            placeholder={MESSAGES.PLACEHOLDER_DESCRIPTION}
          ></textarea>
        </div>

        <!-- Area Lead Dropdown -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="area-lead-hidden"
          >
            <i class="fas fa-user-tie mr-1"></i>
            {MESSAGES.LABEL_AREA_LEAD}
          </label>
          <input
            type="hidden"
            id="area-lead-hidden"
            value={formAreaLeadId ?? ''}
          />
          <div
            class="dropdown"
            id="area-lead-dropdown"
          >
            <button
              type="button"
              class="dropdown__trigger"
              class:active={areaLeadDropdownOpen}
              onclick={toggleAreaLeadDropdown}
            >
              <span>{areaLeadDisplayName}</span>
              <i class="fas fa-chevron-down"></i>
            </button>
            <div
              class="dropdown__menu"
              class:active={areaLeadDropdownOpen}
            >
              <button
                type="button"
                class="dropdown__option"
                onclick={() => {
                  selectAreaLead(null);
                }}
              >
                {MESSAGES.NO_AREA_LEAD}
              </button>
              {#each areaLeads as user (user.id)}
                <button
                  type="button"
                  class="dropdown__option"
                  onclick={() => {
                    selectAreaLead(user.id);
                  }}
                >
                  {user.firstName}
                  {user.lastName}
                  {user.role === 'root' ? '(Root)' : '(Admin)'}
                </button>
              {/each}
            </div>
          </div>
          <span class="form-field__message text-(--color-text-secondary)">
            <i class="fas fa-info-circle mr-1"></i>
            {MESSAGES.AREA_LEAD_HINT}
          </span>
        </div>

        <!-- Type Dropdown -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="area-type-hidden"
          >
            {MESSAGES.LABEL_TYPE} <span class="text-red-500">*</span>
          </label>
          <input
            type="hidden"
            id="area-type-hidden"
            value={formType}
          />
          <div
            class="dropdown"
            id="type-dropdown"
          >
            <button
              type="button"
              class="dropdown__trigger"
              class:active={typeDropdownOpen}
              onclick={toggleTypeDropdown}
            >
              <span>{getTypeLabel(formType)}</span>
              <i class="fas fa-chevron-down"></i>
            </button>
            <div
              class="dropdown__menu"
              class:active={typeDropdownOpen}
            >
              {#each TYPE_OPTIONS as option (option.value)}
                <button
                  type="button"
                  class="dropdown__option"
                  onclick={() => {
                    selectType(option.value);
                  }}
                >
                  {option.label}
                </button>
              {/each}
            </div>
          </div>
        </div>

        <!-- Capacity -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="area-capacity">{MESSAGES.LABEL_CAPACITY}</label
          >
          <input
            type="number"
            id="area-capacity"
            name="capacity"
            class="form-field__control"
            min="0"
            bind:value={formCapacity}
            placeholder={MESSAGES.PLACEHOLDER_CAPACITY}
          />
        </div>

        <!-- Address -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="area-address">{MESSAGES.LABEL_ADDRESS}</label
          >
          <input
            type="text"
            id="area-address"
            name="address"
            class="form-field__control"
            bind:value={formAddress}
            placeholder={MESSAGES.PLACEHOLDER_ADDRESS}
          />
        </div>

        <!-- Department Multi-Select -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="area-departments"
          >
            <i class="fas fa-sitemap mr-1"></i>
            {MESSAGES.LABEL_DEPARTMENTS}
          </label>
          <select
            id="area-departments"
            name="departmentIds"
            multiple
            class="form-field__control min-h-[120px]"
            bind:value={formDepartmentIds}
          >
            {#each allDepartments as dept (dept.id)}
              <option value={dept.id}>{dept.name}</option>
            {/each}
          </select>
          <span class="form-field__message text-(--color-text-secondary)">
            <i class="fas fa-info-circle mr-1"></i>
            {MESSAGES.DEPARTMENTS_HINT}
          </span>
        </div>

        <!-- Status Dropdown (only in edit mode) -->
        {#if isEditMode}
          <div class="form-field">
            <label
              class="form-field__label"
              for="area-status-hidden"
            >
              {MESSAGES.LABEL_STATUS} <span class="text-red-500">*</span>
            </label>
            <input
              type="hidden"
              id="area-status-hidden"
              value={formIsActive}
            />
            <div
              class="dropdown"
              id="status-dropdown"
            >
              <button
                type="button"
                class="dropdown__trigger"
                class:active={statusDropdownOpen}
                onclick={toggleStatusDropdown}
              >
                <span class="badge {getStatusBadgeClass(formIsActive)}"
                  >{getStatusLabel(formIsActive)}</span
                >
                <i class="fas fa-chevron-down"></i>
              </button>
              <div
                class="dropdown__menu"
                class:active={statusDropdownOpen}
              >
                <button
                  type="button"
                  class="dropdown__option"
                  onclick={() => {
                    selectStatus(1);
                  }}
                >
                  <span class="badge badge--success">Aktiv</span>
                </button>
                <button
                  type="button"
                  class="dropdown__option"
                  onclick={() => {
                    selectStatus(0);
                  }}
                >
                  <span class="badge badge--warning">Inaktiv</span>
                </button>
                <button
                  type="button"
                  class="dropdown__option"
                  onclick={() => {
                    selectStatus(3);
                  }}
                >
                  <span class="badge badge--secondary">Archiviert</span>
                </button>
              </div>
            </div>
            <span
              class="form-field__message mt-1 block text-(--color-text-secondary)"
            >
              {MESSAGES.STATUS_HINT}
            </span>
          </div>
        {/if}
      </div>

      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={onclose}>{MESSAGES.BTN_CANCEL}</button
        >
        <button
          type="submit"
          class="btn btn-modal"
          disabled={submitting}
        >
          {#if submitting}<span class="spinner-ring spinner-ring--sm mr-2"
            ></span>{/if}
          {MESSAGES.BTN_SAVE}
        </button>
      </div>
    </form>
  </div>
{/if}
