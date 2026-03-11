<script lang="ts">
  /**
   * Asset Cascade Selector (Area → Department → Asset)
   * @module plan/[uuid]/_lib/AssetCascadeSelector
   *
   * Three-level cascade dropdown for selecting a asset.
   * Used in TPM plan create mode only.
   */
  import { type TpmMessages } from '../../../_lib/constants';

  import type { Asset, TpmArea, TpmDepartment } from '../../../_lib/types';

  interface Props {
    messages: TpmMessages;
    assets: Asset[];
    areas: TpmArea[];
    departments: TpmDepartment[];
    assetUuidsWithPlans: string[];
    submitting: boolean;
    onselect: (assetUuid: string) => void;
  }

  const {
    messages,
    assets,
    areas,
    departments,
    assetUuidsWithPlans,
    submitting,
    onselect,
  }: Props = $props();

  // =========================================================================
  // STATE
  // =========================================================================

  let formAreaId = $state<number | null>(null);
  let formDepartmentId = $state<number | null>(null);
  let assetUuid = $state('');

  // =========================================================================
  // DROPDOWN STATE
  // =========================================================================

  let areaDropdownOpen = $state(false);
  let departmentDropdownOpen = $state(false);
  let assetDropdownOpen = $state(false);

  function closeAllDropdowns(): void {
    areaDropdownOpen = false;
    departmentDropdownOpen = false;
    assetDropdownOpen = false;
  }

  $effect(() => {
    const anyOpen =
      areaDropdownOpen || departmentDropdownOpen || assetDropdownOpen;
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

  const assetUuidsWithPlanSet = $derived(new Set(assetUuidsWithPlans));

  function assetHasPlan(uuid: string): boolean {
    return assetUuidsWithPlanSet.has(uuid);
  }

  const filteredDepartments = $derived.by(() => {
    if (formAreaId === null) return [];
    return departments.filter((d: TpmDepartment) => d.areaId === formAreaId);
  });

  const filteredAssets = $derived.by(() => {
    if (formDepartmentId === null) return [];
    return assets.filter(
      (m: Asset) =>
        m.status !== 'decommissioned' && m.departmentId === formDepartmentId,
    );
  });

  const isDepartmentDisabled = $derived(formAreaId === null);
  const isAssetDisabled = $derived(formDepartmentId === null);

  const selectedAreaText = $derived.by(() => {
    if (formAreaId === null) return messages.PH_AREA;
    const match = areas.find((a: TpmArea) => a.id === formAreaId);
    return match?.name ?? messages.PH_AREA;
  });

  const selectedDepartmentText = $derived.by(() => {
    if (isDepartmentDisabled) return messages.PH_SELECT_AREA_FIRST;
    if (formDepartmentId === null) return messages.PH_DEPARTMENT;
    const match = filteredDepartments.find(
      (d: TpmDepartment) => d.id === formDepartmentId,
    );
    return match?.name ?? messages.PH_DEPARTMENT;
  });

  const selectedAssetText = $derived.by(() => {
    if (isAssetDisabled) return messages.PH_SELECT_DEPT_FIRST;
    if (assetUuid === '') return messages.PH_MACHINE;
    const match = filteredAssets.find((m: Asset) => m.uuid === assetUuid);
    if (match === undefined) return messages.PH_MACHINE;
    const num = match.assetNumber?.trim() ?? '';
    return num.length > 0 ? `${match.name} (${num})` : match.name;
  });

  // =========================================================================
  // HANDLERS
  // =========================================================================

  function selectArea(areaId: number): void {
    formAreaId = areaId;
    formDepartmentId = null;
    assetUuid = '';
    areaDropdownOpen = false;
    onselect('');
  }

  function selectDepartment(deptId: number): void {
    formDepartmentId = deptId;
    assetUuid = '';
    departmentDropdownOpen = false;
    onselect('');
  }

  function selectAsset(uuid: string): void {
    assetUuid = uuid;
    assetDropdownOpen = false;
    onselect(uuid);
  }
</script>

<!-- Area -->
<div class="form-field">
  <span class="form-field__label">{messages.LABEL_AREA}</span>
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
  <span class="form-field__label">{messages.LABEL_DEPARTMENT}</span>
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

<!-- Asset (disabled until department selected) -->
<div class="form-field">
  <span class="form-field__label">{messages.LABEL_MACHINE}</span>
  <div
    class="dropdown"
    class:disabled={isAssetDisabled}
  >
    <button
      type="button"
      class="dropdown__trigger"
      class:active={assetDropdownOpen}
      disabled={submitting || isAssetDisabled}
      onclick={() => {
        if (isAssetDisabled) return;
        const wasOpen = assetDropdownOpen;
        closeAllDropdowns();
        assetDropdownOpen = !wasOpen;
      }}
    >
      <span>{selectedAssetText}</span>
      <i class="fas fa-chevron-down"></i>
    </button>
    {#if !isAssetDisabled}
      <div
        class="dropdown__menu dropdown__menu--scrollable"
        class:active={assetDropdownOpen}
      >
        {#each filteredAssets as asset (asset.uuid)}
          {@const hasPlan = assetHasPlan(asset.uuid)}
          <button
            type="button"
            class="dropdown__option"
            class:dropdown__option--selected={assetUuid === asset.uuid}
            class:dropdown__option--disabled={hasPlan}
            disabled={hasPlan}
            onclick={() => {
              selectAsset(asset.uuid);
            }}
          >
            {asset.name}
            {#if asset.assetNumber}
              ({asset.assetNumber})
            {/if}
            {#if hasPlan}
              <span class="dropdown__option-hint">
                ({messages.MACHINE_HAS_PLAN})
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
