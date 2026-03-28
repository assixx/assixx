<script lang="ts">
  import {
    getTextFromBuffer,
    getStatusText,
    getStatusBadgeClass,
    toBool,
    formatSurveyDate,
    calculateResponseRate,
  } from './utils';

  import type { AssignmentBadgeInfo } from './handlers';
  import type { Survey } from './types';

  // =============================================================================
  // PROPS
  // =============================================================================

  interface Props {
    survey: Survey;
    surveyId: string;
    canManage: boolean;
    assignmentBadges: AssignmentBadgeInfo[];
    onviewresults: (surveyId: string) => void;
    ondelete: (surveyId: number | string) => void;
  }

  const { survey, surveyId, canManage, assignmentBadges, onviewresults, ondelete }: Props =
    $props();

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
  const status = $derived(survey.status ?? 'completed');
  const creatorName = $derived(
    [survey.creatorFirstName, survey.creatorLastName].filter(Boolean).join(' '),
  );
</script>

{#snippet cardContent()}
  <div class="mb-4 flex items-start justify-between">
    <h3 class="text-primary m-0 text-xl font-semibold">{title}</h3>
    <span class="badge {getStatusBadgeClass(status)} badge--uppercase">
      {getStatusText(status)}
    </span>
  </div>

  <div class="mb-4 flex flex-wrap items-center gap-2">
    <span class="badge badge--sm {isAnonymous ? 'badge--info' : 'badge--secondary'}">
      <i class="fas {isAnonymous ? 'fa-user-secret' : 'fa-user'}"></i>
      {isAnonymous ? 'Anonym' : 'Nicht anonym'}
    </span>
  </div>

  <p class="text-secondary mb-4 text-sm leading-relaxed">
    {description !== '' ? description : 'Keine Beschreibung'}
  </p>

  <div class="text-secondary mb-4 flex items-center gap-2 text-sm">
    <i class="fas fa-calendar-alt"></i>
    {#if startDate !== '' && endDate !== ''}
      <span>{startDate} - {endDate}</span>
    {:else if startDate !== ''}
      <span>Ab {startDate}</span>
    {:else}
      <span>Kein Zeitraum</span>
    {/if}
  </div>

  {#if creatorName !== ''}
    <div class="text-secondary mb-4 flex items-center gap-2 text-sm">
      <i class="fas fa-user-pen"></i>
      <span>Erstellt von {creatorName}</span>
    </div>
  {/if}

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

  {#if canManage}
    <div class="survey-actions">
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
  {/if}
{/snippet}

{#if canManage}
  <div
    class="card card--clickable"
    role="button"
    tabindex="0"
    onclick={() => {
      onviewresults(surveyId);
    }}
    onkeydown={(e) => {
      if (e.key === 'Enter') onviewresults(surveyId);
    }}
  >
    <!-- eslint-disable @typescript-eslint/no-confusing-void-expression, sonarjs/no-use-of-empty-return-value -- {@render} false positive -->
    {@render cardContent()}
    <!-- eslint-enable @typescript-eslint/no-confusing-void-expression, sonarjs/no-use-of-empty-return-value -->
  </div>
{:else}
  <div class="card">
    <!-- eslint-disable @typescript-eslint/no-confusing-void-expression, sonarjs/no-use-of-empty-return-value -- {@render} false positive -->
    {@render cardContent()}
    <!-- eslint-enable @typescript-eslint/no-confusing-void-expression, sonarjs/no-use-of-empty-return-value -->
  </div>
{/if}
