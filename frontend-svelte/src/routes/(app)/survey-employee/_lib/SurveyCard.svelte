<script lang="ts">
  import type { SurveyWithStatus } from './types';
  import {
    getTextFromBuffer,
    getStatusText,
    getStatusBadgeClass,
    toBool,
    formatSurveyDate,
    getAssignmentInfo,
  } from './utils';

  interface Props {
    survey: SurveyWithStatus;
    mode: 'pending' | 'completed';
    onclick: () => void;
  }

  const { survey, mode, onclick }: Props = $props();

  const isPending = $derived(mode === 'pending');

  function getDateRangeText(): string {
    const startDate = formatSurveyDate(survey.startDate);
    const endDate = formatSurveyDate(survey.endDate);
    return startDate !== '' && endDate !== '' ? `${startDate} - ${endDate}` : '';
  }

  const dateRange = $derived(getDateRangeText());
  const assignmentInfo = $derived(getAssignmentInfo());
</script>

<div
  class="card card--clickable"
  role="button"
  tabindex="0"
  {onclick}
  onkeydown={(e) => e.key === 'Enter' && onclick()}
>
  <div class="flex justify-between items-start mb-4">
    <h3 class="text-xl font-semibold text-primary m-0">
      {getTextFromBuffer(survey.title)}
    </h3>
    <span class="badge {getStatusBadgeClass(survey.status)} badge--uppercase">
      {getStatusText(survey.status)}
    </span>
  </div>

  <!-- Survey properties badges -->
  <div class="mb-4 flex items-center gap-2 flex-wrap">
    <span class="badge badge--sm {toBool(survey.isAnonymous) ? 'badge--info' : 'badge--secondary'}">
      <i class="fas {toBool(survey.isAnonymous) ? 'fa-user-secret' : 'fa-user'}"></i>
      {toBool(survey.isAnonymous) ? 'Anonym' : 'Nicht anonym'}
    </span>
    <span
      class="badge badge--sm {toBool(survey.isMandatory) ? 'badge--warning' : 'badge--success'}"
    >
      <i class="fas {toBool(survey.isMandatory) ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i>
      {toBool(survey.isMandatory) ? 'Verpflichtend' : 'Freiwillig'}
    </span>
  </div>

  <p class="mb-4 text-sm leading-relaxed text-secondary">
    {getTextFromBuffer(survey.description) !== ''
      ? getTextFromBuffer(survey.description)
      : 'Keine Beschreibung'}
  </p>

  {#if dateRange !== ''}
    <div class="mb-4 text-sm text-secondary flex items-center gap-2">
      <i class="fas fa-calendar-alt"></i>
      <span>{dateRange}</span>
    </div>
  {/if}

  {#if assignmentInfo !== ''}
    <div class="mb-4 text-sm text-secondary flex items-center gap-2">
      <i class="fas fa-users-cog"></i>
      <span>{assignmentInfo}</span>
    </div>
  {/if}

  <div class="survey-actions">
    {#if isPending}
      <button type="button" class="btn btn-upload">
        <i class="fas fa-arrow-right"></i>
        Teilnehmen
      </button>
    {:else}
      <button type="button" class="btn btn-upload" disabled>
        <i class="fas fa-check"></i>
        Abgeschlossen
      </button>
    {/if}
  </div>
</div>
