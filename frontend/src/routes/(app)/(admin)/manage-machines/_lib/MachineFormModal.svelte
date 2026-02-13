<script lang="ts">
  import { onClickOutsideDropdown } from '$lib/actions/click-outside';

  import { MESSAGES, MACHINE_TYPE_OPTIONS, STATUS_OPTIONS } from './constants';
  import { machineState } from './state.svelte';
  import { getStatusBadgeClass, getStatusLabel } from './utils';

  import type { MachineStatus } from './types';

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
    const wasOpen = machineState.departmentDropdownOpen;
    machineState.closeAllDropdowns();
    machineState.setDepartmentDropdownOpen(!wasOpen);
  }

  function selectDepartment(deptId: number | null) {
    machineState.setFormDepartmentId(deptId);
    machineState.setDepartmentDropdownOpen(false);
    machineState.setFormTeamIds([]);
  }

  function toggleAreaDropdown(e: MouseEvent) {
    e.stopPropagation();
    const wasOpen = machineState.areaDropdownOpen;
    machineState.closeAllDropdowns();
    machineState.setAreaDropdownOpen(!wasOpen);
  }

  function selectArea(areaId: number | null) {
    machineState.setFormAreaId(areaId);
    machineState.setAreaDropdownOpen(false);
    machineState.setFormDepartmentId(null);
    machineState.setFormTeamIds([]);
  }

  function toggleTypeDropdown(e: MouseEvent) {
    e.stopPropagation();
    const wasOpen = machineState.typeDropdownOpen;
    machineState.closeAllDropdowns();
    machineState.setTypeDropdownOpen(!wasOpen);
  }

  function selectType(type: string) {
    machineState.setFormMachineType(type);
    machineState.setTypeDropdownOpen(false);
  }

  function toggleStatusDropdown(e: MouseEvent) {
    e.stopPropagation();
    const wasOpen = machineState.statusDropdownOpen;
    machineState.closeAllDropdowns();
    machineState.setStatusDropdownOpen(!wasOpen);
  }

  function selectStatus(status: MachineStatus) {
    machineState.setFormStatus(status);
    machineState.setStatusDropdownOpen(false);
  }

  function toggleTeamsDropdown(e: MouseEvent) {
    e.stopPropagation();
    if (machineState.formDepartmentId === null) return;
    const wasOpen = machineState.teamsDropdownOpen;
    machineState.closeAllDropdowns();
    machineState.setTeamsDropdownOpen(!wasOpen);
  }

  function toggleTeamSelection(teamId: number) {
    const currentIds = machineState.formTeamIds;
    if (currentIds.includes(teamId)) {
      machineState.setFormTeamIds(currentIds.filter((id) => id !== teamId));
    } else {
      machineState.setFormTeamIds([...currentIds, teamId]);
    }
  }

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }

  // Capture-phase click-outside: works inside modals (bypasses stopPropagation)
  $effect(() => {
    return onClickOutsideDropdown(() => {
      machineState.closeAllDropdowns();
    });
  });
</script>

{#if machineState.showMachineModal}
  <div
    id="machine-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="machine-modal-title"
    tabindex="-1"
    onclick={handleOverlayClick}
    onkeydown={(e) => {
      if (e.key === 'Escape') onclose();
    }}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <form
      id="machine-form"
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
          id="machine-modal-title"
        >
          {machineState.modalTitle}
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
            for="machine-name"
          >
            {MESSAGES.LABEL_NAME} <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="machine-name"
            name="name"
            class="form-field__control"
            required
            value={machineState.formName}
            oninput={(e) => {
              machineState.setFormName((e.target as HTMLInputElement).value);
            }}
          />
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="machine-model">{MESSAGES.LABEL_MODEL}</label
          >
          <input
            type="text"
            id="machine-model"
            name="model"
            class="form-field__control"
            value={machineState.formModel}
            oninput={(e) => {
              machineState.setFormModel((e.target as HTMLInputElement).value);
            }}
          />
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="machine-manufacturer"
          >
            {MESSAGES.LABEL_MANUFACTURER}
          </label>
          <input
            type="text"
            id="machine-manufacturer"
            name="manufacturer"
            class="form-field__control"
            value={machineState.formManufacturer}
            oninput={(e) => {
              machineState.setFormManufacturer(
                (e.target as HTMLInputElement).value,
              );
            }}
          />
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="machine-serial">{MESSAGES.LABEL_SERIAL}</label
          >
          <input
            type="text"
            id="machine-serial"
            name="serialNumber"
            class="form-field__control"
            value={machineState.formSerialNumber}
            oninput={(e) => {
              machineState.setFormSerialNumber(
                (e.target as HTMLInputElement).value,
              );
            }}
          />
        </div>

        <!-- 1. AREA DROPDOWN (Parent) -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="machine-area">{MESSAGES.LABEL_AREA}</label
          >
          <input
            type="hidden"
            id="machine-area"
            name="areaId"
            value={machineState.formAreaId ?? ''}
          />
          <div
            class="dropdown"
            id="area-dropdown"
          >
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="dropdown__trigger"
              class:active={machineState.areaDropdownOpen}
              onclick={toggleAreaDropdown}
            >
              <span>{machineState.selectedAreaName}</span>
              <i class="fas fa-chevron-down"></i>
            </div>
            <div
              class="dropdown__menu"
              class:active={machineState.areaDropdownOpen}
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
              {#each machineState.allAreas as area (area.id)}
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
            for="machine-department">{MESSAGES.LABEL_DEPARTMENT}</label
          >
          <input
            type="hidden"
            id="machine-department"
            name="departmentId"
            value={machineState.formDepartmentId ?? ''}
          />
          <div
            class="dropdown"
            id="department-dropdown"
            class:disabled={machineState.isDepartmentDisabled}
          >
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="dropdown__trigger"
              class:active={machineState.departmentDropdownOpen}
              class:disabled={machineState.isDepartmentDisabled}
              onclick={(e) => {
                if (!machineState.isDepartmentDisabled) {
                  toggleDepartmentDropdown(e);
                }
              }}
            >
              <span>
                {#if machineState.isDepartmentDisabled}
                  {MESSAGES.PLACEHOLDER_SELECT_AREA_FIRST}
                {:else}
                  {machineState.selectedDepartmentName}
                {/if}
              </span>
              <i class="fas fa-chevron-down"></i>
            </div>
            {#if !machineState.isDepartmentDisabled}
              <div
                class="dropdown__menu"
                class:active={machineState.departmentDropdownOpen}
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
                {#each machineState.filteredDepartments as dept (dept.id)}
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
            for="machine-teams">{MESSAGES.LABEL_TEAMS}</label
          >
          <div
            class="dropdown"
            id="teams-dropdown"
            class:disabled={machineState.isTeamsDisabled}
          >
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="dropdown__trigger"
              class:active={machineState.teamsDropdownOpen}
              class:disabled={machineState.isTeamsDisabled}
              onclick={toggleTeamsDropdown}
            >
              <span>{machineState.teamsDisplayText}</span>
              <i class="fas fa-chevron-down"></i>
            </div>
            {#if !machineState.isTeamsDisabled}
              <div
                class="dropdown__menu dropdown__menu--multi"
                class:active={machineState.teamsDropdownOpen}
              >
                {#if machineState.filteredTeams.length === 0}
                  <div class="dropdown__option dropdown__option--disabled">
                    {MESSAGES.PLACEHOLDER_NO_TEAMS_AVAILABLE}
                  </div>
                {:else}
                  {#each machineState.filteredTeams as team (team.id)}
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
                        checked={machineState.formTeamIds.includes(team.id)}
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
            for="machine-type">{MESSAGES.LABEL_TYPE}</label
          >
          <input
            type="hidden"
            id="machine-type"
            name="machineType"
            value={machineState.formMachineType}
          />
          <div
            class="dropdown"
            id="type-dropdown"
          >
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="dropdown__trigger"
              class:active={machineState.typeDropdownOpen}
              onclick={toggleTypeDropdown}
            >
              <span>{machineState.selectedTypeLabel}</span>
              <i class="fas fa-chevron-down"></i>
            </div>
            <div
              class="dropdown__menu"
              class:active={machineState.typeDropdownOpen}
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

        <div class="form-field">
          <label
            class="form-field__label"
            for="machine-status">{MESSAGES.LABEL_STATUS}</label
          >
          <input
            type="hidden"
            id="machine-status"
            name="status"
            value={machineState.formStatus}
          />
          <div
            class="dropdown"
            id="status-dropdown"
          >
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="dropdown__trigger"
              class:active={machineState.statusDropdownOpen}
              onclick={toggleStatusDropdown}
            >
              <span
                class="badge {getStatusBadgeClass(machineState.formStatus)}"
              >
                {getStatusLabel(machineState.formStatus)}
              </span>
              <i class="fas fa-chevron-down"></i>
            </div>
            <div
              class="dropdown__menu"
              class:active={machineState.statusDropdownOpen}
            >
              {#each STATUS_OPTIONS as option (option.value)}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="dropdown__option"
                  onclick={() => {
                    selectStatus(option.value);
                  }}
                >
                  <span class="badge {option.class}">{option.label}</span>
                </div>
              {/each}
            </div>
          </div>
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="machine-hours">{MESSAGES.LABEL_HOURS}</label
          >
          <input
            type="number"
            id="machine-hours"
            name="operatingHours"
            class="form-field__control"
            min="0"
            step="1"
            value={machineState.formOperatingHours ?? ''}
            oninput={(e) => {
              const val = (e.target as HTMLInputElement).value;
              machineState.setFormOperatingHours(
                val !== '' ? Math.round(Number(val)) : null,
              );
            }}
          />
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="machine-next-maintenance"
          >
            {MESSAGES.LABEL_NEXT_MAINTENANCE}
          </label>
          <div class="date-picker">
            <i class="date-picker__icon fas fa-calendar"></i>
            <input
              type="date"
              id="machine-next-maintenance"
              name="nextMaintenance"
              class="date-picker__input"
              value={machineState.formNextMaintenance}
              oninput={(e) => {
                machineState.setFormNextMaintenance(
                  (e.target as HTMLInputElement).value,
                );
              }}
            />
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
          class="btn btn-modal"
          disabled={machineState.submitting}
        >
          {#if machineState.submitting}<span
              class="spinner-ring spinner-ring--sm mr-2"
            ></span>{/if}
          {MESSAGES.BTN_SAVE}
        </button>
      </div>
    </form>
  </div>
{/if}
