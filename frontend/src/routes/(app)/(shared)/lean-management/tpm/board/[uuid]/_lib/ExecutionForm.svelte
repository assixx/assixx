<script lang="ts">
  /**
   * ExecutionForm — Form for marking a card as done.
   *
   * Fields:
   *   1. Execution date (default: today, changeable for late documentation)
   *   2. "Ohne Beanstandung" checkbox (fast path for 80% of routine maintenance)
   *   3. Actual duration + staff count (IST vs SOLL comparison)
   *   4. Documentation / remarks (optional when no issues, required when issues found)
   *   5. Photo staging (optional, max 5)
   *
   * Only shown when card status is 'red' or 'overdue'.
   */
  import { onDestroy } from 'svelte';

  import AppDatePicker from '$lib/components/AppDatePicker.svelte';
  import SearchResultUser from '$lib/components/SearchResultUser.svelte';

  import { createExecution, uploadPhoto, logApiError } from '../../../_lib/api';
  import { MESSAGES } from '../../../_lib/constants';

  import type {
    DefectPayload,
    TpmCard,
    TpmEmployee,
    TpmExecution,
    TpmTimeEstimate,
  } from '../../../_lib/types';

  const MAX_PHOTOS = 5;
  const MAX_FILE_SIZE = 5_242_880;
  const MAX_DEFECTS = 20;
  const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  interface StagedPhoto {
    file: File;
    previewUrl: string;
  }

  interface Props {
    card: TpmCard;
    timeEstimates?: TpmTimeEstimate[];
    employees?: TpmEmployee[];
    onExecutionCreated: (execution: TpmExecution) => void;
  }

  const {
    card,
    timeEstimates = [],
    employees = [],
    onExecutionCreated,
  }: Props = $props();

  // Form state
  let executionDate = $state(new Date().toISOString().slice(0, 10));
  let noIssuesFound = $state(true);
  let actualDurationMinutes = $state<string>('');
  let actualStaffCount = $state<string>('');
  let documentation = $state('');
  let submitting = $state(false);
  let error = $state<string | null>(null);
  let completed = $state(false);
  let stagedPhotos = $state<StagedPhoto[]>([]);
  let photoError = $state<string | null>(null);
  let photoUploadWarning = $state<string | null>(null);

  // Defect state
  interface DefectEntry {
    id: number;
    title: string;
    description: string;
  }
  let defectIdCounter = 1;
  function createEmptyDefect(): DefectEntry {
    return { id: defectIdCounter++, title: '', description: '' };
  }
  let defects = $state<DefectEntry[]>([createEmptyDefect()]);

  function addDefect(): void {
    defects = [...defects, createEmptyDefect()];
  }

  function removeDefect(index: number): void {
    defects = defects.filter((_: DefectEntry, i: number) => i !== index);
    if (defects.length === 0) {
      defects = [createEmptyDefect()];
    }
  }

  const canAddDefect = $derived(defects.length < MAX_DEFECTS && !submitting);

  // Employee search state
  let employeeQuery = $state('');
  let employeeSearchOpen = $state(false);
  let selectedEmployees = $state<TpmEmployee[]>([]);

  const MAX_SEARCH_RESULTS = 5;

  const filteredEmployees = $derived.by((): TpmEmployee[] => {
    const term = employeeQuery.trim().toLowerCase();
    if (term === '') return [];
    return employees
      .filter((e: TpmEmployee) => {
        if (selectedEmployees.some((s: TpmEmployee) => s.uuid === e.uuid))
          return false;
        const fullName = `${e.firstName} ${e.lastName}`.toLowerCase();
        const email = e.email.toLowerCase();
        const empNr = (e.employeeNumber ?? '').toLowerCase();
        return (
          fullName.includes(term) ||
          email.includes(term) ||
          empNr.includes(term)
        );
      })
      .slice(0, MAX_SEARCH_RESULTS);
  });

  function selectEmployee(employee: TpmEmployee): void {
    selectedEmployees = [...selectedEmployees, employee];
    employeeQuery = '';
    employeeSearchOpen = false;
  }

  function removeEmployee(uuid: string): void {
    selectedEmployees = selectedEmployees.filter(
      (e: TpmEmployee) => e.uuid !== uuid,
    );
  }

  function handleEmployeeInput(): void {
    employeeSearchOpen = employeeQuery.trim().length > 0;
  }

  $effect(() => {
    if (!employeeSearchOpen) return;

    function handleClickOutside(event: MouseEvent): void {
      const target = event.target as HTMLElement;
      if (!target.closest('.employee-search')) {
        employeeSearchOpen = false;
      }
    }

    document.addEventListener('click', handleClickOutside, true);
    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  });

  // Derived: SOLL values from time estimates matching this card's interval
  const matchingEstimate = $derived(
    timeEstimates.find(
      (e: TpmTimeEstimate) => e.intervalType === card.intervalType,
    ),
  );
  const sollDuration = $derived(matchingEstimate?.executionMinutes ?? null);
  const sollStaff = $derived(matchingEstimate?.staffCount ?? null);

  // Clear defects + documentation when user checks "no issues" back on
  $effect(() => {
    if (noIssuesFound) {
      documentation = '';
      defects = [createEmptyDefect()];
    }
  });

  // Derived: validation
  const canExecute = $derived(
    card.status === 'red' || card.status === 'overdue',
  );
  const requiresDocs = $derived(card.requiresApproval && !noIssuesFound);
  const hasValidDefects = $derived(
    noIssuesFound ||
      defects.some((d: DefectEntry) => d.title.trim().length > 0),
  );
  const isValid = $derived(
    hasValidDefects && (!requiresDocs || documentation.trim().length > 0),
  );
  const canAddPhoto = $derived(stagedPhotos.length < MAX_PHOTOS && !submitting);

  function validateFile(file: File): string | null {
    if (!ACCEPTED_TYPES.includes(file.type)) return MESSAGES.PHOTO_INVALID_TYPE;
    if (file.size > MAX_FILE_SIZE) return MESSAGES.PHOTO_TOO_LARGE;
    return null;
  }

  function handleFileSelect(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file === undefined) return;

    const validationError = validateFile(file);
    if (validationError !== null) {
      photoError = validationError;
      input.value = '';
      return;
    }

    photoError = null;
    stagedPhotos = [
      ...stagedPhotos,
      { file, previewUrl: URL.createObjectURL(file) },
    ];
    input.value = '';
  }

  function removePhoto(index: number): void {
    URL.revokeObjectURL(stagedPhotos[index].previewUrl);
    stagedPhotos = stagedPhotos.filter(
      (_: StagedPhoto, i: number) => i !== index,
    );
  }

  function cleanupPreviews(): void {
    for (const staged of stagedPhotos) {
      URL.revokeObjectURL(staged.previewUrl);
    }
  }

  function parseIntOrNull(val: string): number | null {
    const n = Number.parseInt(val, 10);
    return Number.isNaN(n) || n <= 0 ? null : n;
  }

  async function handleSubmit(): Promise<void> {
    if (!canExecute || !isValid || submitting) return;

    submitting = true;
    error = null;
    photoUploadWarning = null;

    try {
      // Step 1: Create execution
      // Build defect payloads (only non-empty titles)
      const validDefects: DefectPayload[] = noIssuesFound ?
        [] :
        defects
          .filter((d: DefectEntry) => d.title.trim().length > 0)
          .map((d: DefectEntry) => ({
            title: d.title.trim(),
            description:
              d.description.trim().length > 0 ? d.description.trim() : null,
          }));

      const execution = await createExecution({
        cardUuid: card.uuid,
        executionDate,
        noIssuesFound,
        actualDurationMinutes: parseIntOrNull(actualDurationMinutes),
        actualStaffCount: parseIntOrNull(actualStaffCount),
        documentation:
          documentation.trim().length > 0 ? documentation.trim() : null,
        participantUuids:
          selectedEmployees.length > 0 ?
            selectedEmployees.map((e: TpmEmployee) => e.uuid)
          : undefined,
        defects: validDefects.length > 0 ? validDefects : undefined,
      });

      // Step 2: Upload staged photos (sequential to avoid server overload)
      let failedUploads = 0;
      for (const staged of stagedPhotos) {
        try {
          await uploadPhoto(execution.uuid, staged.file);
        } catch (uploadErr: unknown) {
          failedUploads++;
          logApiError('uploadPhoto', uploadErr);
        }
      }

      // Step 3: Clean up blob URLs
      cleanupPreviews();

      // eslint-disable-next-line require-atomic-updates -- Single-threaded UI; button disabled prevents concurrent calls
      submitting = false;
      completed = true;

      if (failedUploads > 0) {
        photoUploadWarning = `${String(failedUploads)} Foto(s) konnten nicht hochgeladen werden.`;
      }

      onExecutionCreated(execution);
    } catch (err: unknown) {
      // eslint-disable-next-line require-atomic-updates -- Single-threaded UI; button disabled prevents concurrent calls
      submitting = false;
      logApiError('createExecution', err);
      error = MESSAGES.EXEC_ERROR;
    }
  }

  onDestroy(cleanupPreviews);
</script>

<div class="execution-form">
  <h4 class="execution-form__title">
    <i class="fas fa-check-double"></i>
    {MESSAGES.EXEC_HEADING}
  </h4>

  {#if !canExecute}
    <p class="m-0 text-sm text-(--color-text-muted) italic">
      {MESSAGES.EXEC_CARD_NOT_DUE}
    </p>
  {:else if completed}
    <div class="execution-form__success">
      <i class="fas fa-check-circle"></i>
      {MESSAGES.EXEC_SUCCESS}
    </div>
    {#if photoUploadWarning !== null}
      <span class="flex items-center gap-1.5 text-sm text-(--color-warning)">
        <i class="fas fa-exclamation-triangle"></i>
        {photoUploadWarning}
      </span>
    {/if}
  {:else}
    <!-- Step 1: Execution Date -->
    <div class="execution-form__date">
      <AppDatePicker
        bind:value={executionDate}
        label={MESSAGES.EXEC_DATE}
        max={new Date().toISOString().slice(0, 10)}
        disabled={submitting}
        size="sm"
      />
    </div>

    <!-- Step 2: No Issues Checkbox -->
    <label class="choice-card execution-form__no-issues">
      <input
        type="checkbox"
        class="choice-card__input"
        bind:checked={noIssuesFound}
        disabled={submitting}
      />
      <span class="choice-card__text">
        {MESSAGES.EXEC_NO_ISSUES}
        <span class="choice-card__description">
          {MESSAGES.EXEC_NO_ISSUES_HINT}
        </span>
      </span>
    </label>

    <!-- Step 2b: Defects (when issues found) -->
    {#if !noIssuesFound}
      <div class="defects-section">
        <h5 class="defects-section__title">
          <i class="fas fa-exclamation-triangle"></i>
          {MESSAGES.DEFECT_SECTION_TITLE}
        </h5>

        {#each defects as defect, index (defect.id)}
          <div class="defect-entry">
            <div class="defect-entry__header">
              <span class="defect-entry__number">
                {MESSAGES.DEFECT_NUMBER} {index + 1}
              </span>
              {#if defects.length > 1}
                <button
                  type="button"
                  class="defect-entry__remove"
                  onclick={() => {
                    removeDefect(index);
                  }}
                  disabled={submitting}
                  aria-label={MESSAGES.DEFECT_REMOVE}
                >
                  <i class="fas fa-times"></i>
                </button>
              {/if}
            </div>

            <div class="form-field">
              <label
                for="defect-title-{index}"
                class="form-field__label"
              >
                {MESSAGES.DEFECT_TITLE_LABEL}
              </label>
              <input
                id="defect-title-{index}"
                type="text"
                class="form-field__control"
                placeholder={MESSAGES.DEFECT_TITLE_PH}
                bind:value={defect.title}
                maxlength="500"
                disabled={submitting}
              />
            </div>

            <div class="form-field">
              <label
                for="defect-desc-{index}"
                class="form-field__label"
              >
                {MESSAGES.DEFECT_DESC_LABEL}
              </label>
              <textarea
                id="defect-desc-{index}"
                class="form-field__control form-field__control--textarea"
                placeholder={MESSAGES.DEFECT_DESC_PH}
                bind:value={defect.description}
                rows="2"
                maxlength="5000"
                disabled={submitting}
              ></textarea>
            </div>
          </div>
        {/each}

        {#if canAddDefect}
          <button
            type="button"
            class="defects-section__add"
            onclick={addDefect}
            disabled={submitting}
          >
            <i class="fas fa-plus"></i>
            {MESSAGES.DEFECT_ADD}
          </button>
        {/if}
      </div>
    {/if}

    <!-- Step 3: Time & Staff (optional) -->
    <div class="execution-form__row">
      <div class="form-field execution-form__half">
        <label
          for="exec-duration"
          class="form-field__label"
        >
          {MESSAGES.EXEC_DURATION}
          {#if sollDuration !== null}
            <span class="execution-form__soll">
              ({MESSAGES.EXEC_SOLL}: {sollDuration}
              {MESSAGES.EXEC_DURATION_UNIT})
            </span>
          {/if}
        </label>
        <div class="execution-form__input-suffix">
          <input
            id="exec-duration"
            type="number"
            class="form-field__control"
            bind:value={actualDurationMinutes}
            min="1"
            max="1440"
            placeholder="—"
            disabled={submitting}
          />
          <span class="execution-form__suffix"
            >{MESSAGES.EXEC_DURATION_UNIT}</span
          >
        </div>
      </div>

      <div class="form-field execution-form__half">
        <label
          for="exec-staff"
          class="form-field__label"
        >
          {MESSAGES.EXEC_STAFF}
          {#if sollStaff !== null}
            <span class="execution-form__soll">
              ({MESSAGES.EXEC_SOLL}: {sollStaff})
            </span>
          {/if}
        </label>
        <input
          id="exec-staff"
          type="number"
          class="form-field__control"
          bind:value={actualStaffCount}
          min="1"
          max="50"
          placeholder="—"
          disabled={submitting}
        />
      </div>

      <!-- Employee Search -->
      {#if employees.length > 0}
        <div class="form-field execution-form__half">
          <span class="form-field__label">Beteiligte Mitarbeiter</span>
          <div
            class="search-input-wrapper employee-search"
            class:search-input-wrapper--open={employeeSearchOpen &&
              employeeQuery.trim().length > 0}
          >
            <div class="search-input">
              <i class="search-input__icon fas fa-search"></i>
              <input
                type="search"
                class="search-input__field"
                placeholder="Mitarbeiter suchen..."
                autocomplete="off"
                bind:value={employeeQuery}
                oninput={handleEmployeeInput}
                onfocus={handleEmployeeInput}
                disabled={submitting}
              />
              {#if employeeQuery.length > 0}
                <button
                  type="button"
                  class="search-input__clear"
                  aria-label="Suche löschen"
                  onclick={() => {
                    employeeQuery = '';
                    employeeSearchOpen = false;
                  }}
                >
                  <i class="fas fa-times"></i>
                </button>
              {/if}
            </div>
            <div class="search-input__results">
              {#if filteredEmployees.length > 0}
                {#each filteredEmployees as emp (emp.uuid)}
                  <SearchResultUser
                    id={emp.id}
                    firstName={emp.firstName}
                    lastName={emp.lastName}
                    email={emp.email}
                    employeeNumber={emp.employeeNumber}
                    position={emp.position}
                    role="employee"
                    query={employeeQuery}
                    onclick={() => {
                      selectEmployee(emp);
                    }}
                  />
                {/each}
              {:else}
                <div class="employee-search__no-results">
                  Keine Mitarbeiter gefunden
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Selected Employees (chips) -->
    {#if selectedEmployees.length > 0}
      <div class="employee-chips">
        {#each selectedEmployees as emp (emp.uuid)}
          <span class="employee-chip">
            <span class="employee-chip__name">
              {emp.firstName}
              {emp.lastName}
            </span>
            <button
              type="button"
              class="employee-chip__remove"
              onclick={() => {
                removeEmployee(emp.uuid);
              }}
              disabled={submitting}
              aria-label="{emp.firstName} {emp.lastName} entfernen"
            >
              <i class="fas fa-times"></i>
            </button>
          </span>
        {/each}
      </div>
    {/if}

    <!-- Step 4: Documentation (only when issues found) -->
    {#if !noIssuesFound}
      <div class="form-field">
        <label
          for="exec-docs"
          class="form-field__label"
        >
          {MESSAGES.EXEC_DOCUMENTATION}
          {#if requiresDocs}
            <span class="text-(--color-danger)">*</span>
          {/if}
        </label>
        <textarea
          id="exec-docs"
          class="form-field__control form-field__control--textarea"
          placeholder={MESSAGES.EXEC_DOCUMENTATION_PH}
          bind:value={documentation}
          rows="3"
          maxlength="10000"
          disabled={submitting}
        ></textarea>
        {#if requiresDocs}
          <span class="form-field__message">
            {MESSAGES.EXEC_DOCUMENTATION_HINT}
          </span>
        {/if}
      </div>
    {/if}

    <!-- Step 5: Photo staging -->
    <div class="execution-form__photos">
      {#if stagedPhotos.length > 0}
        <div class="execution-form__photo-grid">
          {#each stagedPhotos as staged, index (staged.previewUrl)}
            <div class="execution-form__photo-thumb">
              <img
                src={staged.previewUrl}
                alt={staged.file.name}
                class="execution-form__photo-img"
              />
              <button
                type="button"
                class="execution-form__photo-remove"
                onclick={() => {
                  removePhoto(index);
                }}
                disabled={submitting}
                aria-label="Foto entfernen"
              >
                <i class="fas fa-times"></i>
              </button>
            </div>
          {/each}
        </div>
      {/if}

      {#if canAddPhoto}
        <div
          class="file-upload-zone file-upload-zone--compact execution-form__upload-zone"
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onchange={handleFileSelect}
            class="file-upload-zone__input"
            id="photo-upload"
            disabled={submitting}
          />
          <label
            for="photo-upload"
            class="file-upload-zone__label"
          >
            <div class="file-upload-zone__icon">
              <i class="fas fa-camera"></i>
            </div>
            <div class="file-upload-zone__text">
              <p class="file-upload-zone__title">{MESSAGES.PHOTO_ADD}</p>
              <p class="file-upload-zone__subtitle">
                {MESSAGES.PHOTO_MAX_SIZE} · {stagedPhotos.length} / {MAX_PHOTOS}
              </p>
            </div>
          </label>
        </div>
      {:else if stagedPhotos.length >= MAX_PHOTOS}
        <span class="text-xs text-(--color-text-muted) italic">
          {MESSAGES.PHOTO_MAX_REACHED}
        </span>
      {/if}

      {#if photoError !== null}
        <span class="flex items-center gap-1.5 text-sm text-(--color-danger)">
          <i class="fas fa-exclamation-circle"></i>
          {photoError}
        </span>
      {/if}
    </div>

    <!-- Error -->
    {#if error !== null}
      <span class="flex items-center gap-1.5 text-sm text-(--color-danger)">
        <i class="fas fa-exclamation-circle"></i>
        {error}
      </span>
    {/if}

    <!-- Step 6: Submit -->
    <button
      type="button"
      class="btn btn-primary execution-form__submit"
      onclick={handleSubmit}
      disabled={submitting || !isValid}
    >
      {#if submitting}
        <i class="fas fa-spinner fa-spin"></i>
        {MESSAGES.EXEC_SUBMITTING}
      {:else}
        <i class="fas fa-check"></i>
        {MESSAGES.EXEC_SUBMIT}
      {/if}
    </button>
  {/if}
</div>

<style>
  .execution-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .execution-form__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
  }

  .execution-form__date {
    width: fit-content;
  }

  .execution-form__success {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-success);
    padding: 0.5rem 0.75rem;
    background: color-mix(in srgb, var(--color-success) 8%, transparent);
    border-radius: var(--radius-md);
  }


  .execution-form__no-issues {
    padding: 0.5rem 0.75rem;
    width: fit-content;
  }

  /* Row layout for duration + staff */
  .execution-form__row {
    display: flex;
    gap: 0.75rem;
  }

  .execution-form__half {
    flex: 1;
    min-width: 0;
  }

  .execution-form__input-suffix {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .execution-form__input-suffix .form-field__control {
    flex: 1;
  }

  .execution-form__suffix {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  .execution-form__soll {
    font-weight: 400;
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  /* Photo staging */
  .execution-form__photos {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .execution-form__upload-zone {
    max-width: 600px;
    width: 100%;
    align-self: center;
    margin-bottom: 0.75rem;
  }

  .execution-form__photo-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .execution-form__photo-thumb {
    position: relative;
    width: 72px;
    height: 72px;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--color-glass-border);
  }

  .execution-form__photo-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .execution-form__photo-remove {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-full, 9999px);
    background: rgb(0 0 0 / 60%);
    color: #fff;
    font-size: 0.625rem;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .execution-form__photo-remove:hover {
    background: var(--color-danger);
  }

  .execution-form__submit {
    align-self: center;
  }

  /* Employee Search */
  .employee-search {
    position: relative;
  }

  .employee-search__no-results {
    padding: 0.5rem 0.75rem;
    font-size: 0.813rem;
    color: var(--color-text-muted);
    font-style: italic;
  }

  /* Selected Employee Chips */
  .employee-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .employee-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
    border-radius: var(--radius-full, 9999px);
    font-size: 0.75rem;
    color: var(--color-text-primary);
  }

  .employee-chip__name {
    font-weight: 500;
  }

  .employee-chip__remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border: none;
    border-radius: var(--radius-full, 9999px);
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 0.625rem;
    transition: color 0.15s ease;
  }

  .employee-chip__remove:hover:not(:disabled) {
    color: var(--color-danger);
  }

  /* Defects Section */
  .defects-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
    background: color-mix(in srgb, var(--color-warning) 5%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-warning) 20%, transparent);
    border-radius: var(--radius-md);
  }

  .defects-section__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.813rem;
    font-weight: 600;
    color: var(--color-warning);
    margin: 0;
  }

  .defect-entry {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.625rem;
    background: var(--color-glass-bg);
    border: 1px solid var(--color-glass-border);
    border-radius: var(--radius-sm);
  }

  .defect-entry__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .defect-entry__number {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .defect-entry__remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 0.75rem;
    transition:
      color 0.15s ease,
      background 0.15s ease;
  }

  .defect-entry__remove:hover:not(:disabled) {
    color: var(--color-danger);
    background: color-mix(in srgb, var(--color-danger) 10%, transparent);
  }

  .defects-section__add {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.813rem;
    font-weight: 500;
    color: var(--color-primary);
    background: transparent;
    border: 1px dashed color-mix(in srgb, var(--color-primary) 40%, transparent);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease;
  }

  .defects-section__add:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-primary) 8%, transparent);
    border-color: var(--color-primary);
  }

  .defects-section__add:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
