<script lang="ts">
  /**
   * Survey Employee - Page Component
   * @module survey-employee/+page
   *
   * Level 3 SSR: $derived for SSR data, invalidateAll() after mutations.
   */
  import { invalidateAll } from '$app/navigation';

  import { showErrorAlert, showSuccessAlert } from '$lib/utils';
  import { createLogger } from '$lib/utils/logger';

  const log = createLogger('SurveyEmployeePage');

  // Survey-specific styles (migrated from legacy)
  import '../../../styles/survey-employee.css';

  import { loadSurveyById, fetchUserResponse, submitResponse } from './_lib/api';
  import { surveyEmployeeState } from './_lib/state.svelte';
  import SurveyCard from './_lib/SurveyCard.svelte';
  import {
    getTextFromBuffer,
    isQuestionRequired,
    formatSurveyDate,
    formatDateTimeGerman,
    convertDateToISO,
    convertAnswersToArray,
    validateRequiredQuestions,
  } from './_lib/utils';

  import type { PageData } from './$types';
  import type { QuestionOption, SurveyWithStatus } from './_lib/types';

  // =============================================================================
  // SSR DATA - Level 3: $derived from props (single source of truth)
  // =============================================================================

  const { data }: { data: PageData } = $props();

  // SSR data via $derived - updates when invalidateAll() is called
  const allSurveys = $derived<SurveyWithStatus[]>(data.surveys);

  // One-time initialization flag (prevents re-running on every SSR change)
  let initialized = $state(false);

  // Sync SSR data to state store - ONE TIME ONLY (best practice per Svelte 5 docs)
  // Reason: $effect should NOT be used for state sync without guards
  $effect(() => {
    if (initialized) return; // Guard: only run once
    if (allSurveys.length > 0) {
      initialized = true;
      surveyEmployeeState.setSurveys(allSurveys);
      surveyEmployeeState.setLoading(false);
    }
  });

  // Derived: Filter surveys by response status
  const pendingSurveys = $derived(allSurveys.filter((s) => !s.hasResponded));
  const completedSurveys = $derived(allSurveys.filter((s) => s.hasResponded));

  // Derived: Response modal data (typed object when guard passes, null otherwise)
  const responseModalData = $derived.by(() => {
    if (
      !surveyEmployeeState.showResponseModal ||
      surveyEmployeeState.viewingSurvey === null ||
      surveyEmployeeState.viewingResponse === null
    ) {
      return null;
    }
    return {
      survey: surveyEmployeeState.viewingSurvey,
      response: surveyEmployeeState.viewingResponse,
    };
  });

  // ==========================================================================
  // SURVEY ACTIONS
  // ==========================================================================

  async function handleStartSurvey(surveyId: number) {
    surveyEmployeeState.setLoading(true);

    try {
      const survey = await loadSurveyById(surveyId);
      if (survey === null) {
        showErrorAlert('Umfrage konnte nicht geladen werden');
        return;
      }

      surveyEmployeeState.openSurveyModal(survey);
    } catch (error) {
      log.error({ err: error }, 'Error loading survey');
      showErrorAlert('Fehler beim Laden der Umfrage');
    } finally {
      surveyEmployeeState.setLoading(false);
    }
  }

  async function handleViewResponse(surveyId: number) {
    surveyEmployeeState.setLoading(true);

    try {
      const survey = await loadSurveyById(surveyId);
      const responseData = await fetchUserResponse(surveyId);

      if (survey === null) {
        showErrorAlert('Umfrage konnte nicht geladen werden');
        return;
      }

      if (responseData === null || !responseData.responded || responseData.response === undefined) {
        showErrorAlert('Keine Antworten für diese Umfrage gefunden.');
        return;
      }

      surveyEmployeeState.openResponseModal(survey, responseData.response);
    } catch (error) {
      log.error({ err: error }, 'Error viewing response');
      showErrorAlert('Fehler beim Abrufen Ihrer Antworten');
    } finally {
      surveyEmployeeState.setLoading(false);
    }
  }

  // ==========================================================================
  // ANSWER HANDLERS
  // ==========================================================================

  function handleTextChange(questionId: number, value: string) {
    surveyEmployeeState.setAnswer(questionId, {
      questionId,
      answerText: value,
    });
  }

  function handleNumberChange(questionId: number, value: string) {
    surveyEmployeeState.setAnswer(questionId, {
      questionId,
      answerNumber: Number(value),
    });
  }

  function handleDateChange(questionId: number, value: string) {
    surveyEmployeeState.setAnswer(questionId, {
      questionId,
      answerDate: convertDateToISO(value),
    });
  }

  function handleSingleChoiceChange(questionId: number, optionId: number) {
    surveyEmployeeState.setAnswer(questionId, {
      questionId,
      answerOptions: [optionId],
    });
  }

  function handleMultipleChoiceChange(questionId: number, optionId: number, checked: boolean) {
    const currentAnswer = surveyEmployeeState.answers[questionId];
    const currentOptions = currentAnswer?.selectedOptions ?? [];

    let newOptions: number[];
    if (checked) {
      newOptions = [...currentOptions, optionId];
    } else {
      newOptions = currentOptions.filter((id) => id !== optionId);
    }

    if (newOptions.length === 0) {
      surveyEmployeeState.removeAnswer(questionId);
    } else {
      surveyEmployeeState.setAnswer(questionId, {
        questionId,
        selectedOptions: newOptions,
      });
    }
  }

  function handleRatingClick(questionId: number, value: number) {
    surveyEmployeeState.setAnswer(questionId, {
      questionId,
      answerNumber: value,
    });
  }

  // ==========================================================================
  // FORM SUBMISSION
  // ==========================================================================

  async function handleSubmit(e: Event): Promise<void> {
    e.preventDefault();

    const survey = surveyEmployeeState.currentSurvey;
    if (survey === null) return;

    // Validate required questions
    const validation = validateRequiredQuestions(survey.questions, surveyEmployeeState.answers);
    if (!validation.valid) {
      showErrorAlert(`Bitte beantworten Sie alle Pflichtfragen: ${validation.missing.join(', ')}`);
      return;
    }

    surveyEmployeeState.setSubmitting(true);

    try {
      const answersArray = convertAnswersToArray(surveyEmployeeState.answers);
      const result = await submitResponse(survey.id, answersArray);

      if (result.success) {
        showSuccessAlert('Vielen Dank für Ihre Teilnahme!');
        surveyEmployeeState.closeSurveyModal();

        // Level 3: Trigger SSR refetch
        await invalidateAll();
      } else {
        showErrorAlert(result.error ?? 'Fehler beim Absenden der Antworten');
      }
    } catch (error) {
      log.error({ err: error }, 'Error submitting survey');
      showErrorAlert('Fehler beim Absenden der Antworten');
    } finally {
      surveyEmployeeState.setSubmitting(false);
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  function getOptionId(option: string | QuestionOption, index: number): number {
    return typeof option === 'string' ? index + 1 : option.id;
  }

  function getOptionText(option: string | QuestionOption): string {
    return typeof option === 'string' ? option : option.optionText;
  }

  function isRatingSelected(questionId: number, value: number): boolean {
    const answer = surveyEmployeeState.answers[questionId];
    return answer?.answerNumber === value;
  }

  function isMultipleOptionSelected(questionId: number, optionId: number): boolean {
    const answer = surveyEmployeeState.answers[questionId];
    return answer?.selectedOptions?.includes(optionId) ?? false;
  }
</script>

<svelte:head>
  <title>Mitarbeiterumfragen - Assixx</title>
</svelte:head>

<div class="container">
  <div class="card">
    <div class="card__header flex justify-between items-center">
      <div>
        <h2 class="card-title">Mitarbeiterumfragen</h2>
        <p class="text-secondary">
          Hier finden Sie alle Umfragen, an denen Sie teilnehmen können oder bereits teilgenommen
          haben.
        </p>
      </div>
    </div>
    <div class="card-body">
      <!-- Pending Surveys -->
      <div class="surveys-section">
        <h2 class="section-title">
          <i class="fas fa-clock"></i>
          Offene Umfragen
        </h2>
        {#if pendingSurveys.length === 0}
          <div class="empty-state">
            <div class="empty-state__icon">
              <i class="fas fa-clipboard-list"></i>
            </div>
            <h3 class="empty-state__title">Keine offenen Umfragen</h3>
            <p class="empty-state__description">
              Aktuell gibt es keine Umfragen, an denen Sie teilnehmen können.
            </p>
          </div>
        {:else}
          <div class="surveys-grid">
            {#each pendingSurveys as survey (survey.id)}
              <SurveyCard {survey} mode="pending" onclick={() => handleStartSurvey(survey.id)} />
            {/each}
          </div>
        {/if}
      </div>

      <!-- Section Divider -->
      <div class="section-divider"></div>

      <!-- Completed Surveys -->
      <div class="surveys-section">
        <h2 class="section-title">
          <i class="fas fa-check-circle"></i>
          Abgeschlossene Umfragen
        </h2>
        {#if completedSurveys.length === 0}
          <div class="empty-state">
            <div class="empty-state__icon">
              <i class="fas fa-check-circle"></i>
            </div>
            <h3 class="empty-state__title">Keine abgeschlossenen Umfragen</h3>
            <p class="empty-state__description">Sie haben noch an keinen Umfragen teilgenommen.</p>
          </div>
        {:else}
          <div class="surveys-grid">
            {#each completedSurveys as survey (survey.id)}
              <SurveyCard {survey} mode="completed" onclick={() => handleViewResponse(survey.id)} />
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<!-- Survey Response Modal -->
{#if surveyEmployeeState.showSurveyModal && surveyEmployeeState.currentSurvey !== null}
  {@const survey = surveyEmployeeState.currentSurvey}
  <div class="modal-overlay modal-overlay--active">
    <form class="ds-modal ds-modal--lg" onsubmit={handleSubmit}>
      <div class="ds-modal__header flex-col items-stretch">
        <!-- Title Row: Title + Close Button -->
        <div class="flex justify-between items-center w-full">
          <h3 class="ds-modal__title">{getTextFromBuffer(survey.title)}</h3>
          <button
            type="button"
            class="ds-modal__close"
            aria-label="Schließen"
            onclick={() => {
              surveyEmployeeState.closeSurveyModal();
            }}
          >
            <i class="fas fa-times"></i>
          </button>
        </div>

        <!-- Progress Bar Row -->
        <div class="mt-6 w-full">
          <div class="progress progress--lg">
            <div
              class="progress__bar progress__bar--info"
              role="progressbar"
              aria-valuenow={surveyEmployeeState.progressPercentage}
              aria-valuemin="0"
              aria-valuemax="100"
              style="width: {surveyEmployeeState.progressPercentage}%"
            ></div>
          </div>
          <div class="progress-text mt-2 text-center text-secondary text-sm">
            {surveyEmployeeState.answeredCount} von {surveyEmployeeState.totalQuestions} Fragen beantwortet
          </div>
        </div>
      </div>

      <div class="ds-modal__body">
        <!-- Questions Container -->
        <div id="questionsContainer">
          {#each survey.questions as question, qIndex (question.id)}
            {@const required = isQuestionRequired(question.isRequired)}
            <div class="question-item">
              <div class="question-header">
                <span class="question-number">{qIndex + 1}</span>
                <div class="question-text">
                  {getTextFromBuffer(question.questionText)}
                  {#if required}
                    <span class="required-indicator">*</span>
                  {/if}
                </div>
              </div>
              <div class="answer-container">
                <!-- Text Input -->
                {#if question.questionType === 'text'}
                  <div class="form-field">
                    <textarea
                      class="form-field__control form-field__control--textarea"
                      placeholder="Ihre Antwort..."
                      rows="4"
                      {required}
                      oninput={(e) => {
                        handleTextChange(question.id, (e.target as HTMLTextAreaElement).value);
                      }}
                    ></textarea>
                  </div>

                  <!-- Single Choice -->
                {:else if question.questionType === 'single_choice'}
                  <div class="choice-group">
                    {#each question.options ?? [] as option, optIndex (optIndex)}
                      {@const optionId = getOptionId(option, optIndex)}
                      {@const optionText = getOptionText(option)}
                      <label class="choice-card">
                        <input
                          type="radio"
                          class="choice-card__input"
                          name="question_{question.id}"
                          value={optionId}
                          {required}
                          onchange={() => {
                            handleSingleChoiceChange(question.id, optionId);
                          }}
                        />
                        <span class="choice-card__text">{optionText}</span>
                      </label>
                    {/each}
                  </div>

                  <!-- Multiple Choice -->
                {:else if question.questionType === 'multiple_choice'}
                  <div class="choice-group">
                    {#each question.options ?? [] as option, optIndex (optIndex)}
                      {@const optionId = getOptionId(option, optIndex)}
                      {@const optionText = getOptionText(option)}
                      <label class="choice-card">
                        <input
                          type="checkbox"
                          class="choice-card__input"
                          value={optionId}
                          checked={isMultipleOptionSelected(question.id, optionId)}
                          onchange={(e) => {
                            handleMultipleChoiceChange(
                              question.id,
                              optionId,
                              (e.target as HTMLInputElement).checked,
                            );
                          }}
                        />
                        <span class="choice-card__text">{optionText}</span>
                      </label>
                    {/each}
                  </div>

                  <!-- Rating -->
                {:else if question.questionType === 'rating'}
                  <div class="flex gap-3 flex-wrap">
                    {#each [1, 2, 3, 4, 5] as value (value)}
                      <button
                        type="button"
                        class="rating-button"
                        class:rating-button--selected={isRatingSelected(question.id, value)}
                        aria-label="Bewertung {value} von 5"
                        onclick={() => {
                          handleRatingClick(question.id, value);
                        }}
                      >
                        {value}
                      </button>
                    {/each}
                  </div>

                  <!-- Yes/No -->
                {:else if question.questionType === 'yes_no'}
                  <div class="choice-group">
                    <label class="choice-card">
                      <input
                        type="radio"
                        class="choice-card__input"
                        name="question_{question.id}"
                        value="1"
                        {required}
                        onchange={() => {
                          handleSingleChoiceChange(question.id, 1);
                        }}
                      />
                      <span class="choice-card__text">Ja</span>
                    </label>
                    <label class="choice-card">
                      <input
                        type="radio"
                        class="choice-card__input"
                        name="question_{question.id}"
                        value="2"
                        {required}
                        onchange={() => {
                          handleSingleChoiceChange(question.id, 2);
                        }}
                      />
                      <span class="choice-card__text">Nein</span>
                    </label>
                  </div>

                  <!-- Number -->
                {:else if question.questionType === 'number'}
                  <div class="form-field">
                    <input
                      type="number"
                      class="form-field__control"
                      placeholder="Zahl eingeben..."
                      {required}
                      oninput={(e) => {
                        handleNumberChange(question.id, (e.target as HTMLInputElement).value);
                      }}
                    />
                  </div>

                  <!-- Date -->
                {:else if question.questionType === 'date'}
                  <div class="form-field">
                    <input
                      type="date"
                      class="form-field__control"
                      placeholder="Datum wählen..."
                      {required}
                      oninput={(e) => {
                        handleDateChange(question.id, (e.target as HTMLInputElement).value);
                      }}
                    />
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <div class="ds-modal__footer ds-modal__footer--right">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={() => {
            surveyEmployeeState.closeSurveyModal();
          }}
        >
          Abbrechen
        </button>
        <button type="submit" class="btn btn-modal" disabled={surveyEmployeeState.isSubmitting}>
          {#if surveyEmployeeState.isSubmitting}
            <i class="fas fa-spinner fa-spin"></i>
          {:else}
            <i class="fas fa-paper-plane"></i>
          {/if}
          Antworten absenden
        </button>
      </div>
    </form>
  </div>
{/if}

<!-- Response Viewing Modal -->
{#if responseModalData}
  <div class="modal-overlay modal-overlay--active">
    <div class="ds-modal ds-modal--lg">
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">
          Ihre Antworten - {getTextFromBuffer(responseModalData.survey.title)}
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schließen"
          onclick={() => {
            surveyEmployeeState.closeResponseModal();
          }}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body">
        <div class="response-info">
          <p>
            <i class="fas fa-clock"></i>
            Abgeschlossen am: {formatDateTimeGerman(responseModalData.response.completedAt)}
          </p>
        </div>
        <div class="response-answers">
          {#each responseModalData.response.answers as answer (answer.questionId)}
            <div class="response-question">
              <h4>{answer.questionText}</h4>
              <div class="response-answer">
                {#if answer.answerText !== undefined}
                  <p>{answer.answerText}</p>
                {:else if answer.answerNumber !== undefined}
                  {#if answer.questionType === 'rating'}
                    <p>Bewertung: {answer.answerNumber}</p>
                  {:else}
                    <p>{answer.answerNumber}</p>
                  {/if}
                {:else if answer.answerDate !== undefined}
                  <p>
                    <i class="fas fa-calendar"></i>
                    {formatSurveyDate(answer.answerDate)}
                  </p>
                {:else if answer.answerOptions !== undefined}
                  {#each answer.answerOptions as optionText, idx (idx)}
                    <p><i class="fas fa-check-square"></i> {optionText}</p>
                  {/each}
                {:else}
                  <p><em>Keine Antwort</em></p>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
      <div class="ds-modal__footer ds-modal__footer--right">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={() => {
            surveyEmployeeState.closeResponseModal();
          }}
        >
          Schließen
        </button>
      </div>
    </div>
  </div>
{/if}
