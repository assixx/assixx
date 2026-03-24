<!--
  HierarchyLabelsModal — Anpassung der Hierarchie-Ebenen-Namen
  5 Zeilen (Halle, Bereich, Abteilung, Team, Anlage) mit je einem Label
-->
<script lang="ts">
  import { DEFAULT_HIERARCHY_LABELS, ENTITY_COLORS, HALL_COLOR } from './constants.js';

  import type { HierarchyLabels } from './types.js';

  interface Props {
    show: boolean;
    labels: HierarchyLabels;
    onclose: () => void;
    onsave: (labels: HierarchyLabels) => void;
    isSaving: boolean;
  }

  const { show, labels, onclose, onsave, isSaving }: Props = $props();

  let editLabels = $state(structuredClone(DEFAULT_HIERARCHY_LABELS));

  interface LabelLevel {
    key: keyof HierarchyLabels;
    prefixKey?: keyof HierarchyLabels;
    icon: string;
    color: string;
    defaultLabel: string;
  }

  const LEVELS: LabelLevel[] = [
    {
      key: 'hall',
      icon: HALL_COLOR.icon,
      color: HALL_COLOR.border,
      defaultLabel: 'Hallen',
    },
    {
      key: 'area',
      prefixKey: 'areaLeadPrefix',
      icon: ENTITY_COLORS.area.icon,
      color: ENTITY_COLORS.area.border,
      defaultLabel: 'Bereiche',
    },
    {
      key: 'department',
      prefixKey: 'departmentLeadPrefix',
      icon: ENTITY_COLORS.department.icon,
      color: ENTITY_COLORS.department.border,
      defaultLabel: 'Abteilungen',
    },
    {
      key: 'team',
      prefixKey: 'teamLeadPrefix',
      icon: ENTITY_COLORS.team.icon,
      color: ENTITY_COLORS.team.border,
      defaultLabel: 'Teams',
    },
    {
      key: 'asset',
      icon: ENTITY_COLORS.asset.icon,
      color: ENTITY_COLORS.asset.border,
      defaultLabel: 'Anlagen',
    },
  ];

  const isValid = $derived(validateLabels());

  $effect(() => {
    if (show) {
      editLabels = $state.snapshot(labels);
    }
  });

  function isLabelValid(value: string): boolean {
    return value.trim() !== '' && value.length <= 50;
  }

  function validateLabels(): boolean {
    return LEVELS.every((level: LabelLevel) => {
      if (!isLabelValid(editLabels[level.key])) return false;
      if (level.prefixKey !== undefined && !isLabelValid(editLabels[level.prefixKey])) return false;
      return true;
    });
  }

  function restoreDefaults(): void {
    editLabels = structuredClone(DEFAULT_HIERARCHY_LABELS);
  }

  function handleSubmit(event: SubmitEvent): void {
    event.preventDefault();
    if (!isValid) return;
    onsave(editLabels);
  }
</script>

{#if show}
  <div
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="hierarchy-modal-title"
    tabindex="-1"
  >
    <form
      id="hierarchy-labels-form"
      class="ds-modal ds-modal--sm"
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
          Benenne die Organisationsebenen passend für dein Unternehmen um. Die Struktur bleibt
          identisch — nur die Anzeige-Labels ändern sich.
        </p>

        <div class="hierarchy-stepper">
          {#each LEVELS as level, idx (level.key)}
            {@const color = level.color}
            <div class="step">
              <div class="step__indicator">
                <span
                  class="step__number"
                  style="background: {color}">{idx + 1}</span
                >
                {#if idx < LEVELS.length - 1}
                  <div class="step__connector"></div>
                {/if}
              </div>
              <div class="step__content">
                <span
                  class="step__label"
                  style="color: {color}"
                >
                  <i class={level.icon}></i>
                  {level.defaultLabel}
                  {#if idx === 0}
                    <span class="step__hint">Höchste Ebene</span>
                  {:else if idx === LEVELS.length - 1}
                    <span class="step__hint">Niedrigste Ebene</span>
                  {/if}
                </span>
                <input
                  type="text"
                  class="form-field__control"
                  placeholder={level.defaultLabel}
                  maxlength="50"
                  required
                  bind:value={editLabels[level.key]}
                />
                {#if level.prefixKey}
                  <div class="prefix-field">
                    <label class="prefix-field__label">
                      Positionsvorsilbe
                      <input
                        type="text"
                        class="form-field__control form-field__control--sm"
                        placeholder={DEFAULT_HIERARCHY_LABELS[level.prefixKey]}
                        maxlength="50"
                        required
                        bind:value={editLabels[level.prefixKey]}
                      />
                    </label>
                    <span class="prefix-field__preview">
                      {editLabels[level.prefixKey]}leiter · Stellv. {editLabels[
                        level.prefixKey
                      ]}leiter
                    </span>
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <div class="ds-modal__footer ds-modal__footer--spaced">
        <button
          type="button"
          class="btn btn-danger"
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

  .hierarchy-stepper {
    display: flex;
    flex-direction: column;
  }

  .step {
    display: flex;
    gap: 0.75rem;
  }

  .step__indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
  }

  .step__number {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-white, #fff);
    font-weight: 700;
    font-size: 0.75rem;
    flex-shrink: 0;
  }

  .step__connector {
    width: 2px;
    flex: 1;
    min-height: 8px;
    background: var(--glass-border, rgb(255 255 255 / 12%));
  }

  .step__content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding-bottom: 0.75rem;
  }

  .step__label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .step__hint {
    font-size: 0.7rem;
    font-weight: 400;
    opacity: 60%;
    margin-left: auto;
  }

  .footer-actions {
    display: flex;
    gap: 0.75rem;
  }

  .prefix-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-top: 0.25rem;
  }

  .prefix-field__label {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    font-weight: 500;
  }

  .prefix-field__preview {
    font-size: 0.7rem;
    color: var(--color-text-secondary);
    font-style: italic;
    padding-left: 0.25rem;
  }
</style>
