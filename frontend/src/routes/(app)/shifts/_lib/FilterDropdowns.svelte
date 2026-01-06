<!--
  FilterDropdowns.svelte
  Admin filter controls for Area/Department/Machine/Team selection
  Plus favorites management
  Extracted from +page.svelte for maintainability
-->
<script lang="ts">
  import type { Area, Department, Machine, Team, ShiftFavorite, SelectedContext } from './types';
  import { DROPDOWN_PLACEHOLDERS } from './constants';
  import { shouldShowAddFavoriteButton } from './favorites';

  /**
   * Props interface for FilterDropdowns
   */
  interface Props {
    // Data
    areas: Area[];
    departments: Department[];
    machines: Machine[];
    teams: Team[];
    favorites: ShiftFavorite[];
    selectedContext: SelectedContext;

    // Dropdown open states
    areaDropdownOpen: boolean;
    departmentDropdownOpen: boolean;
    machineDropdownOpen: boolean;
    teamDropdownOpen: boolean;

    // Callbacks
    ontoggleAreaDropdown: () => void;
    ontoggleDepartmentDropdown: () => void;
    ontoggleMachineDropdown: () => void;
    ontoggleTeamDropdown: () => void;
    oncloseAllDropdowns: () => void;

    // Change handlers
    onareaChange: (areaId: number) => void;
    ondepartmentChange: (departmentId: number) => void;
    onmachineChange: (machineId: number) => void;
    onteamChange: (teamId: number) => void;

    // Favorite handlers
    onfavoriteClick: (favorite: ShiftFavorite) => void;
    ondeleteFavorite: (favoriteId: number, event: MouseEvent) => void;
    onaddToFavorites: () => void;
  }

  const {
    areas,
    departments,
    machines,
    teams,
    favorites,
    selectedContext,
    areaDropdownOpen,
    departmentDropdownOpen,
    machineDropdownOpen,
    teamDropdownOpen,
    ontoggleAreaDropdown,
    ontoggleDepartmentDropdown,
    ontoggleMachineDropdown,
    ontoggleTeamDropdown,
    oncloseAllDropdowns,
    onareaChange,
    ondepartmentChange,
    onmachineChange,
    onteamChange,
    onfavoriteClick,
    ondeleteFavorite,
    onaddToFavorites,
  }: Props = $props();

  // Helper to get selected name
  function getSelectedAreaName(): string {
    if (selectedContext.areaId === null) return DROPDOWN_PLACEHOLDERS.AREA;
    return areas.find((a) => a.id === selectedContext.areaId)?.name ?? DROPDOWN_PLACEHOLDERS.AREA;
  }

  function getSelectedDepartmentName(): string {
    if (selectedContext.areaId === null) return DROPDOWN_PLACEHOLDERS.AWAIT_AREA;
    if (selectedContext.departmentId === null) return DROPDOWN_PLACEHOLDERS.DEPARTMENT;
    return (
      departments.find((d) => d.id === selectedContext.departmentId)?.name ??
      DROPDOWN_PLACEHOLDERS.DEPARTMENT
    );
  }

  function getSelectedMachineName(): string {
    if (selectedContext.departmentId === null) return DROPDOWN_PLACEHOLDERS.AWAIT_DEPARTMENT;
    if (selectedContext.machineId === null) return DROPDOWN_PLACEHOLDERS.MACHINE;
    return (
      machines.find((m) => m.id === selectedContext.machineId)?.name ??
      DROPDOWN_PLACEHOLDERS.MACHINE
    );
  }

  function getSelectedTeamName(): string {
    // Team requires Machine to be selected first (hierarchical filter)
    if (selectedContext.machineId === null) return DROPDOWN_PLACEHOLDERS.AWAIT_MACHINE;
    if (selectedContext.teamId === null) return DROPDOWN_PLACEHOLDERS.TEAM;
    return teams.find((t) => t.id === selectedContext.teamId)?.name ?? DROPDOWN_PLACEHOLDERS.TEAM;
  }
</script>

<div id="admin-filter-controls" class="mt-6 shift-info-row">
  <!-- Area Dropdown -->
  <div class="info-item">
    <div class="info-label">Bereich</div>
    <div class="dropdown" data-dropdown="area">
      <div
        class="dropdown__trigger"
        class:active={areaDropdownOpen}
        onclick={ontoggleAreaDropdown}
        onkeydown={(e) => e.key === 'Enter' && ontoggleAreaDropdown()}
        role="button"
        tabindex="0"
      >
        <span>{getSelectedAreaName()}</span>
        <i class="fas fa-chevron-down"></i>
      </div>
      <div class="dropdown__menu" class:active={areaDropdownOpen}>
        {#each areas as area (area.id)}
          <div
            class="dropdown__option"
            data-value={area.id}
            onclick={() => {
              onareaChange(area.id);
              oncloseAllDropdowns();
            }}
            onkeydown={(e) => {
              if (e.key === 'Enter') {
                onareaChange(area.id);
                oncloseAllDropdowns();
              }
            }}
            role="option"
            aria-selected={selectedContext.areaId === area.id}
            tabindex="0"
          >
            {area.name}
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Department Dropdown -->
  <div class="info-item">
    <div class="info-label">Abteilung</div>
    <div
      class="dropdown"
      class:dropdown--disabled={selectedContext.areaId === null}
      data-dropdown="department"
    >
      <div
        class="dropdown__trigger"
        class:active={departmentDropdownOpen}
        onclick={() => selectedContext.areaId !== null && ontoggleDepartmentDropdown()}
        onkeydown={(e) =>
          e.key === 'Enter' && selectedContext.areaId !== null && ontoggleDepartmentDropdown()}
        role="button"
        tabindex={selectedContext.areaId === null ? -1 : 0}
        style={selectedContext.areaId === null ? 'pointer-events: none; opacity: 0.5;' : ''}
      >
        <span>{getSelectedDepartmentName()}</span>
        <i class="fas fa-chevron-down"></i>
      </div>
      <div class="dropdown__menu" class:active={departmentDropdownOpen}>
        {#each departments as dept (dept.id)}
          <div
            class="dropdown__option"
            data-value={dept.id}
            onclick={() => {
              ondepartmentChange(dept.id);
              oncloseAllDropdowns();
            }}
            onkeydown={(e) => {
              if (e.key === 'Enter') {
                ondepartmentChange(dept.id);
                oncloseAllDropdowns();
              }
            }}
            role="option"
            aria-selected={selectedContext.departmentId === dept.id}
            tabindex="0"
          >
            {dept.name}
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Machine Dropdown -->
  <div class="info-item">
    <div class="info-label">Maschine</div>
    <div
      class="dropdown"
      class:dropdown--disabled={selectedContext.departmentId === null}
      data-dropdown="machine"
    >
      <div
        class="dropdown__trigger"
        class:active={machineDropdownOpen}
        onclick={() => selectedContext.departmentId !== null && ontoggleMachineDropdown()}
        onkeydown={(e) =>
          e.key === 'Enter' && selectedContext.departmentId !== null && ontoggleMachineDropdown()}
        role="button"
        tabindex={selectedContext.departmentId === null ? -1 : 0}
        style={selectedContext.departmentId === null ? 'pointer-events: none; opacity: 0.5;' : ''}
      >
        <span>{getSelectedMachineName()}</span>
        <i class="fas fa-chevron-down"></i>
      </div>
      <div class="dropdown__menu" class:active={machineDropdownOpen}>
        {#each machines as machine (machine.id)}
          <div
            class="dropdown__option"
            data-value={machine.id}
            onclick={() => {
              onmachineChange(machine.id);
              oncloseAllDropdowns();
            }}
            onkeydown={(e) => {
              if (e.key === 'Enter') {
                onmachineChange(machine.id);
                oncloseAllDropdowns();
              }
            }}
            role="option"
            aria-selected={selectedContext.machineId === machine.id}
            tabindex="0"
          >
            {machine.name}
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Team Dropdown (requires Machine to be selected first) -->
  <div class="info-item">
    <div class="info-label">Team</div>
    <div
      class="dropdown"
      class:dropdown--disabled={selectedContext.machineId === null}
      data-dropdown="team"
    >
      <div
        class="dropdown__trigger"
        class:active={teamDropdownOpen}
        onclick={() => selectedContext.machineId !== null && ontoggleTeamDropdown()}
        onkeydown={(e) =>
          e.key === 'Enter' && selectedContext.machineId !== null && ontoggleTeamDropdown()}
        role="button"
        tabindex={selectedContext.machineId === null ? -1 : 0}
        style={selectedContext.machineId === null ? 'pointer-events: none; opacity: 0.5;' : ''}
      >
        <span>{getSelectedTeamName()}</span>
        <i class="fas fa-chevron-down"></i>
      </div>
      <div class="dropdown__menu" class:active={teamDropdownOpen}>
        {#each teams as team (team.id)}
          <div
            class="dropdown__option"
            data-value={team.id}
            onclick={() => {
              onteamChange(team.id);
              oncloseAllDropdowns();
            }}
            onkeydown={(e) => {
              if (e.key === 'Enter') {
                onteamChange(team.id);
                oncloseAllDropdowns();
              }
            }}
            role="option"
            aria-selected={selectedContext.teamId === team.id}
            tabindex="0"
          >
            {team.name}
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

<!-- Favorites Container -->
<div class="favorites-container" id="favoritesContainer">
  <div class="favorites-header">
    <span class="favorites-label">&#11088; Favoriten:</span>
    <div class="favorites-list" id="favoritesList">
      {#if favorites.length === 0}
        <div class="favorites-empty">Keine Favoriten gespeichert</div>
      {:else}
        {#each favorites as favorite (favorite.id)}
          <div
            class="favorite-btn"
            role="button"
            tabindex="0"
            onclick={(e) => {
              const target = e.target as HTMLElement;
              if (!target.closest('.remove-favorite')) {
                onfavoriteClick(favorite);
              }
            }}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                const target = e.target as HTMLElement;
                if (!target.closest('.remove-favorite')) {
                  e.preventDefault();
                  onfavoriteClick(favorite);
                }
              }
            }}
          >
            <span class="favorite-btn-inner">
              <span>{favorite.name}</span>
            </span>
            <button
              type="button"
              class="remove-favorite"
              onclick={(e) => {
                e.stopPropagation();
                ondeleteFavorite(Number(favorite.id), e);
              }}
              title="Favorit löschen"
            >
              <i class="fas fa-times"></i>
            </button>
          </div>
        {/each}
      {/if}
    </div>
  </div>
</div>

<!-- Add to Favorites Button -->
{#if shouldShowAddFavoriteButton(selectedContext, favorites)}
  <button
    type="button"
    class="btn btn-success add-favorite-btn"
    data-action="add-to-favorites"
    onclick={onaddToFavorites}
  >
    <i class="fas fa-star"></i>
    <span>Zu Favoriten</span>
  </button>
{/if}
