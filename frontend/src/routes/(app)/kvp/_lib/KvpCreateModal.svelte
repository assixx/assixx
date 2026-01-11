<script lang="ts">
  import { showWarningAlert, showErrorAlert, showSuccessAlert } from '$lib/utils';

  import { createSuggestion, uploadPhotos } from './api';
  import { PRIORITY_OPTIONS, UPLOAD_CONFIG } from './constants';
  import { kvpState } from './state.svelte';
  import { validatePhotoFile, readFileAsDataUrl } from './utils';

  import type { KvpFormData, KvpPriority } from './types';

  interface Props {
    currentTeamId: number | null;
    onclose: () => void;
    onsuccess: () => void;
  }

  const { currentTeamId, onclose, onsuccess }: Props = $props();

  // Photo state
  let photoPreviews = $state<string[]>([]);
  let selectedPhotos = $state<File[]>([]);

  // Dropdown state
  let activeDropdown = $state<string | null>(null);
  let formCategoryDisplay = $state('Bitte waehlen');
  let formCategoryValue = $state('');
  let formPriorityDisplay = $state('Normal');
  let formPriorityValue = $state<KvpPriority>('normal');

  // Form refs
  let formElement: HTMLFormElement | undefined = $state();
  let fileInput: HTMLInputElement | undefined = $state();

  function toggleDropdown(dropdownId: string) {
    activeDropdown = activeDropdown === dropdownId ? null : dropdownId;
  }

  function closeAllDropdowns() {
    activeDropdown = null;
  }

  function handleFormCategorySelect(value: string, label: string, icon?: string) {
    formCategoryValue = value;
    formCategoryDisplay = icon !== undefined ? `${icon} ${label}` : label;
    closeAllDropdowns();
  }

  function handleFormPrioritySelect(value: string, label: string) {
    formPriorityValue = value as KvpPriority;
    formPriorityDisplay = label;
    closeAllDropdowns();
  }

  function handleDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown')) {
      closeAllDropdowns();
    }
  }

  function handlePhotoClick() {
    fileInput?.click();
  }

  async function handlePhotoSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = Array.from(target.files ?? []);

    for (const file of files) {
      if (selectedPhotos.length >= UPLOAD_CONFIG.MAX_FILES) {
        showWarningAlert(`Sie koennen maximal ${UPLOAD_CONFIG.MAX_FILES} Fotos hochladen.`);
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
      } catch {
        console.error('[KVP] Error reading file for preview');
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
    formCategoryDisplay = 'Bitte waehlen';
    formCategoryValue = '';
    formPriorityDisplay = 'Normal';
    formPriorityValue = 'normal';
    formElement?.reset();
    onclose();
  }

  interface OrgInfo {
    orgLevel: 'team' | 'company';
    orgId: number;
  }

  function determineOrgInfo(): OrgInfo {
    const isEmployee = kvpState.effectiveRole === 'employee';
    const isAdminOrRoot = kvpState.effectiveRole === 'admin' || kvpState.effectiveRole === 'root';

    if (isEmployee && currentTeamId !== null) {
      return { orgLevel: 'team', orgId: currentTeamId };
    }
    if (isAdminOrRoot) {
      return { orgLevel: 'company', orgId: kvpState.currentUser?.tenantId ?? 0 };
    }
    return { orgLevel: 'team', orgId: 0 };
  }

  function buildFormPayload(
    title: string,
    description: string,
    expectedBenefit: string,
  ): KvpFormData {
    const { orgLevel, orgId } = determineOrgInfo();
    const categoryId = formCategoryValue !== '' ? parseInt(formCategoryValue, 10) : null;

    return {
      title: title.trim(),
      description: description.trim(),
      categoryId,
      priority: formPriorityValue,
      expectedBenefit: expectedBenefit !== '' ? expectedBenefit : undefined,
      orgLevel,
      orgId,
      departmentId: kvpState.currentUser?.departmentId ?? null,
    };
  }

  async function handlePhotoUpload(suggestionId: number): Promise<void> {
    if (selectedPhotos.length === 0) return;

    const uploadResult = await uploadPhotos(suggestionId, selectedPhotos);
    if (!uploadResult.success) {
      const errorMsg = uploadResult.error ?? 'Unbekannter Fehler';
      showWarningAlert(`Vorschlag erstellt, aber Fotos fehlgeschlagen: ${errorMsg}`);
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
      showWarningAlert('Bitte fuellen Sie Titel und Beschreibung aus');
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
    } catch (error) {
      console.error('[KVP] Error creating suggestion:', error);
      showErrorAlert('Fehler beim Erstellen des Vorschlags');
    } finally {
      kvpState.setSubmitting(false);
    }
  }
</script>

<svelte:document onclick={handleDocumentClick} />

<div class="modal-overlay modal-overlay--active">
  <form class="ds-modal ds-modal--lg" bind:this={formElement} onsubmit={handleSubmit}>
    <div class="ds-modal__header">
      <h3 class="ds-modal__title">Neuer KVP-Vorschlag</h3>
      <button type="button" class="ds-modal__close" aria-label="Schliessen" onclick={handleClose}>
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
            Nach dem Einreichen koennen Sie Ihren Vorschlag nicht mehr bearbeiten oder Löschen.
            Bitte pruefen Sie alle Angaben sorgfaeltig, bevor Sie den Vorschlag absenden.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="form-field">
          <label class="form-field__label" for="kvpTitle">
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
          <label class="form-field__label" for="kvpDescription">
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
          <label class="form-field__label" for="kvpCategoryValue">
            Kategorie
            <span class="text-red-500">*</span>
          </label>
          <div class="dropdown" data-dropdown="kvpCategory">
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
              <span>{formCategoryDisplay}</span>
              <i class="fas fa-chevron-down"></i>
            </div>
            <div class="dropdown__menu" class:active={activeDropdown === 'kvpCategory'}>
              {#each kvpState.categories as category (category.id)}
                <div
                  class="dropdown__option"
                  role="button"
                  tabindex="0"
                  onclick={() => {
                    handleFormCategorySelect(category.id.toString(), category.name, category.icon);
                  }}
                  onkeydown={(e) => {
                    if (e.key === 'Enter') {
                      handleFormCategorySelect(
                        category.id.toString(),
                        category.name,
                        category.icon,
                      );
                    }
                  }}
                >
                  {category.icon ?? '💡'}
                  {category.name}
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

        <div class="form-field">
          <label class="form-field__label" for="kvpPriorityValue">Prioritaet</label>
          <div class="dropdown" data-dropdown="kvpPriority">
            <div
              class="dropdown__trigger"
              class:active={activeDropdown === 'kvpPriority'}
              role="button"
              tabindex="0"
              onclick={() => {
                toggleDropdown('kvpPriority');
              }}
              onkeydown={(e) => {
                if (e.key === 'Enter') toggleDropdown('kvpPriority');
              }}
            >
              <span>{formPriorityDisplay}</span>
              <i class="fas fa-chevron-down"></i>
            </div>
            <div class="dropdown__menu" class:active={activeDropdown === 'kvpPriority'}>
              {#each PRIORITY_OPTIONS as option (option.value)}
                <div
                  class="dropdown__option"
                  role="button"
                  tabindex="0"
                  onclick={() => {
                    handleFormPrioritySelect(option.value, option.label);
                  }}
                  onkeydown={(e) => {
                    if (e.key === 'Enter') handleFormPrioritySelect(option.value, option.label);
                  }}
                >
                  {option.label}
                </div>
              {/each}
            </div>
            <input type="hidden" id="kvpPriorityValue" name="priority" value={formPriorityValue} />
          </div>
        </div>

        <div class="form-field md:col-span-2">
          <label class="form-field__label" for="kvpBenefit">Erwarteter Nutzen</label>
          <textarea
            id="kvpBenefit"
            name="expected_benefit"
            class="form-field__control"
            placeholder="Welche Vorteile bringt dieser Vorschlag?"
            rows="3"
          ></textarea>
        </div>

        <div class="form-field md:col-span-2">
          <label class="form-field__label" for="kvpPhotos">
            Fotos hinzufuegen (optional)
            <span class="form-field__hint">Max. 5 Fotos, je max. 10MB, nur JPG/PNG</span>
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
              <p>Klicken Sie hier, um Fotos auszuwaehlen</p>
              <p class="text-sm text-gray-400 mt-2">oder ziehen Sie Dateien hierher</p>
            </div>
            <div class="flex flex-wrap gap-2 mt-6">
              {#each photoPreviews as preview, index (index)}
                <div class="photo-preview-item">
                  <img src={preview} alt="Vorschau" />
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
      <button type="button" class="btn btn-cancel" onclick={handleClose}>Abbrechen</button>
      <button type="submit" class="btn btn-modal" disabled={kvpState.isSubmitting}>
        {#if kvpState.isSubmitting}
          <i class="fas fa-spinner fa-spin"></i>
          Wird eingereicht...
        {:else}
          <i class="fas fa-save"></i>
          Vorschlag einreichen
        {/if}
      </button>
    </div>
  </form>
</div>
