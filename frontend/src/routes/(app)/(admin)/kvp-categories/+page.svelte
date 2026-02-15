<script lang="ts">
  import ColorPicker from 'svelte-awesome-color-picker';

  import { invalidateAll } from '$app/navigation';

  import { onClickOutsideDropdown } from '$lib/actions/click-outside';
  import {
    showSuccessAlert,
    showErrorAlert,
    showWarningAlert,
  } from '$lib/utils';
  import { createLogger } from '$lib/utils/logger';

  import {
    upsertOverride,
    deleteOverride,
    createCustomCategory,
    deleteCustomCategory,
  } from './_lib/api';
  import { LABELS, MESSAGES, ICON_OPTIONS } from './_lib/constants';

  import type { CustomizableDefault } from './_lib/types';

  const log = createLogger('KvpCategoriesPage');

  interface PageData {
    categories: {
      defaults: CustomizableDefault[];
      custom: {
        id: number;
        name: string;
        description: string | null;
        color: string;
        icon: string;
      }[];
      totalCount: number;
      maxAllowed: number;
      remainingSlots: number;
    } | null;
    error: string | null;
  }

  const { data }: { data: PageData } = $props();

  // Override editing state: map categoryId -> edited custom name
  let overrideEdits = $state<Record<number, string>>({});
  let isSaving = $state(false);

  // New category form state
  let showNewForm = $state(false);
  let newName = $state('');
  let newColor = $state('#8e44ad');
  let newIcon = $state('lightbulb');
  let newDescription = $state('');
  let isCreating = $state(false);

  // Dropdown state
  let activeDropdown = $state<string | null>(null);

  function toggleDropdown(name: string): void {
    activeDropdown = activeDropdown === name ? null : name;
  }

  /** Display label for selected icon */
  const selectedIconLabel = $derived(
    ICON_OPTIONS.find((o) => o.value === newIcon)?.label ?? 'Icon wählen',
  );

  // Close dropdowns on outside click
  $effect(() => {
    return onClickOutsideDropdown(() => {
      activeDropdown = null;
    });
  });

  // Delete confirmation modal state
  let showDeleteModal = $state(false);
  let deleteTarget = $state<{ id: number; name: string } | null>(null);

  // Reset override confirmation modal state
  let showResetModal = $state(false);
  let resetTarget = $state<{ categoryId: number; name: string } | null>(null);

  // Initialize override edits from server data
  $effect(() => {
    if (data.categories !== null) {
      const edits: Record<number, string> = {};
      for (const d of data.categories.defaults) {
        edits[d.id] = d.customName ?? '';
      }
      overrideEdits = edits;
    }
  });

  function hasUnsavedChanges(): boolean {
    if (data.categories === null) return false;
    return data.categories.defaults.some((d) => {
      const current = overrideEdits[d.id] ?? '';
      const original = d.customName ?? '';
      return current !== original;
    });
  }

  /** Apply a single override change (reset or upsert) */
  async function applyOverrideChange(
    d: CustomizableDefault,
    current: string,
  ): Promise<boolean> {
    if (current === '' && d.isCustomized) {
      const ok = await deleteOverride(d.id);
      if (!ok) {
        showErrorAlert(`Fehler beim Zurücksetzen von "${d.defaultName}"`);
      }
      return ok;
    }
    if (current !== '') {
      const ok = await upsertOverride(d.id, current);
      if (!ok) {
        showErrorAlert(`Fehler beim Speichern von "${d.defaultName}"`);
      }
      return ok;
    }
    return false;
  }

  async function handleSaveOverrides(): Promise<void> {
    if (data.categories === null) return;
    isSaving = true;

    try {
      let changeCount = 0;
      for (const d of data.categories.defaults) {
        const current = (overrideEdits[d.id] ?? '').trim();
        const original = d.customName ?? '';
        if (current === original) continue;

        const ok = await applyOverrideChange(d, current);
        if (ok) changeCount++;
      }

      if (changeCount > 0) {
        showSuccessAlert(MESSAGES.SAVE_SUCCESS);
        await invalidateAll();
      }
    } catch (err) {
      log.error({ err }, 'Error saving overrides');
      showErrorAlert(MESSAGES.SAVE_ERROR);
    } finally {
      isSaving = false;
    }
  }

  /** Open reset confirmation modal */
  function requestResetOverride(categoryId: number, name: string): void {
    resetTarget = { categoryId, name };
    showResetModal = true;
  }

  /** Execute reset after modal confirmation */
  async function confirmResetOverride(): Promise<void> {
    if (resetTarget === null) return;
    showResetModal = false;
    const { categoryId } = resetTarget;
    resetTarget = null;

    const ok = await deleteOverride(categoryId);
    if (ok) {
      showSuccessAlert(MESSAGES.RESET_SUCCESS);
      await invalidateAll();
    } else {
      showErrorAlert(MESSAGES.SAVE_ERROR);
    }
  }

  function resetNewForm(): void {
    newName = '';
    newColor = '#8e44ad';
    newIcon = 'lightbulb';
    newDescription = '';
    showNewForm = false;
  }

  async function handleCreateCustom(): Promise<void> {
    if (newName.trim() === '') {
      showWarningAlert('Bitte geben Sie einen Namen ein');
      return;
    }
    isCreating = true;

    try {
      const result = await createCustomCategory({
        name: newName.trim(),
        color: newColor,
        icon: newIcon,
        description:
          newDescription.trim() !== '' ? newDescription.trim() : undefined,
      });

      if (result !== null) {
        showSuccessAlert(MESSAGES.CREATE_SUCCESS);
        resetNewForm();
        await invalidateAll();
      } else {
        showErrorAlert(MESSAGES.CREATE_ERROR);
      }
    } catch (err) {
      log.error({ err }, 'Error creating custom category');
      showErrorAlert(MESSAGES.CREATE_ERROR);
    } finally {
      isCreating = false;
    }
  }

  /** Open delete confirmation modal */
  function requestDeleteCustom(id: number, name: string): void {
    deleteTarget = { id, name };
    showDeleteModal = true;
  }

  /** Execute delete after modal confirmation */
  async function confirmDeleteCustom(): Promise<void> {
    if (deleteTarget === null) return;
    showDeleteModal = false;
    const { id } = deleteTarget;
    deleteTarget = null;

    const ok = await deleteCustomCategory(id);
    if (ok) {
      showSuccessAlert(MESSAGES.DELETE_SUCCESS);
      await invalidateAll();
    } else {
      showErrorAlert(MESSAGES.DELETE_ERROR);
    }
  }
</script>

<svelte:head>
  <title>Definitionen - Assixx</title>
</svelte:head>

<div class="container">
  {#if data.error !== null}
    <div class="card">
      <div class="card__body">
        <div class="p-6 text-center">
          <i
            class="fas fa-exclamation-triangle mb-4 text-4xl text-(--color-danger)"
          ></i>
          <p class="text-(--color-text-secondary)">{data.error}</p>
          <button
            type="button"
            class="btn btn-primary mt-4"
            onclick={() => void invalidateAll()}>Erneut versuchen</button
          >
        </div>
      </div>
    </div>
  {:else if data.categories !== null}
    <!-- Card 1: Override Default Categories -->
    <div class="card mb-6">
      <div class="card__header">
        <h2 class="card__title">
          <i class="fas fa-edit mr-2"></i>
          {LABELS.SECTION_DEFAULTS}
        </h2>
        <p class="mt-2 text-(--color-text-secondary)">
          {LABELS.PAGE_DESCRIPTION}
        </p>
      </div>
      <div class="card__body">
        <div class="table-responsive">
          <table class="data-table data-table--hover data-table--striped">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">{LABELS.COL_DEFAULT}</th>
                <th scope="col">{LABELS.COL_CUSTOM_NAME}</th>
                <th scope="col">{LABELS.COL_ACTION}</th>
              </tr>
            </thead>
            <tbody>
              {#each data.categories.defaults as defaultCat, i (defaultCat.id)}
                <tr>
                  <td>{i + 1}</td>
                  <td>
                    <div class="flex items-center gap-2">
                      <span
                        class="inline-block h-3 w-3 rounded-full"
                        style="background-color: {defaultCat.color}"
                      ></span>
                      <span class="font-medium">{defaultCat.defaultName}</span>
                    </div>
                  </td>
                  <td>
                    <input
                      type="text"
                      class="form-field__control"
                      placeholder={defaultCat.defaultName}
                      maxlength="50"
                      bind:value={overrideEdits[defaultCat.id]}
                    />
                  </td>
                  <td>
                    {#if defaultCat.isCustomized}
                      <button
                        type="button"
                        class="action-icon action-icon--delete"
                        title={LABELS.BTN_RESET}
                        aria-label="Zurücksetzen"
                        onclick={() => {
                          requestResetOverride(
                            defaultCat.id,
                            defaultCat.defaultName,
                          );
                        }}
                      >
                        <i class="fas fa-undo"></i>
                      </button>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <div class="mt-4">
          <button
            type="button"
            class="btn btn-primary"
            disabled={isSaving || !hasUnsavedChanges()}
            onclick={handleSaveOverrides}
          >
            {#if isSaving}
              <span class="spinner-ring spinner-ring--sm"></span>
              Speichern...
            {:else}
              <i class="fas fa-save"></i>
              {LABELS.BTN_SAVE}
            {/if}
          </button>
        </div>
      </div>
    </div>

    <!-- Card 2: Custom Categories -->
    <div class="card">
      <div class="card__header">
        <h2 class="card__title">
          <i class="fas fa-tags mr-2"></i>
          {LABELS.SECTION_CUSTOM}
        </h2>
        <p class="mt-2 text-(--color-text-secondary)">
          <span class="badge badge--info">
            {LABELS.remaining(data.categories.remainingSlots)}
          </span>
          <span class="badge ml-2">
            {LABELS.counter(
              data.categories.totalCount,
              data.categories.maxAllowed,
            )}
          </span>
        </p>
      </div>
      <div class="card__body">
        {#if data.categories.custom.length > 0}
          <div class="table-responsive">
            <table class="data-table data-table--hover data-table--striped">
              <thead>
                <tr>
                  <th scope="col">{LABELS.COL_NAME}</th>
                  <th scope="col">{LABELS.COL_COLOR}</th>
                  <th scope="col">{LABELS.COL_ICON}</th>
                  <th scope="col">{LABELS.COL_ACTION}</th>
                </tr>
              </thead>
              <tbody>
                {#each data.categories.custom as cat (cat.id)}
                  <tr>
                    <td>
                      <span class="font-medium">{cat.name}</span>
                    </td>
                    <td>
                      <div class="flex items-center gap-2">
                        <span
                          class="inline-block h-4 w-4 rounded-full border border-gray-400"
                          style="background-color: {cat.color}"
                        ></span>
                        <span class="text-sm text-(--color-text-secondary)"
                          >{cat.color}</span
                        >
                      </div>
                    </td>
                    <td>
                      <i class="fas fa-{cat.icon}"></i>
                    </td>
                    <td>
                      <button
                        type="button"
                        class="action-icon action-icon--delete"
                        title={LABELS.BTN_DELETE}
                        aria-label="Kategorie Löschen"
                        onclick={() => {
                          requestDeleteCustom(cat.id, cat.name);
                        }}
                      >
                        <i class="fas fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <div class="empty-state">
            <div class="empty-state__icon">
              <i class="fas fa-tags"></i>
            </div>
            <h3 class="empty-state__title">Keine eigenen Kategorien</h3>
            <p class="empty-state__description">
              Noch keine eigenen Kategorien erstellt.
            </p>
          </div>
        {/if}

        {#if data.categories.remainingSlots > 0}
          {#if showNewForm}
            <div class="card card--compact card--no-margin mt-4">
              <div class="card__header">
                <h3 class="card__title">
                  <i class="fas fa-plus-circle mr-2"></i>
                  Neue Kategorie
                </h3>
              </div>
              <div class="card__body">
                <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div class="form-field">
                    <label
                      class="form-field__label form-field__label--required"
                      for="newCatName"
                    >
                      Name
                    </label>
                    <input
                      type="text"
                      id="newCatName"
                      class="form-field__control"
                      placeholder="z.B. Digitalisierung"
                      maxlength="50"
                      bind:value={newName}
                    />
                  </div>

                  <div class="form-field">
                    <label
                      class="form-field__label form-field__label--required"
                      for="newCatColor"
                    >
                      Farbe
                    </label>
                    <div class="color-picker-wrapper">
                      <ColorPicker
                        bind:hex={newColor}
                        label=""
                        isAlpha={false}
                        position="responsive"
                        --picker-height="150px"
                        --picker-width="150px"
                        --slider-width="150px"
                        --focus-color="var(--color-primary, #2196f3)"
                        --cp-bg-color="var(--color-gray-900, #212121)"
                        --cp-border-color="var(--color-border, #616161)"
                        --cp-text-color="var(--color-text-primary, #fff)"
                        --cp-input-color="var(--color-gray-800, #424242)"
                        --cp-button-hover-color="var(--color-gray-700, #616161)"
                        --picker-z-index="1060"
                      />
                      <span class="text-sm text-(--color-text-secondary)"
                        >{newColor}</span
                      >
                    </div>
                  </div>

                  <div class="form-field">
                    <span class="form-field__label form-field__label--required">
                      Icon
                    </span>
                    <div
                      class="dropdown mt-2"
                      data-dropdown="icon"
                    >
                      <button
                        type="button"
                        class="dropdown__trigger"
                        class:active={activeDropdown === 'icon'}
                        onclick={() => {
                          toggleDropdown('icon');
                        }}
                      >
                        <span>
                          <i
                            class="fas fa-{newIcon} mr-2"
                            style="color: {newColor}"
                          ></i>
                          {selectedIconLabel}
                        </span>
                        <i class="fas fa-chevron-down"></i>
                      </button>
                      <div
                        class="dropdown__menu"
                        class:active={activeDropdown === 'icon'}
                      >
                        {#each ICON_OPTIONS as opt (opt.value)}
                          <button
                            type="button"
                            class="dropdown__option"
                            class:selected={newIcon === opt.value}
                            onclick={() => {
                              newIcon = opt.value;
                              activeDropdown = null;
                            }}
                          >
                            <i class="fas fa-{opt.value} mr-2"></i>
                            {opt.label}
                          </button>
                        {/each}
                      </div>
                    </div>
                    <div class="mt-2">
                      <i
                        class="fas fa-{newIcon} text-lg"
                        style="color: {newColor}"
                      ></i>
                      <span class="ml-2 text-sm">Vorschau</span>
                    </div>
                  </div>

                  <div class="form-field">
                    <label
                      class="form-field__label"
                      for="newCatDescription"
                    >
                      Beschreibung
                    </label>
                    <textarea
                      id="newCatDescription"
                      class="form-field__control"
                      placeholder="Optionale Beschreibung..."
                      rows="2"
                      maxlength="500"
                      bind:value={newDescription}
                    ></textarea>
                  </div>
                </div>
              </div>
              <div class="card__footer flex gap-2">
                <button
                  type="button"
                  class="btn btn-primary"
                  disabled={isCreating || newName.trim() === ''}
                  onclick={handleCreateCustom}
                >
                  {#if isCreating}
                    <span class="spinner-ring spinner-ring--sm"></span>
                    Erstellen...
                  {:else}
                    <i class="fas fa-plus"></i>
                    Erstellen
                  {/if}
                </button>
                <button
                  type="button"
                  class="btn btn-cancel"
                  onclick={() => {
                    showNewForm = false;
                  }}
                >
                  Abbrechen
                </button>
              </div>
            </div>
          {/if}
        {:else}
          <div class="alert alert--warning mt-4">
            <span class="alert__icon">
              <i class="fas fa-exclamation-triangle"></i>
            </span>
            <p class="alert__content">{MESSAGES.LIMIT_REACHED}</p>
          </div>
        {/if}
      </div>
    </div>

    {#if data.categories.remainingSlots > 0 && !showNewForm}
      <button
        type="button"
        class="btn-float"
        aria-label="Neue Kategorie"
        onclick={() => {
          showNewForm = true;
        }}
      >
        <i class="fas fa-plus"></i>
      </button>
    {/if}
  {/if}
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteModal && deleteTarget !== null}
  <div class="modal-overlay modal-overlay--active">
    <div class="confirm-modal confirm-modal--danger">
      <div class="confirm-modal__icon">
        <i class="fas fa-trash-alt"></i>
      </div>
      <h3 class="confirm-modal__title">Kategorie Löschen</h3>
      <p class="confirm-modal__message">
        {MESSAGES.DELETE_CONFIRM}<br />
        <strong>"{deleteTarget.name}"</strong>
      </p>
      <div class="confirm-modal__actions confirm-modal__actions--centered">
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--cancel confirm-modal__btn--wide"
          onclick={() => {
            showDeleteModal = false;
            deleteTarget = null;
          }}
        >
          Abbrechen
        </button>
        <button
          type="button"
          class="btn btn-danger confirm-modal__btn--wide"
          onclick={() => void confirmDeleteCustom()}
        >
          <i class="fas fa-trash"></i>
          Löschen
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Reset Override Confirmation Modal -->
{#if showResetModal && resetTarget !== null}
  <div class="modal-overlay modal-overlay--active">
    <div class="confirm-modal confirm-modal--warning">
      <div class="confirm-modal__icon">
        <i class="fas fa-undo"></i>
      </div>
      <h3 class="confirm-modal__title">Bezeichnung zurücksetzen</h3>
      <p class="confirm-modal__message">
        Die eigene Bezeichnung für <strong>"{resetTarget.name}"</strong> wird entfernt
        und der Standard-Name wiederhergestellt.
      </p>
      <div class="confirm-modal__actions confirm-modal__actions--centered">
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--cancel confirm-modal__btn--wide"
          onclick={() => {
            showResetModal = false;
            resetTarget = null;
          }}
        >
          Abbrechen
        </button>
        <button
          type="button"
          class="btn btn-warning confirm-modal__btn--wide"
          onclick={() => void confirmResetOverride()}
        >
          <i class="fas fa-undo"></i>
          Zurücksetzen
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Hide the alpha-grid overlay on the color circle (alpha is disabled) */
  .color-picker-wrapper :global(.alpha) {
    display: none;
  }

  /* Hue slider thumb: no fill, only border for position indicator */
  .color-picker-wrapper :global(.h),
  .color-picker-wrapper :global(.a) {
    --thumb-background: transparent;
    --thumb-border: 2px solid var(--color-text-primary, #fff);
  }
</style>
