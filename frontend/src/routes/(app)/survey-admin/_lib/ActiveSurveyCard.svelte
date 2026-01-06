<script lang="ts">
  import type { Survey } from './types';
  import {
    getTextFromBuffer,
    getStatusText,
    getStatusBadgeClass,
    toBool,
    formatSurveyDate,
    calculateResponseRate,
  } from './utils';

  // =============================================================================
  // PROPS
  // =============================================================================

  interface Props {
    survey: Survey;
    surveyId: string;
    assignmentInfo: string;
    onedit: (surveyId: number | string) => void;
    onviewresults: (surveyId: string) => void;
    ondelete: (surveyId: number | string) => void;
  }

  const { survey, surveyId, assignmentInfo, onedit, onviewresults, ondelete }: Props = $props();

  // =============================================================================
  // DERIVED
  // =============================================================================

  const responseCount = $derived(survey.responseCount ?? 0);
  const completedCount = $derived(survey.completedCount ?? 0);
  const responseRate = $derived(calculateResponseRate(responseCount, completedCount));
  const startDate = $derived(formatSurveyDate(survey.startDate));
  const endDate = $derived(formatSurveyDate(survey.endDate));
  const title = $derived(getTextFromBuffer(survey.title));
  const description = $derived(getTextFromBuffer(survey.description));
  const isAnonymous = $derived(toBool(survey.isAnonymous));
  const isMandatory = $derived(toBool(survey.isMandatory));
</script>

<div
  class="card card--clickable"
  role="button"
  tabindex="0"
  onclick={() => onviewresults(surveyId)}
  onkeydown={(e) => e.key === 'Enter' && onviewresults(surveyId)}
>
  <div class="flex justify-between items-start mb-4">
    <h3 class="text-xl font-semibold text-primary m-0">{title}</h3>
    <span class="badge {getStatusBadgeClass(survey.status ?? 'active')} badge--uppercase">
      {getStatusText(survey.status ?? 'active')}
    </span>
  </div>

  <!-- Survey properties badges -->
  <div class="mb-4 flex items-center gap-2 flex-wrap">
    <span class="badge badge--sm {isAnonymous ? 'badge--info' : 'badge--secondary'}">
      <i class="fas {isAnonymous ? 'fa-user-secret' : 'fa-user'}"></i>
      {isAnonymous ? 'Anonym' : 'Nicht anonym'}
    </span>
    <span class="badge badge--sm {isMandatory ? 'badge--warning' : 'badge--success'}">
      <i class="fas {isMandatory ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i>
      {isMandatory ? 'Verpflichtend' : 'Freiwillig'}
    </span>
  </div>

  <p class="mb-4 text-sm leading-relaxed text-secondary">
    {description !== '' ? description : 'Keine Beschreibung'}
  </p>

  {#if startDate !== '' && endDate !== ''}
    <div class="mb-4 text-sm text-secondary flex items-center gap-2">
      <i class="fas fa-calendar-alt"></i>
      <span>{startDate} - {endDate}</span>
    </div>
  {/if}

  {#if assignmentInfo !== ''}
    <div class="mb-4 text-sm text-secondary flex items-center gap-2">
      <i class="fas fa-users-cog"></i>
      <span>{assignmentInfo}</span>
    </div>
  {/if}

  <div class="survey-stats">
    <div class="survey-stat">
      <i class="fas fa-users"></i>
      <span>{responseCount} Teilnehmer</span>
    </div>
    <div class="survey-stat">
      <i class="fas fa-chart-pie"></i>
      <span>{responseRate}% Abgeschlossen</span>
    </div>
  </div>

  <div class="survey-actions">
    {#if responseCount === 0}
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
    {/if}
    <button
      type="button"
      class="btn btn-secondary"
      onclick={(e) => {
        e.stopPropagation();
        onviewresults(surveyId);
      }}
    >
      <i class="fas fa-chart-bar"></i>
      Ergebnisse
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
