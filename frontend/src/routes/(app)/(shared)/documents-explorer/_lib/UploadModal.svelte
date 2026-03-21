<script lang="ts">
  import { UPLOAD_CATEGORY_OPTIONS, CATEGORY_MAPPINGS, MESSAGES } from './constants';
  import { formatFileSize, validateFile, getFileTypeDisplayInfo } from './utils';

  import type { UploadData } from './types';

  interface Props {
    show: boolean;
    onclose: () => void;
    onsubmit: (data: UploadData) => void;
  }

  const { show, onclose, onsubmit }: Props = $props();

  // Form State
  let uploadFile = $state<File | null>(null);
  let uploadCategory = $state('');
  let uploadDocName = $state('');
  let uploadDescription = $state('');
  let uploadTags = $state('');
  let uploadSalaryYear = $state<number>(new Date().getFullYear());
  let uploadSalaryMonth = $state<number>(new Date().getMonth() + 1);
  const uploadSubmitting = false; // Progress not tracked internally, upload happens in parent
  let uploadProgress = $state(0);
  let categoryDropdownOpen = $state(false);

  const requiresPayrollPeriod = $derived(
    uploadCategory in CATEGORY_MAPPINGS &&
      CATEGORY_MAPPINGS[uploadCategory].requiresPayrollPeriod === true,
  );

  function handleClose() {
    resetForm();
    onclose();
  }

  function resetForm() {
    uploadFile = null;
    uploadCategory = '';
    uploadDocName = '';
    uploadDescription = '';
    uploadTags = '';
    uploadSalaryYear = new Date().getFullYear();
    uploadSalaryMonth = new Date().getMonth() + 1;
    uploadProgress = 0;
    categoryDropdownOpen = false;
  }

  function handleFileDrop(e: DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (file) handleFileSelected(file);
  }

  function handleFileInputChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) handleFileSelected(file);
  }

  function handleFileSelected(file: File) {
    const validation = validateFile(file);
    if (!validation.valid) {
      // Use window alert for simplicity in component
      alert(validation.error ?? MESSAGES.UPLOAD_INVALID_TYPE);
      return;
    }
    uploadFile = file;
    if (!uploadDocName) {
      uploadDocName = file.name.replace(/\.[^/.]+$/, '');
    }
  }

  function clearFileSelection() {
    uploadFile = null;
  }

  function selectCategory(category: string) {
    uploadCategory = category;
    categoryDropdownOpen = false;
  }

  function handleSubmit() {
    if (!uploadFile) return;
    onsubmit({
      file: uploadFile,
      category: uploadCategory,
      docName: uploadDocName,
      description: uploadDescription,
      tags: uploadTags,
      salaryYear: uploadSalaryYear,
      salaryMonth: uploadSalaryMonth,
    });
  }

  // Reset form state every time modal opens (ensures clean slate after upload)
  $effect(() => {
    if (show) {
      resetForm();
    }
  });

  // Outside click handler
  $effect(() => {
    if (categoryDropdownOpen) {
      const handleOutsideClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const el = document.getElementById('upload-category-dropdown');
        if (el && !el.contains(target)) categoryDropdownOpen = false;
      };
      document.addEventListener('click', handleOutsideClick, true);
      return () => {
        document.removeEventListener('click', handleOutsideClick, true);
      };
    }
  });
</script>

{#if show}
  <div
    id="upload-modal"
    class="modal-overlay modal-overlay--active"
  >
    <form
      id="upload-form"
      class="ds-modal ds-modal--lg"
      onsubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">{MESSAGES.UPLOAD_TITLE}</h3>
        <button
          type="button"
          class="ds-modal__close"
          onclick={handleClose}
          aria-label="Schließen"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body">
        <div id="upload-form-container">
          <!-- Upload Dropzone -->
          <div
            id="upload-dropzone"
            class="file-upload-zone"
            role="button"
            tabindex="0"
            ondragover={(e) => {
              e.preventDefault();
            }}
            ondrop={handleFileDrop}
            onclick={() => document.getElementById('file-input')?.click()}
            onkeydown={(e) => e.key === 'Enter' && document.getElementById('file-input')?.click()}
          >
            <input
              type="file"
              class="file-upload-zone__input"
              id="file-input"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png"
              onchange={handleFileInputChange}
            />
            <label
              for="file-input"
              class="file-upload-zone__label"
            >
              <div class="file-upload-zone__icon">
                <i class="fas fa-cloud-upload-alt"></i>
              </div>
              <div class="file-upload-zone__text">
                <p class="file-upload-zone__title">Datei hier ablegen oder klicken zum Auswählen</p>
                <p class="file-upload-zone__subtitle">PDF, Word, Excel, JPG, PNG</p>
              </div>
            </label>
            <p class="file-upload-zone__helper">
              Erlaubt: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG • Max. 10 MB
            </p>
          </div>

          <!-- Selected File Display -->
          {#if uploadFile}
            {@const extension = uploadFile.name.split('.').pop()?.toLowerCase() ?? ''}
            {@const displayInfo = getFileTypeDisplayInfo(uploadFile.type, extension)}
            <div
              id="selected-file"
              class="file-upload-list file-upload-list--compact"
            >
              <div class="file-upload-item">
                <div
                  id="file-preview"
                  class="file-upload-item__preview {displayInfo.cssClass}"
                >
                  <i
                    id="file-icon"
                    class={displayInfo.iconClass}
                  ></i>
                </div>
                <div class="file-upload-item__info">
                  <div
                    id="file-name"
                    class="file-upload-item__name"
                  >
                    {uploadFile.name}
                  </div>
                  <div
                    id="file-size"
                    class="file-upload-item__meta"
                  >
                    {formatFileSize(uploadFile.size)}
                  </div>
                </div>
                <button
                  type="button"
                  id="remove-file"
                  class="file-upload-item__remove"
                  aria-label="Datei entfernen"
                  onclick={clearFileSelection}
                >
                  <i class="fas fa-times"></i>
                </button>
              </div>
            </div>
          {/if}

          <!-- Upload Progress -->
          {#if uploadSubmitting}
            <div
              id="upload-progress"
              class="rounded-lg border border-(--color-border) bg-(--background-secondary) p-4"
            >
              <div class="mb-2 flex items-center justify-between">
                <span class="text-sm text-(--color-text-primary)">Hochladen...</span>
                <span
                  id="progress-text"
                  class="text-sm text-(--color-text-secondary)">{uploadProgress}%</span
                >
              </div>
              <div class="progress h-2">
                <div
                  id="progress-bar"
                  class="progress__bar"
                  style="width: {uploadProgress}%"
                ></div>
              </div>
            </div>
          {/if}

          <!-- Category Selection -->
          <div class="form-field">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="form-field__label form-field__label--required">Kategorie</label>
            <div
              class="dropdown w-full"
              id="upload-category-dropdown"
            >
              <button
                type="button"
                class="dropdown__trigger w-full gap-2"
                onclick={(e) => {
                  e.stopPropagation();
                  categoryDropdownOpen = !categoryDropdownOpen;
                }}
              >
                <span class="flex items-center gap-2">
                  <i class="fas fa-folder"></i>
                  <span>
                    {#if uploadCategory}
                      {UPLOAD_CATEGORY_OPTIONS.find((o) => o.value === uploadCategory)?.label ??
                        MESSAGES.UPLOAD_CATEGORY_PLACEHOLDER}
                    {:else}
                      {MESSAGES.UPLOAD_CATEGORY_PLACEHOLDER}
                    {/if}
                  </span>
                </span>
                <i class="fas fa-chevron-down"></i>
              </button>
              <div
                class="dropdown__menu"
                class:active={categoryDropdownOpen}
              >
                {#each UPLOAD_CATEGORY_OPTIONS as opt (opt.value)}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    class="dropdown__option"
                    onclick={() => {
                      selectCategory(opt.value);
                    }}
                  >
                    <i class={opt.icon}></i>
                    {opt.label}
                  </div>
                {/each}
              </div>
            </div>
            <input
              type="hidden"
              name="category"
              value={uploadCategory}
              required
            />
          </div>

          <!-- Document Name -->
          <div class="form-field">
            <label
              class="form-field__label form-field__label--required"
              for="doc-name">Dokumentname</label
            >
            <input
              type="text"
              id="doc-name"
              name="name"
              class="form-field__control"
              placeholder="z.B. Arbeitsvertrag 2025"
              bind:value={uploadDocName}
              required
            />
            <small class="form-field__message">Der Name wird in der Dokumentenliste angezeigt</small
            >
          </div>

          <!-- Description -->
          <div class="form-field">
            <label
              class="form-field__label"
              for="doc-description">Beschreibung</label
            >
            <textarea
              id="doc-description"
              name="description"
              class="form-field__control"
              rows="3"
              placeholder="Optionale Beschreibung des Dokuments..."
              bind:value={uploadDescription}
            ></textarea>
          </div>

          <!-- Payroll Fields -->
          {#if requiresPayrollPeriod}
            <div
              class="form-field"
              id="payroll-fields"
            >
              <!-- svelte-ignore a11y_label_has_associated_control -->
              <label class="form-field__label form-field__label--required"
                >Zeitraum für Gehaltsabrechnung</label
              >
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label
                    class="form-field__label text-sm"
                    for="salary-year">Jahr</label
                  >
                  <select
                    id="salary-year"
                    name="salary_year"
                    class="form-field__control"
                    bind:value={uploadSalaryYear}
                  >
                    {#each Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i) as year (year)}
                      <option value={year}>{year}</option>
                    {/each}
                  </select>
                </div>
                <div>
                  <label
                    class="form-field__label text-sm"
                    for="salary-month">Monat</label
                  >
                  <select
                    id="salary-month"
                    name="salary_month"
                    class="form-field__control"
                    bind:value={uploadSalaryMonth}
                  >
                    <option value={1}>Januar</option>
                    <option value={2}>Februar</option>
                    <option value={3}>März</option>
                    <option value={4}>April</option>
                    <option value={5}>Mai</option>
                    <option value={6}>Juni</option>
                    <option value={7}>Juli</option>
                    <option value={8}>August</option>
                    <option value={9}>September</option>
                    <option value={10}>Oktober</option>
                    <option value={11}>November</option>
                    <option value={12}>Dezember</option>
                  </select>
                </div>
              </div>
              <small class="form-field__message">Wird nur für Gehaltsabrechnungen benötigt</small>
            </div>
          {/if}

          <!-- Tags -->
          <div class="form-field">
            <label
              class="form-field__label"
              for="doc-tags">Tags</label
            >
            <input
              type="text"
              id="doc-tags"
              name="tags"
              class="form-field__control"
              placeholder="z.B. vertrag, 2025, personal (kommagetrennt)"
              bind:value={uploadTags}
            />
            <small class="form-field__message">Tags helfen beim späteren Suchen und Filtern</small>
          </div>
        </div>
      </div>
      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={handleClose}>{MESSAGES.UPLOAD_CANCEL}</button
        >
        <button
          type="submit"
          class="btn btn-primary"
          disabled={uploadSubmitting}
        >
          <i class="fas fa-cloud-upload-alt mr-2"></i>
          Hochladen
        </button>
      </div>
    </form>
  </div>
{/if}
