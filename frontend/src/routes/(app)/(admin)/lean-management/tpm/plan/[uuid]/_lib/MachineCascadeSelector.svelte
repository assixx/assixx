<script lang="ts">
  /**
   * Machine Cascade Selector (Area → Department → Machine)
   * @module plan/[uuid]/_lib/MachineCascadeSelector
   *
   * Three-level cascade dropdown for selecting a machine.
   * Used in TPM plan create mode only.
   */
  import { MESSAGES } from '../../../_lib/constants';

  import type { Machine, TpmArea, TpmDepartment } from '../../../_lib/types';

  interface Props {
    machines: Machine[];
    areas: TpmArea[];
    departments: TpmDepartment[];
    machineUuidsWithPlans: string[];
    submitting: boolean;
    onselect: (machineUuid: string) => void;
  }

  const {
    machines,
    areas,
    departments,
    machineUuidsWithPlans,
    submitting,
    onselect,
  }: Props = $props();

  // =========================================================================
  // STATE
  // =========================================================================

  let formAreaId = $state<number | null>(null);
  let formDepartmentId = $state<number | null>(null);
  let machineUuid = $state('');

  // =========================================================================
  // DROPDOWN STATE
  // =========================================================================

  let areaDropdownOpen = $state(false);
  let departmentDropdownOpen = $state(false);
  let machineDropdownOpen = $state(false);

  function closeAllDropdowns(): void {
    areaDropdownOpen = false;
    departmentDropdownOpen = false;
    machineDropdownOpen = false;
  }

  $effect(() => {
    const anyOpen =
      areaDropdownOpen || departmentDropdownOpen || machineDropdownOpen;
    if (!anyOpen) return;

    function handleClickOutside(event: MouseEvent): void {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown')) {
        closeAllDropdowns();
      }
    }

    document.addEventListener('click', handleClickOutside, true);
    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  });

  // =========================================================================
  // DERIVED
  // =========================================================================

  const machineUuidsWithPlanSet = $derived(new Set(machineUuidsWithPlans));

  function machineHasPlan(uuid: string): boolean {
    return machineUuidsWithPlanSet.has(uuid);
  }

  const filteredDepartments = $derived.by(() => {
    if (formAreaId === null) return [];
    return departments.filter((d: TpmDepartment) => d.areaId === formAreaId);
  });

  const filteredMachines = $derived.by(() => {
    if (formDepartmentId === null) return [];
    return machines.filter(
      (m: Machine) =>
        m.status !== 'decommissioned' && m.departmentId === formDepartmentId,
    );
  });

  const isDepartmentDisabled = $derived(formAreaId === null);
  const isMachineDisabled = $derived(formDepartmentId === null);

  const selectedAreaText = $derived.by(() => {
    if (formAreaId === null) return MESSAGES.PH_AREA;
    const match = areas.find((a: TpmArea) => a.id === formAreaId);
    return match?.name ?? MESSAGES.PH_AREA;
  });

  const selectedDepartmentText = $derived.by(() => {
    if (isDepartmentDisabled) return MESSAGES.PH_SELECT_AREA_FIRST;
    if (formDepartmentId === null) return MESSAGES.PH_DEPARTMENT;
    const match = filteredDepartments.find(
      (d: TpmDepartment) => d.id === formDepartmentId,
    );
    return match?.name ?? MESSAGES.PH_DEPARTMENT;
  });

  const selectedMachineText = $derived.by(() => {
    if (isMachineDisabled) return MESSAGES.PH_SELECT_DEPT_FIRST;
    if (machineUuid === '') return MESSAGES.PH_MACHINE;
    const match = filteredMachines.find((m: Machine) => m.uuid === machineUuid);
    if (match === undefined) return MESSAGES.PH_MACHINE;
    const num = match.machineNumber?.trim() ?? '';
    return num.length > 0 ? `${match.name} (${num})` : match.name;
  });

  // =========================================================================
  // HANDLERS
  // =========================================================================

  function selectArea(areaId: number): void {
    formAreaId = areaId;
    formDepartmentId = null;
    machineUuid = '';
    areaDropdownOpen = false;
    onselect('');
  }

  function selectDepartment(deptId: number): void {
    formDepartmentId = deptId;
    machineUuid = '';
    departmentDropdownOpen = false;
    onselect('');
  }

  function selectMachine(uuid: string): void {
    machineUuid = uuid;
    machineDropdownOpen = false;
    onselect(uuid);
  }
</script>

<!-- Area -->
<div class="form-field">
  <span class="form-field__label">{MESSAGES.LABEL_AREA}</span>
  <div class="dropdown">
    <button
      type="button"
      class="dropdown__trigger"
      class:active={areaDropdownOpen}
      disabled={submitting}
      onclick={() => {
        const wasOpen = areaDropdownOpen;
        closeAllDropdowns();
        areaDropdownOpen = !wasOpen;
      }}
    >
      <span>{selectedAreaText}</span>
      <i class="fas fa-chevron-down"></i>
    </button>
    <div
      class="dropdown__menu dropdown__menu--scrollable"
      class:active={areaDropdownOpen}
    >
      {#each areas as area (area.id)}
        <button
          type="button"
          class="dropdown__option"
          class:dropdown__option--selected={formAreaId === area.id}
          onclick={() => {
            selectArea(area.id);
          }}
        >
          {area.name}
        </button>
      {/each}
    </div>
  </div>
</div>

<!-- Department (disabled until area selected) -->
<div class="form-field">
  <span class="form-field__label">{MESSAGES.LABEL_DEPARTMENT}</span>
  <div
    class="dropdown"
    class:disabled={isDepartmentDisabled}
  >
    <button
      type="button"
      class="dropdown__trigger"
      class:active={departmentDropdownOpen}
      disabled={submitting || isDepartmentDisabled}
      onclick={() => {
        if (isDepartmentDisabled) return;
        const wasOpen = departmentDropdownOpen;
        closeAllDropdowns();
        departmentDropdownOpen = !wasOpen;
      }}
    >
      <span>{selectedDepartmentText}</span>
      <i class="fas fa-chevron-down"></i>
    </button>
    {#if !isDepartmentDisabled}
      <div
        class="dropdown__menu dropdown__menu--scrollable"
        class:active={departmentDropdownOpen}
      >
        {#each filteredDepartments as dept (dept.id)}
          <button
            type="button"
            class="dropdown__option"
            class:dropdown__option--selected={formDepartmentId === dept.id}
            onclick={() => {
              selectDepartment(dept.id);
            }}
          >
            {dept.name}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Machine (disabled until department selected) -->
<div class="form-field">
  <span class="form-field__label">{MESSAGES.LABEL_MACHINE}</span>
  <div
    class="dropdown"
    class:disabled={isMachineDisabled}
  >
    <button
      type="button"
      class="dropdown__trigger"
      class:active={machineDropdownOpen}
      disabled={submitting || isMachineDisabled}
      onclick={() => {
        if (isMachineDisabled) return;
        const wasOpen = machineDropdownOpen;
        closeAllDropdowns();
        machineDropdownOpen = !wasOpen;
      }}
    >
      <span>{selectedMachineText}</span>
      <i class="fas fa-chevron-down"></i>
    </button>
    {#if !isMachineDisabled}
      <div
        class="dropdown__menu dropdown__menu--scrollable"
        class:active={machineDropdownOpen}
      >
        {#each filteredMachines as machine (machine.uuid)}
          {@const hasPlan = machineHasPlan(machine.uuid)}
          <button
            type="button"
            class="dropdown__option"
            class:dropdown__option--selected={machineUuid === machine.uuid}
            class:dropdown__option--disabled={hasPlan}
            disabled={hasPlan}
            onclick={() => {
              selectMachine(machine.uuid);
            }}
          >
            {machine.name}
            {#if machine.machineNumber}
              ({machine.machineNumber})
            {/if}
            {#if hasPlan}
              <span class="dropdown__option-hint">
                ({MESSAGES.MACHINE_HAS_PLAN})
              </span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .dropdown.disabled :global(.dropdown__trigger) {
    opacity: 50%;
    cursor: not-allowed;
    pointer-events: none;
    background-color: var(--color-glass-light);
  }

  .dropdown__option--disabled {
    opacity: 50%;
    cursor: not-allowed;
    color: var(--color-text-muted);
  }

  .dropdown__option-hint {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    font-style: italic;
  }
</style>
