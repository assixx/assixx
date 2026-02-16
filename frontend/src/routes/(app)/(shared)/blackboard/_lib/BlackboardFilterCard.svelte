<script lang="ts">
  /**
   * BlackboardFilterCard - Filter & Search Component
   *
   * Provides filtering and search capabilities:
   * - Text search (with Enter to submit)
   * - Organization level filter (company/area/department/team)
   * - Sort options (dropdown)
   * - Collapsible card
   *
   * Pattern: Controlled component with local dropdown state
   */
  import { onClickOutsideDropdown } from '$lib/actions/click-outside';

  import { SORT_OPTIONS } from './constants';

  interface Props {
    searchQuery: string;
    levelFilter: 'all' | 'company' | 'department' | 'team' | 'area';
    sortBy: string;
    sortDir: 'ASC' | 'DESC';
    sortLabel: string;
    expanded: boolean;
    onsearchchange: (query: string) => void;
    onlevelchange: (level: typeof levelFilter) => void;
    onsortchange: (value: string) => void;
    ontoggle: () => void;
  }

  const {
    searchQuery,
    levelFilter,
    sortBy,
    sortDir,
    sortLabel,
    expanded,
    onsearchchange,
    onlevelchange,
    onsortchange,
    ontoggle,
  }: Props = $props();

  // Local state: search input + dropdown
  // eslint-disable-next-line svelte/prefer-writable-derived -- searchInput must be writable for bind:value, $derived would be read-only
  let searchInput = $state('');
  let sortDropdownOpen = $state(false);

  // Sync searchInput with prop when prop changes
  $effect(() => {
    searchInput = searchQuery;
  });

  function handleSearch(): void {
    onsearchchange(searchInput.trim());
  }

  function handleLevelClick(level: typeof levelFilter): void {
    onlevelchange(level);
  }

  function handleSortSelect(value: string): void {
    sortDropdownOpen = false;
    onsortchange(value);
  }

  function handleToggle(): void {
    ontoggle();
  }

  function handleToggleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      ontoggle();
    }
  }

  function handleSearchKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }

  function toggleSortDropdown(): void {
    sortDropdownOpen = !sortDropdownOpen;
  }

  function handleSortKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      toggleSortDropdown();
    }
  }

  function handleOptionKeyDown(e: KeyboardEvent, value: string): void {
    if (e.key === 'Enter') {
      handleSortSelect(value);
    }
  }

  // Capture-phase click-outside: works inside modals (bypasses stopPropagation)
  $effect(() => {
    return onClickOutsideDropdown(() => {
      sortDropdownOpen = false;
    });
  });

  // Level filter options
  const levelOptions = [
    { value: 'all', label: 'Alle', icon: 'fa-globe' },
    { value: 'company', label: 'Firma', icon: 'fa-building' },
    { value: 'area', label: 'Bereich', icon: 'fa-map-marked-alt' },
    { value: 'department', label: 'Abteilung', icon: 'fa-sitemap' },
    { value: 'team', label: 'Team', icon: 'fa-users' },
  ] as const;
</script>

<div class="card mb-6">
  <!-- Card Header (Collapsible) -->
  <div
    class="card__header cursor-pointer"
    onclick={handleToggle}
    role="button"
    tabindex="0"
    onkeydown={handleToggleKeyDown}
  >
    <div class="flex items-center justify-between">
      <h3 class="card__title m-0">
        <i class="fas fa-filter mr-2"></i>
        Filter & Suche
      </h3>
      <i
        class="fas fa-chevron-down transition-transform duration-200"
        class:rotate-180={expanded}
      ></i>
    </div>
  </div>

  <!-- Card Body (Collapsible Content) -->
  {#if expanded}
    <div class="card__body">
      <div class="flex flex-wrap items-end gap-4">
        <!-- Search Bar -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="searchInput">Suche</label
          >
          <div class="relative">
            <input
              type="text"
              id="searchInput"
              class="form-field__control pl-10"
              placeholder="Blackboard durchsuchen..."
              bind:value={searchInput}
              onkeydown={handleSearchKeyDown}
            />
            <i
              class="fas fa-search absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
            ></i>
          </div>
        </div>

        <!-- Level Filter (Toggle Button Group) -->
        <div class="form-field">
          <span
            class="form-field__label"
            id="levelFilterLabel"
          >
            Organisationsebene
          </span>
          <div
            class="toggle-group mt-2"
            role="group"
            aria-labelledby="levelFilterLabel"
          >
            {#each levelOptions as opt (opt.value)}
              <button
                type="button"
                class="toggle-group__btn"
                class:active={levelFilter === opt.value}
                onclick={() => {
                  handleLevelClick(opt.value);
                }}
              >
                <i
                  class="fas {opt.icon}"
                  aria-hidden="true"
                ></i>
                {opt.label}
              </button>
            {/each}
          </div>
        </div>

        <!-- Sort Dropdown -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="sortFilter">Sortierung</label
          >
          <div
            class="dropdown"
            id="sort-dropdown"
            role="listbox"
          >
            <div
              class="dropdown__trigger"
              onclick={toggleSortDropdown}
              role="button"
              tabindex="0"
              onkeydown={handleSortKeyDown}
            >
              <span>{sortLabel}</span>
              <i class="fas fa-chevron-down"></i>
            </div>
            {#if sortDropdownOpen}
              <div class="dropdown__menu active">
                {#each SORT_OPTIONS as opt (opt.value)}
                  <div
                    class="dropdown__option"
                    onclick={() => {
                      handleSortSelect(opt.value);
                    }}
                    onkeydown={(e) => {
                      handleOptionKeyDown(e, opt.value);
                    }}
                    role="option"
                    tabindex="0"
                    aria-selected={`${sortBy}|${sortDir}` === opt.value}
                  >
                    {opt.label}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
