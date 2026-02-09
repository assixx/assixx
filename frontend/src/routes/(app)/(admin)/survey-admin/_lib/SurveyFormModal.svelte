<script lang="ts">
  import {
    filterAvailableDepartments,
    filterDepartmentIdsByAreas,
    filterAvailableTeams,
    filterTeamIdsByDepartments,
  } from '$lib/utils';

  import QuestionItem from './QuestionItem.svelte';
  import { surveyAdminState } from './state.svelte';
  import { getTeamMemberCount } from './utils';

  import type { QuestionType, Department, Team, Area } from './types';

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
    formCompanyWide: boolean;
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
    departments: Department[];
    teams: Team[];
    areas: Area[];
    canAssignCompanyWide: boolean;
    onclose: () => void;
    onsavedraft: () => void;
    onsaveactive: () => void;
    onaddquestion: () => void;
    onremovequestion: (questionId: string) => void;
    onquestiontypechange: (questionId: string, type: QuestionType) => void;
    onaddoption: (questionId: string) => void;
    onremoveoption: (questionId: string, optionIndex: number) => void;
    onupdateoption: (
      questionId: string,
      optionIndex: number,
      text: string,
    ) => void;
  }

  /* eslint-disable prefer-const, @typescript-eslint/no-useless-default-assignment -- Svelte $bindable() requires let and is not a useless default */
  // prettier-ignore
  let { formTitle = $bindable(), formDescription = $bindable(), formIsAnonymous = $bindable(), formIsMandatory = $bindable(), formStartDate = $bindable(), formStartTime = $bindable(), formEndDate = $bindable(), formEndTime = $bindable(), formCompanyWide = $bindable(), formSelectedAreas = $bindable(), formSelectedDepartments = $bindable(), formSelectedTeams = $bindable(), formQuestions = $bindable(), departments, teams, areas, canAssignCompanyWide, onclose, onsavedraft, onsaveactive, onaddquestion, onremovequestion, onquestiontypechange, onaddoption, onremoveoption, onupdateoption }: Props = $props();
  /* eslint-enable prefer-const, @typescript-eslint/no-useless-default-assignment */

  // =============================================================================
  // LOCAL STATE
  // =============================================================================

  let activeDropdown = $state<string | null>(null);
  let formElement: HTMLFormElement | undefined = $state();

  // =============================================================================
  // VISIBILITY LOGIC (Calendar-style inheritance)
  // =============================================================================

  /** Filter departments based on selected areas (inheritance logic) */
  const availableDepartments = $derived.by(() => {
    return filterAvailableDepartments(
      departments,
      formSelectedAreas,
      formCompanyWide,
    );
  });

  /** All department IDs covered by selection (explicit + area-inherited) */
  const coveredDepartmentIds = $derived.by(() => {
    const inherited = departments
      .filter((d) => formSelectedAreas.includes(d.areaId ?? -1))
      .map((d) => d.id);
    return [...formSelectedDepartments, ...inherited];
  });

  /** Filter teams: hide teams whose department is already covered */
  const availableTeams = $derived.by(() => {
    return filterAvailableTeams(teams, coveredDepartmentIds, formCompanyWide);
  });

  /**
   * Handle area selection change.
   * Filters out departments and teams covered by selected areas (inheritance).
   */
  function handleAreaChange(e: Event): void {
    const select = e.target as HTMLSelectElement;
    const newAreaIds = Array.from(select.selectedOptions).map((o) =>
      Number(o.value),
    );
    formSelectedAreas = newAreaIds;
    formSelectedDepartments = filterDepartmentIdsByAreas(
      formSelectedDepartments,
      departments,
      newAreaIds,
    );
    // Remove teams whose department is now covered (explicit + area-inherited)
    const areaDeptIds = departments
      .filter((d) => newAreaIds.includes(d.areaId ?? -1))
      .map((d) => d.id);
    formSelectedTeams = filterTeamIdsByDepartments(formSelectedTeams, teams, [
      ...formSelectedDepartments,
      ...areaDeptIds,
    ]);
  }

  /**
   * Handle department selection change.
   * Filters out teams covered by selected departments.
   */
  function handleDepartmentChange(e: Event): void {
    const select = e.target as HTMLSelectElement;
    const newDeptIds = Array.from(select.selectedOptions).map((o) =>
      Number(o.value),
    );
    formSelectedDepartments = newDeptIds;
    const areaDeptIds = departments
      .filter((d) => formSelectedAreas.includes(d.areaId ?? -1))
      .map((d) => d.id);
    formSelectedTeams = filterTeamIdsByDepartments(formSelectedTeams, teams, [
      ...newDeptIds,
      ...areaDeptIds,
    ]);
  }

  // =============================================================================
  // DROPDOWN HANDLERS
  // =============================================================================

  function toggleDropdown(dropdownId: string) {
    activeDropdown = activeDropdown === dropdownId ? null : dropdownId;
  }

  function closeAllDropdowns() {
    activeDropdown = null;
  }

  function handleQuestionTypeChange(questionId: string, type: QuestionType) {
    onquestiontypechange(questionId, type);
    closeAllDropdowns();
  }

  // =============================================================================
  // OUTSIDE CLICK HANDLER
  // =============================================================================

  // Reset local UI state when modal opens
  $effect(() => {
    if (surveyAdminState.showModal) {
      activeDropdown = null;
    }
  });

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
    <form
      class="ds-modal ds-modal--lg"
      bind:this={formElement}
    >
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">{surveyAdminState.modalTitle}</h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schliessen"
          onclick={onclose}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="ds-modal__body">
        <!-- Survey Title -->
        <div class="form-field">
          <label
            class="form-field__label"
            for="surveyTitle"
          >
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
          <label
            class="form-field__label"
            for="surveyDescription">Beschreibung</label
          >
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
          <p class="text-secondary mt-3 text-sm">
            <i class="fas fa-info-circle"></i>
            Bei anonymen Umfragen werden keine Benutzerdaten gespeichert. Sie können
            nicht sehen, wer geantwortet hat.
          </p>
        </div>

        <!-- Duration -->
        <div class="form-field">
          <span class="form-field__label">Laufzeit</span>
          <div class="flex flex-col gap-4">
            <!-- Start Date/Time -->
            <div>
              <label
                class="form-field__label text-sm"
                for="startDate">Startdatum und -zeit</label
              >
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
              <label
                class="form-field__label text-sm"
                for="endDate">Enddatum und -zeit</label
              >
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

        <!-- Zielgruppe / Sichtbarkeit (Calendar-style) -->
        <div class="form-field">
          <span class="form-field__label">
            <i class="fas fa-users mr-2"></i>
            Sichtbarkeit
          </span>
          <p class="mb-2 text-sm text-(--color-text-secondary)">
            wählen Sie keine Organisation für firmenweite Umfragen oder
            eine/mehrere spezifische Organisationen.
          </p>
        </div>

        <!-- Ganze Firma Toggle (only for root / has_full_access users) -->
        {#if canAssignCompanyWide}
          <div class="form-field">
            <label class="toggle-switch toggle-switch--danger">
              <input
                type="checkbox"
                class="toggle-switch__input"
                bind:checked={formCompanyWide}
              />
              <span class="toggle-switch__slider"></span>
              <span class="toggle-switch__label">
                <i class="fas fa-building mr-2"></i>
                Ganze Firma (Alle Mitarbeiter)
              </span>
            </label>
            <span class="form-field__message text-(--color-danger)">
              <i class="fas fa-exclamation-triangle mr-1"></i>
              Wenn aktiviert, sehen ALLE Mitarbeiter der Firma diese Umfrage
            </span>
          </div>
        {/if}

        <!-- Area Selection -->
        <div
          class="form-field"
          class:opacity-50={formCompanyWide}
        >
          <label
            class="form-field__label"
            for="survey-area-select"
          >
            <i class="fas fa-layer-group mr-1"></i> Bereiche (Areas)
          </label>
          <select
            id="survey-area-select"
            multiple
            class="form-field__control min-h-25"
            value={formSelectedAreas}
            disabled={formCompanyWide}
            onchange={handleAreaChange}
          >
            {#each areas as area (area.id)}
              <option
                value={area.id}
                selected={formSelectedAreas.includes(area.id)}
              >
                {area.name}{(
                  area.departmentCount !== undefined && area.departmentCount > 0
                ) ?
                  ` (${area.departmentCount} Abt.)`
                : ''}
              </option>
            {/each}
          </select>
          <span class="form-field__message text-(--color-text-secondary)">
            <i class="fas fa-info-circle mr-1"></i>
            Strg/Cmd + Klick für Mehrfachauswahl. Bereiche vererben Zugriff auf zugehörige
            Abteilungen.
          </span>
        </div>

        <!-- Department Selection (filtered by area inheritance) -->
        <div
          class="form-field"
          class:opacity-50={formCompanyWide}
        >
          <label
            class="form-field__label"
            for="survey-department-select"
          >
            <i class="fas fa-sitemap mr-1"></i> Zusaetzliche Abteilungen
          </label>
          <select
            id="survey-department-select"
            multiple
            class="form-field__control min-h-25"
            value={formSelectedDepartments}
            disabled={formCompanyWide}
            onchange={handleDepartmentChange}
          >
            {#each availableDepartments as dept (dept.id)}
              <option
                value={dept.id}
                selected={formSelectedDepartments.includes(dept.id)}
              >
                {dept.name}{(
                  dept.areaName !== undefined && dept.areaName !== ''
                ) ?
                  ` (${dept.areaName})`
                : ''}
              </option>
            {/each}
          </select>
          <span class="form-field__message text-(--color-text-secondary)">
            <i class="fas fa-info-circle mr-1"></i>
            Strg/Cmd + Klick für Mehrfachauswahl. Nur Abteilungen die nicht bereits
            durch Bereiche abgedeckt sind.
          </span>
        </div>

        <!-- Team Selection -->
        <div
          class="form-field"
          class:opacity-50={formCompanyWide}
        >
          <label
            class="form-field__label"
            for="survey-team-select"
          >
            <i class="fas fa-users mr-1"></i> Teams
          </label>
          <select
            id="survey-team-select"
            multiple
            class="form-field__control min-h-25"
            bind:value={formSelectedTeams}
            disabled={formCompanyWide}
          >
            {#each availableTeams as team (team.id)}
              <option value={team.id}>
                {team.name} ({getTeamMemberCount(team)} Mitglieder)
              </option>
            {/each}
          </select>
          <span class="form-field__message text-(--color-text-secondary)">
            <i class="fas fa-info-circle mr-1"></i>
            Teams werden automatisch vererbt: Bereich-/Abteilungs-Auswahl blendet
            zugehörige Teams aus.
          </span>
        </div>

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
          <button
            type="button"
            class="btn btn-secondary"
            onclick={onaddquestion}
          >
            <i class="fas fa-plus"></i>
            Frage hinzufügen
          </button>
        </div>
      </div>

      <div class="ds-modal__footer ds-modal__footer--right">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={onclose}>Abbrechen</button
        >
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
