<!--
  ParticipantChips — selector for KVP "Beteiligte" (co-originators).

  Renders selected entries as removable chips + "+" button that opens a
  grouped, server-searchable dropdown across users, teams, departments,
  and areas. Pure annotation: no permission grant, no notification trigger
  (ADR-045 §"Annotation only", masterplan §0 Q2).

  Bound `value` is the wire shape `Participant[]`. Display labels come
  from a local cache populated when an option is selected from the
  dropdown — sufficient for V1 (Edit-UI is out of scope per Step 5.3).

  @see docs/FEAT_KVP_PARTICIPANTS_MASTERPLAN.md §Phase 5.1
  @see frontend/src/lib/components/UserPositionChips.svelte (style ref)
-->
<script lang="ts">
  import { SvelteMap } from 'svelte/reactivity';

  import { onClickOutsideDropdown } from '$lib/actions/click-outside';
  import { createLogger } from '$lib/utils/logger';

  import { getParticipantOptions } from './api';

  import type { HierarchyLabels } from '$lib/types/hierarchy-labels';
  import type {
    EnrichedParticipant,
    Participant,
    ParticipantOptions,
    ParticipantType,
  } from './types';

  interface Props {
    /** Selected participants (bindable wire shape). */
    value?: Participant[];
    /** Tenant-customised hierarchy labels for group headers (ADR-034). */
    hierarchyLabels: HierarchyLabels;
    /** Disables add + remove interactions while parent is submitting. */
    disabled?: boolean;
  }

  /* eslint-disable prefer-const -- $bindable() is a Svelte semantic marker */
  let { value = $bindable([]), hierarchyLabels, disabled = false }: Props = $props();
  /* eslint-enable prefer-const */

  const log = createLogger('ParticipantChips');

  // Visual order + per-type icon (used in the dropdown options + group
  // headers only — chips themselves carry type info via colour modifier
  // classes, not icons, mirroring the `pos-chip` pattern in
  // frontend/src/lib/components/UserPositionChips.svelte).
  // Per-type colour palette is defined in the style block at the bottom
  // of this file as `.participant-chip--{type}` modifiers — uses the same
  // tokens as the calendar legend (`--color-sky` / `--color-emerald` /
  // `--color-carrot` / `--color-danger-hover`) for cross-feature visual
  // consistency. NOTE: avoid bare HTML-style tags in script comments —
  // Svelte's tokenizer still scans them and breaks parsing.
  const TYPE_ORDER: ParticipantType[] = ['user', 'team', 'department', 'area'];
  const TYPE_ICON: Record<ParticipantType, string> = {
    user: 'fa-user',
    team: 'fa-users',
    department: 'fa-building',
    area: 'fa-th-large',
  };

  let searchQuery = $state('');
  let dropdownOpen = $state(false);
  let options = $state<ParticipantOptions>({
    users: [],
    teams: [],
    departments: [],
    areas: [],
  });
  let loading = $state(false);
  let debouncedQuery = $state('');

  // Local cache: stores enriched data (label/sublabel) for chips that have
  // been added through this component's dropdown. V1 has no Edit-UI, so
  // any preloaded `value` won't carry labels — a fallback "${type} #${id}"
  // is rendered until/unless the dropdown is opened (which fetches labels).
  // SvelteMap (svelte/reactivity) provides reactive mutation semantics
  // — `set()` triggers re-render without manual reassignment.
  const labelCache = new SvelteMap<string, EnrichedParticipant>();

  function chipKey(p: Participant): string {
    return `${p.type}:${String(p.id)}`;
  }

  // Bucket name resolution: 'user' → 'users', etc. Keeps the
  // discriminator → bucket mapping in one place. Template-literal
  // narrowing yields the exact `keyof ParticipantOptions` union, so
  // no assertion is needed.
  function bucketKey(t: ParticipantType): keyof ParticipantOptions {
    return `${t}s`;
  }

  // Group header text: 'Mitarbeiter' is hardcoded German per masterplan §5.1
  // (no `users` field in HierarchyLabels — that's an org-level concept).
  function groupHeader(t: ParticipantType): string {
    switch (t) {
      case 'user':
        return 'Mitarbeiter';
      case 'team':
        return hierarchyLabels.team;
      case 'department':
        return hierarchyLabels.department;
      case 'area':
        return hierarchyLabels.area;
    }
  }

  const selectedKeys = $derived(new Set(value.map(chipKey)));

  // Debounce: 250 ms from last keystroke. Cleanup on dependency change
  // prevents stale-timer fan-out (the previous timer is cleared before
  // a new one is scheduled).
  $effect(() => {
    const q = searchQuery;
    const timer = setTimeout(() => {
      debouncedQuery = q;
    }, 250);
    return () => {
      clearTimeout(timer);
    };
  });

  // Re-fetch options whenever the dropdown is open and the debounced
  // query changes. Closed dropdown = no fetch (saves a request and
  // avoids stale options being briefly visible on next open).
  $effect(() => {
    if (!dropdownOpen) return;
    const q = debouncedQuery;
    void (async () => {
      loading = true;
      try {
        const next = await getParticipantOptions(q);
        options = next;
      } catch (err: unknown) {
        log.error({ err }, 'Failed to load participant options');
        options = { users: [], teams: [], departments: [], areas: [] };
      } finally {
        loading = false;
      }
    })();
  });

  // Capture-phase click-outside (works inside modals — bubble phase is
  // killed by KvpCreateModal's stopPropagation). Active only while open.
  $effect(() => {
    if (!dropdownOpen) return;
    return onClickOutsideDropdown(() => {
      dropdownOpen = false;
    });
  });

  function toggleDropdown(): void {
    if (disabled) return;
    dropdownOpen = !dropdownOpen;
  }

  function addParticipant(opt: EnrichedParticipant): void {
    if (disabled) return;
    const key = chipKey(opt);
    if (selectedKeys.has(key)) {
      // Idempotent: already selected → close the dropdown but don't duplicate.
      dropdownOpen = false;
      return;
    }
    labelCache.set(key, opt);
    value = [...value, { type: opt.type, id: opt.id }];
    dropdownOpen = false;
  }

  function removeParticipant(p: Participant): void {
    if (disabled) return;
    const key = chipKey(p);
    value = value.filter((entry) => chipKey(entry) !== key);
  }

  function chipLabel(p: Participant): string {
    return labelCache.get(chipKey(p))?.label ?? `${p.type} #${String(p.id)}`;
  }

  function chipSublabel(p: Participant): string | undefined {
    const cached = labelCache.get(chipKey(p));
    if (cached?.sublabel === undefined || cached.sublabel === '') return undefined;
    return cached.sublabel;
  }

  function handleSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      dropdownOpen = false;
    }
  }

  // Renderable groups — buckets in fixed order; unselected entries only.
  // Inject the discriminator `type` from the bucket name onto each option:
  // the backend `/options` endpoint returns `{ users: [{id,label,sublabel}],
  // teams: […], … }` and uses the bucket *key* as the type signal — no
  // inline `type` field per row (see kvp-participants.service.ts
  // searchUsers/searchTeams/searchDepartments/searchAreas). Without this
  // map(), `chipKey(opt)`, `addParticipant(opt)` and the
  // `participant-chip--{type}` colour modifier all see `opt.type ===
  // undefined`, producing class="participant-chip--" with no colour.
  const visibleGroups = $derived(
    TYPE_ORDER.map((t) => {
      const items = options[bucketKey(t)]
        .map((opt) => ({ ...opt, type: t }))
        .filter((opt: EnrichedParticipant) => !selectedKeys.has(chipKey(opt)));
      return { type: t, items };
    }),
  );

  const hasAnyResults = $derived(visibleGroups.some((g) => g.items.length > 0));
</script>

<div class="participant-chips dropdown">
  <div class="participant-chips__list">
    {#each value as p (chipKey(p))}
      {@const sub = chipSublabel(p)}
      <!--
        Chip markup mirrors the `pos-chip` pattern from
        frontend/src/lib/components/UserPositionChips.svelte — text + remove
        button, no icon inside the chip, no badge wrapper class. Type info
        is conveyed by the `participant-chip--{type}` colour modifier (see
        chip rules in the style block below) using the same tokens as the
        calendar legend so the four types pop visually with low cognitive
        cost. ADR-017 design system §4. NOTE: avoid bare HTML tags inside
        comments — Svelte's tokenizer treats them as real elements and
        breaks parsing.
      -->
      <span
        class="participant-chip participant-chip--{p.type}"
        title={sub ?? chipLabel(p)}
      >
        <span class="participant-chip__label">{chipLabel(p)}</span>
        <button
          type="button"
          class="participant-chip__remove"
          aria-label="Entfernen"
          {disabled}
          onclick={() => {
            removeParticipant(p);
          }}
        >
          <i class="fas fa-times"></i>
        </button>
      </span>
    {/each}

    <button
      type="button"
      class="participant-chips__add"
      aria-label="Beteiligten hinzufügen"
      aria-haspopup="listbox"
      aria-expanded={dropdownOpen}
      {disabled}
      onclick={toggleDropdown}
    >
      <i class="fas fa-plus"></i>
    </button>
  </div>

  <!--
    Dropdown menu uses ONLY design-system primitives (custom-dropdown.css +
    searchable-dropdown.css). No component-local overrides — global classes
    handle search bar, scrollable options, empty state, and group labels.
    Single-line option layout via flex `space-between` between left span
    (icon + name) and `.dropdown__option-secondary` for the sublabel.
  -->
  <div
    class="dropdown__menu"
    class:active={dropdownOpen}
    role="listbox"
  >
    <div class="dropdown__search">
      <i class="dropdown__search-icon fas fa-search"></i>
      <input
        type="search"
        class="dropdown__search-input"
        placeholder="Suche nach Person, Team, Abteilung oder Bereich…"
        bind:value={searchQuery}
        onkeydown={handleSearchKeydown}
      />
    </div>

    {#if loading}
      <div class="dropdown__empty">
        <i class="fas fa-spinner fa-spin mr-2"></i>
        Wird geladen…
      </div>
    {:else if !hasAnyResults}
      <div class="dropdown__empty">
        {searchQuery === '' ? 'Keine Einträge verfügbar.' : 'Keine Treffer.'}
      </div>
    {:else}
      <div class="dropdown__options">
        {#each visibleGroups as group (group.type)}
          {#if group.items.length > 0}
            <div class="dropdown__group-label">
              <i class="fas {TYPE_ICON[group.type]} mr-2"></i>
              {groupHeader(group.type)}
            </div>
            {#each group.items as opt (chipKey(opt))}
              <button
                type="button"
                class="dropdown__option"
                onclick={() => {
                  addParticipant(opt);
                }}
              >
                <span>
                  <i class="fas {TYPE_ICON[opt.type]}"></i>
                  {opt.label}
                </span>
                {#if opt.sublabel !== undefined && opt.sublabel !== ''}
                  <span class="dropdown__option-secondary">{opt.sublabel}</span>
                {/if}
              </button>
            {/each}
          {/if}
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .participant-chips {
    position: relative;
    margin-top: 0.25rem;
  }

  .participant-chips__list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }

  /* Chip layout mirrors `pos-chip` (UserPositionChips.svelte:195) — pill
     shape, 15 % colour-mix bg, bold same-hue text. Per-type colour is
     parameterised via the `--participant-chip-color` custom property; the
     four `--user`/`--team`/`--department`/`--area` modifiers each set this
     to the corresponding calendar-legend token, giving a single chip rule
     instead of four. ADR-017 design-system §"Token-First". */
  .participant-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.625rem;
    border-radius: var(--radius-xl, 9999px);
    background: color-mix(
      in oklch,
      var(--participant-chip-color, var(--color-primary)) 15%,
      transparent
    );
    color: var(--participant-chip-color, var(--color-primary));
    font-size: 0.8125rem;
    font-weight: 500;
    max-width: 100%;
  }

  .participant-chip--user {
    --participant-chip-color: var(--color-sky);
  }

  .participant-chip--team {
    --participant-chip-color: var(--color-emerald);
  }

  .participant-chip--department {
    --participant-chip-color: var(--color-carrot);
  }

  .participant-chip--area {
    --participant-chip-color: var(--color-danger-hover);
  }

  .participant-chip__label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 16rem;
  }

  .participant-chip__remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: 0.125rem;
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

  .participant-chip__remove:hover:not(:disabled) {
    opacity: 100%;
  }

  .participant-chip__remove:disabled {
    cursor: not-allowed;
    opacity: 30%;
  }

  .participant-chips__add {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: 1px dashed var(--color-glass-border, rgb(255 255 255 / 15%));
    border-radius: var(--radius-sm, 6px);
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.15s;
  }

  .participant-chips__add:hover:not(:disabled) {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .participant-chips__add:disabled {
    cursor: not-allowed;
    opacity: 50%;
  }

  /* Mobile: cap chip width tighter so the row wraps cleanly at 375px.
     Dropdown menu sizing + search bar + scrollable options + empty state +
     two-column option layout are ALL handled by global design-system
     primitives (custom-dropdown.css + searchable-dropdown.css) — no
     component-local overrides needed. ADR-017 §"Use design tokens (no
     hardcoded values)" + design-system README §"Pattern: Base + Variants". */
  @media (width <= 480px) {
    .participant-chip__label {
      max-width: 9rem;
    }
  }
</style>
