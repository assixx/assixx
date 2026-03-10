<!--
  HierarchyLabelsModal — Anpassung der Hierarchie-Ebenen-Namen
  4 Zeilen (Bereich, Abteilung, Team, Anlage) mit je einem Label
-->
<script lang="ts">
  import { DEFAULT_HIERARCHY_LABELS, ENTITY_COLORS } from './constants.js';

  import type { HierarchyLabels, OrgEntityType } from './types.js';

  interface Props {
    show: boolean;
    labels: HierarchyLabels;
    onclose: () => void;
    onsave: (labels: HierarchyLabels) => void;
    isSaving: boolean;
  }

  const { show, labels, onclose, onsave, isSaving }: Props = $props();

  let editLabels = $state<HierarchyLabels>(
    structuredClone(DEFAULT_HIERARCHY_LABELS),
  );

  const LEVELS: { key: OrgEntityType; icon: string; defaultLabel: string }[] = [
    { key: 'area', icon: ENTITY_COLORS.area.icon, defaultLabel: 'Bereiche' },
    {
      key: 'department',
      icon: ENTITY_COLORS.department.icon,
      defaultLabel: 'Abteilungen',
    },
    { key: 'team', icon: ENTITY_COLORS.team.icon, defaultLabel: 'Teams' },
    { key: 'asset', icon: ENTITY_COLORS.asset.icon, defaultLabel: 'Anlagen' },
  ];

  const isValid = $derived(validateLabels());

  $effect(() => {
    if (show) {
      editLabels = $state.snapshot(labels);
    }
  });

  function validateLabels(): boolean {
    for (const level of LEVELS) {
      const label = editLabels[level.key];
      if (label.trim() === '') return false;
      if (label.length > 50) return false;
    }
    return true;
  }

  function restoreDefaults(): void {
    editLabels = structuredClone(DEFAULT_HIERARCHY_LABELS);
  }

  function handleSubmit(event: SubmitEvent): void {
    event.preventDefault();
    if (!isValid) return;
    onsave(editLabels);
  }

  function handleOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) onclose();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') onclose();
  }
</script>

{#if show}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="hierarchy-modal-title"
    tabindex="-1"
    onclick={handleOverlayClick}
    onkeydown={handleKeydown}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <form
      id="hierarchy-labels-form"
      class="ds-modal ds-modal--sm"
      onclick={(e) => {
        e.stopPropagation();
      }}
      onsubmit={handleSubmit}
    >
      <div class="ds-modal__header">
        <h3
          class="ds-modal__title"
          id="hierarchy-modal-title"
        >
          <i class="fas fa-tags"></i>
          Hierarchie-Ebenen anpassen
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schließen"
          onclick={onclose}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="ds-modal__body">
        <p class="hint-text">
          Benenne die Organisationsebenen passend für dein Unternehmen um. Die
          Struktur bleibt identisch — nur die Anzeige-Labels ändern sich.
        </p>

        <div class="labels-list">
          {#each LEVELS as level (level.key)}
            {@const color = ENTITY_COLORS[level.key].border}
            <div class="level-row">
              <span
                class="level-label"
                style="color: {color}"
              >
                <i class={level.icon}></i>
                {level.defaultLabel}
              </span>
              <input
                type="text"
                class="form-field__control level-input"
                placeholder={level.defaultLabel}
                maxlength="50"
                required
                bind:value={editLabels[level.key]}
              />
            </div>
          {/each}
        </div>
      </div>

      <div class="ds-modal__footer ds-modal__footer--spaced">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={restoreDefaults}
          disabled={isSaving}
        >
          <i class="fas fa-undo"></i>
          Standard wiederherstellen
        </button>

        <div class="footer-actions">
          <button
            type="button"
            class="btn btn-cancel"
            onclick={onclose}
            disabled={isSaving}
          >
            Abbrechen
          </button>
          <button
            type="submit"
            class="btn btn-primary"
            disabled={!isValid || isSaving}
          >
            {#if isSaving}
              <span class="spinner-ring spinner-ring--sm"></span>
            {:else}
              <i class="fas fa-check"></i>
            {/if}
            Speichern
          </button>
        </div>
      </div>
    </form>
  </div>
{/if}

<style>
  .hint-text {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    line-height: 1.5;
    margin-bottom: 0.5rem;
  }

  .labels-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .level-row {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 0.75rem;
    align-items: center;
  }

  .level-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .level-input {
    padding: 0.5rem 0.75rem;
    font-size: 0.85rem;
  }

  .footer-actions {
    display: flex;
    gap: 0.75rem;
  }
</style>
