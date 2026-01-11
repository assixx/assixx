<script lang="ts">
  import { ASSIGNMENT_TYPE_OPTIONS } from './constants';
  import QuestionItem from './QuestionItem.svelte';
  import { surveyAdminState } from './state.svelte';
  import { getDepartmentMemberCount, getTeamMemberCount } from './utils';

  import type { QuestionType } from './types';

  // =============================================================================
  // PROPS
  // =============================================================================

  interface Props {
    formTitle: string;
    formDescription: string;
    formIsAnonymous: boolean;
    formIsMandatory: boolean;
    formStartDate: string;
    formStartTime: string;
    formEndDate: string;
    formEndTime: string;
    formAssignmentType: string;
    formSelectedAreas: number[];
    formSelectedDepartments: number[];
    formSelectedTeams: number[];
    formQuestions: {
      id: string;
      text: string;
      type: QuestionType;
      isOptional: boolean;
      options: string[];
    }[];
    assignmentDisplayText: string;
    onclose: () => void;
    onsavedraft: () => void;
    onsaveactive: () => void;
    onaddquestion: () => void;
    onremovequestion: (questionId: string) => void;
    onquestiontypechange: (questionId: string, type: QuestionType) => void;
    onaddoption: (questionId: string) => void;
    onremoveoption: (questionId: string, optionIndex: number) => void;
    onupdateoption: (questionId: string, optionIndex: number, text: string) => void;
    onassignmentselect: (value: string, label: string) => void;
  }

  /* eslint-disable */
  // prettier-ignore
  let { formTitle = $bindable(), formDescription = $bindable(), formIsAnonymous = $bindable(), formIsMandatory = $bindable(), formStartDate = $bindable(), formStartTime = $bindable(), formEndDate = $bindable(), formEndTime = $bindable(), formAssignmentType = $bindable(), formSelectedAreas = $bindable(), formSelectedDepartments = $bindable(), formSelectedTeams = $bindable(), formQuestions = $bindable(), assignmentDisplayText, onclose, onsavedraft, onsaveactive, onaddquestion, onremovequestion, onquestiontypechange, onaddoption, onremoveoption, onupdateoption, onassignmentselect }: Props = $props();
  /* eslint-enable */

  // =============================================================================
  // LOCAL STATE
  // =============================================================================

  let activeDropdown = $state<string | null>(null);
  let formElement: HTMLFormElement | undefined = $state();

  // =============================================================================
  // DROPDOWN HANDLERS
  // =============================================================================

  function toggleDropdown(dropdownId: string) {
    activeDropdown = activeDropdown === dropdownId ? null : dropdownId;
  }

  function closeAllDropdowns() {
    activeDropdown = null;
  }

  function handleAssignmentSelect(value: string, label: string) {
    onassignmentselect(value, label);
    closeAllDropdowns();
  }

  function handleQuestionTypeChange(questionId: string, type: QuestionType) {
    onquestiontypechange(questionId, type);
    closeAllDropdowns();
  }

  // =============================================================================
  // OUTSIDE CLICK HANDLER
  // =============================================================================

  function handleDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown')) {
      closeAllDropdowns();
    }
  }
</script>

<svelte:document onclick={handleDocumentClick} />

{#if surveyAdminState.showModal}
  <div class="modal-overlay modal-overlay--active">
    <form class="ds-modal ds-modal--lg" bind:this={formElement}>
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">{surveyAdminState.modalTitle}</h3>
        <button type="button" class="ds-modal__close" aria-label="Schliessen" onclick={onclose}>
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="ds-modal__body">
        <!-- Survey Title -->
        <div class="form-field">
          <label class="form-field__label" for="surveyTitle">
            Titel der Umfrage
            <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="surveyTitle"
            name="title"
            class="form-field__control"
            required
            bind:value={formTitle}
          />
        </div>

        <!-- Survey Description -->
        <div class="form-field">
          <label class="form-field__label" for="surveyDescription">Beschreibung</label>
          <textarea
            id="surveyDescription"
            name="description"
            class="form-field__control"
            rows="3"
            bind:value={formDescription}
          ></textarea>
        </div>

        <!-- Settings -->
        <div class="form-field">
          <span class="form-field__label">Einstellungen</span>
          <div class="mt-3">
            <label class="toggle-switch toggle-switch--info">
              <input
                type="checkbox"
                class="toggle-switch__input"
                id="isAnonymous"
                name="is_anonymous"
                bind:checked={formIsAnonymous}
              />
              <span class="toggle-switch__slider"></span>
              <span class="toggle-switch__label">Anonyme Umfrage</span>
            </label>
          </div>
          <div class="mt-3">
            <label class="toggle-switch toggle-switch--warning">
              <input
                type="checkbox"
                class="toggle-switch__input"
                id="isMandatory"
                name="is_mandatory"
                bind:checked={formIsMandatory}
              />
              <span class="toggle-switch__slider"></span>
              <span class="toggle-switch__label">Verpflichtende Teilnahme</span>
            </label>
          </div>
          <p class="mt-3 text-secondary text-sm">
            <i class="fas fa-info-circle"></i>
            Bei anonymen Umfragen werden keine Benutzerdaten gespeichert. Sie koennen nicht sehen, wer
            geantwortet hat.
          </p>
        </div>

        <!-- Duration -->
        <div class="form-field">
          <span class="form-field__label">Laufzeit</span>
          <div class="flex flex-col gap-4">
            <!-- Start Date/Time -->
            <div>
              <label class="form-field__label text-sm" for="startDate">Startdatum und -zeit</label>
              <div class="flex gap-3">
                <div class="date-picker flex-1">
                  <i class="date-picker__icon fas fa-calendar"></i>
                  <input
                    type="date"
                    id="startDate"
                    name="start_date"
                    class="date-picker__input"
                    bind:value={formStartDate}
                  />
                </div>
                <div class="time-picker time-picker--24h">
                  <i class="time-picker__icon fas fa-clock"></i>
                  <input
                    type="time"
                    id="startTime"
                    name="start_time"
                    class="time-picker__input"
                    bind:value={formStartTime}
                  />
                </div>
              </div>
            </div>
            <!-- End Date/Time -->
            <div>
              <label class="form-field__label text-sm" for="endDate">Enddatum und -zeit</label>
              <div class="flex gap-3">
                <div class="date-picker flex-1">
                  <i class="date-picker__icon fas fa-calendar"></i>
                  <input
                    type="date"
                    id="endDate"
                    name="end_date"
                    class="date-picker__input"
                    bind:value={formEndDate}
                  />
                </div>
                <div class="time-picker time-picker--24h">
                  <i class="time-picker__icon fas fa-clock"></i>
                  <input
                    type="time"
                    id="endTime"
                    name="end_time"
                    class="time-picker__input"
                    bind:value={formEndTime}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Target Audience -->
        <div class="form-field">
          <span class="form-field__label">Zielgruppe</span>
          <div class="dropdown" data-dropdown="assignment">
            <button
              type="button"
              class="dropdown__trigger"
              class:active={activeDropdown === 'assignment'}
              onclick={() => {
                toggleDropdown('assignment');
              }}
            >
              <span>{assignmentDisplayText}</span>
              <i class="fas fa-chevron-down"></i>
            </button>
            <div class="dropdown__menu" class:active={activeDropdown === 'assignment'}>
              {#each ASSIGNMENT_TYPE_OPTIONS as option (option.value)}
                <button
                  type="button"
                  class="dropdown__option"
                  onclick={() => {
                    handleAssignmentSelect(option.value, option.label);
                  }}
                >
                  {option.label}
                </button>
              {/each}
            </div>
          </div>
        </div>

        <!-- Area Selection -->
        {#if formAssignmentType === 'area'}
          <div class="form-field">
            <label class="form-field__label" for="areaSelect">Bereiche auswaehlen</label>
            <select
              id="areaSelect"
              multiple
              class="form-field__control min-h-[120px]"
              bind:value={formSelectedAreas}
            >
              {#each surveyAdminState.areas as area (area.id)}
                <option value={area.id}>{area.name}</option>
              {/each}
            </select>
            <small class="text-secondary text-xs mt-1 block">
              Halten Sie Strg/Cmd gedrueckt fuer Mehrfachauswahl
            </small>
          </div>
        {/if}

        <!-- Department Selection -->
        {#if formAssignmentType === 'department'}
          <div class="form-field">
            <label class="form-field__label" for="departmentSelect">Abteilungen auswaehlen</label>
            <select
              id="departmentSelect"
              multiple
              class="form-field__control min-h-[120px]"
              bind:value={formSelectedDepartments}
            >
              {#each surveyAdminState.departments as dept (dept.id)}
                <option value={dept.id}>
                  {dept.name} ({getDepartmentMemberCount(dept)} Mitglieder)
                </option>
              {/each}
            </select>
            <small class="text-secondary text-xs mt-1 block">
              Halten Sie Strg/Cmd gedrueckt fuer Mehrfachauswahl
            </small>
          </div>
        {/if}

        <!-- Team Selection -->
        {#if formAssignmentType === 'team'}
          <div class="form-field">
            <label class="form-field__label" for="teamSelect">Teams auswaehlen</label>
            <select
              id="teamSelect"
              multiple
              class="form-field__control min-h-[120px]"
              bind:value={formSelectedTeams}
            >
              {#each surveyAdminState.teams as team (team.id)}
                <option value={team.id}>
                  {team.name} ({getTeamMemberCount(team)} Mitglieder)
                </option>
              {/each}
            </select>
            <small class="text-secondary text-xs mt-1 block">
              Halten Sie Strg/Cmd gedrueckt fuer Mehrfachauswahl
            </small>
          </div>
        {/if}

        <!-- Question Builder -->
        <div class="question-builder">
          <h3 class="mb-4">Fragen</h3>
          <div id="questionsList">
            {#each formQuestions as question, qIndex (question.id)}
              <QuestionItem
                {question}
                questionIndex={qIndex}
                isMandatory={formIsMandatory}
                {activeDropdown}
                ontoggleDropdown={toggleDropdown}
                onremove={() => {
                  onremovequestion(question.id);
                }}
                ontypechange={(type: QuestionType) => {
                  handleQuestionTypeChange(question.id, type);
                }}
                onaddoption={() => {
                  onaddoption(question.id);
                }}
                onremoveoption={(optIndex: number) => {
                  onremoveoption(question.id, optIndex);
                }}
                onupdateoption={(optIndex: number, text: string) => {
                  onupdateoption(question.id, optIndex, text);
                }}
              />
            {/each}
          </div>
          <button type="button" class="btn btn-secondary" onclick={onaddquestion}>
            <i class="fas fa-plus"></i>
            Frage hinzufuegen
          </button>
        </div>
      </div>

      <div class="ds-modal__footer ds-modal__footer--right">
        <button type="button" class="btn btn-cancel" onclick={onclose}>Abbrechen</button>
        <button
          type="button"
          class="btn btn-secondary"
          disabled={surveyAdminState.isSaving}
          onclick={onsavedraft}
        >
          {#if surveyAdminState.isSaving}
            <i class="fas fa-spinner fa-spin"></i>
          {:else}
            <i class="fas fa-save"></i>
          {/if}
          Als Entwurf speichern
        </button>
        <button
          type="button"
          class="btn btn-modal"
          disabled={surveyAdminState.isSaving}
          onclick={onsaveactive}
        >
          {#if surveyAdminState.isSaving}
            <i class="fas fa-spinner fa-spin"></i>
          {:else}
            <i class="fas fa-paper-plane"></i>
          {/if}
          Umfrage starten
        </button>
      </div>
    </form>
  </div>
{/if}
