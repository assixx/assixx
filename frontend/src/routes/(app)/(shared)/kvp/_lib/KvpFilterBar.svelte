<script lang="ts">
  /**
   * KVP Filter Bar - All filter controls for the KVP suggestions list
   * Extracted from +page.svelte for modularity (max-lines rule)
   */

  import { SvelteSet } from 'svelte/reactivity';

  import { onClickOutsideDropdown } from '$lib/actions/click-outside';
  import {
    DEFAULT_HIERARCHY_LABELS,
    type HierarchyLabels,
  } from '$lib/types/hierarchy-labels';

  import { createFilterOptions, STATUS_FILTER_OPTIONS } from './constants';
  import { kvpState } from './state.svelte';
  import { debounce } from './utils';

  import type { UserTeamWithAssets } from './types';

  interface Props {
    userOrganizations: UserTeamWithAssets[];
    onfilterchange: () => void;
    labels?: HierarchyLabels;
  }

  const {
    userOrganizations,
    onfilterchange,
    labels = DEFAULT_HIERARCHY_LABELS,
  }: Props = $props();

  const filterOptions = $derived(createFilterOptions(labels));

  // ==========================================================================
  // DROPDOWN STATE
  // ==========================================================================

  let activeDropdown = $state<string | null>(null);
  let statusDisplayText = $state('Alle Status');
  let categoryDisplayText = $state('Alle Kategorien');
  let departmentDisplayText = $state<string | null>(null);
  let teamDisplayText = $state<string | null>(null);
  let assetDisplayText = $state<string | null>(null);

  /** Show selected name or dynamic default */
  const departmentDisplay = $derived(
    departmentDisplayText ?? `Alle ${labels.department}`,
  );
  const teamDisplay = $derived(teamDisplayText ?? `Alle ${labels.team}`);
  const assetDisplay = $derived(assetDisplayText ?? `Alle ${labels.asset}`);

  const debouncedSearch = debounce(() => {
    onfilterchange();
  }, 300);

  // ==========================================================================
  // FILTER HANDLERS
  // ==========================================================================

  function handleFilterChange(filter: string) {
    kvpState.setFilter(filter as typeof kvpState.currentFilter);
    onfilterchange();
  }

  function toggleDropdown(dropdownId: string) {
    activeDropdown = activeDropdown === dropdownId ? null : dropdownId;
  }

  function closeAllDropdowns() {
    activeDropdown = null;
  }

  function handleStatusSelect(value: string, label: string) {
    kvpState.setStatusFilter(value);
    statusDisplayText = label;
    closeAllDropdowns();
    onfilterchange();
  }

  function handleCategorySelect(value: string, label: string) {
    kvpState.setCategoryFilter(value);
    categoryDisplayText = label;
    closeAllDropdowns();
    onfilterchange();
  }

  function handleDepartmentSelect(value: string, label: string | null) {
    kvpState.setDepartmentFilter(value);
    departmentDisplayText = label;
    closeAllDropdowns();
    onfilterchange();
  }

  function handleTeamSelect(value: string, label: string | null) {
    kvpState.setTeamFilter(value);
    teamDisplayText = label;
    closeAllDropdowns();
    onfilterchange();
  }

  function handleAssetSelect(value: string, label: string | null) {
    kvpState.setAssetFilter(value);
    assetDisplayText = label;
    closeAllDropdowns();
    onfilterchange();
  }

  /** All assets from user organizations (deduplicated) */
  const allFilterAssets = $derived.by(() => {
    const seen = new SvelteSet<number>();
    const assets: { id: number; name: string }[] = [];
    for (const team of userOrganizations) {
      for (const asset of team.assets) {
        if (!seen.has(asset.id)) {
          seen.add(asset.id);
          assets.push(asset);
        }
      }
    }
    return assets;
  });

  function handleSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    kvpState.setSearchQuery(target.value);
    debouncedSearch();
  }

  // Capture-phase click-outside: works inside modals (bypasses stopPropagation)
  $effect(() => {
    return onClickOutsideDropdown(closeAllDropdowns);
  });
</script>

<div class="card mb-6">
  <div class="card__header">
    <h3 class="card__title">
      <i class="fas fa-filter mr-2"></i>
      Filter & Anzeige
    </h3>
    <div class="kvp-filter-row mt-6">
      <!-- Ansichts-Filter -->
      <div class="form-field">
        <span class="form-field__label">Ansicht</span>
        <div
          class="toggle-group mt-2"
          id="kvpFilter"
        >
          {#each filterOptions as option (option.value)}
            <button
              type="button"
              class="toggle-group__btn"
              class:active={kvpState.currentFilter === option.value}
              data-value={option.value}
              onclick={() => {
                handleFilterChange(option.value);
              }}
              title={option.title}
            >
              <i class="fas {option.icon}"></i>
              {option.label}
            </button>
          {/each}
        </div>
      </div>

      <!-- Status Filter -->
      <div class="form-field">
        <span class="form-field__label">Status</span>
        <div
          class="dropdown mt-2"
          data-dropdown="status"
        >
          <button
            type="button"
            class="dropdown__trigger"
            class:active={activeDropdown === 'status'}
            onclick={() => {
              toggleDropdown('status');
            }}
          >
            <span>{statusDisplayText}</span>
            <i class="fas fa-chevron-down"></i>
          </button>
          <div
            class="dropdown__menu"
            class:active={activeDropdown === 'status'}
          >
            {#each STATUS_FILTER_OPTIONS as option (option.value)}
              <button
                type="button"
                class="dropdown__option"
                data-action="select-status"
                data-value={option.value}
                onclick={() => {
                  handleStatusSelect(option.value, option.label);
                }}
              >
                {option.label}
              </button>
            {/each}
          </div>
        </div>
      </div>

      <!-- Category Filter -->
      <div class="form-field">
        <span class="form-field__label">Kategorie</span>
        <div
          class="dropdown mt-2"
          data-dropdown="category"
        >
          <button
            type="button"
            class="dropdown__trigger"
            class:active={activeDropdown === 'category'}
            onclick={() => {
              toggleDropdown('category');
            }}
          >
            <span>{categoryDisplayText}</span>
            <i class="fas fa-chevron-down"></i>
          </button>
          <div
            class="dropdown__menu"
            class:active={activeDropdown === 'category'}
          >
            <button
              type="button"
              class="dropdown__option"
              data-action="select-category"
              data-value=""
              onclick={() => {
                handleCategorySelect('', 'Alle Kategorien');
              }}
            >
              Alle Kategorien
            </button>
            {#each kvpState.categories as category (`${category.source}:${String(category.id)}`)}
              <button
                type="button"
                class="dropdown__option"
                data-action="select-category"
                data-value={`${category.source}:${String(category.id)}`}
                onclick={() => {
                  handleCategorySelect(
                    `${category.source}:${category.id}`,
                    category.name,
                  );
                }}
              >
                {category.name}
              </button>
            {/each}
          </div>
        </div>
      </div>

      <!-- Department Filter -->
      <div class="form-field">
        <span class="form-field__label">{labels.department}</span>
        <div
          class="dropdown mt-2"
          data-dropdown="department"
        >
          <button
            type="button"
            class="dropdown__trigger"
            class:active={activeDropdown === 'department'}
            onclick={() => {
              toggleDropdown('department');
            }}
          >
            <span>{departmentDisplay}</span>
            <i class="fas fa-chevron-down"></i>
          </button>
          <div
            class="dropdown__menu"
            class:active={activeDropdown === 'department'}
          >
            <button
              type="button"
              class="dropdown__option"
              data-action="select-department"
              data-value=""
              onclick={() => {
                handleDepartmentSelect('', null);
              }}
            >
              Alle {labels.department}
            </button>
            {#each kvpState.departments as dept (dept.id)}
              <button
                type="button"
                class="dropdown__option"
                data-action="select-department"
                data-value={dept.id.toString()}
                onclick={() => {
                  handleDepartmentSelect(dept.id.toString(), dept.name);
                }}
              >
                {dept.name}
              </button>
            {/each}
          </div>
        </div>
      </div>

      <!-- Team Filter -->
      <div class="form-field">
        <span class="form-field__label">{labels.team}</span>
        <div
          class="dropdown mt-2"
          data-dropdown="team"
        >
          <button
            type="button"
            class="dropdown__trigger"
            class:active={activeDropdown === 'team'}
            onclick={() => {
              toggleDropdown('team');
            }}
          >
            <span>{teamDisplay}</span>
            <i class="fas fa-chevron-down"></i>
          </button>
          <div
            class="dropdown__menu"
            class:active={activeDropdown === 'team'}
          >
            <button
              type="button"
              class="dropdown__option"
              onclick={() => {
                handleTeamSelect('', null);
              }}
            >
              Alle {labels.team}
            </button>
            {#each userOrganizations as team (team.teamId)}
              <button
                type="button"
                class="dropdown__option"
                onclick={() => {
                  handleTeamSelect(team.teamId.toString(), team.teamName);
                }}
              >
                {team.teamName}
              </button>
            {/each}
          </div>
        </div>
      </div>

      <!-- Asset Filter -->
      {#if allFilterAssets.length > 0}
        <div class="form-field">
          <span class="form-field__label">{labels.asset}</span>
          <div
            class="dropdown mt-2"
            data-dropdown="asset"
          >
            <button
              type="button"
              class="dropdown__trigger"
              class:active={activeDropdown === 'asset'}
              onclick={() => {
                toggleDropdown('asset');
              }}
            >
              <span>{assetDisplay}</span>
              <i class="fas fa-chevron-down"></i>
            </button>
            <div
              class="dropdown__menu"
              class:active={activeDropdown === 'asset'}
            >
              <button
                type="button"
                class="dropdown__option"
                onclick={() => {
                  handleAssetSelect('', null);
                }}
              >
                Alle {labels.asset}
              </button>
              {#each allFilterAssets as asset (asset.id)}
                <button
                  type="button"
                  class="dropdown__option"
                  onclick={() => {
                    handleAssetSelect(asset.id.toString(), asset.name);
                  }}
                >
                  {asset.name}
                </button>
              {/each}
            </div>
          </div>
        </div>
      {/if}

      <!-- Suche -->
      <div class="form-field kvp-search-field">
        <span class="form-field__label">Suche</span>
        <div class="search-input mt-2">
          <i class="search-input__icon fas fa-search"></i>
          <input
            type="search"
            class="search-input__field"
            placeholder="Vorschläge durchsuchen..."
            value={kvpState.searchQuery}
            oninput={handleSearchInput}
          />
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  [data-dropdown='status'] .dropdown__trigger {
    width: auto;
    min-width: 180px;
  }

  [data-dropdown='status'] .dropdown__menu {
    min-width: 180px;
    left: auto;
    right: auto;
  }

  .kvp-filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-4);
    align-items: flex-end;
  }

  .kvp-search-field {
    width: 220px;
  }
</style>
