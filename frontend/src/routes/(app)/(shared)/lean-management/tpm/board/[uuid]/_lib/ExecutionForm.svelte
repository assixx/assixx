<script lang="ts">
  /**
   * ExecutionForm — Form for marking a card as done.
   *
   * Fields:
   *   1. Execution date (default: today, changeable for late documentation)
   *   2. "Ohne Beanstandung" checkbox (fast path for 80% of routine maintenance)
   *   3. Actual duration + staff count (IST vs SOLL comparison)
   *   4. Documentation / remarks (optional when no issues, required when issues found)
   *   5. Photo staging (optional, max 5 per execution + max 5 per defect)
   *
   * Only shown when card status is 'red' or 'overdue'.
   */
  import { onDestroy } from 'svelte';

  import AppDatePicker from '$lib/components/AppDatePicker.svelte';
  import SearchResultUser from '$lib/components/SearchResultUser.svelte';
  import { showSuccessAlert, showErrorAlert, showWarningAlert } from '$lib/stores/toast';

  import { createExecution, uploadPhoto, uploadDefectPhoto, logApiError } from '../../../_lib/api';
  import { MESSAGES } from '../../../_lib/constants';

  import DefectSection from './DefectSection.svelte';

  import type { DefectEntry, StagedPhoto } from './execution-types';
  import type {
    CreateExecutionPayload,
    DefectPayload,
    TpmCard,
    TpmEmployee,
    TpmExecution,
    TpmTimeEstimate,
  } from '../../../_lib/types';

  const MAX_PHOTOS = 5;
  const MAX_FILE_SIZE = 5_242_880;
  const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  interface Props {
    card: TpmCard;
    timeEstimates?: TpmTimeEstimate[];
    employees?: TpmEmployee[];
    onExecutionCreated: (execution: TpmExecution) => void;
  }

  const { card, timeEstimates = [], employees = [], onExecutionCreated }: Props = $props();

  // Form state
  let executionDate = $state(new Date().toISOString().slice(0, 10));
  let noIssuesFound = $state<boolean>(true);
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
  let defectIdCounter = 1;
  function createEmptyDefect(): DefectEntry {
    return {
      id: defectIdCounter++,
      title: '',
      description: '',
      stagedPhotos: [],
    };
  }
  let defects = $state<DefectEntry[]>([createEmptyDefect()]);

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
        if (selectedEmployees.some((s: TpmEmployee) => s.uuid === e.uuid)) return false;
        const fullName = `${e.firstName} ${e.lastName}`.toLowerCase();
        const email = e.email.toLowerCase();
        const empNr = (e.employeeNumber ?? '').toLowerCase();
        return fullName.includes(term) || email.includes(term) || empNr.includes(term);
      })
      .slice(0, MAX_SEARCH_RESULTS);
  });

  function selectEmployee(employee: TpmEmployee): void {
    selectedEmployees = [...selectedEmployees, employee];
    employeeQuery = '';
    employeeSearchOpen = false;
  }

  function removeEmployee(uuid: string): void {
    selectedEmployees = selectedEmployees.filter((e: TpmEmployee) => e.uuid !== uuid);
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
    timeEstimates.find((e: TpmTimeEstimate) => e.intervalType === card.intervalType),
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
  const canExecute = $derived(card.status === 'red' || card.status === 'overdue');
  const requiresDocs = $derived(card.requiresApproval && !noIssuesFound);
  const hasValidDefects = $derived(
    noIssuesFound || defects.some((d: DefectEntry) => d.title.trim().length > 0),
  );
  const isValid = $derived(hasValidDefects && (!requiresDocs || documentation.trim().length > 0));
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
    stagedPhotos = [...stagedPhotos, { file, previewUrl: URL.createObjectURL(file) }];
    input.value = '';
  }

  function removePhoto(index: number): void {
    URL.revokeObjectURL(stagedPhotos[index].previewUrl);
    stagedPhotos = stagedPhotos.filter((_: StagedPhoto, i: number) => i !== index);
  }

  function cleanupPreviews(): void {
    for (const staged of stagedPhotos) {
      URL.revokeObjectURL(staged.previewUrl);
    }
    for (const defect of defects) {
      for (const staged of defect.stagedPhotos) {
        URL.revokeObjectURL(staged.previewUrl);
      }
    }
  }

  function parseIntOrNull(val: string): number | null {
    const n = Number.parseInt(val, 10);
    return Number.isNaN(n) || n <= 0 ? null : n;
  }

  function buildExecutionPayload(): CreateExecutionPayload {
    const validDefects: DefectPayload[] =
      noIssuesFound ?
        []
      : defects
          .filter((d: DefectEntry) => d.title.trim().length > 0)
          .map((d: DefectEntry) => ({
            title: d.title.trim(),
            description: d.description.trim().length > 0 ? d.description.trim() : null,
          }));

    return {
      cardUuid: card.uuid,
      executionDate,
      noIssuesFound,
      actualDurationMinutes: parseIntOrNull(actualDurationMinutes),
      actualStaffCount: parseIntOrNull(actualStaffCount),
      documentation: documentation.trim().length > 0 ? documentation.trim() : null,
      participantUuids:
        selectedEmployees.length > 0 ?
          selectedEmployees.map((e: TpmEmployee) => e.uuid)
        : undefined,
      defects: validDefects.length > 0 ? validDefects : undefined,
    };
  }

  /** Upload staged execution photos, return failure count */
  async function uploadStagedPhotos(executionUuid: string): Promise<number> {
    let failed = 0;
    for (const staged of stagedPhotos) {
      try {
        await uploadPhoto(executionUuid, staged.file);
      } catch (uploadErr: unknown) {
        failed++;
        logApiError('uploadPhoto', uploadErr);
      }
    }
    return failed;
  }

  /** Upload staged defect photos, return failure count */
  async function uploadStagedDefectPhotos(execution: TpmExecution): Promise<number> {
    if (noIssuesFound) return 0;
    const validDefects = defects.filter((d: DefectEntry) => d.title.trim().length > 0);
    const serverDefects = execution.defects ?? [];
    const limit = Math.min(validDefects.length, serverDefects.length);
    let failed = 0;
    for (let i = 0; i < limit; i++) {
      for (const staged of validDefects[i].stagedPhotos) {
        try {
          await uploadDefectPhoto(serverDefects[i].uuid, staged.file);
        } catch (uploadErr: unknown) {
          failed++;
          logApiError('uploadDefectPhoto', uploadErr);
        }
      }
    }
    return failed;
  }

  async function handleSubmit(): Promise<void> {
    if (!canExecute || !isValid || submitting) return;

    submitting = true;
    error = null;
    photoUploadWarning = null;

    try {
      const execution = await createExecution(buildExecutionPayload());
      const failedUploads =
        (await uploadStagedPhotos(execution.uuid)) + (await uploadStagedDefectPhotos(execution));

      cleanupPreviews();

      // eslint-disable-next-line require-atomic-updates -- Single-threaded UI; button disabled prevents concurrent calls
      submitting = false;
      completed = true;

      if (failedUploads > 0) {
        photoUploadWarning = `${String(failedUploads)} Foto(s) konnten nicht hochgeladen werden.`;
        showWarningAlert(photoUploadWarning);
      }

      showSuccessAlert(MESSAGES.EXEC_SUCCESS);
      onExecutionCreated(execution);
    } catch (err: unknown) {
      // eslint-disable-next-line require-atomic-updates -- Single-threaded UI; button disabled prevents concurrent calls
      submitting = false;
      logApiError('createExecution', err);
      showErrorAlert(MESSAGES.EXEC_ERROR);
      error = MESSAGES.EXEC_ERROR;
    }
  }

  onDestroy(cleanupPreviews);
</script>

<div class="flex flex-col gap-3">
  <h4 class="m-0 flex items-center gap-2 text-sm font-semibold text-(--color-text-primary)">
    <i class="fas fa-check-double"></i>
    {MESSAGES.EXEC_HEADING}
  </h4>

  {#if !canExecute}
    <p class="m-0 text-sm text-(--color-text-muted) italic">
      {MESSAGES.EXEC_CARD_NOT_DUE}
    </p>
  {:else if completed}
    <div
      class="flex items-center gap-2 rounded-(--radius-md) px-3 py-2 text-sm font-medium text-(--color-success)"
      style="background: color-mix(in srgb, var(--color-success) 8%, transparent)"
    >
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
    <!-- Execution Date -->
    <div class="w-fit">
      <AppDatePicker
        bind:value={executionDate}
        label={MESSAGES.EXEC_DATE}
        max={new Date().toISOString().slice(0, 10)}
        disabled={submitting}
        size="sm"
      />
    </div>

    <!-- No Issues Checkbox -->
    <label class="choice-card w-fit px-3 py-2">
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

    <!-- Defects (when issues found) -->
    {#if !noIssuesFound}
      <DefectSection
        bind:defects
        {submitting}
      />
    {/if}

    <!-- Time & Staff (optional) -->
    <div class="flex gap-3">
      <div class="form-field min-w-0 flex-1">
        <label
          for="exec-duration"
          class="form-field__label"
        >
          {MESSAGES.EXEC_DURATION}
          {#if sollDuration !== null}
            <span class="text-xs font-normal text-(--color-text-muted)">
              ({MESSAGES.EXEC_SOLL}: {sollDuration}
              {MESSAGES.EXEC_DURATION_UNIT})
            </span>
          {/if}
        </label>
        <div class="flex items-center gap-1.5">
          <input
            id="exec-duration"
            type="number"
            class="form-field__control flex-1"
            bind:value={actualDurationMinutes}
            min="1"
            max="1440"
            placeholder="—"
            disabled={submitting}
          />
          <span class="text-xs whitespace-nowrap text-(--color-text-muted)">
            {MESSAGES.EXEC_DURATION_UNIT}
          </span>
        </div>
      </div>

      <div class="form-field min-w-0 flex-1">
        <label
          for="exec-staff"
          class="form-field__label"
        >
          {MESSAGES.EXEC_STAFF}
          {#if sollStaff !== null}
            <span class="text-xs font-normal text-(--color-text-muted)">
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
        <div class="form-field min-w-0 flex-1">
          <span class="form-field__label">Beteiligte Mitarbeiter</span>
          <div
            class="search-input-wrapper relative"
            class:search-input-wrapper--open={employeeSearchOpen && employeeQuery.trim().length > 0}
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
                <div class="px-3 py-2 text-[0.813rem] text-(--color-text-muted) italic">
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
      <div class="flex flex-wrap gap-1.5">
        {#each selectedEmployees as emp (emp.uuid)}
          <span class="employee-chip">
            <span class="font-medium">
              {emp.firstName}
              {emp.lastName}
            </span>
            <button
              type="button"
              class="flex size-4 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-[0.625rem] text-(--color-text-muted) transition-colors duration-150 hover:enabled:text-(--color-danger)"
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

    <!-- Documentation (only when issues found) -->
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

    <!-- Execution Photo staging -->
    <div class="flex flex-col gap-3">
      {#if stagedPhotos.length > 0}
        <div class="flex flex-wrap gap-2">
          {#each stagedPhotos as staged, index (staged.previewUrl)}
            <div class="photo-thumb">
              <img
                src={staged.previewUrl}
                alt={staged.file.name}
                class="h-full w-full object-cover"
              />
              <button
                type="button"
                class="photo-thumb__remove"
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
          class="file-upload-zone file-upload-zone--compact mb-3 w-full max-w-[600px] self-center"
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

    <!-- Submit -->
    <button
      type="button"
      class="btn btn-primary self-center"
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
  .photo-thumb {
    position: relative;
    width: 72px;
    height: 72px;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--color-glass-border);
  }

  .photo-thumb__remove {
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
    background: color-mix(in oklch, var(--color-black) 60%, transparent);
    color: var(--color-white);
    font-size: 0.625rem;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .photo-thumb__remove:hover {
    background: var(--color-danger);
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
</style>
