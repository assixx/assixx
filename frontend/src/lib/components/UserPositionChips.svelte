<!--
  UserPositionChips — Form-controlled position selector.
  Shows selected positions as removable chips + add dropdown from catalog.
  No API calls — parent owns state via bind:selectedIds.
-->
<script lang="ts">
  import {
    isLeadPosition,
    resolvePositionDisplay,
    type HierarchyLabels,
    DEFAULT_HIERARCHY_LABELS,
    type PositionOption,
  } from '$lib/types/hierarchy-labels';

  interface Props {
    /** Full position catalog (all available positions) */
    catalog: PositionOption[];
    /** Currently selected position IDs (bindable) */
    selectedIds?: string[];
    /** Hierarchy labels for display */
    hierarchyLabels?: HierarchyLabels;
  }

  /* eslint-disable prefer-const -- $bindable() is a Svelte semantic marker */
  let {
    catalog,
    selectedIds = $bindable([]),
    hierarchyLabels: hl = DEFAULT_HIERARCHY_LABELS,
  }: Props = $props();

  let dropdownOpen = $state(false);

  const ROLE_CATEGORY_LABELS: Record<string, string> = {
    employee: 'Mitarbeiter',
    admin: 'Admin',
    root: 'Root',
  };

  const roleCategories = ['employee', 'admin', 'root'] as const;

  /** Positions not yet selected */
  const available = $derived(catalog.filter((p: PositionOption) => !selectedIds.includes(p.id)));

  /** Selected positions with metadata from catalog */
  const selected = $derived(
    selectedIds
      .map((id: string) => catalog.find((p: PositionOption) => p.id === id))
      .filter((p: PositionOption | undefined): p is PositionOption => p !== undefined),
  );

  // 2-Layer Lead Setup Reminder (ADR-010 §3.3, ADR-045 isAnyLead branch).
  // Drives the warning alert below — see the inline comment there for the
  // background incident that motivated this hint.
  const hasLeadPositionSelected = $derived(
    selected.some((p: PositionOption) => isLeadPosition(p.name)),
  );

  /** Show grouped dropdown when multiple role categories present */
  const grouped = $derived(
    available.length > 0 &&
      available.some((p: PositionOption) => p.roleCategory !== available[0]?.roleCategory),
  );

  function toggleDropdown(e: MouseEvent): void {
    e.stopPropagation();
    dropdownOpen = !dropdownOpen;
  }

  function addPosition(id: string): void {
    if (!selectedIds.includes(id)) {
      selectedIds = [...selectedIds, id];
    }
    dropdownOpen = false;
  }

  function removePosition(id: string): void {
    selectedIds = selectedIds.filter((sid: string) => sid !== id);
  }

  // Close dropdown on outside click
  $effect(() => {
    if (dropdownOpen) {
      const handleClick = (e: MouseEvent): void => {
        const target = e.target as HTMLElement;
        const el = document.getElementById('pos-chips-dropdown');
        if (el && !el.contains(target)) dropdownOpen = false;
      };
      document.addEventListener('click', handleClick, true);
      return () => {
        document.removeEventListener('click', handleClick, true);
      };
    }
  });
</script>

<div class="pos-chips">
  <span class="form-field__label">
    <i class="fas fa-id-badge mr-1"></i>
    Positionen <span class="text-red-500">*</span>
  </span>

  <div class="pos-chips__list">
    {#each selected as pos (pos.id)}
      <span class="pos-chip">
        {resolvePositionDisplay(pos.name, hl)}
        <button
          type="button"
          class="pos-chip__remove"
          aria-label="Entfernen"
          onclick={() => {
            removePosition(pos.id);
          }}
        >
          <i class="fas fa-times"></i>
        </button>
      </span>
    {/each}

    {#if available.length > 0}
      <div
        class="pos-add-dropdown"
        id="pos-chips-dropdown"
      >
        <button
          type="button"
          class="pos-add-btn"
          aria-label="Position hinzufügen"
          onclick={toggleDropdown}
        >
          <i class="fas fa-plus"></i>
        </button>
        <div
          class="dropdown__menu"
          class:dropdown__menu--tall={grouped}
          class:active={dropdownOpen}
        >
          {#if grouped}
            {#each roleCategories as category (category)}
              {@const catPositions = available.filter(
                (p: PositionOption) => p.roleCategory === category,
              )}
              {#if catPositions.length > 0}
                <div class="dropdown__group-label">
                  {ROLE_CATEGORY_LABELS[category]}
                </div>
                {#each catPositions as pos (pos.id)}
                  <button
                    type="button"
                    class="dropdown__option"
                    onclick={() => {
                      addPosition(pos.id);
                    }}
                  >
                    {resolvePositionDisplay(pos.name, hl)}
                    {#if isLeadPosition(pos.name)}
                      <span class="badge badge--primary badge--xs ml-2">System</span>
                    {/if}
                  </button>
                {/each}
              {/if}
            {/each}
          {:else}
            {#each available as pos (pos.id)}
              <button
                type="button"
                class="dropdown__option"
                onclick={() => {
                  addPosition(pos.id);
                }}
              >
                {resolvePositionDisplay(pos.name, hl)}
                {#if isLeadPosition(pos.name)}
                  <span class="badge badge--primary badge--xs ml-2">System</span>
                {/if}
              </button>
            {/each}
          {/if}
        </div>
      </div>
    {/if}
  </div>

  {#if selected.length === 0 && available.length === 0}
    <span class="pos-chips__empty">Keine Positionen verfügbar</span>
  {/if}

  <!--
    2-Layer Lead Setup Reminder.
    WHY: `users.position` is only the UI label / role-category routing
    (ADR-038). For the user to actually be treated as a lead, the
    Management Gate (ADR-045 Layer 1) requires `isAnyLead = true`, which
    is resolved from `areas.area_lead_id` / `departments.department_lead_id` /
    `teams.team_lead_id` (or the matching `*_deputy_lead_id` columns,
    ADR-035). Position alone never sets those.
    Real-world incident 2026-04-26: admin Adler had position
    'department_lead' but no `departments.department_lead_id` row →
    Layer 1 failed → KVP /permission-denied loop.
    Hierarchy-label aware (ADR-034) so custom tenants (e.g. "Hallen"
    instead of "Bereiche") get the right wording automatically.
  -->
  {#if hasLeadPositionSelected}
    <div
      class="alert alert--warning mt-2"
      role="status"
    >
      <i class="fas fa-exclamation-triangle"></i>
      <div>
        <strong>Hinweis:</strong> Position allein reicht nicht — Benutzer zusätzlich in der
        jeweiligen Verwaltung als Leiter eintragen:
        <ul class="mt-1">
          <li>{hl.areaLeadPrefix}leiter → unter <em>{hl.area} verwalten</em></li>
          <li>{hl.departmentLeadPrefix}leiter → unter <em>{hl.department} verwalten</em></li>
          <li>{hl.teamLeadPrefix}leiter → unter <em>{hl.team} verwalten</em></li>
        </ul>
      </div>
    </div>
  {/if}
</div>

<style>
  .pos-chips {
    margin-top: 0.25rem;
  }

  .pos-chips__list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    align-items: center;
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .pos-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.625rem;
    border-radius: var(--radius-xl, 9999px);
    background: color-mix(in oklch, var(--color-primary, #3b82f6) 15%, transparent);
    color: var(--color-primary, #3b82f6);
    font-size: 0.8125rem;
    font-weight: 500;
  }

  .pos-chip__remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border: none;
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
    color: inherit;
    opacity: 60%;
    font-size: 0.625rem;
    transition: opacity 0.15s;
  }

  .pos-chip__remove:hover:not(:disabled) {
    opacity: 100%;
  }

  .pos-add-dropdown {
    position: relative;
  }

  .pos-add-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: 1px dashed var(--color-border, rgb(255 255 255 / 15%));
    border-radius: var(--radius-sm, 6px);
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.15s;
  }

  .pos-add-btn:hover {
    border-color: var(--color-primary, #3b82f6);
    color: var(--color-primary, #3b82f6);
  }

  /* Override global .dropdown__menu sizing — parent is only 28px wide */
  .pos-add-dropdown :global(.dropdown__menu) {
    right: auto;
    min-width: 280px;
  }

  .pos-chips__empty {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    font-style: italic;
  }
</style>
