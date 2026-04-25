<script lang="ts">
  /**
   * Shift-Handover Templates — Page Component.
   *
   * Team-scoped configuration UI for the per-team handover field set.
   *
   * Flow:
   *   1. Team filter (defaults to first team in the user's scope)
   *   2. On team change → fetch template via `getTemplate(teamId)` and seed
   *      the working state (`builderState.setInitial(fields)`)
   *   3. User edits fields in `FieldBuilder` (validation reactive)
   *   4. Save → `upsertTemplate` → `markSaved()` (clears dirty flag)
   *   5. Delete → 2-click confirm → `deleteTemplate` → reset state
   *
   * Why two-click delete (not confirm()): CODE-OF-CONDUCT forbids
   * `alert`/`confirm`; two-click is the lightest pattern that meets the
   * "destructive action requires intent" UX requirement without dragging in
   * a full modal. Auto-resets after 5 s.
   *
   * @see docs/FEAT_SHIFT_HANDOVER_MASTERPLAN.md §5.2
   */
  import { onDestroy } from 'svelte';

  import PermissionDenied from '$lib/components/PermissionDenied.svelte';
  import { checkSessionExpired } from '$lib/utils/session-expired';

  import { deleteTemplate, getTemplate, upsertTemplate } from './_lib/api-templates';
  import FieldBuilder from './_lib/FieldBuilder.svelte';
  import { createTemplateBuilderState } from './_lib/state-templates.svelte';

  import type { PageData } from './$types';

  // ── SSR data ────────────────────────────────────────────────────────────
  const { data }: { data: PageData } = $props();
  const labels = $derived(data.hierarchyLabels);
  const teams = $derived(data.teams);
  // ADR-020 §6: discriminated-union flag set by the SSR probe in
  // +page.server.ts. When true, the canonical <PermissionDenied /> view
  // replaces the whole template body — identical UX to /shifts and the
  // other 31 addon-gated pages.
  const permissionDenied = $derived(data.permissionDenied);

  // ── Local state ─────────────────────────────────────────────────────────
  let selectedTeamId = $state<number | null>(null);
  let loading = $state(false);
  let saving = $state(false);
  let loadError = $state<string | null>(null);
  let toast = $state<{ kind: 'success' | 'error'; text: string } | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  // 2-click delete confirm — auto-resets after 5 s of inactivity.
  let deleteConfirming = $state(false);
  let confirmTimer: ReturnType<typeof setTimeout> | null = null;

  // Team-filter custom-dropdown state (design-system pattern,
  // `frontend/src/design-system/primitives/dropdowns/custom-dropdown.css`).
  // Click-outside mirrors `logs/_lib/FilterDropdown.svelte` — no wrapper
  // component, just the canonical markup + state inline.
  let teamDropdownOpen = $state(false);
  let teamDropdownRef = $state<HTMLDivElement | undefined>(undefined);

  const builderState = createTemplateBuilderState();

  // Default selection: first team in scope (none if empty). The
  // `teams.length > 0` guard makes `teams[0]` non-empty per the frontend
  // tsconfig narrowing.
  $effect(() => {
    if (selectedTeamId === null && teams.length > 0) {
      selectedTeamId = teams[0].id;
    }
  });

  // Auto-load template when team changes.
  $effect(() => {
    const teamId = selectedTeamId;
    if (teamId !== null) {
      void loadTemplate(teamId);
    }
  });

  // Team-dropdown click-outside — close when user clicks anywhere outside
  // the dropdown container (same pattern as logs/_lib/FilterDropdown).
  $effect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (teamDropdownRef !== undefined && !teamDropdownRef.contains(event.target as Node)) {
        teamDropdownOpen = false;
      }
    }
    document.addEventListener('click', handleClickOutside, true);
    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  });

  onDestroy(() => {
    if (toastTimer !== null) clearTimeout(toastTimer);
    if (confirmTimer !== null) clearTimeout(confirmTimer);
  });

  // ── Actions ─────────────────────────────────────────────────────────────

  function showToast(kind: 'success' | 'error', text: string): void {
    toast = { kind, text };
    if (toastTimer !== null) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast = null;
    }, 4000);
  }

  async function loadTemplate(teamId: number): Promise<void> {
    loading = true;
    loadError = null;
    try {
      const tpl = await getTemplate(teamId);
      builderState.setInitial(tpl.fields);
    } catch (err: unknown) {
      if (checkSessionExpired(err)) return;
      loadError = 'Vorlage konnte nicht geladen werden.';
    } finally {
      loading = false;
    }
  }

  async function save(): Promise<void> {
    if (selectedTeamId === null || !builderState.canSave) return;
    saving = true;
    try {
      const cleaned = builderState.getCleanFields();
      await upsertTemplate(selectedTeamId, cleaned);
      builderState.markSaved();
      showToast('success', 'Vorlage gespeichert.');
    } catch (err: unknown) {
      if (checkSessionExpired(err)) return;
      showToast('error', 'Speichern fehlgeschlagen.');
    } finally {
      saving = false;
    }
  }

  function reset(): void {
    builderState.setInitial(builderState.initial);
  }

  function requestDelete(): void {
    if (deleteConfirming) {
      void confirmDelete();
      return;
    }
    deleteConfirming = true;
    if (confirmTimer !== null) clearTimeout(confirmTimer);
    confirmTimer = setTimeout(() => {
      deleteConfirming = false;
    }, 5000);
  }

  async function confirmDelete(): Promise<void> {
    if (selectedTeamId === null) return;
    if (confirmTimer !== null) clearTimeout(confirmTimer);
    deleteConfirming = false;
    saving = true;
    try {
      await deleteTemplate(selectedTeamId);
      builderState.setInitial([]);
      showToast('success', 'Vorlage gelöscht.');
    } catch (err: unknown) {
      if (checkSessionExpired(err)) return;
      showToast('error', 'Löschen fehlgeschlagen.');
    } finally {
      saving = false;
    }
  }

  function selectedTeamName(): string {
    if (selectedTeamId === null) return '';
    const t = teams.find((x) => x.id === selectedTeamId);
    return t?.name ?? '';
  }
</script>

<svelte:head>
  <title>Übergabe-Vorlagen · Assixx</title>
</svelte:head>

{#if permissionDenied}
  <PermissionDenied addonName="die Übergabe-Vorlagen" />
{:else}
  <div class="container">
    <div class="card">
      <!--
        Canonical page-header pattern: container > card > card__header / card__body.
        Matches /inventory, /manage-*, and all other addon-gated management pages.
        Title + description + team-filter live in card__header; body carries the
        FieldBuilder, empty-state, loading/error surfaces, and the sticky action-bar.
      -->
      <div class="card__header">
        <!-- Session 19: title on the left, destructive delete action on the
             right — matches the "header-owns-destructive-action" pattern
             surfaced in smoke-test feedback. `flex-wrap` so the button drops
             below the title on narrow viewports (the label carries the team
             name and can be long). -->
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <h2 class="card__title">
              <i class="fas fa-clipboard-list mr-2"></i>
              Übergabe-Vorlagen
            </h2>
            <p class="mt-2 text-(--color-text-secondary)">
              Pro {labels.team.endsWith('s') ? labels.team.slice(0, -1) : labels.team} eine Vorlage —
              Felder erscheinen im Übergabe-Modal jeder Schicht.
            </p>
          </div>

          {#if teams.length > 0 && !loading && loadError === null}
            <button
              class="btn btn-danger shrink-0"
              type="button"
              disabled={saving || builderState.fields.length === 0}
              onclick={requestDelete}
            >
              <i class="fas fa-trash-alt mr-2"></i>
              {deleteConfirming ? 'Wirklich löschen?' : (
                `Vorlage für „${selectedTeamName()}" löschen`
              )}
            </button>
          {/if}
        </div>

        {#if teams.length > 0}
          <!--
            Design-system custom-dropdown (Storybook `Design System/Dropdowns`,
            CSS at design-system/primitives/dropdowns/custom-dropdown.css).
            Markup used directly — no wrapper component; click-outside state
            lives in the page's script block.
          -->
          <div class="team-filter mt-6">
            <div class="form-field">
              <span
                class="form-field__label"
                id="team-filter-label">{labels.team} wählen</span
              >
              <div
                class="dropdown"
                bind:this={teamDropdownRef}
              >
                <button
                  type="button"
                  class="dropdown__trigger"
                  class:active={teamDropdownOpen}
                  aria-labelledby="team-filter-label"
                  aria-expanded={teamDropdownOpen}
                  disabled={loading || saving}
                  onclick={() => (teamDropdownOpen = !teamDropdownOpen)}
                >
                  <span>
                    {selectedTeamName() === '' ? `${labels.team} wählen` : selectedTeamName()}
                  </span>
                  <i
                    class="fas fa-chevron-down"
                    aria-hidden="true"
                  ></i>
                </button>
                <div
                  class="dropdown__menu"
                  class:active={teamDropdownOpen}
                  role="listbox"
                  aria-labelledby="team-filter-label"
                >
                  {#each teams as team (team.id)}
                    <button
                      type="button"
                      class="dropdown__option"
                      class:selected={selectedTeamId === team.id}
                      role="option"
                      aria-selected={selectedTeamId === team.id}
                      onclick={() => {
                        selectedTeamId = team.id;
                        teamDropdownOpen = false;
                      }}
                    >
                      {team.name}
                    </button>
                  {/each}
                </div>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <div class="card__body">
        {#if teams.length === 0}
          <div class="empty-state">
            <div class="empty-state__icon">
              <i class="fas fa-users-slash"></i>
            </div>
            <h3 class="empty-state__title">Keine {labels.team}</h3>
            <p class="empty-state__description">
              Keine {labels.team} in deinem Bereich. Lege zuerst {labels.team} an, um Vorlagen zu konfigurieren.
            </p>
          </div>
        {:else if loading}
          <div class="flex items-center justify-center gap-3 py-12">
            <div class="spinner-ring spinner-ring--md"></div>
            <span class="text-(--color-text-secondary)">Lade Vorlage...</span>
          </div>
        {:else if loadError !== null}
          <div class="alert alert--danger">
            <i class="fas fa-exclamation-circle mr-2"></i>{loadError}
          </div>
        {:else}
          <FieldBuilder
            builder={builderState}
            disabled={saving}
          />
        {/if}
      </div>

      <!--
        Design-system card__footer (see Storybook `Design System/Cards`,
        `kvp-categories/+page.svelte` Referenz).  Nur im Happy-Path gerendert
        (Teams vorhanden, kein Loading/Error, FieldBuilder sichtbar).
      -->
      {#if teams.length > 0 && !loading && loadError === null}
        <div class="card__footer flex items-center justify-between gap-4">
          <div>
            {#if builderState.dirty}
              <span class="badge badge--warning">
                <i class="fas fa-circle mr-1"></i>Ungespeicherte Änderungen
              </span>
            {:else}
              <span class="text-sm text-(--color-text-tertiary)">
                <!-- Session 19: icon tinted `--color-success` — positive-state
                     affordance. Text kept tertiary so the indicator reads as
                     quiet status, not a loud success badge. -->
                <i class="fas fa-check-circle mr-1 text-(--color-success)"></i>Gespeichert
              </span>
            {/if}
          </div>

          <div class="flex flex-wrap gap-2">
            <!-- Session 19: btn-cancel per design-system Modal/Back
                 convention (Design System/Buttons README §"Cancel/Back").
                 btn-secondary is reserved for neutral auxiliary actions
                 like "Feld hinzufügen"; "Verwerfen" is a revert/cancel. -->
            <button
              class="btn btn-cancel"
              type="button"
              disabled={!builderState.dirty || saving}
              onclick={reset}
            >
              <i class="fas fa-undo mr-2"></i>Verwerfen
            </button>

            <!-- Session 19: destructive action (btn-danger "Vorlage löschen")
                 lifted out of the footer into the card header. Footer now
                 only carries the save-flow (Verwerfen + Speichern). -->

            <!-- Session 19: Speichern uses btn-success instead of btn-primary —
                 aligns with the positive-action-green convention applied to
                 "Übergabe abschließen" in the handover detail page. -->
            <button
              class="btn btn-success"
              type="button"
              disabled={!builderState.canSave || saving}
              onclick={save}
            >
              {#if saving}
                <div class="spinner-ring spinner-ring--sm mr-2"></div>
              {:else}
                <i class="fas fa-save mr-2"></i>
              {/if}
              Speichern
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>

  {#if toast !== null}
    <div
      class="toast toast--{toast.kind}"
      role="status"
      aria-live="polite"
    >
      <i class="fas {toast.kind === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} mr-2"
      ></i>
      {toast.text}
    </div>
  {/if}
{/if}

<style>
  /*
   * Local overrides minimal — design-system owns everything else:
   * .container, .card, .card__header/body/footer, .dropdown*, .btn*,
   * .badge*, .empty-state*, .form-field*, .alert*.
   *
   * The only page-specific residual is the width-constraint on the team
   * filter (design-system dropdown defaults to 100%; we want it narrow)
   * and the fixed-position toast. Every former `.action-bar*` rule was
   * replaced by `card__footer` + flex utilities in the template.
   */

  .team-filter {
    max-width: 20rem;
  }

  .toast {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    z-index: 1000;

    padding: 0.875rem 1.25rem;
    border-radius: 0.5rem;
    background: var(--color-bg-elevated);
    box-shadow: 0 4px 16px rgb(0 0 0 / 15%);

    color: var(--color-text-primary);
    font-size: 0.9375rem;
  }

  .toast--success {
    border-left: 4px solid var(--color-success);
  }

  .toast--error {
    border-left: 4px solid var(--color-danger);
  }
</style>
