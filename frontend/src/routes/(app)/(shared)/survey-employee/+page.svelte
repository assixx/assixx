<script lang="ts">
  /**
   * Survey Employee - Page Component
   * @module survey-employee/+page
   *
   * Level 3 SSR: $derived for SSR data, invalidateAll() after mutations.
   */
  import { invalidateAll } from '$app/navigation';

  import AppDatePicker from '$lib/components/AppDatePicker.svelte';
  import PermissionDenied from '$lib/components/PermissionDenied.svelte';
  import { notificationStore } from '$lib/stores/notification.store.svelte';
  import { showErrorAlert, showSuccessAlert } from '$lib/utils';
  import { createLogger } from '$lib/utils/logger';

  const log = createLogger('SurveyEmployeePage');

  import { loadSurveyById, fetchUserResponse, submitResponse } from './_lib/api';
  import ResponseModal from './_lib/ResponseModal.svelte';
  import { surveyEmployeeState } from './_lib/state.svelte';
  import SurveyCard from './_lib/SurveyCard.svelte';
  import {
    getTextFromBuffer,
    isQuestionRequired,
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

  const permissionDenied = $derived<boolean>(data.permissionDenied);

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

  // Derived: Filter surveys into sections
  // Open = active AND not yet responded (employee can still participate)
  const pendingSurveys = $derived(
    allSurveys.filter((s) => s.status === 'active' && !s.hasResponded),
  );
  // Completed = already responded OR survey ended by admin (status 'completed')
  const completedSurveys = $derived(
    allSurveys.filter((s) => s.hasResponded || s.status === 'completed'),
  );

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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
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

        // Optimistically decrement survey badge count
        notificationStore.decrementCount('surveys');

        // Level 3: Trigger SSR refetch
        await invalidateAll();
      } else {
        showErrorAlert(result.error ?? 'Fehler beim Absenden der Antworten');
      }
    } catch (error: unknown) {
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

{#if permissionDenied}
  <PermissionDenied addonName="die Umfragen" />
{:else}
  <div class="container">
    <div class="card">
      <div class="card__header flex items-center justify-between">
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
                <SurveyCard
                  {survey}
                  mode="pending"
                  onclick={() => handleStartSurvey(survey.id)}
                />
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
              <p class="empty-state__description">
                Sie haben noch an keinen Umfragen teilgenommen.
              </p>
            </div>
          {:else}
            <div class="surveys-grid">
              {#each completedSurveys as survey (survey.id)}
                <SurveyCard
                  {survey}
                  mode={survey.hasResponded ? 'responded' : 'ended'}
                  onclick={() => {
                    if (survey.hasResponded) {
                      void handleViewResponse(survey.id);
                    }
                  }}
                />
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
    <div
      id="survey-detail-modal"
      class="modal-overlay modal-overlay--active"
    >
      <form
        class="ds-modal ds-modal--lg"
        onsubmit={handleSubmit}
      >
        <div class="ds-modal__header flex-col items-stretch">
          <!-- Title Row: Title + Close Button -->
          <div class="flex w-full items-center justify-between">
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
            <div class="progress-text text-secondary mt-2 text-center text-sm">
              {surveyEmployeeState.answeredCount} von {surveyEmployeeState.totalQuestions}
              Fragen beantwortet
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
                    <div class="flex flex-wrap gap-3">
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
                      <AppDatePicker
                        {required}
                        onchange={(v: string) => {
                          handleDateChange(question.id, v);
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
          <button
            type="submit"
            class="btn btn-primary"
            disabled={surveyEmployeeState.isSubmitting}
          >
            {#if surveyEmployeeState.isSubmitting}
              <span class="spinner-ring spinner-ring--sm"></span>
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
    <ResponseModal
      survey={responseModalData.survey}
      response={responseModalData.response}
      onclose={() => {
        surveyEmployeeState.closeResponseModal();
      }}
    />
  {/if}
{/if}

<style>
  /* Survey Employee - Layout */
  .surveys-section {
    margin-bottom: var(--spacing-8);
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: var(--spacing-4);

    margin-bottom: var(--spacing-6);
    color: var(--text-primary);
    font-weight: 600;

    font-size: 1.5rem;
  }

  .surveys-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: var(--spacing-6);
  }

  .section-divider {
    position: relative;
    margin: var(--spacing-8) 0;
    background: linear-gradient(90deg, transparent, var(--accent-color), transparent);
    height: 1px;
  }

  /* Question Display */
  .question-item {
    margin-bottom: var(--spacing-6);
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-xl);

    background: var(--glass-bg-active);
    padding: var(--spacing-6);
  }

  .question-header {
    display: flex;
    align-items: start;
    gap: var(--spacing-4);
    margin-bottom: var(--spacing-4);
  }

  .question-number {
    display: flex;
    flex-shrink: 0;
    justify-content: center;
    align-items: center;
    border-radius: 50%;

    background: var(--primary-color);

    width: 30px;
    height: 30px;
    color: var(--color-white);

    font-weight: 600;
  }

  .question-text {
    flex: 1;
    color: var(--text-primary);
    font-size: 1.1rem;
  }

  .required-indicator {
    margin-left: 4px;
    color: var(--color-danger);
  }

  .answer-container {
    margin-top: var(--spacing-4);
  }

  /* Rating Button */
  .rating-button {
    display: flex;
    align-items: center;
    justify-content: center;

    width: 3rem;
    height: 3rem;
    border: 1px solid var(--color-glass-border);
    border-radius: 0.5rem;

    background: var(--glass-bg-active);

    color: oklch(87.58% 0.0034 264.53);
    font-size: 1rem;
    font-weight: 500;

    transition: all 0.2s ease;
  }

  .rating-button:hover {
    transform: scale(1.1);
    border-color: oklch(71.37% 0.1435 254.63 / 50%);

    background: oklch(62.31% 0.1881 259.82 / 10%);
    box-shadow: 0 0 20px color-mix(in oklch, var(--color-primary) 15%, transparent);

    color: oklch(68.86% 0.1408 254.62);
  }

  .rating-button:focus {
    outline: none;
    box-shadow: 0 0 0 2px oklch(62.31% 0.1881 259.82 / 50%);
  }

  .rating-button--selected {
    transform: scale(1.1);
    border-color: var(--color-info) !important;

    background: oklch(62.31% 0.1881 259.82 / 20%) !important;

    color: oklch(68.86% 0.1408 254.62) !important;
  }
</style>
