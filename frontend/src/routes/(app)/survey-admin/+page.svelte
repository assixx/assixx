<script lang="ts">
  /**
   * Survey Admin - Page Component
   * @module survey-admin/+page
   *
   * Level 3 SSR: All data via $derived from SSR props, invalidateAll() after mutations.
   */
  import { invalidateAll } from '$app/navigation';

  import '../../../styles/survey-admin.css';
  import { showErrorAlert } from '$lib/utils';

  // Extracted Components
  import ActiveSurveyCard from './_lib/ActiveSurveyCard.svelte';
  import DraftSurveyCard from './_lib/DraftSurveyCard.svelte';
  import {
    getSurveyId,
    getAssignmentInfoWithData,
    getOptionsFromQuestion,
    handleDeleteSurveyWithInvalidate,
    handleViewResults,
    loadSurveyForEdit,
    saveSurveyWithInvalidate,
    type FormState,
  } from './_lib/handlers';
  import { surveyAdminState } from './_lib/state.svelte';
  import SurveyFormModal from './_lib/SurveyFormModal.svelte';
  import { questionTypeNeedsOptions, getTextFromBuffer, toBool } from './_lib/utils';

  import type { PageData } from './$types';
  import type { QuestionType, Survey, SurveyTemplate, Department, Team, Area } from './_lib/types';

  // =============================================================================
  // SSR DATA - Level 3: $derived from props (single source of truth)
  // =============================================================================

  const { data }: { data: PageData } = $props();

  // SSR data as derived - updates automatically when invalidateAll() is called
  const surveys = $derived<Survey[]>(data.surveys);
  const templates = $derived<SurveyTemplate[]>(data.templates);
  const departments = $derived<Department[]>(data.departments);
  const teams = $derived<Team[]>(data.teams);
  const areas = $derived<Area[]>(data.areas);

  // Derived computed values
  const activeSurveys = $derived(surveys.filter((s) => s.status === 'active'));
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
  let formAssignmentType = $state('all_users');
  let formSelectedAreas = $state<number[]>([]);
  let formSelectedDepartments = $state<number[]>([]);
  let formSelectedTeams = $state<number[]>([]);
  let formQuestions = $state<
    { id: string; text: string; type: QuestionType; isOptional: boolean; options: string[] }[]
  >([]);
  let assignmentDisplayText = $state('Ganze Firma');

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
      formAssignmentType,
      formSelectedAreas,
      formSelectedDepartments,
      formSelectedTeams,
      formQuestions,
      assignmentDisplayText,
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
    formAssignmentType = state.formAssignmentType;
    formSelectedAreas = state.formSelectedAreas;
    formSelectedDepartments = state.formSelectedDepartments;
    formSelectedTeams = state.formSelectedTeams;
    formQuestions = state.formQuestions;
    assignmentDisplayText = state.assignmentDisplayText;
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
    formAssignmentType = 'all_users';
    assignmentDisplayText = 'Ganze Firma';
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
    if (formState !== null) applyFormState(formState);
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
      { id: questionId, text: '', type: 'text' as QuestionType, isOptional: false, options: [] },
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
            needsOptions && q.options.length === 0 ? ['', ''] : needsOptions ? q.options : [],
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

  function handleAssignmentSelect(value: string, label: string): void {
    formAssignmentType = value;
    assignmentDisplayText = label;
  }

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

<div class="container">
  <div class="card">
    <div class="card__header flex justify-between items-center">
      <div>
        <h4 class="card-title">Umfrage-Verwaltung</h4>
        <p class="text-secondary">Erstellen und verwalten Sie Mitarbeiterumfragen</p>
      </div>
    </div>

    <div class="card-body">
      <h4>Aktive Umfragen</h4>
      {#if activeSurveys.length === 0}
        <div class="empty-state">
          <div class="empty-state__icon"><i class="fas fa-clipboard-list"></i></div>
          <h3 class="empty-state__title">Keine aktiven Umfragen</h3>
          <p class="empty-state__description">
            Es gibt derzeit keine aktiven Umfragen. Erstellen Sie eine neue oder aktivieren Sie
            einen Entwurf.
          </p>
        </div>
      {:else}
        <div class="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6 mb-8">
          {#each activeSurveys as survey (getSurveyId(survey))}
            <ActiveSurveyCard
              {survey}
              surveyId={getSurveyId(survey)}
              assignmentInfo={getAssignmentInfoWithData(survey, departments, teams, areas)}
              onedit={handleEditSurvey}
              onviewresults={handleViewResults}
              ondelete={(id: number | string) =>
                handleDeleteSurveyWithInvalidate(id, invalidateAll)}
            />
          {/each}
        </div>
      {/if}

      <div class="drafts-section">
        <div class="drafts-header"><h4 class="drafts-title">Entwürfe</h4></div>
        {#if draftSurveys.length === 0}
          <div class="empty-state">
            <div class="empty-state__icon"><i class="fas fa-file-alt"></i></div>
            <h3 class="empty-state__title">Keine Entwürfe</h3>
            <p class="empty-state__description">
              Sie haben keine Umfrage-Entwürfe. Erstellen Sie eine neue und speichern Sie sie als
              Entwurf.
            </p>
          </div>
        {:else}
          <div class="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6 mb-8">
            {#each draftSurveys as survey (getSurveyId(survey))}
              <DraftSurveyCard
                {survey}
                surveyId={getSurveyId(survey)}
                onedit={handleEditSurvey}
                ondelete={(id: number | string) =>
                  handleDeleteSurveyWithInvalidate(id, invalidateAll)}
              />
            {/each}
          </div>
        {/if}
      </div>

      <div class="templates-section">
        <div class="templates-header"><h4 class="templates-title">Vorlagen</h4></div>
        {#if templates.length === 0}
          <div class="empty-state">
            <div class="empty-state__icon"><i class="fas fa-folder-open"></i></div>
            <h3 class="empty-state__title">Keine Vorlagen verfuegbar</h3>
            <p class="empty-state__description">
              Es sind noch keine Umfragevorlagen vorhanden. Vorlagen werden automatisch erstellt.
            </p>
          </div>
        {:else}
          <div class="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6 mb-8">
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
                <h4 class="mb-2 font-semibold text-primary">{template.name}</h4>
                <p class="text-sm leading-normal text-secondary">{template.description}</p>
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
  bind:formTitle
  bind:formDescription
  bind:formIsAnonymous
  bind:formIsMandatory
  bind:formStartDate
  bind:formStartTime
  bind:formEndDate
  bind:formEndTime
  bind:formAssignmentType
  bind:formSelectedAreas
  bind:formSelectedDepartments
  bind:formSelectedTeams
  bind:formQuestions
  {assignmentDisplayText}
  onclose={handleCloseModal}
  onsavedraft={() => handleSaveSurvey('draft')}
  onsaveactive={() => handleSaveSurvey('active')}
  onaddquestion={addQuestion}
  onremovequestion={removeQuestion}
  onquestiontypechange={handleQuestionTypeChange}
  onaddoption={addOption}
  onremoveoption={removeOption}
  onupdateoption={updateOptionText}
  onassignmentselect={handleAssignmentSelect}
/>

<!-- No component-specific styles needed - using global styles -->
