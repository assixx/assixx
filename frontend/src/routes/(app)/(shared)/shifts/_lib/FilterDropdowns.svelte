<!--
  FilterDropdowns.svelte
  Admin filter controls for Area/Department/Asset/Team selection
  Plus favorites management
  Extracted from +page.svelte for maintainability
-->
<script lang="ts">
  import { DROPDOWN_PLACEHOLDERS } from './constants';
  import { shouldShowAddFavoriteButton } from './favorites';

  import type {
    Area,
    Department,
    Asset,
    Team,
    ShiftFavorite,
    SelectedContext,
  } from './types';

  /**
   * Props interface for FilterDropdowns
   */
  interface Props {
    // Data
    areas: Area[];
    departments: Department[];
    assets: Asset[];
    teams: Team[];
    favorites: ShiftFavorite[];
    selectedContext: SelectedContext;

    // Dropdown open states
    areaDropdownOpen: boolean;
    departmentDropdownOpen: boolean;
    assetDropdownOpen: boolean;
    teamDropdownOpen: boolean;

    // Callbacks
    ontoggleAreaDropdown: () => void;
    ontoggleDepartmentDropdown: () => void;
    ontoggleAssetDropdown: () => void;
    ontoggleTeamDropdown: () => void;
    oncloseAllDropdowns: () => void;

    // Change handlers
    onareaChange: (areaId: number) => void;
    ondepartmentChange: (departmentId: number) => void;
    onassetChange: (assetId: number) => void;
    onteamChange: (teamId: number) => void;

    // Favorite handlers
    onfavoriteClick: (favorite: ShiftFavorite) => void;
    ondeleteFavorite: (favoriteId: number, event: MouseEvent) => void;
    onaddToFavorites: () => void;
  }

  const {
    areas,
    departments,
    assets,
    teams,
    favorites,
    selectedContext,
    areaDropdownOpen,
    departmentDropdownOpen,
    assetDropdownOpen,
    teamDropdownOpen,
    ontoggleAreaDropdown,
    ontoggleDepartmentDropdown,
    ontoggleAssetDropdown,
    ontoggleTeamDropdown,
    oncloseAllDropdowns,
    onareaChange,
    ondepartmentChange,
    onassetChange,
    onteamChange,
    onfavoriteClick,
    ondeleteFavorite,
    onaddToFavorites,
  }: Props = $props();

  // Helper to get selected name
  function getSelectedAreaName(): string {
    if (selectedContext.areaId === null) return DROPDOWN_PLACEHOLDERS.AREA;
    return (
      areas.find((a) => a.id === selectedContext.areaId)?.name ??
      DROPDOWN_PLACEHOLDERS.AREA
    );
  }

  function getSelectedDepartmentName(): string {
    if (selectedContext.areaId === null)
      return DROPDOWN_PLACEHOLDERS.AWAIT_AREA;
    if (selectedContext.departmentId === null)
      return DROPDOWN_PLACEHOLDERS.DEPARTMENT;
    return (
      departments.find((d) => d.id === selectedContext.departmentId)?.name ??
      DROPDOWN_PLACEHOLDERS.DEPARTMENT
    );
  }

  function getSelectedTeamName(): string {
    if (selectedContext.departmentId === null)
      return DROPDOWN_PLACEHOLDERS.AWAIT_DEPARTMENT;
    if (selectedContext.teamId === null) return DROPDOWN_PLACEHOLDERS.TEAM;
    return (
      teams.find((t) => t.id === selectedContext.teamId)?.name ??
      DROPDOWN_PLACEHOLDERS.TEAM
    );
  }

  function getSelectedAssetName(): string {
    if (selectedContext.teamId === null)
      return DROPDOWN_PLACEHOLDERS.AWAIT_TEAM;
    if (selectedContext.assetId === null) return DROPDOWN_PLACEHOLDERS.MACHINE;
    return (
      assets.find((m) => m.id === selectedContext.assetId)?.name ??
      DROPDOWN_PLACEHOLDERS.MACHINE
    );
  }
</script>

<div
  id="admin-filter-controls"
  class="card shift-info-row mt-6"
>
  <!-- Area Dropdown -->
  <div class="info-item">
    <div class="info-label">Bereich</div>
    <div
      class="dropdown"
      data-dropdown="area"
    >
      <div
        class="dropdown__trigger"
        class:active={areaDropdownOpen}
        onclick={ontoggleAreaDropdown}
        onkeydown={(e) => {
          if (e.key === 'Enter') ontoggleAreaDropdown();
        }}
        role="button"
        tabindex="0"
      >
        <span>{getSelectedAreaName()}</span>
        <i class="fas fa-chevron-down"></i>
      </div>
      <div
        class="dropdown__menu"
        class:active={areaDropdownOpen}
      >
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
        onclick={() => {
          if (selectedContext.areaId !== null) ontoggleDepartmentDropdown();
        }}
        onkeydown={(e) => {
          if (e.key === 'Enter' && selectedContext.areaId !== null)
            ontoggleDepartmentDropdown();
        }}
        role="button"
        tabindex={selectedContext.areaId === null ? -1 : 0}
      >
        <span>{getSelectedDepartmentName()}</span>
        <i class="fas fa-chevron-down"></i>
      </div>
      <div
        class="dropdown__menu"
        class:active={departmentDropdownOpen}
      >
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

  <!-- Team Dropdown (requires Department) -->
  <div class="info-item">
    <div class="info-label">Team</div>
    <div
      class="dropdown"
      class:dropdown--disabled={selectedContext.departmentId === null}
      data-dropdown="team"
    >
      <div
        class="dropdown__trigger"
        class:active={teamDropdownOpen}
        onclick={() => {
          if (selectedContext.departmentId !== null) ontoggleTeamDropdown();
        }}
        onkeydown={(e) => {
          if (e.key === 'Enter' && selectedContext.departmentId !== null)
            ontoggleTeamDropdown();
        }}
        role="button"
        tabindex={selectedContext.departmentId === null ? -1 : 0}
      >
        <span>{getSelectedTeamName()}</span>
        <i class="fas fa-chevron-down"></i>
      </div>
      <div
        class="dropdown__menu"
        class:active={teamDropdownOpen}
      >
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

  <!-- Asset Dropdown (requires Team) -->
  <div class="info-item">
    <div class="info-label">Anlage</div>
    <div
      class="dropdown"
      class:dropdown--disabled={selectedContext.teamId === null}
      data-dropdown="asset"
    >
      <div
        class="dropdown__trigger"
        class:active={assetDropdownOpen}
        onclick={() => {
          if (selectedContext.teamId !== null) ontoggleAssetDropdown();
        }}
        onkeydown={(e) => {
          if (e.key === 'Enter' && selectedContext.teamId !== null)
            ontoggleAssetDropdown();
        }}
        role="button"
        tabindex={selectedContext.teamId === null ? -1 : 0}
      >
        <span>{getSelectedAssetName()}</span>
        <i class="fas fa-chevron-down"></i>
      </div>
      <div
        class="dropdown__menu"
        class:active={assetDropdownOpen}
      >
        {#each assets as asset (asset.id)}
          <div
            class="dropdown__option"
            data-value={asset.id}
            onclick={() => {
              onassetChange(asset.id);
              oncloseAllDropdowns();
            }}
            onkeydown={(e) => {
              if (e.key === 'Enter') {
                onassetChange(asset.id);
                oncloseAllDropdowns();
              }
            }}
            role="option"
            aria-selected={selectedContext.assetId === asset.id}
            tabindex="0"
          >
            {asset.name}
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

<!-- Favorites Container -->
<div
  class="favorites-container"
  id="favoritesContainer"
>
  <div class="favorites-header">
    <span class="favorites-label">&#11088; Favoriten:</span>
    <div
      class="favorites-list"
      id="favoritesList"
    >
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

<style>
  .shift-info-row {
    display: grid;
    position: relative;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--spacing-6);
    z-index: 1;
  }

  .info-item {
    display: flex;
    position: relative;
    flex-direction: column;
    align-items: center;

    text-align: center;
  }

  .info-label {
    margin-bottom: var(--spacing-1);
    color: var(--text-secondary);
    font-weight: 500;

    font-size: 16px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .dropdown--disabled {
    opacity: 50%;
    pointer-events: none;
    transition: opacity 300ms ease;
  }

  .dropdown--disabled .dropdown__trigger {
    cursor: not-allowed;
  }

  .info-item :global(.dropdown) {
    transition: opacity 300ms ease;
  }

  #admin-filter-controls .dropdown {
    min-width: 200px;
    width: 100%;
  }

  #admin-filter-controls .dropdown__trigger {
    min-width: 200px;
  }

  #admin-filter-controls .dropdown__option {
    white-space: nowrap;
  }

  .favorites-container {
    backdrop-filter: var(--glass-backdrop);
    margin-bottom: var(--spacing-6);

    border: var(--glass-border);
    border-radius: var(--radius-xl);

    background: var(--glass-bg);
    padding: var(--spacing-4);
  }

  .favorites-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--spacing-4);
  }

  .favorites-label {
    color: var(--text-primary);
    font-weight: 600;
    font-size: 14px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .favorites-list {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    gap: var(--spacing-2);
  }

  .favorite-btn {
    display: flex;

    position: relative;
    align-items: center;
    gap: 8px;

    transition: all 0.3s ease;
    cursor: pointer;
    border: 1px solid rgb(76 175 80 / 40%);
    border-radius: var(--radius-xl);

    background: linear-gradient(
      135deg,
      rgb(76 175 80 / 20%),
      rgb(76 175 80 / 10%)
    );

    padding: 8px 16px;
    color: #4caf50;
    font-weight: 600;

    font-size: 13px;
  }

  .favorite-btn:hover {
    box-shadow: 0 4px 12px rgb(76 175 80 / 20%);
    border-color: rgb(76 175 80 / 60%);
    background: linear-gradient(
      135deg,
      rgb(76 175 80 / 30%),
      rgb(76 175 80 / 20%)
    );
  }

  .favorite-btn:active {
    transform: translateY(0);
  }

  .favorite-btn-inner {
    display: flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    padding: 0;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .remove-favorite {
    display: flex;

    position: absolute;
    top: -10px;
    right: -3px;
    justify-content: center;
    align-items: center;

    visibility: hidden;
    opacity: 0%;

    transition: all 0.2s ease;
    cursor: pointer;
    border: 2px solid rgb(244 67 54);
    border-radius: 50%;
    background: rgb(244 67 54 / 10%);

    width: 20px;
    height: 20px;
    color: rgb(244 67 54);

    font-size: 11px;
  }

  .favorite-btn:hover .remove-favorite {
    visibility: visible;
    opacity: 100%;
  }

  .remove-favorite:hover {
    transform: scale(1.2);
    border-color: rgb(244 67 54);
    background: rgb(244 67 54 / 37%);
  }

  .favorites-empty {
    color: var(--text-tertiary);
    font-size: 13px;
    font-style: italic;
  }

  .add-favorite-btn {
    display: inline-block;

    transition: all 0.3s ease;
    cursor: pointer;

    margin-top: var(--spacing-4);
    margin-bottom: var(--spacing-4);

    border: 1px solid rgb(76 175 80 / 40%);
    border-radius: var(--radius-xl);

    background: linear-gradient(
      135deg,
      rgb(76 175 80 / 20%),
      rgb(76 175 80 / 10%)
    );
    padding: 10px 20px;
    color: #4caf50;
    font-weight: 700;

    font-size: 14px;
  }

  .add-favorite-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgb(76 175 80 / 30%);
    border-color: rgb(76 175 80 / 60%);
    background: linear-gradient(
      135deg,
      rgb(76 175 80 / 30%),
      rgb(76 175 80 / 20%)
    );
  }

  .add-favorite-btn:active {
    transform: translateY(0);
  }

  @media (width < 1024px) {
    .shift-info-row {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (width < 768px) {
    .shift-info-row {
      grid-template-columns: 1fr;
    }

    .dropdown {
      min-width: 100%;
    }
  }
</style>
