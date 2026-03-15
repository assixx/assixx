<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';

  import { onClickOutsideDropdown } from '$lib/actions/click-outside';
  import {
    DEFAULT_HIERARCHY_LABELS,
    type HierarchyLabels,
  } from '$lib/types/hierarchy-labels';
  import {
    showWarningAlert,
    showErrorAlert,
    showSuccessAlert,
  } from '$lib/utils';
  import { createLogger } from '$lib/utils/logger';

  const log = createLogger('KvpCreateModal');

  import { createSuggestion, uploadPhotos } from './api';
  import { UPLOAD_CONFIG } from './constants';
  import { kvpState } from './state.svelte';
  import { validatePhotoFile, readFileAsDataUrl, isFaIcon } from './utils';

  import type { KvpFormData, UserTeamWithAssets } from './types';

  interface Props {
    userOrganizations: UserTeamWithAssets[];
    onclose: () => void;
    onsuccess: () => void;
    labels?: HierarchyLabels;
  }

  const {
    userOrganizations,
    onclose,
    onsuccess,
    labels = DEFAULT_HIERARCHY_LABELS,
  }: Props = $props();

  // Photo state
  let photoPreviews = $state<string[]>([]);
  let selectedPhotos = $state<File[]>([]);

  // Dropdown state
  let activeDropdown = $state<string | null>(null);
  let formCategoryDisplay = $state('Bitte wählen');
  let formCategoryIcon = $state<string | undefined>(undefined);
  let formCategoryColor = $state<string | undefined>(undefined);
  let formCategoryValue = $state('');

  // Team/Asset selection state
  let selectedTeamIds = $state<number[]>([]);
  let selectedAssetIds = $state<number[]>([]);

  /** All assets from all user teams (deduplicated) */
  const allAssets = $derived.by(() => {
    const seen = new SvelteSet<number>();
    const assets: { id: number; name: string }[] = [];
    for (const team of userOrganizations) {
      for (const asset of team.assets) {
        if (!seen.has(asset.id)) {
          seen.add(asset.id);
          assets.push(asset);
        }
      }
    }
    return assets;
  });

  /** Show asset select only when no team is selected */
  const showAssetSelect = $derived(
    selectedTeamIds.length === 0 && allAssets.length > 0,
  );

  /** Validation: at least 1 team or 1 asset */
  const hasOrgSelection = $derived(
    selectedTeamIds.length > 0 || selectedAssetIds.length > 0,
  );

  // Form refs
  let formElement: HTMLFormElement | undefined = $state();
  let fileInput: HTMLInputElement | undefined = $state();

  function toggleDropdown(dropdownId: string) {
    activeDropdown = activeDropdown === dropdownId ? null : dropdownId;
  }

  function closeAllDropdowns() {
    activeDropdown = null;
  }

  function handleFormCategorySelect(
    id: number,
    source: 'global' | 'custom',
    label: string,
    icon?: string,
    color?: string,
  ) {
    formCategoryValue = `${source}:${id}`;
    formCategoryIcon = icon;
    formCategoryColor = color;
    formCategoryDisplay = label;
    closeAllDropdowns();
  }

  function handleTeamChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    selectedTeamIds = Array.from(select.selectedOptions).map((o) =>
      Number(o.value),
    );
    // Clear assets when teams are selected
    if (selectedTeamIds.length > 0) {
      selectedAssetIds = [];
    }
  }

  function handleAssetChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    selectedAssetIds = Array.from(select.selectedOptions).map((o) =>
      Number(o.value),
    );
  }

  // Capture-phase click-outside: works inside modals (bypasses stopPropagation)
  $effect(() => {
    return onClickOutsideDropdown(closeAllDropdowns);
  });

  function handlePhotoClick() {
    fileInput?.click();
  }

  async function handlePhotoSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = Array.from(target.files ?? []);

    for (const file of files) {
      if (selectedPhotos.length >= UPLOAD_CONFIG.MAX_FILES) {
        showWarningAlert(
          `Sie können maximal ${UPLOAD_CONFIG.MAX_FILES} Fotos hochladen.`,
        );
        break;
      }

      const validation = validatePhotoFile(file);
      if (!validation.valid) {
        showErrorAlert(validation.error ?? 'Ungueltige Datei');
        continue;
      }

      selectedPhotos = [...selectedPhotos, file];

      try {
        const dataUrl = await readFileAsDataUrl(file);
        photoPreviews = [...photoPreviews, dataUrl];
      } catch (err: unknown) {
        log.error({ err }, 'Error reading file for preview');
      }
    }

    target.value = '';
  }

  function handleRemovePhoto(index: number) {
    selectedPhotos = selectedPhotos.filter((_, i) => i !== index);
    photoPreviews = photoPreviews.filter((_, i) => i !== index);
  }

  function handleClose() {
    photoPreviews = [];
    selectedPhotos = [];
    selectedTeamIds = [];
    selectedAssetIds = [];
    formCategoryDisplay = 'Bitte wählen';
    formCategoryIcon = undefined;
    formCategoryColor = undefined;
    formCategoryValue = '';
    formElement?.reset();
    onclose();
  }

  function buildFormPayload(
    title: string,
    description: string,
    expectedBenefit: string,
  ): KvpFormData {
    let categoryId: number | null = null;
    let customCategoryId: number | null = null;

    if (formCategoryValue !== '') {
      const [source, idStr] = formCategoryValue.split(':');
      const id = parseInt(idStr, 10);
      if (source === 'global') {
        categoryId = id;
      } else {
        customCategoryId = id;
      }
    }

    return {
      title: title.trim(),
      description: description.trim(),
      categoryId,
      customCategoryId,
      expectedBenefit: expectedBenefit !== '' ? expectedBenefit : undefined,
      teamIds: selectedTeamIds,
      assetIds: selectedAssetIds,
      departmentId: kvpState.currentUser?.departmentId ?? null,
    };
  }

  async function handlePhotoUpload(suggestionId: number): Promise<void> {
    if (selectedPhotos.length === 0) return;

    const uploadResult = await uploadPhotos(suggestionId, selectedPhotos);
    if (!uploadResult.success) {
      const errorMsg = uploadResult.error ?? 'Unbekannter Fehler';
      showWarningAlert(
        `Vorschlag erstellt, aber Fotos fehlgeschlagen: ${errorMsg}`,
      );
    }
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();

    if (formElement === undefined) return;

    const formData = new FormData(formElement);
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const expectedBenefit = formData.get('expected_benefit') as string;

    if (title === '' || description === '') {
      showWarningAlert('Bitte füllen Sie Titel und Beschreibung aus');
      return;
    }

    if (!hasOrgSelection) {
      showWarningAlert(
        `Bitte wählen Sie mindestens ein ${labels.team} oder eine ${labels.asset} aus`,
      );
      return;
    }

    const data = buildFormPayload(title, description, expectedBenefit);
    kvpState.setSubmitting(true);

    try {
      const result = await createSuggestion(data);

      if (!result.success) {
        showErrorAlert(result.error ?? 'Fehler beim Erstellen des Vorschlags');
        return;
      }

      if (result.id !== undefined) {
        await handlePhotoUpload(result.id);
      }

      showSuccessAlert('Vorschlag wurde erfolgreich eingereicht');
      handleClose();
      onsuccess();
    } catch (err: unknown) {
      log.error({ err }, 'Error creating suggestion');
      showErrorAlert('Fehler beim Erstellen des Vorschlags');
    } finally {
      kvpState.setSubmitting(false);
    }
  }
</script>

<div
  id="kvp-create-modal"
  class="modal-overlay modal-overlay--active"
>
  <form
    class="ds-modal ds-modal--lg"
    bind:this={formElement}
    onsubmit={handleSubmit}
  >
    <div class="ds-modal__header">
      <h3 class="ds-modal__title">Neuer KVP-Vorschlag</h3>
      <button
        type="button"
        class="ds-modal__close"
        aria-label="Schließen"
        onclick={handleClose}
      >
        <i class="fas fa-times"></i>
      </button>
    </div>

    <div class="ds-modal__body">
      <div class="alert alert--warning mb-6">
        <div class="alert__icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <div class="alert__content">
          <strong class="alert__title">Wichtiger Hinweis:</strong>
          <p class="alert__message">
            Nach dem Einreichen können Sie Ihren Vorschlag nicht mehr bearbeiten
            oder löschen. Bitte prüfen Sie alle Angaben sorgfältig, bevor Sie
            den Vorschlag absenden. KVP-Vorschläge können vom Vorgesetzten
            firmenweit oder abteilungsübergreifend geteilt werden..
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div class="form-field">
          <label
            class="form-field__label"
            for="kvpTitle"
          >
            Titel
            <span class="text-red-500">*</span>
            <span class="form-field__hint">(3-255 Zeichen)</span>
          </label>
          <input
            type="text"
            id="kvpTitle"
            name="title"
            class="form-field__control"
            placeholder="Kurze, praegnante Beschreibung"
            required
            minlength="3"
            maxlength="255"
          />
        </div>

        <div class="form-field md:col-span-2">
          <label
            class="form-field__label"
            for="kvpDescription"
          >
            Beschreibung
            <span class="text-red-500">*</span>
            <span class="form-field__hint">(10-5000 Zeichen)</span>
          </label>
          <textarea
            id="kvpDescription"
            name="description"
            class="form-field__control"
            placeholder="Detaillierte Beschreibung des Vorschlags..."
            rows="4"
            required
            minlength="10"
            maxlength="5000"
          ></textarea>
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="kvpCategoryValue"
          >
            Kategorie
            <span class="text-red-500">*</span>
          </label>
          <div
            class="dropdown"
            data-dropdown="kvpCategory"
          >
            <div
              class="dropdown__trigger"
              class:active={activeDropdown === 'kvpCategory'}
              role="button"
              tabindex="0"
              onclick={() => {
                toggleDropdown('kvpCategory');
              }}
              onkeydown={(e) => {
                if (e.key === 'Enter') toggleDropdown('kvpCategory');
              }}
            >
              <span>
                {#if formCategoryIcon !== undefined && isFaIcon(formCategoryIcon)}
                  <i
                    class="fas fa-{formCategoryIcon}"
                    style:color={formCategoryColor}
                    style:margin-right="0"
                  ></i>
                {:else if formCategoryIcon !== undefined}
                  {formCategoryIcon}
                {/if}
                {formCategoryDisplay}
              </span>
              <i class="fas fa-chevron-down"></i>
            </div>
            <div
              class="dropdown__menu"
              class:active={activeDropdown === 'kvpCategory'}
            >
              {#each kvpState.categories as category (`${category.source}:${String(category.id)}`)}
                <div
                  class="dropdown__option"
                  role="button"
                  tabindex="0"
                  onclick={() => {
                    handleFormCategorySelect(
                      category.id,
                      category.source,
                      category.name,
                      category.icon,
                      category.color,
                    );
                  }}
                  onkeydown={(e) => {
                    if (e.key === 'Enter') {
                      handleFormCategorySelect(
                        category.id,
                        category.source,
                        category.name,
                        category.icon,
                        category.color,
                      );
                    }
                  }}
                >
                  <span>
                    {#if category.icon !== undefined && isFaIcon(category.icon)}
                      <i
                        class="fas fa-{category.icon}"
                        style:color={category.color}
                        style:margin-right="0"
                      ></i>
                    {:else}
                      {category.icon ?? '💡'}
                    {/if}
                    {category.name}
                  </span>
                </div>
              {/each}
            </div>
            <input
              type="hidden"
              id="kvpCategoryValue"
              name="category_id"
              value={formCategoryValue}
            />
          </div>
        </div>

        <!-- Team Selection -->
        <div
          class="form-field"
          class:md:col-span-2={!showAssetSelect}
        >
          <label
            class="form-field__label"
            for="kvpTeamSelect"
          >
            Team(s) zuweisen
            <span class="text-red-500">*</span>
            <span class="form-field__hint"
              >(Max. 3, Strg+Klick für Mehrfachauswahl)</span
            >
          </label>
          <select
            id="kvpTeamSelect"
            multiple
            class="multi-select"
            value={selectedTeamIds}
            onchange={handleTeamChange}
          >
            {#each userOrganizations as team (team.teamId)}
              <option value={team.teamId}>
                {team.teamName}
              </option>
            {/each}
          </select>
        </div>

        <!-- Asset Selection (only when no team selected) -->
        {#if showAssetSelect}
          <div class="form-field">
            <label
              class="form-field__label"
              for="kvpAssetSelect"
            >
              {labels.asset} zuweisen
              <span class="text-red-500">*</span>
              <span class="form-field__hint"
                >(Strg+Klick für Mehrfachauswahl)</span
              >
            </label>
            <select
              id="kvpAssetSelect"
              multiple
              class="multi-select"
              value={selectedAssetIds}
              onchange={handleAssetChange}
            >
              {#each allAssets as asset (asset.id)}
                <option value={asset.id}>
                  {asset.name}
                </option>
              {/each}
            </select>
          </div>
        {/if}

        <!-- Validation hint -->
        {#if !hasOrgSelection}
          <div class="form-field md:col-span-2">
            <p class="text-sm text-amber-400">
              <i class="fas fa-exclamation-triangle mr-1"></i>
              Bitte wählen Sie mindestens ein {labels.team} oder eine {labels.asset}
              aus.
            </p>
          </div>
        {/if}

        <div class="form-field md:col-span-2">
          <label
            class="form-field__label"
            for="kvpBenefit">Erwarteter Nutzen</label
          >
          <textarea
            id="kvpBenefit"
            name="expected_benefit"
            class="form-field__control"
            placeholder="Welche Vorteile bringt dieser Vorschlag?"
            rows="3"
            maxlength="1000"
          ></textarea>
        </div>

        <div class="form-field md:col-span-2">
          <label
            class="form-field__label"
            for="kvpPhotos"
          >
            Fotos hinzufügen (optional)
            <span class="form-field__hint"
              >Max. 5 Fotos, je max. 10MB, nur JPG/PNG</span
            >
          </label>
          <div class="mt-2">
            <input
              type="file"
              id="kvpPhotos"
              name="photos"
              accept="image/jpeg,image/jpg,image/png"
              multiple
              hidden
              bind:this={fileInput}
              onchange={handlePhotoSelect}
            />
            <div
              class="upload-box"
              role="button"
              tabindex="0"
              onclick={handlePhotoClick}
              onkeydown={(e) => {
                if (e.key === 'Enter') handlePhotoClick();
              }}
            >
              <i class="fas fa-camera"></i>
              <p>Klicken Sie hier, um Fotos auszuwählen</p>
              <p class="mt-2 text-sm text-gray-400">
                oder ziehen Sie Dateien hierher
              </p>
            </div>
            <div class="mt-6 flex flex-wrap gap-2">
              {#each photoPreviews as preview, index (index)}
                <div class="photo-preview-item">
                  <img
                    src={preview}
                    alt="Vorschau"
                  />
                  <button
                    type="button"
                    class="remove-photo"
                    onclick={() => {
                      handleRemovePhoto(index);
                    }}
                  >
                    ×
                  </button>
                </div>
              {/each}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="ds-modal__footer ds-modal__footer--right">
      <button
        type="button"
        class="btn btn-cancel"
        onclick={handleClose}>Abbrechen</button
      >
      <button
        type="submit"
        class="btn btn-primary"
        disabled={kvpState.isSubmitting}
      >
        {#if kvpState.isSubmitting}
          <span class="spinner-ring spinner-ring--sm"></span>
          Wird eingereicht...
        {:else}
          <i class="fas fa-save"></i>
          Vorschlag einreichen
        {/if}
      </button>
    </div>
  </form>
</div>

<style>
  /* Photo Upload */
  .upload-box {
    cursor: pointer;
    border: 2px dashed var(--color-glass-border-hover);
    border-radius: var(--radius-xl);
    background: var(--glass-bg);
    padding: var(--spacing-8);
    text-align: center;
  }

  .upload-box:hover {
    border-color: var(--primary-color);
    background: var(--glass-bg-active);
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
    border-radius: var(--radius-xl);
    background: var(--glass-bg-active);
    width: 100px;
    height: 100px;
    overflow: hidden;
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
    transform: scale(1.1);
    background: var(--color-danger);
  }
</style>
