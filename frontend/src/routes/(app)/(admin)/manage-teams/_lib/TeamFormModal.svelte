<script lang="ts">
  import { MESSAGES } from './constants';
  import {
    getStatusBadgeClass,
    getStatusLabel,
    getMembersDisplayText,
    getMachinesDisplayText,
    getDepartmentDisplayText,
    getLeaderDisplayText,
    toggleIdInArray,
  } from './utils';

  import type {
    Department,
    Admin,
    TeamMember,
    Machine,
    FormIsActiveStatus,
  } from './types';

  interface Props {
    isEditMode: boolean;
    modalTitle: string;
    formName: string;
    formDescription: string;
    formDepartmentId: number | null;
    formLeaderId: number | null;
    formMemberIds: number[];
    formMachineIds: number[];
    formIsActive: FormIsActiveStatus;
    allDepartments: Department[];
    allAdmins: Admin[];
    allEmployees: TeamMember[];
    allMachines: Machine[];
    submitting: boolean;
    onclose: () => void;
    onsubmit: (data: {
      name: string;
      description: string;
      departmentId: number | null;
      leaderId: number | null;
      memberIds: number[];
      machineIds: number[];
      isActive: FormIsActiveStatus;
    }) => void;
  }

  // Destructure all props directly from $props() for ESLint compatibility
  const {
    isEditMode,
    modalTitle,
    formName,
    formDescription,
    formDepartmentId,
    formLeaderId,
    formMemberIds,
    formMachineIds,
    formIsActive,
    allDepartments,
    allAdmins,
    allEmployees,
    allMachines,
    submitting,
    onclose,
    onsubmit,
  }: Props = $props();

  // Local form state - initialize with defaults, sync via $effect
  let localName = $state('');
  let localDescription = $state('');
  let localDepartmentId = $state<number | null>(null);
  let localLeaderId = $state<number | null>(null);
  let localMemberIds = $state<number[]>([]);
  let localMachineIds = $state<number[]>([]);
  let localIsActive = $state<FormIsActiveStatus>(1);

  // Sync props to local state when they change
  $effect(() => {
    localName = formName;
    localDescription = formDescription;
    localDepartmentId = formDepartmentId;
    localLeaderId = formLeaderId;
    localMemberIds = [...formMemberIds];
    localMachineIds = [...formMachineIds];
    localIsActive = formIsActive;
  });

  // Dropdown states
  let departmentDropdownOpen = $state(false);
  let leaderDropdownOpen = $state(false);
  let membersDropdownOpen = $state(false);
  let machinesDropdownOpen = $state(false);
  let statusDropdownOpen = $state(false);

  function closeOtherDropdowns(except: string): void {
    if (except !== 'department') departmentDropdownOpen = false;
    if (except !== 'leader') leaderDropdownOpen = false;
    if (except !== 'members') membersDropdownOpen = false;
    if (except !== 'machines') machinesDropdownOpen = false;
    if (except !== 'status') statusDropdownOpen = false;
  }

  function toggleDepartmentDropdown(e: MouseEvent): void {
    e.stopPropagation();
    closeOtherDropdowns('department');
    departmentDropdownOpen = !departmentDropdownOpen;
  }

  function selectDepartment(id: number | null): void {
    localDepartmentId = id;
    departmentDropdownOpen = false;
  }

  function toggleLeaderDropdown(e: MouseEvent): void {
    e.stopPropagation();
    closeOtherDropdowns('leader');
    leaderDropdownOpen = !leaderDropdownOpen;
  }

  function selectLeader(id: number | null): void {
    localLeaderId = id;
    leaderDropdownOpen = false;
  }

  function toggleMembersDropdown(e: MouseEvent): void {
    e.stopPropagation();
    closeOtherDropdowns('members');
    membersDropdownOpen = !membersDropdownOpen;
  }

  function toggleMember(id: number): void {
    localMemberIds = toggleIdInArray(localMemberIds, id);
  }

  function toggleMachinesDropdown(e: MouseEvent): void {
    e.stopPropagation();
    closeOtherDropdowns('machines');
    machinesDropdownOpen = !machinesDropdownOpen;
  }

  function toggleMachine(id: number): void {
    localMachineIds = toggleIdInArray(localMachineIds, id);
  }

  function toggleStatusDropdown(e: MouseEvent): void {
    e.stopPropagation();
    closeOtherDropdowns('status');
    statusDropdownOpen = !statusDropdownOpen;
  }

  function selectStatus(status: FormIsActiveStatus): void {
    localIsActive = status;
    statusDropdownOpen = false;
  }

  function handleOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onclose();
  }

  function handleFormSubmit(e: Event): void {
    e.preventDefault();
    onsubmit({
      name: localName,
      description: localDescription,
      departmentId: localDepartmentId,
      leaderId: localLeaderId,
      memberIds: localMemberIds,
      machineIds: localMachineIds,
      isActive: localIsActive,
    });
  }

  /** Close dropdown if click is outside its container */
  function closeDropdownIfOutside(
    target: HTMLElement,
    isOpen: boolean,
    selector: string,
  ): boolean {
    return isOpen && !target.closest(selector) ? false : isOpen;
  }

  function handleOutsideClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    departmentDropdownOpen = closeDropdownIfOutside(
      target,
      departmentDropdownOpen,
      '#department-dropdown',
    );
    leaderDropdownOpen = closeDropdownIfOutside(
      target,
      leaderDropdownOpen,
      '#team-lead-dropdown',
    );
    membersDropdownOpen = closeDropdownIfOutside(
      target,
      membersDropdownOpen,
      '#team-members-dropdown',
    );
    machinesDropdownOpen = closeDropdownIfOutside(
      target,
      machinesDropdownOpen,
      '#team-machines-dropdown',
    );
    statusDropdownOpen = closeDropdownIfOutside(
      target,
      statusDropdownOpen,
      '#status-dropdown',
    );
  }
</script>

<svelte:document onclick={handleOutsideClick} />

<div
  class="modal-overlay modal-overlay--active"
  role="dialog"
  aria-modal="true"
  aria-labelledby="team-modal-title"
  tabindex="-1"
  onclick={handleOverlayClick}
  onkeydown={(e) => {
    if (e.key === 'Escape') onclose();
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
    onsubmit={handleFormSubmit}
  >
    <div class="ds-modal__header">
      <h3
        class="ds-modal__title"
        id="team-modal-title"
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
      <div class="form-field">
        <label
          class="form-field__label"
          for="team-name"
        >
          Name <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="team-name"
          name="name"
          class="form-field__control"
          required
          bind:value={localName}
        />
      </div>

      <div class="form-field">
        <label
          class="form-field__label"
          for="team-description">Beschreibung</label
        >
        <textarea
          id="team-description"
          name="description"
          class="form-field__control"
          rows="3"
          bind:value={localDescription}
        ></textarea>
      </div>

      <div class="form-field">
        <label
          class="form-field__label"
          for="team-department">Abteilung</label
        >
        <div
          class="dropdown"
          id="department-dropdown"
        >
          <button
            type="button"
            class="dropdown__trigger"
            class:active={departmentDropdownOpen}
            onclick={toggleDepartmentDropdown}
          >
            <span
              >{getDepartmentDisplayText(
                localDepartmentId,
                allDepartments,
              )}</span
            >
            <i class="fas fa-chevron-down"></i>
          </button>
          <div
            class="dropdown__menu"
            class:active={departmentDropdownOpen}
          >
            <button
              type="button"
              class="dropdown__option"
              onclick={() => {
                selectDepartment(null);
              }}
            >
              {MESSAGES.NO_DEPARTMENT}
            </button>
            {#each allDepartments as dept (dept.id)}
              <button
                type="button"
                class="dropdown__option"
                onclick={() => {
                  selectDepartment(dept.id);
                }}
              >
                {dept.name}
              </button>
            {/each}
          </div>
        </div>
      </div>

      <div class="form-field">
        <label
          class="form-field__label"
          for="team-lead">Team-Leiter (Admin)</label
        >
        <div
          class="dropdown"
          id="team-lead-dropdown"
        >
          <button
            type="button"
            class="dropdown__trigger"
            class:active={leaderDropdownOpen}
            onclick={toggleLeaderDropdown}
          >
            <span>{getLeaderDisplayText(localLeaderId, allAdmins)}</span>
            <i class="fas fa-chevron-down"></i>
          </button>
          <div
            class="dropdown__menu"
            class:active={leaderDropdownOpen}
          >
            <button
              type="button"
              class="dropdown__option"
              onclick={() => {
                selectLeader(null);
              }}
            >
              {MESSAGES.NO_LEADER}
            </button>
            {#each allAdmins as admin (admin.id)}
              <button
                type="button"
                class="dropdown__option"
                onclick={() => {
                  selectLeader(admin.id);
                }}
              >
                {admin.firstName}
                {admin.lastName}
              </button>
            {/each}
          </div>
        </div>
      </div>

      <div class="form-field">
        <label
          class="form-field__label"
          for="team-members">Team-Mitglieder</label
        >
        <div
          class="dropdown"
          id="team-members-dropdown"
        >
          <button
            type="button"
            class="dropdown__trigger"
            class:active={membersDropdownOpen}
            onclick={toggleMembersDropdown}
          >
            <span>{getMembersDisplayText(localMemberIds, allEmployees)}</span>
            <i class="fas fa-chevron-down"></i>
          </button>
          <div
            class="dropdown__menu dropdown__menu--scrollable"
            class:active={membersDropdownOpen}
          >
            {#each allEmployees as employee (employee.id)}
              <button
                type="button"
                class="dropdown__option dropdown__option--checkbox"
                onclick={() => {
                  toggleMember(employee.id);
                }}
              >
                <input
                  type="checkbox"
                  checked={localMemberIds.includes(employee.id)}
                  class="mr-2"
                  onclick={(e) => {
                    e.stopPropagation();
                  }}
                  onchange={() => {
                    toggleMember(employee.id);
                  }}
                />
                {employee.firstName}
                {employee.lastName}
              </button>
            {/each}
            {#if allEmployees.length === 0}
              <div class="dropdown__option dropdown__option--disabled">
                {MESSAGES.NO_EMPLOYEES_AVAILABLE}
              </div>
            {/if}
          </div>
        </div>
      </div>

      <div class="form-field">
        <label
          class="form-field__label"
          for="team-machines">Zugewiesene Maschinen</label
        >
        <div
          class="dropdown"
          id="team-machines-dropdown"
        >
          <button
            type="button"
            class="dropdown__trigger"
            class:active={machinesDropdownOpen}
            onclick={toggleMachinesDropdown}
          >
            <span>{getMachinesDisplayText(localMachineIds, allMachines)}</span>
            <i class="fas fa-chevron-down"></i>
          </button>
          <div
            class="dropdown__menu dropdown__menu--scrollable"
            class:active={machinesDropdownOpen}
          >
            {#each allMachines as machine (machine.id)}
              <button
                type="button"
                class="dropdown__option dropdown__option--checkbox"
                onclick={() => {
                  toggleMachine(machine.id);
                }}
              >
                <input
                  type="checkbox"
                  checked={localMachineIds.includes(machine.id)}
                  class="mr-2"
                  onclick={(e) => {
                    e.stopPropagation();
                  }}
                  onchange={() => {
                    toggleMachine(machine.id);
                  }}
                />
                {machine.name}
              </button>
            {/each}
            {#if allMachines.length === 0}
              <div class="dropdown__option dropdown__option--disabled">
                {MESSAGES.NO_MACHINES_AVAILABLE}
              </div>
            {/if}
          </div>
        </div>
      </div>

      {#if isEditMode}
        <div class="form-field mt-6">
          <label
            class="form-field__label"
            for="team-is-active"
          >
            Status <span class="text-red-500">*</span>
          </label>
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
              <span class="badge {getStatusBadgeClass(localIsActive)}"
                >{getStatusLabel(localIsActive)}</span
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
          <span class="form-field__hint mt-1 block">
            {MESSAGES.STATUS_HINT}
          </span>
        </div>
      {/if}
    </div>

    <div class="ds-modal__footer">
      <button
        type="button"
        class="btn btn-cancel"
        onclick={onclose}>Abbrechen</button
      >
      <button
        type="submit"
        class="btn btn-modal"
        disabled={submitting}
      >
        {#if submitting}<span class="spinner-ring spinner-ring--sm mr-2"
          ></span>{/if}
        Speichern
      </button>
    </div>
  </form>
</div>
