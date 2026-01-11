<script lang="ts">
  /**
   * Survey Results - Page Component
   * @module survey-results/+page
   *
   * Level 3 SSR: All data via $derived from SSR props, no onMount data copying.
   */
  import { SvelteSet } from 'svelte/reactivity';

  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  import '../../../styles/survey-results.css';
  import { showAlert, showErrorAlert, showSuccessAlert } from '$lib/utils';

  import { exportToExcel } from './_lib/api';
  import {
    formatGermanDate,
    isAnonymousSurvey,
    renderStars,
    getQuestionTypeLabel,
    getStatusText,
    getRespondentName,
    getCompletedDate,
    getAnswerDisplayText,
    calculateTotalResponses,
    calculateOptionPercentage,
  } from './_lib/utils';

  import type { PageData } from './$types';
  import type { SurveyQuestion, ResponseAnswer, Survey } from './_lib/types';

  /** Resolve path with base prefix (for dynamic runtime paths) */
  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

  // ==========================================================================
  // SSR DATA - Level 3: $derived from props (single source of truth)
  // ==========================================================================

  const { data }: { data: PageData } = $props();

  // SSR data as derived - updates automatically when data changes
  // Server guarantees: surveyId (string), survey (Survey), questions ([]), responses ([])
  // Only statistics can be null
  const surveyId = $derived(data.surveyId);
  const survey = $derived.by<Survey>(() => ({
    ...data.survey,
    questions: data.questions.length > 0 ? data.questions : (data.survey.questions ?? []),
  }));
  const statistics = $derived(data.statistics);
  const responses = $derived(data.responses);

  // Derived computed values - survey is always defined, only check statistics
  const hasData = $derived(statistics !== null);
  const totalResponses = $derived(statistics?.totalResponses ?? 0);
  const completedResponses = $derived(statistics?.completedResponses ?? 0);
  const completionRate = $derived(statistics?.completionRate ?? 0);
  const hasResponses = $derived(responses.length > 0);
  const responsesData = $derived(hasResponses ? { responses } : null);

  // ==========================================================================
  // UI STATE - Only for client-side interactions
  // ==========================================================================

  let isExporting = $state(false);
  const expandedResponses = new SvelteSet<number>();

  function isResponseExpanded(index: number): boolean {
    return expandedResponses.has(index);
  }

  // ==========================================================================
  // EVENT HANDLERS
  // ==========================================================================

  async function handleExportExcel(): Promise<void> {
    isExporting = true;

    try {
      const success = await exportToExcel(surveyId);
      if (success) {
        showSuccessAlert('Export erfolgreich!');
      } else {
        showErrorAlert('Fehler beim Exportieren');
      }
    } catch (error) {
      console.error('[Survey Results] Export error:', error);
      const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
      showErrorAlert(`Fehler beim Exportieren: ${message}`);
    } finally {
      isExporting = false;
    }
  }

  function handleExportPDF(): void {
    // TODO: Implement PDF export
    showAlert('PDF-Export wird implementiert...');
  }

  function handlePrint(): void {
    window.print();
  }

  function handleNavigateBack(): void {
    void goto(resolvePath('/survey-admin'));
  }

  function handleAccordionToggle(index: number): void {
    if (expandedResponses.has(index)) {
      expandedResponses.delete(index);
    } else {
      expandedResponses.add(index);
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  function getTextResponseCount(question: SurveyQuestion): number {
    return question.responses?.filter((r) => r.answerText.trim() !== '').length ?? 0;
  }

  function getStatisticsAverage(question: SurveyQuestion): number {
    return question.statistics?.average ?? 0;
  }

  function getStatisticsCount(question: SurveyQuestion): number {
    return question.statistics?.count ?? 0;
  }

  function getStatisticsMin(question: SurveyQuestion): number {
    return question.statistics?.min ?? 0;
  }

  function getStatisticsMax(question: SurveyQuestion): number {
    return question.statistics?.max ?? 0;
  }
</script>

<svelte:head>
  <title>Umfrage-Ergebnisse - Assixx</title>
</svelte:head>

<div class="container">
  <!-- Back Button -->
  <div class="mb-4">
    <button type="button" class="btn btn-light" onclick={handleNavigateBack}>
      <i class="fas fa-arrow-left mr-2"></i>Zurück zur Übersicht
    </button>
  </div>

  <div class="card">
    <div class="card__header flex justify-between items-center">
      <div>
        <h2 class="card-title">Umfrage-Ergebnisse</h2>
        <p class="text-secondary">Auswertung und Statistiken der Umfrage</p>
      </div>
    </div>

    <div class="card-body" id="content-area">
      <!-- Results View - SSR: Data instantly available, no loading state needed -->
      {#if hasData}
        <!-- Survey Header -->
        <div class="card results-header">
          <h2 class="survey-title">{survey.title}</h2>
          <div class="survey-meta">
            <span
              ><i class="fas fa-calendar"></i> Erstellt: {formatGermanDate(survey.createdAt)}</span
            >
            <span
              ><i class="fas fa-calendar-check"></i> Endet: {formatGermanDate(survey.endDate)}</span
            >
            <span>
              <i class="fas fa-user-shield"></i>
              {isAnonymousSurvey(survey) ? 'Anonym' : 'Nicht anonym'}
            </span>
          </div>
        </div>

        <!-- Export Actions -->
        <div class="export-actions">
          <button
            type="button"
            class="btn btn-upload"
            id="export-excel"
            onclick={handleExportExcel}
            disabled={isExporting}
          >
            {#if isExporting}
              <i class="fas fa-spinner fa-spin"></i>
            {:else}
              <i class="fas fa-file-excel"></i>
            {/if}
            Excel Export
          </button>
          <button type="button" class="btn btn-upload" id="export-pdf" onclick={handleExportPDF}>
            <i class="fas fa-file-pdf"></i> PDF Export
          </button>
          <button type="button" class="btn btn-upload" onclick={handlePrint}>
            <i class="fas fa-print"></i> Drucken
          </button>
        </div>

        <!-- Statistics Grid -->
        <div class="stats-grid">
          <div class="card-stat">
            <h3 class="text-3xl font-bold text-blue-500 mb-1">
              {totalResponses}
            </h3>
            <p class="text-sm text-gray-400">Antworten</p>
          </div>
          <div class="card-stat">
            <h3 class="text-3xl font-bold text-blue-500 mb-1">
              {completedResponses}
            </h3>
            <p class="text-sm text-gray-400">Abgeschlossen</p>
          </div>
          <div class="card-stat">
            <h3 class="text-3xl font-bold text-blue-500 mb-1">
              {completionRate}%
            </h3>
            <p class="text-sm text-gray-400">Abschlussrate</p>
          </div>
          <div class="card-stat">
            <h3 class="text-3xl font-bold text-blue-500 mb-1">
              {survey.status === 'active' ? 'Aktiv' : getStatusText(survey.status)}
            </h3>
            <p class="text-sm text-gray-400">Status</p>
          </div>
        </div>

        <!-- Question Results -->
        <div id="questions-results">
          {#if statistics?.questions === undefined || statistics.questions.length === 0}
            <div class="empty-state">
              <div class="empty-icon">&#128202;</div>
              <p>Noch keine Antworten vorhanden</p>
            </div>
          {:else}
            {#each statistics.questions as question (question.id)}
              <div class="card">
                <div class="question-header">
                  <h3 class="question-text">{question.questionText}</h3>
                  <p class="question-type">Typ: {getQuestionTypeLabel(question.questionType)}</p>
                </div>
                <div class="question-body">
                  <!-- Choice Questions (single_choice, multiple_choice, yes_no) -->
                  {#if question.questionType === 'single_choice' || question.questionType === 'multiple_choice' || question.questionType === 'yes_no' || question.questionType === 'date'}
                    {#if question.options === undefined || question.options.length === 0}
                      <p>Keine Optionen verfuegbar</p>
                    {:else}
                      {@const totalResponses = calculateTotalResponses(question)}
                      {#each question.options as option (option.optionId ?? option.optionText)}
                        {@const count = option.count ?? 0}
                        {@const percentage = calculateOptionPercentage(count, totalResponses)}
                        <div class="option-result">
                          <div class="option-header">
                            <span class="option-text">{option.optionText}</span>
                            <span class="option-count">{count} Stimmen</span>
                          </div>
                          <div class="progress progress--lg">
                            <div
                              class="progress__bar {percentage === 0 ? 'progress__bar--empty' : ''}"
                              style="width: {percentage}%"
                            >
                              {percentage}%
                            </div>
                          </div>
                        </div>
                      {/each}
                    {/if}

                    <!-- Rating Questions -->
                  {:else if question.questionType === 'rating'}
                    {@const average = getStatisticsAverage(question)}
                    {@const count = getStatisticsCount(question)}
                    {@const min = getStatisticsMin(question)}
                    {@const max = getStatisticsMax(question)}
                    <div class="u-text-center">
                      <h4 class="rating-average">{average.toFixed(1)}</h4>
                      <p class="rating-meta">von 5 Sternen ({count} Bewertungen)</p>
                      <div class="rating-stars">{renderStars(average, 5)}</div>
                      <div class="rating-range">Min: {min} | Max: {max}</div>
                    </div>

                    <!-- Text Questions -->
                  {:else if question.questionType === 'text'}
                    {@const responseCount = getTextResponseCount(question)}
                    <div class="text-info">
                      <p class="text-info-message">
                        <i class="fas fa-info-circle"></i>
                        {#if responseCount > 0}
                          {responseCount} Textantwort{responseCount > 1 ? 'en' : ''} - siehe unten bei
                          "Individuelle Antworten"
                        {:else}
                          Keine Textantworten vorhanden
                        {/if}
                      </p>
                    </div>

                    <!-- Number Questions -->
                  {:else if question.questionType === 'number'}
                    {@const average = getStatisticsAverage(question)}
                    {@const count = getStatisticsCount(question)}
                    {@const min = getStatisticsMin(question)}
                    {@const max = getStatisticsMax(question)}
                    <div class="u-text-center">
                      <h4 class="number-average">{average.toFixed(2)}</h4>
                      <p class="number-meta">Durchschnittswert ({count} Antworten)</p>
                      <div class="number-range">
                        <strong>Min:</strong>
                        {min} | <strong>Max:</strong>
                        {max}
                      </div>
                    </div>

                    <!-- Unknown Question Type -->
                  {:else}
                    <p>Unbekannter Fragetyp</p>
                  {/if}
                </div>
              </div>
            {/each}
          {/if}
        </div>

        <!-- Individual Responses -->
        <div id="individual-responses">
          {#if hasResponses && responsesData !== null}
            <div class="card responses-section">
              <h3>
                <i class="fas fa-users"></i> Individuelle Antworten ({responsesData.responses
                  .length})
              </h3>
              <div class="accordion accordion--compact">
                {#each responsesData.responses as response, index (response.id)}
                  {@const respondentName = getRespondentName(response, index)}
                  {@const completedDate = getCompletedDate(response)}
                  {@const isExpanded = isResponseExpanded(index)}
                  <div class="accordion__item" class:accordion__item--active={isExpanded}>
                    <button
                      type="button"
                      class="accordion__header"
                      onclick={() => {
                        handleAccordionToggle(index);
                      }}
                    >
                      <span class="accordion__title">
                        {respondentName} &#8226; <i class="fas fa-clock"></i>
                        {completedDate}
                        {#if response.status === 'completed'}
                          <span class="badge badge--success">Abgeschlossen</span>
                        {:else}
                          <span class="badge badge--warning">In Bearbeitung</span>
                        {/if}
                      </span>
                      <i class="fas fa-chevron-down accordion__icon"></i>
                    </button>
                    <div class="accordion__content">
                      <div class="accordion__body">
                        {#if statistics?.questions !== undefined}
                          {#each statistics.questions as question (question.id)}
                            {@const answer = response.answers?.find(
                              (a: ResponseAnswer) => a.questionId === question.id,
                            )}
                            {@const answerText = getAnswerDisplayText(question, answer)}
                            <div class="answer-item">
                              <strong>{question.questionText}:</strong>
                              <span>{answerText}</span>
                            </div>
                          {/each}
                        {/if}
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {:else}
        <!-- No data available -->
        <div class="empty-state">
          <div class="empty-icon">&#128202;</div>
          <p>Keine Umfrage-Daten verfügbar</p>
          <button type="button" class="btn btn-cancel" onclick={handleNavigateBack}>
            Zurück zur Übersicht
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>
