<script lang="ts">
  import {
    getTextFromBuffer,
    getStatusText,
    getStatusBadgeClass,
    toBool,
    formatSurveyDate,
    getAssignmentBadges,
  } from './utils';

  import type { SurveyWithStatus } from './types';

  interface Props {
    survey: SurveyWithStatus;
    /** pending = can participate, responded = already answered, ended = survey closed without response */
    mode: 'pending' | 'responded' | 'ended';
    onclick: () => void;
  }

  const { survey, mode, onclick }: Props = $props();

  const startDate = $derived(formatSurveyDate(survey.startDate));
  const endDate = $derived(formatSurveyDate(survey.endDate));
  const assignmentBadges = $derived(getAssignmentBadges(survey.assignments));
</script>

<div
  class="card card--clickable"
  role="button"
  tabindex="0"
  {onclick}
  onkeydown={(e) => {
    if (e.key === 'Enter') onclick();
  }}
>
  <div class="mb-4 flex items-start justify-between">
    <h3 class="text-primary m-0 text-xl font-semibold">
      {getTextFromBuffer(survey.title)}
    </h3>
    <span class="badge {getStatusBadgeClass(survey.status)} badge--uppercase">
      {getStatusText(survey.status)}
    </span>
  </div>

  <!-- Survey properties badges -->
  <div class="mb-4 flex flex-wrap items-center gap-2">
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

  <p class="text-secondary mb-4 text-sm leading-relaxed">
    {getTextFromBuffer(survey.description) !== '' ?
      getTextFromBuffer(survey.description)
    : 'Keine Beschreibung'}
  </p>

  <div class="text-secondary mb-4 flex items-center gap-2 text-sm">
    <i class="fas fa-calendar-alt"></i>
    {#if startDate !== '' && endDate !== ''}
      <span>{startDate} - {endDate}</span>
    {:else if startDate !== ''}
      <span>Ab {startDate}, laufend</span>
    {:else}
      <span>Laufend</span>
    {/if}
  </div>

  {#if assignmentBadges.length > 0}
    <div class="mb-4 flex flex-wrap items-center gap-2">
      {#each assignmentBadges as badge (badge.text)}
        <span class="badge {badge.badgeClass}">
          <i class="fas {badge.icon}"></i>
          <span>{badge.text}</span>
        </span>
      {/each}
    </div>
  {/if}

  <div class="survey-actions">
    {#if mode === 'pending'}
      <button
        type="button"
        class="btn btn-primary"
      >
        <i class="fas fa-arrow-right"></i>
        Teilnehmen
      </button>
    {:else if mode === 'responded'}
      <button
        type="button"
        class="btn btn-secondary"
      >
        <i class="fas fa-eye"></i>
        Antworten ansehen
      </button>
    {:else}
      <button
        type="button"
        class="btn btn-secondary"
        disabled
      >
        <i class="fas fa-ban"></i>
        Nicht teilgenommen
      </button>
    {/if}
  </div>
</div>
