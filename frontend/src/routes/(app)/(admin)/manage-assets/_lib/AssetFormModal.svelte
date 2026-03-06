<script lang="ts">
  import { onClickOutsideDropdown } from '$lib/actions/click-outside';

  import { MESSAGES, MACHINE_TYPE_OPTIONS } from './constants';
  import { assetState } from './state.svelte';

  interface Props {
    onsubmit: (e: Event) => void;
    onclose: () => void;
  }

  const { onsubmit, onclose }: Props = $props();

  // ==========================================================================
  // DROPDOWN HANDLERS
  // ==========================================================================

  function toggleDepartmentDropdown(e: MouseEvent) {
    e.stopPropagation();
    const wasOpen = assetState.departmentDropdownOpen;
    assetState.closeAllDropdowns();
    assetState.setDepartmentDropdownOpen(!wasOpen);
  }

  function selectDepartment(deptId: number | null) {
    assetState.setFormDepartmentId(deptId);
    assetState.setDepartmentDropdownOpen(false);
    assetState.setFormTeamIds([]);
  }

  function toggleAreaDropdown(e: MouseEvent) {
    e.stopPropagation();
    const wasOpen = assetState.areaDropdownOpen;
    assetState.closeAllDropdowns();
    assetState.setAreaDropdownOpen(!wasOpen);
  }

  function selectArea(areaId: number | null) {
    assetState.setFormAreaId(areaId);
    assetState.setAreaDropdownOpen(false);
    assetState.setFormDepartmentId(null);
    assetState.setFormTeamIds([]);
  }

  function toggleTypeDropdown(e: MouseEvent) {
    e.stopPropagation();
    const wasOpen = assetState.typeDropdownOpen;
    assetState.closeAllDropdowns();
    assetState.setTypeDropdownOpen(!wasOpen);
  }

  function selectType(type: string) {
    assetState.setFormAssetType(type);
    assetState.setTypeDropdownOpen(false);
  }

  function toggleTeamsDropdown(e: MouseEvent) {
    e.stopPropagation();
    if (assetState.formDepartmentId === null) return;
    const wasOpen = assetState.teamsDropdownOpen;
    assetState.closeAllDropdowns();
    assetState.setTeamsDropdownOpen(!wasOpen);
  }

  function toggleTeamSelection(teamId: number) {
    const currentIds = assetState.formTeamIds;
    if (currentIds.includes(teamId)) {
      assetState.setFormTeamIds(currentIds.filter((id) => id !== teamId));
    } else {
      assetState.setFormTeamIds([...currentIds, teamId]);
    }
  }

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }

  // Capture-phase click-outside: works inside modals (bypasses stopPropagation)
  $effect(() => {
    return onClickOutsideDropdown(() => {
      assetState.closeAllDropdowns();
    });
  });
</script>

{#if assetState.showAssetModal}
  <div
    id="asset-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="asset-modal-title"
    tabindex="-1"
    onclick={handleOverlayClick}
    onkeydown={(e) => {
      if (e.key === 'Escape') onclose();
    }}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <form
      id="asset-form"
      class="ds-modal"
      onclick={(e) => {
        e.stopPropagation();
      }}
      onkeydown={(e) => {
        e.stopPropagation();
      }}
      {onsubmit}
    >
      <div class="ds-modal__header">
        <h3
          class="ds-modal__title"
          id="asset-modal-title"
        >
          {assetState.modalTitle}
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
        <div class="form-field">
          <label
            class="form-field__label"
            for="asset-name"
          >
            {MESSAGES.LABEL_NAME} <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="asset-name"
            name="name"
            class="form-field__control"
            required
            value={assetState.formName}
            oninput={(e) => {
              assetState.setFormName((e.target as HTMLInputElement).value);
            }}
          />
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="asset-model">{MESSAGES.LABEL_MODEL}</label
          >
          <input
            type="text"
            id="asset-model"
            name="model"
            class="form-field__control"
            value={assetState.formModel}
            oninput={(e) => {
              assetState.setFormModel((e.target as HTMLInputElement).value);
            }}
          />
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="asset-manufacturer"
          >
            {MESSAGES.LABEL_MANUFACTURER}
          </label>
          <input
            type="text"
            id="asset-manufacturer"
            name="manufacturer"
            class="form-field__control"
            value={assetState.formManufacturer}
            oninput={(e) => {
              assetState.setFormManufacturer(
                (e.target as HTMLInputElement).value,
              );
            }}
          />
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="asset-serial">{MESSAGES.LABEL_SERIAL}</label
          >
          <input
            type="text"
            id="asset-serial"
            name="serialNumber"
            class="form-field__control"
            value={assetState.formSerialNumber}
            oninput={(e) => {
              assetState.setFormSerialNumber(
                (e.target as HTMLInputElement).value,
              );
            }}
          />
        </div>

        <!-- 1. AREA DROPDOWN (Parent) -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="asset-area">{MESSAGES.LABEL_AREA}</label
          >
          <input
            type="hidden"
            id="asset-area"
            name="areaId"
            value={assetState.formAreaId ?? ''}
          />
          <div
            class="dropdown"
            id="area-dropdown"
          >
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="dropdown__trigger"
              class:active={assetState.areaDropdownOpen}
              onclick={toggleAreaDropdown}
            >
              <span>{assetState.selectedAreaName}</span>
              <i class="fas fa-chevron-down"></i>
            </div>
            <div
              class="dropdown__menu"
              class:active={assetState.areaDropdownOpen}
            >
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="dropdown__option"
                onclick={() => {
                  selectArea(null);
                }}
              >
                {MESSAGES.PLACEHOLDER_AREA}
              </div>
              {#each assetState.allAreas as area (area.id)}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="dropdown__option"
                  onclick={() => {
                    selectArea(area.id);
                  }}
                >
                  {area.name}
                </div>
              {/each}
            </div>
          </div>
        </div>

        <!-- 2. DEPARTMENT DROPDOWN (Filtered by Area) -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="asset-department">{MESSAGES.LABEL_DEPARTMENT}</label
          >
          <input
            type="hidden"
            id="asset-department"
            name="departmentId"
            value={assetState.formDepartmentId ?? ''}
          />
          <div
            class="dropdown"
            id="department-dropdown"
            class:disabled={assetState.isDepartmentDisabled}
          >
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="dropdown__trigger"
              class:active={assetState.departmentDropdownOpen}
              class:disabled={assetState.isDepartmentDisabled}
              onclick={(e) => {
                if (!assetState.isDepartmentDisabled) {
                  toggleDepartmentDropdown(e);
                }
              }}
            >
              <span>
                {#if assetState.isDepartmentDisabled}
                  {MESSAGES.PLACEHOLDER_SELECT_AREA_FIRST}
                {:else}
                  {assetState.selectedDepartmentName}
                {/if}
              </span>
              <i class="fas fa-chevron-down"></i>
            </div>
            {#if !assetState.isDepartmentDisabled}
              <div
                class="dropdown__menu"
                class:active={assetState.departmentDropdownOpen}
              >
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="dropdown__option"
                  onclick={() => {
                    selectDepartment(null);
                  }}
                >
                  {MESSAGES.PLACEHOLDER_DEPARTMENT}
                </div>
                {#each assetState.filteredDepartments as dept (dept.id)}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    class="dropdown__option"
                    onclick={() => {
                      selectDepartment(dept.id);
                    }}
                  >
                    {dept.name}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <!-- 3. TEAMS DROPDOWN (Multi-Select, Filtered by Department) -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="asset-teams">{MESSAGES.LABEL_TEAMS}</label
          >
          <div
            class="dropdown"
            id="teams-dropdown"
            class:disabled={assetState.isTeamsDisabled}
          >
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="dropdown__trigger"
              class:active={assetState.teamsDropdownOpen}
              class:disabled={assetState.isTeamsDisabled}
              onclick={toggleTeamsDropdown}
            >
              <span>{assetState.teamsDisplayText}</span>
              <i class="fas fa-chevron-down"></i>
            </div>
            {#if !assetState.isTeamsDisabled}
              <div
                class="dropdown__menu dropdown__menu--multi"
                class:active={assetState.teamsDropdownOpen}
              >
                {#if assetState.filteredTeams.length === 0}
                  <div class="dropdown__option dropdown__option--disabled">
                    {MESSAGES.PLACEHOLDER_NO_TEAMS_AVAILABLE}
                  </div>
                {:else}
                  {#each assetState.filteredTeams as team (team.id)}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                      class="dropdown__option dropdown__option--checkbox"
                      onclick={() => {
                        toggleTeamSelection(team.id);
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={assetState.formTeamIds.includes(team.id)}
                        class="dropdown__checkbox"
                        onclick={(e) => {
                          e.stopPropagation();
                        }}
                        onchange={() => {
                          toggleTeamSelection(team.id);
                        }}
                      />
                      <span>{team.name}</span>
                    </div>
                  {/each}
                {/if}
              </div>
            {/if}
          </div>
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="asset-type">{MESSAGES.LABEL_TYPE}</label
          >
          <input
            type="hidden"
            id="asset-type"
            name="assetType"
            value={assetState.formAssetType}
          />
          <div
            class="dropdown"
            id="type-dropdown"
          >
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="dropdown__trigger"
              class:active={assetState.typeDropdownOpen}
              onclick={toggleTypeDropdown}
            >
              <span>{assetState.selectedTypeLabel}</span>
              <i class="fas fa-chevron-down"></i>
            </div>
            <div
              class="dropdown__menu"
              class:active={assetState.typeDropdownOpen}
            >
              {#each MACHINE_TYPE_OPTIONS as option (option.value)}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="dropdown__option"
                  onclick={() => {
                    selectType(option.value);
                  }}
                >
                  {option.label}
                </div>
              {/each}
            </div>
          </div>
        </div>
      </div>

      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={onclose}
        >
          {MESSAGES.BTN_CANCEL}
        </button>
        <button
          type="submit"
          class="btn btn-primary"
          disabled={assetState.submitting}
        >
          {#if assetState.submitting}<span
              class="spinner-ring spinner-ring--sm mr-2"
            ></span>{/if}
          {MESSAGES.BTN_SAVE}
        </button>
      </div>
    </form>
  </div>
{/if}

<style>
  /* Cascading Dropdowns — Disabled State */
  .dropdown.disabled :global(.dropdown__trigger),
  :global(.dropdown__trigger.disabled) {
    opacity: 50%;
    cursor: not-allowed;
    pointer-events: none;
    background-color: var(--color-glass-light);
  }

  /* Teams Multi-Select Dropdown */
  .dropdown__menu--multi {
    max-height: 280px;
    overflow-y: auto;
  }

  .dropdown__option--checkbox {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
  }

  .dropdown__option--checkbox:hover {
    background-color: var(--color-glass-light);
  }

  .dropdown__checkbox {
    width: 18px;
    height: 18px;
    accent-color: var(--color-primary);
    cursor: pointer;
    flex-shrink: 0;
  }

  .dropdown__option--disabled {
    opacity: 50%;
    cursor: not-allowed;
    font-style: italic;
  }
</style>
