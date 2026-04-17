<!--
  BugReportForm.svelte — /versioninfo page component.

  Posts multipart/form-data to `/api/v2/feedback/bug-report` via the shared
  `apiClient.upload()` (handles JWT header + refresh). All client-side
  validation mirrors the backend Zod schema so users get instant feedback;
  the backend is still the source of truth.

  Design-system classes: form-field, btn, choice-card, etc.
  Toasts: `$lib/utils/alerts` (central notification surface).
-->
<script lang="ts">
  import { showErrorAlert, showSuccessAlert } from '$lib/utils/alerts';
  import { apiClient, ApiError } from '$lib/utils/api-client';

  /**
   * Categories exposed to users. `value` is the Zod enum code sent to the API;
   * `label` is the German display text. Must stay in sync with
   * `BUG_REPORT_CATEGORIES` in `backend/src/nest/feedback/dto/bug-report.dto.ts`.
   */
  const CATEGORIES = [
    { value: 'ui', label: 'UI-Fehler (Layout, Darstellung, Klick ohne Wirkung)' },
    { value: 'backend', label: 'Backend-Fehler (Server-Absturz, 500er)' },
    { value: 'performance', label: 'Performance (Seite lädt langsam, hängt)' },
    { value: 'permission', label: 'Berechtigung (unerwarteter 403, fehlender Button)' },
    { value: 'data', label: 'Daten-Fehler (falsche oder fehlende Anzeige)' },
    { value: 'feature-request', label: 'Feature-Wunsch / Verbesserungsvorschlag' },
    { value: 'other', label: 'Sonstiges' },
  ] as const;

  // Client-side limits mirror backend Zod schema + controller caps so invalid
  // submissions fail locally without a round-trip. Backend stays the source of truth.
  const MAX_TITLE = 120;
  const MAX_URL = 500;
  const MAX_DESCRIPTION = 5000;
  const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
  const MAX_SCREENSHOTS = 3;
  const ALLOWED_SCREENSHOT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

  // Category starts empty — the user must actively pick one. A pre-selected
  // 'ui' default would bias triage (users submit without reading the options).
  type CategoryValue = (typeof CATEGORIES)[number]['value'] | '';

  /** Single screenshot with its object-URL preview, bundled so we can free the
   *  URL together with the File when the user removes it. */
  interface ScreenshotItem {
    file: File;
    preview: string;
  }

  let title = $state('');
  let category = $state<CategoryValue>('');
  let url = $state('');
  let description = $state('');
  let screenshots = $state<ScreenshotItem[]>([]);
  let submitting = $state(false);

  // Ref to the hidden native <input type="file">. The visible trigger is the
  // styled upload-box (mirrors the KVP/Blackboard modal pattern — clickable
  // dashed card is more discoverable than an OS-native file button).
  let fileInput: HTMLInputElement | undefined = $state();

  function openFilePicker(): void {
    fileInput?.click();
  }

  const titleValid = $derived(title.trim().length >= 3 && title.length <= MAX_TITLE);
  const categoryValid = $derived(category !== '');
  const urlValid = $derived(url.trim().length >= 1 && url.length <= MAX_URL);
  const descriptionValid = $derived(
    description.trim().length >= 10 && description.length <= MAX_DESCRIPTION,
  );
  const canSubmit = $derived(
    titleValid && categoryValid && urlValid && descriptionValid && !submitting,
  );

  function onScreenshotChange(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const files = Array.from(input.files ?? []);

    for (const file of files) {
      if (screenshots.length >= MAX_SCREENSHOTS) {
        showErrorAlert(`Maximal ${MAX_SCREENSHOTS} Bilder pro Meldung.`);
        break;
      }
      if (!ALLOWED_SCREENSHOT_TYPES.includes(file.type)) {
        showErrorAlert(`„${file.name}" ist kein unterstütztes Bildformat.`);
        continue;
      }
      if (file.size > MAX_SCREENSHOT_BYTES) {
        showErrorAlert(`„${file.name}" ist größer als 5 MB.`);
        continue;
      }
      screenshots = [...screenshots, { file, preview: URL.createObjectURL(file) }];
    }

    // Clear input so selecting the same file again re-triggers onchange.
    input.value = '';
  }

  function removeScreenshot(index: number): void {
    // `.at()` always returns `T | undefined` — reliable across tsconfig
    // variants with or without noUncheckedIndexedAccess.
    const item = screenshots.at(index);
    screenshots = screenshots.filter((_: ScreenshotItem, i: number): boolean => i !== index);
    if (item !== undefined) URL.revokeObjectURL(item.preview);
  }

  function clearAllScreenshots(): void {
    for (const item of screenshots) URL.revokeObjectURL(item.preview);
    screenshots = [];
  }

  function resetForm(): void {
    title = '';
    category = '';
    url = '';
    description = '';
    clearAllScreenshots();
  }

  async function handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (!canSubmit) return;

    submitting = true;
    try {
      const fd = new FormData();
      fd.set('title', title.trim());
      fd.set('category', category);
      fd.set('url', url.trim());
      fd.set('description', description.trim());
      // Field name must match FilesInterceptor('screenshots', ...) in the
      // backend controller. `append` (not `set`) so all 1–3 files are sent.
      for (const item of screenshots) {
        fd.append('screenshots', item.file);
      }

      // apiClient prepends `/api/v2` automatically — pass only the sub-path.
      await apiClient.upload('/feedback/bug-report', fd);

      showSuccessAlert('Danke für deine Rückmeldung — wir kümmern uns darum.');
      resetForm();
    } catch (error: unknown) {
      const message =
        error instanceof ApiError ? error.message
        : error instanceof Error ? error.message
        : 'Unbekannter Fehler beim Senden.';
      showErrorAlert(`Senden fehlgeschlagen: ${message}`);
    } finally {
      submitting = false;
    }
  }
</script>

<form
  class="bug-report-form"
  onsubmit={handleSubmit}
  enctype="multipart/form-data"
>
  <!-- Title -->
  <div class="form-field">
    <label
      for="bug-title"
      class="form-field__label"
    >
      Titel
      <span class="form-field__required">*</span>
    </label>
    <input
      id="bug-title"
      class="form-field__control"
      class:is-error={title.length > 0 && !titleValid}
      type="text"
      bind:value={title}
      maxlength={MAX_TITLE}
      placeholder="Kurze Zusammenfassung, z. B. „Speichern-Button im Kalender ohne Wirkung“"
      required
    />
    <p class="form-field__message">
      {title.length} / {MAX_TITLE} Zeichen (mindestens 3)
    </p>
  </div>

  <!-- Category -->
  <div class="form-field">
    <label
      for="bug-category"
      class="form-field__label"
    >
      Kategorie
      <span class="form-field__required">*</span>
    </label>
    <select
      id="bug-category"
      class="form-field__control"
      bind:value={category}
      required
    >
      <!-- Empty placeholder option — disabled so it can't be re-selected after
           a real choice, and `value=""` keeps our Zod guard (categoryValid) simple. -->
      <option
        value=""
        disabled
      >
        Bitte Kategorie auswählen
      </option>
      {#each CATEGORIES as opt (opt.value)}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    </select>
  </div>

  <!-- URL — user types the full page URL where the bug occurred. -->
  <div class="form-field">
    <label
      for="bug-url"
      class="form-field__label"
    >
      Wo ist der Fehler aufgetreten? URL
      <span class="form-field__required">*</span>
    </label>
    <input
      id="bug-url"
      class="form-field__control"
      class:is-error={url.length > 0 && !urlValid}
      type="text"
      bind:value={url}
      maxlength={MAX_URL}
      placeholder="/calendar"
      required
    />
  </div>

  <!-- Description -->
  <div class="form-field">
    <label
      for="bug-description"
      class="form-field__label"
    >
      Beschreibung
      <span class="form-field__required">*</span>
    </label>
    <textarea
      id="bug-description"
      class="form-field__control bug-description"
      class:is-error={description.length > 0 && !descriptionValid}
      bind:value={description}
      maxlength={MAX_DESCRIPTION}
      rows="6"
      placeholder="Was ist passiert? Was hast du erwartet? Schritte zum Reproduzieren?"
      required
    ></textarea>
    <p class="form-field__message">
      {description.length} / {MAX_DESCRIPTION} Zeichen (mindestens 10)
    </p>
  </div>

  <!-- Screenshots — up to 3 images, styled after the KVP/Blackboard upload
       pattern (hidden native input + clickable dashed upload-box + thumbnail
       preview with remove buttons). The upload-box stays visible until the
       user has picked the max; then it disappears until an image is removed. -->
  <div class="form-field">
    <label
      for="bug-screenshots"
      class="form-field__label"
    >
      Screenshots (optional)
      <span class="form-field__hint">
        Max. {MAX_SCREENSHOTS} Bilder, je max. 5 MB — PNG, JPEG, WEBP oder GIF
      </span>
    </label>
    <div class="mt-2">
      <input
        type="file"
        id="bug-screenshots"
        name="screenshots"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        hidden
        bind:this={fileInput}
        onchange={onScreenshotChange}
      />

      {#if screenshots.length < MAX_SCREENSHOTS}
        <div
          class="upload-box"
          role="button"
          tabindex="0"
          onclick={openFilePicker}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openFilePicker();
            }
          }}
        >
          <i class="fas fa-camera"></i>
          <p>Klicke hier, um Screenshots auszuwählen</p>
          <p class="mt-2 text-sm text-gray-400">
            oder ziehe Dateien hierher · noch
            {MAX_SCREENSHOTS - screenshots.length} möglich
          </p>
        </div>
      {/if}

      {#if screenshots.length > 0}
        <div class="mt-4 flex flex-wrap gap-2">
          {#each screenshots as item, index (item.preview)}
            <div class="photo-preview-item">
              <img
                src={item.preview}
                alt="Screenshot {index + 1}"
              />
              <button
                type="button"
                class="remove-photo"
                aria-label="Screenshot entfernen"
                onclick={() => {
                  removeScreenshot(index);
                }}
              >
                ×
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Submit -->
  <div class="form-actions">
    <button
      type="submit"
      class="btn btn-primary"
      disabled={!canSubmit}
    >
      {#if submitting}
        <i class="fas fa-spinner fa-spin"></i>
        Wird gesendet…
      {:else}
        <i class="fas fa-paper-plane"></i>
        Bug-Report senden
      {/if}
    </button>
  </div>
</form>

<style>
  .bug-report-form {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .bug-description {
    resize: vertical;
    min-height: 140px;
    font-family: inherit;
    line-height: 1.5;
  }

  /* Upload-Box + Preview — ported from KvpCreateModal for visual consistency
     with other file-upload surfaces (KVP, Blackboard). Single-file variant,
     the thumbnail replaces the drop zone once a file is picked. */
  .upload-box {
    cursor: pointer;

    padding: var(--spacing-8);

    border: 2px dashed var(--color-glass-border-hover);
    border-radius: var(--radius-xl);
    background: var(--glass-bg);

    text-align: center;
  }

  .upload-box:hover,
  .upload-box:focus-visible {
    border-color: var(--primary-color);
    background: var(--glass-bg-active);
    outline: none;
  }

  .upload-box i {
    margin-bottom: var(--spacing-4);
    color: var(--text-muted);
    font-size: 2.5rem;
  }

  .upload-box p {
    margin: 0;
    color: var(--color-text-secondary);
  }

  .photo-preview-item {
    position: relative;

    overflow: hidden;

    border-radius: var(--radius-xl);
    background: var(--glass-bg-active);

    width: 100px;
    height: 100px;
  }

  .photo-preview-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .photo-preview-item .remove-photo {
    display: flex;
    position: absolute;
    top: 4px;
    right: 4px;

    justify-content: center;
    align-items: center;

    cursor: pointer;

    border: none;
    border-radius: 50%;
    background: color-mix(in oklch, var(--color-danger) 90%, transparent);

    width: 24px;
    height: 24px;

    color: var(--color-white);
    font-size: 0.9rem;
  }

  .photo-preview-item .remove-photo:hover {
    background: var(--color-danger);
    transform: scale(1.1);
  }

  .form-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;

    margin-top: 8px;
  }
</style>
