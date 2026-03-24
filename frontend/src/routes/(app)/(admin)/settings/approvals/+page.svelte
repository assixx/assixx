<script lang="ts">
  /**
   * Approval Settings — Configure approval masters per addon
   * @module admin/settings/approvals/+page
   *
   * Design: Uses design-system dropdown + search-input components.
   * ADR-034: Hierarchy labels for dynamic approver type names.
   */
  import SearchResultUser from '$lib/components/SearchResultUser.svelte';
  import { showErrorAlert, showSuccessAlert } from '$lib/stores/toast';
  import { resolvePositionDisplay } from '$lib/types/hierarchy-labels';

  import { createConfig, deleteConfig, fetchConfigs, fetchPositions } from './_lib/api';
  import { APPROVABLE_ADDONS, createApproverTypeOptions, MESSAGES } from './_lib/constants';

  import type { PageData } from './$types';
  import type {
    ApprovalApproverType,
    ApprovalConfig,
    Area,
    Department,
    PositionOption,
    Team,
    UserOption,
  } from './_lib/types';

  // =============================================================================
  // SSR DATA
  // =============================================================================

  const { data }: { data: PageData } = $props();

  // =============================================================================
  // HIERARCHY LABELS (ADR-034)
  // =============================================================================

  const labels = $derived(data.hierarchyLabels);
  const approverTypeOptions = $derived(createApproverTypeOptions(labels));

  // =============================================================================
  // CLIENT STATE
  // =============================================================================

  let clientConfigs = $state<ApprovalConfig[] | null>(null);
  const configs = $derived(clientConfigs ?? data.configs);

  let selectedAddon = $state('');
  let selectedType = $state<ApprovalApproverType>('team_lead');
  let submitting = $state(false);

  // Dropdown state
  let addonDropdownOpen = $state(false);
  let typeDropdownOpen = $state(false);
  let searchOpen = $state(false);

  // User search state (multiselect)
  let userSearchQuery = $state('');
  let userSearchResults = $state<UserOption[]>([]);
  let userSearchLoading = $state(false);
  let selectedUsers = $state<UserOption[]>([]);

  // Position selection state
  let positionOptions = $state<PositionOption[]>([]);
  let positionDropdownOpen = $state(false);
  let selectedPositionId = $state<string | null>(null);

  // Scope state (Blackboard pattern — "Ganze Firma" toggle + Area/Dept/Team multiselect)
  let scopeCompanyWide = $state(true);
  let scopeAreaIds = $state<number[]>([]);
  let scopeDeptIds = $state<number[]>([]);
  let scopeTeamIds = $state<number[]>([]);

  // =============================================================================
  // ORG DATA (from SSR)
  // =============================================================================

  const areas: Area[] = $derived(data.areas);
  const departments: Department[] = $derived(data.departments);
  const teams: Team[] = $derived(data.teams);

  // Scope cascade: departments not already covered by selected areas
  const availableDepartments = $derived.by((): Department[] => {
    if (scopeCompanyWide) return [];
    return departments.filter(
      (d: Department) => d.areaId === undefined || !scopeAreaIds.includes(d.areaId),
    );
  });

  // All department IDs covered (explicit + inherited from areas)
  const coveredDeptIds = $derived.by((): number[] => {
    const inherited = departments
      .filter((d: Department) => d.areaId !== undefined && scopeAreaIds.includes(d.areaId))
      .map((d: Department) => d.id);
    return [...scopeDeptIds, ...inherited];
  });

  // Scope cascade: teams not already covered by selected departments
  const availableTeams = $derived.by((): Team[] => {
    if (scopeCompanyWide) return [];
    return teams.filter(
      (t: Team) => t.departmentId === undefined || !coveredDeptIds.includes(t.departmentId),
    );
  });

  // =============================================================================
  // DERIVED
  // =============================================================================

  const configsByAddon = $derived(
    configs.reduce<Record<string, ApprovalConfig[]>>((acc, cfg) => {
      const key = cfg.addonCode;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- noUncheckedIndexedAccess
      acc[key] = acc[key] !== undefined ? [...acc[key], cfg] : [cfg];
      return acc;
    }, {}),
  );

  const unconfiguredAddons = $derived(
    APPROVABLE_ADDONS.filter((a) => (configsByAddon[a.code] ?? []).length === 0),
  );

  const selectedAddonLabel = $derived(
    APPROVABLE_ADDONS.find((a) => a.code === selectedAddon)?.label ?? '— Modul wählen —',
  );

  const selectedTypeLabel = $derived(
    approverTypeOptions.find((o) => o.value === selectedType)?.label ?? selectedType,
  );

  const selectedTypeIcon = $derived(
    approverTypeOptions.find((o) => o.value === selectedType)?.icon ?? 'fa-user',
  );

  const isUserType = $derived(selectedType === 'user');
  const isPositionType = $derived(selectedType === 'position');

  const isLeadType = $derived(selectedType !== 'user' && selectedType !== 'position');
  const showScopeControls = $derived(isUserType || isPositionType);

  const selectedPositionLabel = $derived.by(() => {
    const name = positionOptions.find((p: PositionOption) => p.id === selectedPositionId)?.name;
    if (name === undefined) return '— Position wählen —';
    return resolvePositionDisplay(name, labels);
  });

  const canAdd = $derived(
    selectedAddon !== '' &&
      !submitting &&
      (!isUserType || selectedUsers.length > 0) &&
      (!isPositionType || selectedPositionId !== null),
  );

  // =============================================================================
  // DROPDOWN HANDLERS
  // =============================================================================

  function selectAddon(code: string): void {
    selectedAddon = code;
    addonDropdownOpen = false;
  }

  function selectType(value: ApprovalApproverType): void {
    selectedType = value;
    typeDropdownOpen = false;
    if (value !== 'user') {
      selectedUsers = [];
      userSearchQuery = '';
      userSearchResults = [];
    }
    if (value === 'position' && positionOptions.length === 0) {
      void loadPositions();
    }
    if (value !== 'position') {
      selectedPositionId = null;
      positionDropdownOpen = false;
    }
  }

  async function loadPositions(): Promise<void> {
    positionOptions = await fetchPositions();
  }

  function handleScopeAreaChange(newAreaIds: number[]): void {
    scopeAreaIds = newAreaIds;
    // Remove departments now covered by areas
    scopeDeptIds = scopeDeptIds.filter(
      (dId: number) =>
        !departments.some(
          (d: Department) =>
            d.id === dId && d.areaId !== undefined && newAreaIds.includes(d.areaId),
        ),
    );
    // Remove teams whose department is now covered
    const areaDeptIds = departments
      .filter((d: Department) => d.areaId !== undefined && newAreaIds.includes(d.areaId))
      .map((d: Department) => d.id);
    const allCoveredDepts = [...scopeDeptIds, ...areaDeptIds];
    scopeTeamIds = scopeTeamIds.filter(
      (tId: number) =>
        !teams.some(
          (t: Team) =>
            t.id === tId &&
            t.departmentId !== undefined &&
            allCoveredDepts.includes(t.departmentId),
        ),
    );
  }

  function handleScopeDeptChange(newDeptIds: number[]): void {
    scopeDeptIds = newDeptIds;
    // Remove teams whose department is now covered
    const areaDeptIds = departments
      .filter((d: Department) => d.areaId !== undefined && scopeAreaIds.includes(d.areaId))
      .map((d: Department) => d.id);
    const allCoveredDepts = [...newDeptIds, ...areaDeptIds];
    scopeTeamIds = scopeTeamIds.filter(
      (tId: number) =>
        !teams.some(
          (t: Team) =>
            t.id === tId &&
            t.departmentId !== undefined &&
            allCoveredDepts.includes(t.departmentId),
        ),
    );
  }

  function resetScope(): void {
    scopeCompanyWide = true;
    scopeAreaIds = [];
    scopeDeptIds = [];
    scopeTeamIds = [];
  }

  function closeAllDropdowns(): void {
    addonDropdownOpen = false;
    typeDropdownOpen = false;
    searchOpen = false;
    positionDropdownOpen = false;
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') closeAllDropdowns();
  }

  // Outside-click: close dropdowns when clicking outside
  $effect(() => {
    if (!addonDropdownOpen && !typeDropdownOpen && !searchOpen) return;
    const handleOutsideClick = (e: MouseEvent): void => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown') && !target.closest('.search-input-wrapper')) {
        closeAllDropdowns();
      }
    };
    document.addEventListener('click', handleOutsideClick, true);
    return () => {
      document.removeEventListener('click', handleOutsideClick, true);
    };
  });

  // =============================================================================
  // USER SEARCH
  // =============================================================================

  let searchTimeout: ReturnType<typeof setTimeout> | undefined;

  function handleUserSearch(query: string): void {
    userSearchQuery = query;
    if (query.length < 2) {
      userSearchResults = [];
      searchOpen = false;
      return;
    }

    searchOpen = true;
    if (searchTimeout !== undefined) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      void searchUsers(query);
    }, 300);
  }

  async function searchUsers(query: string): Promise<void> {
    userSearchLoading = true;
    try {
      const res = await fetch(`/api/v2/users?search=${encodeURIComponent(query)}&limit=10`);
      if (res.ok) {
        const body = (await res.json()) as {
          data: { items?: UserOption[] } | UserOption[];
        };
        const items = Array.isArray(body.data) ? body.data : (body.data.items ?? []);
        userSearchResults = items;
      }
    } catch {
      userSearchResults = [];
    } finally {
      userSearchLoading = false;
    }
  }

  function selectUser(user: UserOption): void {
    if (!selectedUsers.some((u: UserOption) => u.id === user.id)) {
      selectedUsers = [...selectedUsers, user];
    }
    if (selectedType !== 'user') selectedType = 'user';
    userSearchQuery = '';
    userSearchResults = [];
    searchOpen = false;
  }

  function removeUser(userId: number): void {
    selectedUsers = selectedUsers.filter((u: UserOption) => u.id !== userId);
  }

  // =============================================================================
  // CONFIG HANDLERS
  // =============================================================================

  /** Normalize scope arrays: null for "Ganze Firma" or hierarchy types, non-empty arrays otherwise */
  function getScopeForSubmit(): { a: number[] | null; d: number[] | null; t: number[] | null } {
    if (scopeCompanyWide || !showScopeControls) {
      return { a: null, d: null, t: null };
    }
    return {
      a: scopeAreaIds.length > 0 ? scopeAreaIds : null,
      d: scopeDeptIds.length > 0 ? scopeDeptIds : null,
      t: scopeTeamIds.length > 0 ? scopeTeamIds : null,
    };
  }

  async function submitConfigs(addon: string, type: ApprovalApproverType): Promise<boolean> {
    const scope = getScopeForSubmit();
    if (type === 'position') {
      return (
        (await createConfig(addon, type, null, selectedPositionId, scope.a, scope.d, scope.t)) !==
        null
      );
    }
    if (type === 'user') {
      let ok = false;
      for (const user of selectedUsers) {
        const r = await createConfig(addon, type, user.id, null, scope.a, scope.d, scope.t);
        if (r !== null) ok = true;
      }
      return ok;
    }
    return (await createConfig(addon, type, null)) !== null;
  }

  async function handleAddConfig(): Promise<void> {
    if (!canAdd) return;
    submitting = true;
    try {
      const success = await submitConfigs(selectedAddon, selectedType);
      if (success) {
        clientConfigs = await fetchConfigs();
        selectedAddon = ''; // eslint-disable-line require-atomic-updates -- Svelte single-threaded
        selectedUsers = [];
        selectedPositionId = null;
        resetScope();
        showSuccessAlert(MESSAGES.SAVE_SUCCESS);
      } else {
        showErrorAlert(MESSAGES.SAVE_ERROR);
      }
    } catch {
      showErrorAlert(MESSAGES.SAVE_ERROR);
    } finally {
      submitting = false;
    }
  }

  async function handleDeleteConfig(uuid: string): Promise<void> {
    submitting = true;
    try {
      const ok = await deleteConfig(uuid);
      if (ok) {
        clientConfigs = await fetchConfigs();
        showSuccessAlert(MESSAGES.DELETE_SUCCESS);
      } else {
        showErrorAlert(MESSAGES.DELETE_ERROR);
      }
    } catch {
      showErrorAlert(MESSAGES.DELETE_ERROR);
    } finally {
      submitting = false;
    }
  }

  function getApproverLabel(type: ApprovalApproverType): string {
    return approverTypeOptions.find((o) => o.value === type)?.label ?? type;
  }

  function getApproverIcon(type: ApprovalApproverType): string {
    return approverTypeOptions.find((o) => o.value === type)?.icon ?? 'fa-user';
  }
</script>

<svelte:head>
  <title>{MESSAGES.PAGE_TITLE}</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="container">
  <!-- Header Card -->
  <div class="card">
    <div class="card__header">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="card__title">
            <i class="fas fa-check-double mr-2"></i>
            {MESSAGES.HEADING}
          </h2>
          <p class="description mt-2">{MESSAGES.DESCRIPTION}</p>
        </div>
      </div>
    </div>

    <div class="card__body">
      {#if isLeadType}
        <div class="alert alert--info mb-4">
          <i class="fas fa-info-circle mr-2"></i>
          Alle Benutzer mit dieser Lead-Position werden automatisch Freigabe-Master für das gewählte Modul.
        </div>
      {/if}
      {#if isPositionType}
        <div class="alert alert--info mb-4">
          <i class="fas fa-info-circle mr-2"></i>
          Alle Benutzer, denen diese Position zugewiesen ist, werden automatisch Freigabe-Master für das
          gewählte Modul.
        </div>
      {/if}

      <!-- Add new config row -->
      <div class="add-row">
        <!-- Addon Dropdown -->
        <div class="dropdown">
          <button
            type="button"
            class="dropdown__trigger"
            class:active={addonDropdownOpen}
            onclick={() => {
              addonDropdownOpen = !addonDropdownOpen;
              typeDropdownOpen = false;
            }}
          >
            <span>{selectedAddonLabel}</span>
            <i class="fas fa-chevron-down"></i>
          </button>
          <div
            class="dropdown__menu"
            class:active={addonDropdownOpen}
          >
            {#each APPROVABLE_ADDONS as addon (addon.code)}
              <button
                type="button"
                class="dropdown__option"
                class:dropdown__option--selected={selectedAddon === addon.code}
                onclick={() => {
                  selectAddon(addon.code);
                }}
              >
                {addon.label}
              </button>
            {/each}
          </div>
        </div>

        <!-- Type Dropdown -->
        <div class="dropdown">
          <button
            type="button"
            class="dropdown__trigger"
            class:active={typeDropdownOpen}
            onclick={() => {
              typeDropdownOpen = !typeDropdownOpen;
              addonDropdownOpen = false;
            }}
          >
            <span><i class="fas {selectedTypeIcon} mr-2"></i>{selectedTypeLabel}</span>
            <i class="fas fa-chevron-down"></i>
          </button>
          <div
            class="dropdown__menu"
            class:active={typeDropdownOpen}
          >
            {#each approverTypeOptions as opt (opt.value)}
              <button
                type="button"
                class="dropdown__option"
                class:dropdown__option--selected={selectedType === opt.value}
                onclick={() => {
                  selectType(opt.value);
                }}
              >
                <i class="fas {opt.icon}"></i>
                {opt.label}
              </button>
            {/each}
          </div>
        </div>

        <!-- Position Dropdown (when position type selected) -->
        {#if isPositionType}
          <div class="dropdown">
            <button
              type="button"
              class="dropdown__trigger"
              class:active={positionDropdownOpen}
              onclick={() => {
                positionDropdownOpen = !positionDropdownOpen;
                addonDropdownOpen = false;
                typeDropdownOpen = false;
              }}
            >
              <span><i class="fas fa-id-badge mr-2"></i>{selectedPositionLabel}</span>
              <i class="fas fa-chevron-down"></i>
            </button>
            <div
              class="dropdown__menu dropdown__menu--tall"
              class:active={positionDropdownOpen}
            >
              {#each ['employee', 'admin', 'root'] as category (category)}
                {@const catPositions = positionOptions.filter(
                  (p: PositionOption) => p.roleCategory === category,
                )}
                {#if catPositions.length > 0}
                  <div class="dropdown__group-label">
                    {category === 'employee' ? 'Mitarbeiter'
                    : category === 'admin' ? 'Admin'
                    : 'Root'}
                  </div>
                  {#each catPositions as pos (pos.id)}
                    <button
                      type="button"
                      class="dropdown__option"
                      class:dropdown__option--selected={selectedPositionId === pos.id}
                      onclick={() => {
                        selectedPositionId = pos.id;
                        positionDropdownOpen = false;
                      }}
                    >
                      {resolvePositionDisplay(pos.name, labels)}
                      {#if pos.isSystem}
                        <span class="badge badge--primary badge--xs ml-2">System</span>
                      {/if}
                    </button>
                  {/each}
                {/if}
              {/each}
            </div>
          </div>
        {/if}

        <!-- Scope Controls (only for user/position types) -->
        {#if showScopeControls}
          <div class="scope-controls">
            <label class="toggle-switch toggle-switch--danger">
              <input
                type="checkbox"
                class="toggle-switch__input"
                checked={scopeCompanyWide}
                onchange={(e) => {
                  scopeCompanyWide = (e.target as HTMLInputElement).checked;
                  if (scopeCompanyWide) {
                    scopeAreaIds = [];
                    scopeDeptIds = [];
                    scopeTeamIds = [];
                  }
                }}
              />
              <span class="toggle-switch__slider"></span>
              <span class="toggle-switch__label"
                ><i class="fas fa-building mr-2"></i>Ganze Firma</span
              >
            </label>

            {#if !scopeCompanyWide}
              <div class="scope-selects">
                <div class="form-field">
                  <label
                    for="scope-area-select"
                    class="form-field__label"
                  >
                    <i class="fas fa-layer-group mr-1"></i>{labels.area}
                  </label>
                  <select
                    id="scope-area-select"
                    multiple
                    class="multi-select"
                    value={scopeAreaIds}
                    onchange={(e) => {
                      const select = e.target as HTMLSelectElement;
                      handleScopeAreaChange(
                        Array.from(select.selectedOptions).map((o) => Number(o.value)),
                      );
                    }}
                  >
                    {#each areas as area (area.id)}
                      <option value={area.id}>
                        {area.name}{area.departmentCount !== undefined && area.departmentCount > 0 ?
                          ` (${area.departmentCount} Abt.)`
                        : ''}
                      </option>
                    {/each}
                  </select>
                  <span class="form-field__message text-(--color-text-secondary)">
                    <i class="fas fa-info-circle mr-1"></i>Strg/Cmd + Klick für Mehrfachauswahl
                  </span>
                </div>

                {#if availableDepartments.length > 0}
                  <div class="form-field">
                    <label
                      for="scope-dept-select"
                      class="form-field__label"
                    >
                      <i class="fas fa-sitemap mr-1"></i>Zusätzliche {labels.department}
                    </label>
                    <select
                      id="scope-dept-select"
                      multiple
                      class="multi-select"
                      value={scopeDeptIds}
                      onchange={(e) => {
                        const select = e.target as HTMLSelectElement;
                        handleScopeDeptChange(
                          Array.from(select.selectedOptions).map((o) => Number(o.value)),
                        );
                      }}
                    >
                      {#each availableDepartments as dept (dept.id)}
                        <option value={dept.id}>
                          {dept.name}{dept.areaName !== undefined && dept.areaName !== '' ?
                            ` (${dept.areaName})`
                          : ''}
                        </option>
                      {/each}
                    </select>
                  </div>
                {/if}

                {#if availableTeams.length > 0}
                  <div class="form-field">
                    <label
                      for="scope-team-select"
                      class="form-field__label"
                    >
                      <i class="fas fa-users mr-1"></i>{labels.team}
                    </label>
                    <select
                      id="scope-team-select"
                      multiple
                      class="multi-select"
                      value={scopeTeamIds}
                      onchange={(e) => {
                        const select = e.target as HTMLSelectElement;
                        scopeTeamIds = Array.from(select.selectedOptions).map((o) =>
                          Number(o.value),
                        );
                      }}
                    >
                      {#each availableTeams as team (team.id)}
                        <option value={team.id}>{team.name}</option>
                      {/each}
                    </select>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/if}

        <!-- User Search (always visible) -->
        <div class="search-input-wrapper">
          {#if selectedUsers.length > 0}
            <div class="user-chips">
              {#each selectedUsers as user (user.id)}
                <div class="user-chip">
                  <i class="fas fa-user mr-1"></i>
                  <span>{user.firstName} {user.lastName}</span>
                  <button
                    type="button"
                    class="user-chip__clear"
                    aria-label="Entfernen"
                    onclick={() => {
                      removeUser(user.id);
                    }}
                  >
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              {/each}
            </div>
          {/if}
          <div
            class="search-input"
            class:search-input--has-value={userSearchQuery !== ''}
            class:search-input--loading={userSearchLoading}
          >
            <i class="search-input__icon fas fa-search"></i>
            <input
              type="search"
              class="search-input__field"
              autocomplete="off"
              placeholder="Benutzer suchen..."
              value={userSearchQuery}
              oninput={(e) => {
                handleUserSearch((e.target as HTMLInputElement).value);
              }}
            />
            <div class="search-input__spinner"></div>
            <button
              type="button"
              aria-label="Suche löschen"
              class="search-input__clear"
              onclick={() => {
                userSearchQuery = '';
                userSearchResults = [];
                searchOpen = false;
              }}
            >
              <i class="fas fa-times"></i>
            </button>
          </div>
          {#if searchOpen}
            <div class="search-input__results active">
              {#if userSearchResults.length > 0}
                {#each userSearchResults as user (user.id)}
                  <SearchResultUser
                    id={user.id}
                    firstName={user.firstName}
                    lastName={user.lastName}
                    email={user.email}
                    role={user.role}
                    employeeNumber={user.employeeNumber ?? undefined}
                    position={user.position ?? undefined}
                    imageUrl={user.profilePicture}
                    query={userSearchQuery}
                    onclick={() => {
                      selectUser(user);
                    }}
                  />
                {/each}
              {:else if userSearchQuery.length >= 2 && !userSearchLoading}
                <div class="search-input__no-results">
                  Keine Benutzer gefunden für "{userSearchQuery}"
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <button
          type="button"
          class="btn btn-primary"
          disabled={!canAdd}
          onclick={() => void handleAddConfig()}
        >
          <i class="fas fa-plus mr-2"></i>
          Hinzufügen
        </button>
      </div>
    </div>
  </div>

  <!-- Config cards per addon -->
  {#each APPROVABLE_ADDONS as addon (addon.code)}
    {@const addonConfigs = configsByAddon[addon.code] ?? []}
    {#if addonConfigs.length > 0}
      <div class="card mt-6">
        <div class="card__header">
          <h3 class="card__title">{addon.label}</h3>
          <span class="badge badge--primary badge--xs">{addonConfigs.length}</span>
        </div>
        <div class="card__body">
          <ul class="config-list">
            {#each addonConfigs as cfg (cfg.uuid)}
              <li class="config-item">
                <div class="config-item__info">
                  <i class="fas {getApproverIcon(cfg.approverType)} config-item__icon"></i>
                  <span class="config-item__label">
                    {getApproverLabel(cfg.approverType)}
                  </span>
                  {#if cfg.approverUserName !== null}
                    <span class="config-item__user">— {cfg.approverUserName}</span>
                  {/if}
                  {#if cfg.approverPositionName !== null}
                    <span class="config-item__user">— {cfg.approverPositionName}</span>
                  {/if}
                  {#if cfg.scopeAreaIds === null && cfg.scopeDepartmentIds === null && cfg.scopeTeamIds === null}
                    <span class="badge badge--info badge--xs ml-2">Ganze Firma</span>
                  {:else}
                    <span class="config-item__scope ml-2">
                      {#if cfg.scopeAreaIds !== null && cfg.scopeAreaIds.length > 0}
                        <span class="badge badge--warning badge--xs"
                          >{cfg.scopeAreaIds.length} {labels.area}</span
                        >
                      {/if}
                      {#if cfg.scopeDepartmentIds !== null && cfg.scopeDepartmentIds.length > 0}
                        <span class="badge badge--warning badge--xs"
                          >{cfg.scopeDepartmentIds.length} Abt.</span
                        >
                      {/if}
                      {#if cfg.scopeTeamIds !== null && cfg.scopeTeamIds.length > 0}
                        <span class="badge badge--warning badge--xs"
                          >{cfg.scopeTeamIds.length} {labels.team}</span
                        >
                      {/if}
                    </span>
                  {/if}
                </div>
                <button
                  type="button"
                  class="btn-icon btn-icon--danger"
                  aria-label="Entfernen"
                  title="Entfernen"
                  disabled={submitting}
                  onclick={() => void handleDeleteConfig(cfg.uuid)}
                >
                  <i class="fas fa-trash-alt"></i>
                </button>
              </li>
            {/each}
          </ul>
        </div>
      </div>
    {/if}
  {/each}

  <!-- Empty state -->
  {#if unconfiguredAddons.length > 0}
    <div class="card mt-6">
      <div class="card__header">
        <h3 class="card__title">Nicht konfiguriert</h3>
      </div>
      <div class="card__body">
        <ul class="config-list">
          {#each unconfiguredAddons as addon (addon.code)}
            <li class="config-item config-item--empty">
              <span class="config-item__label">{addon.label}</span>
              <span class="no-config-hint">{MESSAGES.NO_CONFIG}</span>
            </li>
          {/each}
        </ul>
      </div>
    </div>
  {/if}
</div>

<style>
  .description {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .add-row {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .add-row :global(.dropdown) {
    flex: 1;
    min-width: 160px;
  }

  .add-row :global(.search-input-wrapper) {
    flex: 1;
    min-width: 200px;
  }

  .user-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-bottom: 0.5rem;
  }

  .user-chip {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-xl);
    background: color-mix(in oklch, var(--color-primary) 15%, transparent);
    color: var(--color-primary);
    font-size: 0.875rem;
    font-weight: 500;
  }

  .user-chip__clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
    color: inherit;
    opacity: 60%;
    transition: opacity 0.15s;
    margin-left: 0.25rem;
  }

  .user-chip__clear:hover {
    opacity: 100%;
  }

  .config-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .config-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.625rem 0.75rem;
    border-radius: var(--radius-sm);
    transition: background 0.15s ease;
  }

  .config-item:hover {
    background: color-mix(in oklch, var(--color-primary) 5%, transparent);
  }

  .config-item--empty {
    opacity: 50%;
  }

  .config-item__info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .config-item__icon {
    width: 1.25rem;
    text-align: center;
    color: var(--color-primary);
  }

  .config-item__label {
    font-weight: 500;
  }

  .config-item__user {
    color: var(--color-text-secondary);
    font-size: 0.875rem;
  }

  .no-config-hint {
    font-size: 0.8125rem;
    font-style: italic;
    color: var(--color-text-muted);
  }

  .btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--color-text-secondary);
    transition: all 0.15s ease;
  }

  .btn-icon--danger:hover {
    background: color-mix(in oklch, var(--color-error) 15%, transparent);
    color: var(--color-error);
  }

  /* dropdown__menu--tall and dropdown__group-label are in design-system/primitives/dropdowns/custom-dropdown.css */

  .scope-controls {
    width: 100%;
    padding: 0.75rem;
    border-radius: var(--radius-sm);
    background: color-mix(in oklch, var(--color-warning) 5%, transparent);
    border: 1px solid color-mix(in oklch, var(--color-warning) 20%, transparent);
  }

  .scope-selects {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 0.75rem;
  }

  .scope-selects .form-field {
    flex: 1;
    min-width: 180px;
  }

  .multi-select {
    width: 100%;
    min-height: 80px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 0.25rem;
    font-size: 0.875rem;
    background: var(--color-surface);
    color: var(--color-text);
  }

  .config-item__scope {
    display: inline-flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }
</style>
