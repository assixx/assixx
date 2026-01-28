<script lang="ts">
  import { getTextFromBuffer } from './utils';

  import type { Survey } from './types';

  // =============================================================================
  // PROPS
  // =============================================================================

  interface Props {
    survey: Survey;
    surveyId: string;
    canManage: boolean;
    onedit: (surveyId: number | string) => void;
    ondelete: (surveyId: number | string) => void;
  }

  const { survey, surveyId, canManage, onedit, ondelete }: Props = $props();

  // =============================================================================
  // DERIVED
  // =============================================================================

  const title = $derived(getTextFromBuffer(survey.title));
  const description = $derived(getTextFromBuffer(survey.description));
  const creatorName = $derived(
    [survey.creatorFirstName, survey.creatorLastName].filter(Boolean).join(' '),
  );
</script>

{#if canManage}
  <div
    class="card card--clickable"
    role="button"
    tabindex="0"
    onclick={() => {
      onedit(survey.id ?? surveyId);
    }}
    onkeydown={(e) => {
      if (e.key === 'Enter') onedit(survey.id ?? surveyId);
    }}
  >
    <div class="flex justify-between items-start mb-4">
      <h3 class="text-xl font-semibold text-primary m-0">{title}</h3>
      <span class="badge badge--warning badge--uppercase">Entwurf</span>
    </div>

    {#if creatorName !== ''}
      <p class="text-xs text-secondary mt-0 mb-3">
        <i class="fas fa-user-pen"></i> Erstellt von {creatorName}
      </p>
    {/if}

    <p class="mb-4 text-sm leading-relaxed text-secondary">
      {description !== '' ? description : 'Keine Beschreibung'}
    </p>

    <div class="survey-actions">
      <button
        type="button"
        class="btn btn-secondary"
        onclick={(e) => {
          e.stopPropagation();
          onedit(survey.id ?? surveyId);
        }}
      >
        <i class="fas fa-edit"></i>
        Bearbeiten
      </button>
      <button
        type="button"
        class="btn btn-secondary"
        onclick={(e) => {
          e.stopPropagation();
          ondelete(survey.id ?? surveyId);
        }}
      >
        <i class="fas fa-trash"></i>
        Löschen
      </button>
    </div>
  </div>
{:else}
  <div class="card">
    <div class="flex justify-between items-start mb-4">
      <h3 class="text-xl font-semibold text-primary m-0">{title}</h3>
      <span class="badge badge--warning badge--uppercase">Entwurf</span>
    </div>

    {#if creatorName !== ''}
      <p class="text-xs text-secondary mt-0 mb-3">
        <i class="fas fa-user-pen"></i> Erstellt von {creatorName}
      </p>
    {/if}

    <p class="mb-4 text-sm leading-relaxed text-secondary">
      {description !== '' ? description : 'Keine Beschreibung'}
    </p>
  </div>
{/if}
