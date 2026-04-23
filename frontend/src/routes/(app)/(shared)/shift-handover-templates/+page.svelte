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

  import { checkSessionExpired } from '$lib/utils/session-expired';

  import { deleteTemplate, getTemplate, upsertTemplate } from './_lib/api-templates';
  import FieldBuilder from './_lib/FieldBuilder.svelte';
  import { createTemplateBuilderState } from './_lib/state-templates.svelte';

  import type { PageData } from './$types';

  // ── SSR data ────────────────────────────────────────────────────────────
  const { data }: { data: PageData } = $props();
  const labels = $derived(data.hierarchyLabels);
  const teams = $derived(data.teams);

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

<div class="page-container">
  <header class="page-header">
    <div>
      <h1 class="text-2xl font-semibold">Übergabe-Vorlagen</h1>
      <p class="text-sm text-(--color-text-secondary)">
        Pro {labels.team.endsWith('s') ? labels.team.slice(0, -1) : labels.team} eine Vorlage — Felder
        erscheinen im Übergabe-Modal jeder Schicht.
      </p>
    </div>
  </header>

  {#if teams.length === 0}
    <div class="alert alert--info mt-6">
      <i class="fas fa-info-circle mr-2"></i>
      Keine {labels.team} in deinem Bereich. Lege zuerst {labels.team} an, um Vorlagen zu konfigurieren.
    </div>
  {:else}
    <section class="filter-row">
      <label
        class="form-field"
        for="team-filter"
      >
        <span class="form-field__label">{labels.team} wählen</span>
        <select
          class="form-field__control"
          id="team-filter"
          value={selectedTeamId}
          onchange={(e) => (selectedTeamId = Number(e.currentTarget.value))}
          disabled={loading || saving}
        >
          {#each teams as team (team.id)}
            <option value={team.id}>{team.name}</option>
          {/each}
        </select>
      </label>
    </section>

    {#if loading}
      <div class="flex items-center justify-center gap-3 py-12">
        <div class="spinner-ring spinner-ring--md"></div>
        <span class="text-(--color-text-secondary)">Lade Vorlage...</span>
      </div>
    {:else if loadError !== null}
      <div class="alert alert--danger mt-6">
        <i class="fas fa-exclamation-circle mr-2"></i>{loadError}
      </div>
    {:else}
      <section class="builder-section">
        <FieldBuilder
          builder={builderState}
          disabled={saving}
        />
      </section>

      <footer class="action-bar">
        <div class="action-bar__status">
          {#if builderState.dirty}
            <span class="badge badge--warning">
              <i class="fas fa-circle mr-1"></i>Ungespeicherte Änderungen
            </span>
          {:else}
            <span class="text-sm text-(--color-text-tertiary)">
              <i class="fas fa-check-circle mr-1"></i>Gespeichert
            </span>
          {/if}
        </div>

        <div class="action-bar__buttons">
          <button
            class="btn btn-secondary"
            type="button"
            disabled={!builderState.dirty || saving}
            onclick={reset}
          >
            <i class="fas fa-undo mr-2"></i>Verwerfen
          </button>

          <button
            class="btn btn-danger"
            type="button"
            disabled={saving || builderState.fields.length === 0}
            onclick={requestDelete}
          >
            <i class="fas fa-trash-alt mr-2"></i>
            {deleteConfirming ? 'Wirklich löschen?' : `Vorlage für „${selectedTeamName()}" löschen`}
          </button>

          <button
            class="btn btn-primary"
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
      </footer>
    {/if}
  {/if}

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
</div>

<style>
  .page-container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 2rem 1.5rem 6rem;
  }

  .page-header {
    margin-bottom: 1.5rem;
  }

  .filter-row {
    margin-bottom: 1.5rem;
    max-width: 400px;
  }

  .builder-section {
    margin-top: 1rem;
  }

  .action-bar {
    position: sticky;
    bottom: 0;

    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;

    margin-top: 2rem;
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--color-border);
    border-radius: 0.5rem;
    background: var(--color-bg-elevated);
    backdrop-filter: blur(8px);
    box-shadow: 0 -2px 12px rgb(0 0 0 / 5%);
  }

  .action-bar__buttons {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
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
