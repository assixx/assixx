<script lang="ts">
  /**
   * Edit Category Modal Component
   * @module kvp-categories/EditCategoryModal
   *
   * Allows editing of custom KVP categories with color picker and icon selection.
   * Modal is destroyed/recreated on each open — no prop sync needed.
   */
  import ColorPicker from 'svelte-awesome-color-picker';

  import { invalidateAll } from '$app/navigation';

  import { onClickOutsideDropdown } from '$lib/actions/click-outside';
  import { showErrorAlert, showSuccessAlert } from '$lib/stores/toast';
  import { createLogger } from '$lib/utils/logger';

  import { updateCustomCategory } from './api';
  import { MESSAGES, ICON_OPTIONS } from './constants';

  const log = createLogger('EditCategoryModal');

  // =============================================================================
  // PROPS
  // =============================================================================

  interface Props {
    categoryId: number;
    categoryName: string;
    categoryColor: string;
    categoryIcon: string;
    categoryDescription: string | null;
    onclose: () => void;
  }

  const {
    categoryId,
    categoryName,
    categoryColor,
    categoryIcon,
    categoryDescription,
    onclose,
  }: Props = $props();

  // =============================================================================
  // UI STATE
  // =============================================================================

  // Local form state — init with defaults, sync from props via $effect
  // (modal is destroyed/recreated on each open, so this runs once effectively)
  let editName = $state('');
  let editColor = $state('#000000');
  let editIcon = $state('folder');
  let editDescription = $state('');
  let isUpdating = $state(false);
  let dropdownOpen = $state(false);

  // Sync props → local state (same pattern as TeamFormModal)
  $effect(() => {
    editName = categoryName;
    editColor = categoryColor;
    editIcon = categoryIcon;
    editDescription = categoryDescription ?? '';
  });

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  const selectedIconLabel = $derived(
    ICON_OPTIONS.find((o) => o.value === editIcon)?.label ?? 'Icon wählen',
  );

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  function handleOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onclose();
  }

  async function handleFormSubmit(e: Event): Promise<void> {
    e.preventDefault();
    if (editName.trim() === '') return;
    isUpdating = true;

    try {
      const ok = await updateCustomCategory(categoryId, {
        name: editName.trim(),
        color: editColor,
        icon: editIcon,
        description:
          editDescription.trim() !== '' ? editDescription.trim() : undefined,
      });

      if (ok) {
        showSuccessAlert(MESSAGES.UPDATE_SUCCESS);
        onclose();
        await invalidateAll();
      } else {
        showErrorAlert(MESSAGES.UPDATE_ERROR);
      }
    } catch (err: unknown) {
      log.error({ err }, 'Error updating custom category');
      showErrorAlert(MESSAGES.UPDATE_ERROR);
    } finally {
      isUpdating = false;
    }
  }

  function toggleIconDropdown(e: MouseEvent): void {
    e.stopPropagation();
    dropdownOpen = !dropdownOpen;
  }

  function selectIcon(value: string): void {
    editIcon = value;
    dropdownOpen = false;
  }

  // =============================================================================
  // CLICK-OUTSIDE HANDLER (capture phase — works inside modals)
  // =============================================================================

  $effect(() => {
    return onClickOutsideDropdown(() => {
      dropdownOpen = false;
    });
  });
</script>

<div
  id="kvp-category-edit-modal"
  class="modal-overlay modal-overlay--active"
  role="dialog"
  aria-modal="true"
  aria-labelledby="edit-category-modal-title"
  tabindex="-1"
  onclick={handleOverlayClick}
  onkeydown={(e) => {
    if (e.key === 'Escape') onclose();
  }}
>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <form
    class="ds-modal"
    onclick={(e) => {
      e.stopPropagation();
    }}
    onkeydown={(e) => {
      e.stopPropagation();
    }}
    onsubmit={(e) => void handleFormSubmit(e)}
  >
    <div class="ds-modal__header">
      <h3
        class="ds-modal__title"
        id="edit-category-modal-title"
      >
        <i class="fas fa-edit mr-2"></i>
        Kategorie bearbeiten
      </h3>
      <button
        type="button"
        class="ds-modal__close"
        aria-label="Schließen"
        onclick={onclose}
      >
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="ds-modal__body">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div class="form-field">
          <label
            class="form-field__label"
            for="editCatName"
          >
            Name <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="editCatName"
            name="name"
            class="form-field__control"
            placeholder="z.B. Digitalisierung"
            maxlength="50"
            required
            bind:value={editName}
          />
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="editCatColor"
          >
            Farbe <span class="text-red-500">*</span>
          </label>
          <div class="color-picker-wrapper">
            <ColorPicker
              bind:hex={editColor}
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
              >{editColor}</span
            >
          </div>
        </div>

        <div class="form-field">
          <span class="form-field__label">
            Icon <span class="text-red-500">*</span>
          </span>
          <div class="dropdown mt-2">
            <button
              type="button"
              class="dropdown__trigger"
              class:active={dropdownOpen}
              onclick={toggleIconDropdown}
            >
              <span>
                <i
                  class="fas fa-{editIcon} mr-2"
                  style="color: {editColor}"
                ></i>
                {selectedIconLabel}
              </span>
              <i class="fas fa-chevron-down"></i>
            </button>
            <div
              class="dropdown__menu"
              class:active={dropdownOpen}
            >
              {#each ICON_OPTIONS as opt (opt.value)}
                <button
                  type="button"
                  class="dropdown__option"
                  class:selected={editIcon === opt.value}
                  onclick={() => {
                    selectIcon(opt.value);
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
              class="fas fa-{editIcon} text-lg"
              style="color: {editColor}"
            ></i>
            <span class="ml-2 text-sm">Vorschau</span>
          </div>
        </div>

        <div class="form-field">
          <label
            class="form-field__label"
            for="editCatDescription"
          >
            Beschreibung
          </label>
          <textarea
            id="editCatDescription"
            name="description"
            class="form-field__control"
            placeholder="Optionale Beschreibung..."
            rows="2"
            maxlength="500"
            bind:value={editDescription}
          ></textarea>
        </div>
      </div>
    </div>
    <div class="ds-modal__footer">
      <button
        type="button"
        class="btn btn-cancel"
        onclick={onclose}
      >
        Abbrechen
      </button>
      <button
        type="submit"
        class="btn btn-primary"
        disabled={isUpdating}
      >
        {#if isUpdating}
          <span class="spinner-ring spinner-ring--sm mr-2"></span>
          Speichern...
        {:else}
          <i class="fas fa-save mr-1"></i>
          Speichern
        {/if}
      </button>
    </div>
  </form>
</div>

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
