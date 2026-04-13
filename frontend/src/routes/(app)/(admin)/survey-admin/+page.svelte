<script lang="ts">
  /**
   * Survey Admin - Page Component
   * @module survey-admin/+page
   *
   * Level 3 SSR: All data via $derived from SSR props, invalidateAll() after mutations.
   */
  import { invalidateAll } from '$app/navigation';

  import PermissionDenied from '$lib/components/PermissionDenied.svelte';
  import { showErrorAlert } from '$lib/utils';

  // Extracted Components
  import ActiveSurveyCard from './_lib/ActiveSurveyCard.svelte';
  import CompletedSurveyCard from './_lib/CompletedSurveyCard.svelte';
  import { createAssignmentBadgeMap, createSurveyMessages } from './_lib/constants';
  import DraftSurveyCard from './_lib/DraftSurveyCard.svelte';
  import {
    getSurveyId,
    getAssignmentBadges,
    getOptionsFromQuestion,
    handleCompleteSurveyWithInvalidate,
    handleDeleteSurveyWithInvalidate,
    handleViewResults,
    loadSurveyForEdit,
    saveSurveyWithInvalidate,
    type FormState,
  } from './_lib/handlers';
  import { surveyAdminState } from './_lib/state.svelte';
  import SurveyFormModal from './_lib/SurveyFormModal.svelte';
  import {
    questionTypeNeedsOptions,
    getTextFromBuffer,
    toBool,
    filterOrgDataByPermissions,
  } from './_lib/utils';

  import type { PageData } from './$types';
  import type { QuestionType } from './_lib/types';

  // =============================================================================
  // SSR DATA - Level 3: $derived from props (single source of truth)
  // =============================================================================

  const { data }: { data: PageData } = $props();
  const permissionDenied = $derived(data.permissionDenied);

  // Hierarchy labels from layout data inheritance (A6)
  const labels = $derived(data.hierarchyLabels);
  const surveyMessages = $derived(createSurveyMessages(labels));
  const badgeMap = $derived(createAssignmentBadgeMap(labels));

  // SSR data as derived - updates automatically when invalidateAll() is called
  const surveys = $derived(data.surveys);
  const templates = $derived(data.templates);
  const departments = $derived(data.departments);
  const teams = $derived(data.teams);
  const areas = $derived(data.areas);

  // Permission-filtered org data for the assignment form
  const filteredOrgData = $derived(
    filterOrgDataByPermissions(data.currentUser, areas, departments, teams),
  );

  // Derived computed values
  const activeSurveys = $derived(surveys.filter((s) => s.status === 'active'));
  const completedSurveys = $derived(
    surveys.filter((s) => s.status === 'completed' || s.status === 'archived'),
  );
  const draftSurveys = $derived(surveys.filter((s) => s.status === 'draft'));

  // =============================================================================
  // UI STATE - Form and Modal state (client-side only)
  // =============================================================================

  let formTitle = $state('');
  let formDescription = $state('');
  let formIsAnonymous = $state(false);
  let formIsMandatory = $state(false);
  let formStartDate = $state('');
  let formStartTime = $state('00:00');
  let formEndDate = $state('');
  let formEndTime = $state('23:59');
  let formCompanyWide = $state(false);
  let formSelectedAreas = $state<number[]>([]);
  let formSelectedDepartments = $state<number[]>([]);
  let formSelectedTeams = $state<number[]>([]);
  let formQuestions = $state<
    {
      id: string;
      text: string;
      type: QuestionType;
      isOptional: boolean;
      options: string[];
    }[]
  >([]);

  // =============================================================================
  // FORM STATE HELPERS
  // =============================================================================

  function getFormState(): FormState {
    return {
      formTitle,
      formDescription,
      formIsAnonymous,
      formIsMandatory,
      formStartDate,
      formStartTime,
      formEndDate,
      formEndTime,
      formCompanyWide,
      formSelectedAreas,
      formSelectedDepartments,
      formSelectedTeams,
      formQuestions,
    };
  }

  function applyFormState(state: FormState): void {
    formTitle = state.formTitle;
    formDescription = state.formDescription;
    formIsAnonymous = state.formIsAnonymous;
    formIsMandatory = state.formIsMandatory;
    formStartDate = state.formStartDate;
    formStartTime = state.formStartTime;
    formEndDate = state.formEndDate;
    formEndTime = state.formEndTime;
    formCompanyWide = state.formCompanyWide;
    formSelectedAreas = state.formSelectedAreas;
    formSelectedDepartments = state.formSelectedDepartments;
    formSelectedTeams = state.formSelectedTeams;
    formQuestions = state.formQuestions;
  }

  function resetForm(): void {
    formTitle = '';
    formDescription = '';
    formIsAnonymous = false;
    formIsMandatory = false;
    formStartDate = '';
    formStartTime = '00:00';
    formEndDate = '';
    formEndTime = '23:59';
    formCompanyWide = false;
    formSelectedAreas = [];
    formSelectedDepartments = [];
    formSelectedTeams = [];
    formQuestions = [];
    surveyAdminState.resetQuestionCounter();
  }

  // =============================================================================
  // MODAL HANDLERS
  // =============================================================================

  function handleOpenCreateModal(): void {
    resetForm();
    surveyAdminState.openModal(null);
    addQuestion();
  }

  async function handleEditSurvey(surveyId: number | string): Promise<void> {
    const formState = await loadSurveyForEdit(surveyId);
    if (formState !== null) {
      // Reset company-wide if user lacks permission (UX guard, backend enforces too)
      if (!filteredOrgData.canAssignCompanyWide && formState.formCompanyWide) {
        formState.formCompanyWide = false;
      }
      applyFormState(formState);
    }
  }

  function handleCloseModal(): void {
    surveyAdminState.closeModal();
    resetForm();
  }

  // =============================================================================
  // QUESTION HANDLERS
  // =============================================================================

  function addQuestion(): void {
    const questionId = `question_${surveyAdminState.incrementQuestionCounter()}`;
    formQuestions = [
      ...formQuestions,
      {
        id: questionId,
        text: '',
        type: 'text' as QuestionType,
        isOptional: false,
        options: [],
      },
    ];
  }

  function removeQuestion(questionId: string): void {
    formQuestions = formQuestions.filter((q) => q.id !== questionId);
  }

  function handleQuestionTypeChange(questionId: string, type: QuestionType): void {
    formQuestions = formQuestions.map((q) => {
      if (q.id === questionId) {
        const needsOptions = questionTypeNeedsOptions(type);
        return {
          ...q,
          type,
          options:
            needsOptions && q.options.length === 0 ? ['', '']
            : needsOptions ? q.options
            : [],
        };
      }
      return q;
    });
  }

  function addOption(questionId: string): void {
    formQuestions = formQuestions.map((q) => {
      if (q.id === questionId) return { ...q, options: [...q.options, ''] };
      return q;
    });
  }

  function removeOption(questionId: string, optionIndex: number): void {
    formQuestions = formQuestions.map((q) => {
      if (q.id === questionId)
        return { ...q, options: q.options.filter((_, i) => i !== optionIndex) };
      return q;
    });
  }

  function updateOptionText(questionId: string, optionIndex: number, text: string): void {
    formQuestions = formQuestions.map((q) => {
      if (q.id === questionId) {
        const newOptions = [...q.options];
        newOptions[optionIndex] = text;
        return { ...q, options: newOptions };
      }
      return q;
    });
  }

  // =============================================================================
  // ASSIGNMENT & SAVE HANDLERS
  // =============================================================================

  async function handleSaveSurvey(status: 'draft' | 'active'): Promise<void> {
    await saveSurveyWithInvalidate(status, getFormState(), handleCloseModal, invalidateAll);
  }

  // =============================================================================
  // TEMPLATE HANDLER
  // =============================================================================

  function handleCreateFromTemplate(templateId: number): void {
    const template = templates.find((t) => t.id === templateId);
    if (template === undefined) {
      showErrorAlert('Vorlage konnte nicht gefunden werden');
      return;
    }

    resetForm();
    formTitle = template.name;
    formDescription = template.description;

    if (template.questions.length > 0) {
      formQuestions = template.questions.map((q) => {
        const qId = `question_${surveyAdminState.incrementQuestionCounter()}`;
        return {
          id: qId,
          text: getTextFromBuffer(q.questionText),
          type: q.questionType,
          isOptional: !toBool(q.isRequired),
          options: getOptionsFromQuestion(q),
        };
      });
    }

    surveyAdminState.openModal(null);
  }
</script>

<svelte:head>
  <title>Umfrage-Verwaltung - Assixx</title>
</svelte:head>

{#if permissionDenied}
  <PermissionDenied addonName="die Umfragen" />
{:else}
  <div class="container">
    <div class="card">
      <div class="card__header flex items-center justify-between">
        <div>
          <h4 class="card-title">Umfrage-Verwaltung</h4>
          <p class="text-secondary">Erstellen und verwalten Sie Mitarbeiterumfragen</p>
        </div>
      </div>

      <div class="card-body">
        <h4>Aktive Umfragen</h4>
        {#if activeSurveys.length === 0}
          <div class="empty-state">
            <div class="empty-state__icon">
              <i class="fas fa-clipboard-list"></i>
            </div>
            <h3 class="empty-state__title">Keine aktiven Umfragen</h3>
            <p class="empty-state__description">
              Es gibt derzeit keine aktiven Umfragen. Erstellen Sie eine neue oder aktivieren Sie
              einen Entwurf.
            </p>
          </div>
        {:else}
          <div class="mb-8 grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6">
            {#each activeSurveys as survey (getSurveyId(survey))}
              <ActiveSurveyCard
                {survey}
                surveyId={getSurveyId(survey)}
                canManage={survey.canManage ?? false}
                assignmentBadges={getAssignmentBadges(survey, departments, teams, areas, badgeMap)}
                onedit={handleEditSurvey}
                onviewresults={handleViewResults}
                ondelete={(id: number | string) =>
                  handleDeleteSurveyWithInvalidate(id, invalidateAll)}
                oncomplete={(id: number | string) =>
                  handleCompleteSurveyWithInvalidate(id, invalidateAll)}
              />
            {/each}
          </div>
        {/if}

        <div class="completed-section">
          <div class="completed-header">
            <h4 class="completed-title">Beendete Umfragen</h4>
          </div>
          {#if completedSurveys.length === 0}
            <div class="empty-state">
              <div class="empty-state__icon">
                <i class="fas fa-check-circle"></i>
              </div>
              <h3 class="empty-state__title">Keine beendeten Umfragen</h3>
              <p class="empty-state__description">
                Beendete und archivierte Umfragen werden hier angezeigt.
              </p>
            </div>
          {:else}
            <div class="mb-8 grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6">
              {#each completedSurveys as survey (getSurveyId(survey))}
                <CompletedSurveyCard
                  {survey}
                  surveyId={getSurveyId(survey)}
                  canManage={survey.canManage ?? false}
                  assignmentBadges={getAssignmentBadges(survey, departments, teams, areas)}
                  onviewresults={handleViewResults}
                  ondelete={(id: number | string) =>
                    handleDeleteSurveyWithInvalidate(id, invalidateAll)}
                />
              {/each}
            </div>
          {/if}
        </div>

        <div class="drafts-section">
          <div class="drafts-header">
            <h4 class="drafts-title">Entwürfe</h4>
          </div>
          {#if draftSurveys.length === 0}
            <div class="empty-state">
              <div class="empty-state__icon">
                <i class="fas fa-file-alt"></i>
              </div>
              <h3 class="empty-state__title">Keine Entwürfe</h3>
              <p class="empty-state__description">
                Sie haben keine Umfrage-Entwürfe. Erstellen Sie eine neue und speichern Sie sie als
                Entwurf.
              </p>
            </div>
          {:else}
            <div class="mb-8 grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6">
              {#each draftSurveys as survey (getSurveyId(survey))}
                <DraftSurveyCard
                  {survey}
                  surveyId={getSurveyId(survey)}
                  canManage={survey.canManage ?? false}
                  onedit={handleEditSurvey}
                  ondelete={(id: number | string) =>
                    handleDeleteSurveyWithInvalidate(id, invalidateAll)}
                />
              {/each}
            </div>
          {/if}
        </div>

        <div class="templates-section">
          <div class="templates-header">
            <h4 class="templates-title">Vorlagen</h4>
          </div>
          {#if templates.length === 0}
            <div class="empty-state">
              <div class="empty-state__icon">
                <i class="fas fa-folder-open"></i>
              </div>
              <h3 class="empty-state__title">Keine Vorlagen verfügbar</h3>
              <p class="empty-state__description">
                Es sind noch keine Umfragevorlagen vorhanden. Vorlagen werden automatisch erstellt.
              </p>
            </div>
          {:else}
            <div class="mb-8 grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6">
              {#each templates as template (template.id)}
                <div
                  class="card card--clickable"
                  role="button"
                  tabindex="0"
                  onclick={() => {
                    handleCreateFromTemplate(template.id);
                  }}
                  onkeydown={(e) => {
                    if (e.key === 'Enter') handleCreateFromTemplate(template.id);
                  }}
                >
                  <h4 class="text-primary mb-2 font-semibold">
                    {template.name}
                  </h4>
                  <p class="text-secondary text-sm leading-normal">
                    {template.description}
                  </p>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <button
    type="button"
    class="btn-float"
    aria-label="Neue Umfrage erstellen"
    onclick={handleOpenCreateModal}
  >
    <i class="fas fa-plus"></i>
  </button>

  <SurveyFormModal
    messages={surveyMessages}
    bind:formTitle
    bind:formDescription
    bind:formIsAnonymous
    bind:formIsMandatory
    bind:formStartDate
    bind:formStartTime
    bind:formEndDate
    bind:formEndTime
    bind:formCompanyWide
    bind:formSelectedAreas
    bind:formSelectedDepartments
    bind:formSelectedTeams
    bind:formQuestions
    departments={filteredOrgData.departments}
    teams={filteredOrgData.teams}
    areas={filteredOrgData.areas}
    canAssignCompanyWide={filteredOrgData.canAssignCompanyWide}
    onclose={handleCloseModal}
    onsavedraft={() => handleSaveSurvey('draft')}
    onsaveactive={() => handleSaveSurvey('active')}
    onaddquestion={addQuestion}
    onremovequestion={removeQuestion}
    onquestiontypechange={handleQuestionTypeChange}
    onaddoption={addOption}
    onremoveoption={removeOption}
    onupdateoption={updateOptionText}
  />
{/if}

<style>
  /* Survey Stats — used in child card components */
  :global(.survey-stats) {
    display: flex;
    gap: var(--spacing-6);
    margin-bottom: var(--spacing-4);
  }

  :global(.survey-stat) {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  :global(.survey-stat-value) {
    color: var(--primary-color);
    font-weight: 700;
    font-size: 1.5rem;
  }

  :global(.survey-stat-label) {
    color: var(--text-secondary);
    font-size: 0.8rem;
    text-transform: uppercase;
  }

  :global(.survey-actions) {
    display: grid;
    gap: var(--spacing-2);
    margin-top: var(--spacing-4);
  }

  /* Question Builder — used in SurveyFormModal */
  :global(.question-builder) {
    margin-top: var(--spacing-6);
  }

  :global(.question-header) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-4);
  }

  :global(.question-number) {
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 50%;

    background: var(--primary-color);

    width: 30px;
    height: 30px;
    color: var(--color-white);
    font-weight: 600;

    font-size: 14px;
  }

  :global(.question-actions) {
    display: flex;
    gap: var(--spacing-1);
  }

  :global(.question-action),
  :global(.remove-question) {
    display: flex;
    justify-content: center;
    align-items: center;

    transition: all 0.2s ease;
    cursor: pointer;
    border: none;
    border-radius: 50%;

    background: color-mix(in oklch, var(--color-white) 10%, transparent);
    padding: var(--spacing-1);

    width: 32px;
    height: 32px;

    color: var(--text-secondary);
  }

  :global(.question-action:hover),
  :global(.remove-question:hover) {
    transform: scale(1.1);
    background: color-mix(in oklch, var(--color-danger) 30%, transparent);
    color: var(--color-red-accent);
  }

  :global(.question-action.delete:hover) {
    background: color-mix(in oklch, var(--color-danger) 20%, transparent);
    color: var(--color-danger);
  }

  :global(.remove-question svg) {
    width: 14px;
    height: 14px;
  }

  /* Question Options — used in SurveyFormModal */
  :global(.option-item) {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-2);
  }

  :global(.option-input) {
    flex: 1;
    border: 1px solid color-mix(in oklch, var(--color-white) 20%, transparent);
    border-radius: var(--radius-xl);

    background: color-mix(in oklch, var(--color-white) 5%, transparent);

    padding: var(--spacing-3);

    color: var(--text-primary);
  }

  :global(.remove-option) {
    display: flex;
    justify-content: center;
    align-items: center;

    transition: background 0.2s ease;
    cursor: pointer;
    border: none;
    border-radius: 50%;

    background: color-mix(in oklch, var(--color-danger) 20%, transparent);
    padding: var(--spacing-1);

    width: 28px;
    height: 28px;

    color: var(--color-danger);
  }

  :global(.remove-option:hover) {
    background: color-mix(in oklch, var(--color-danger) 30%, transparent);
  }

  :global(.add-option-btn) {
    display: flex;
    align-items: center;
    gap: var(--spacing-1);

    transition: background 0.2s ease;
    cursor: pointer;

    margin-bottom: 10px;
    border: none;
    border-radius: var(--radius-xl);

    background: color-mix(in oklch, var(--color-success) 20%, transparent);
    padding: var(--spacing-3);
    color: var(--color-success);

    font-size: 0.9rem;
  }

  :global(.add-option-btn:hover) {
    background: color-mix(in oklch, var(--color-success) 30%, transparent);
  }

  /* Sections — directly in this template */
  .completed-section,
  .drafts-section,
  .templates-section {
    margin-top: var(--spacing-8);
    border-top: 1px solid color-mix(in oklch, var(--color-white) 10%, transparent);
    padding-top: var(--spacing-8);
  }

  .completed-header,
  .drafts-header,
  .templates-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-6);
  }

  .completed-title,
  .drafts-title,
  .templates-title {
    color: var(--text-primary);
    font-weight: 600;
    font-size: 1.5rem;
  }
</style>
