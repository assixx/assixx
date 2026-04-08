<script lang="ts">
  /**
   * ListModal — Create/Edit inventory list modal
   *
   * Fields: title, description, tags (chip input), code prefix, separator,
   * digits, icon, isActive (edit only).
   *
   * Tags are managed via the TagInput component which talks to the shared
   * tagsState cache; the modal only carries the selected ID array as form
   * state.
   */
  import { FORM_STATUS_OPTIONS } from '@assixx/shared/constants';

  import { onClickOutsideDropdown } from '$lib/actions/click-outside';

  import { CODE_DIGIT_OPTIONS, DEFAULT_LIST_ICON, LIST_ICON_OPTIONS, MESSAGES } from './constants';
  import TagInput from './TagInput.svelte';
  import { getCodePreview } from './utils';

  import type { FormIsActiveStatus } from './types';

  interface Props {
    isEditMode: boolean;
    modalTitle: string;
    formTitle: string;
    formDescription: string;
    formCodePrefix: string;
    formCodeSeparator: string;
    formCodeDigits: number;
    formIcon: string;
    formIsActive: FormIsActiveStatus;
    formTagIds: string[];
    submitting: boolean;
    onclose: () => void;
    onsubmit: (data: SubmitData) => void;
  }

  export interface SubmitData {
    title: string;
    description: string;
    codePrefix: string;
    codeSeparator: string;
    codeDigits: number;
    icon: string;
    isActive: FormIsActiveStatus;
    tagIds: string[];
  }

  const {
    isEditMode,
    modalTitle,
    formTitle,
    formDescription,
    formCodePrefix,
    formCodeSeparator,
    formCodeDigits,
    formIcon,
    formIsActive,
    formTagIds,
    submitting,
    onclose,
    onsubmit,
  }: Props = $props();

  // Local form state (synced from props via $effect)
  let localTitle = $state('');
  let localDescription = $state('');
  let localCodePrefix = $state('');
  let localCodeSeparator = $state('-');
  let localCodeDigits = $state(3);
  let localIcon = $state(DEFAULT_LIST_ICON);
  let localIsActive = $state<FormIsActiveStatus>(1);
  let localTagIds = $state<string[]>([]);

  // Dropdown state (KVP-style — single source of truth for all dropdowns)
  let activeDropdown = $state<string | null>(null);

  function toggleDropdown(id: string): void {
    activeDropdown = activeDropdown === id ? null : id;
  }

  function closeAllDropdowns(): void {
    activeDropdown = null;
  }

  const digitsLabel = $derived(
    CODE_DIGIT_OPTIONS.find((opt) => opt.value === localCodeDigits)?.label ?? '',
  );
  const statusLabel = $derived(
    FORM_STATUS_OPTIONS.find((opt) => opt.value === localIsActive)?.label ?? '',
  );

  $effect(() => onClickOutsideDropdown(closeAllDropdowns));

  // Sync props to local state
  $effect(() => {
    localTitle = formTitle;
    localDescription = formDescription;
    localCodePrefix = formCodePrefix;
    localCodeSeparator = formCodeSeparator;
    localCodeDigits = formCodeDigits;
    localIcon = formIcon;
    localIsActive = formIsActive;
    localTagIds = [...formTagIds];
  });

  // Derived: code preview
  const codePreview = $derived(
    getCodePreview(localCodePrefix.toUpperCase(), localCodeSeparator, localCodeDigits),
  );

  // Derived: form validity
  const isValid = $derived(
    localTitle.trim().length > 0 &&
      localCodePrefix.trim().length >= 2 &&
      localCodePrefix.trim().length <= 5,
  );

  function handleFormSubmit(e: Event): void {
    e.preventDefault();
    if (!isValid) return;

    onsubmit({
      title: localTitle.trim(),
      description: localDescription.trim(),
      codePrefix: localCodePrefix.trim().toUpperCase(),
      codeSeparator: localCodeSeparator,
      codeDigits: localCodeDigits,
      icon: localIcon.trim(),
      isActive: localIsActive,
      tagIds: localTagIds,
    });
  }
</script>

<div
  id="inventory-list-modal"
  class="modal-overlay modal-overlay--active"
  role="dialog"
  aria-modal="true"
  aria-labelledby="inventory-list-modal-title"
  tabindex="-1"
>
  <form
    class="ds-modal ds-modal--md"
    onsubmit={handleFormSubmit}
  >
    <div class="ds-modal__header">
      <h3
        class="ds-modal__title"
        id="inventory-list-modal-title"
      >
        {modalTitle}
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
      <!-- Title -->
      <div class="form-field mb-4">
        <label
          class="form-field__label"
          for="list-title">{MESSAGES.LABEL_TITLE} *</label
        >
        <input
          type="text"
          id="list-title"
          class="form-field__control"
          bind:value={localTitle}
          required
          maxlength="255"
          placeholder="z.B. Kröne, Gabelstapler, Leitern"
        />
      </div>

      <!-- Description -->
      <div class="form-field mb-4">
        <label
          class="form-field__label"
          for="list-description">{MESSAGES.LABEL_DESCRIPTION}</label
        >
        <textarea
          id="list-description"
          class="form-field__control"
          bind:value={localDescription}
          rows="2"
          placeholder="Optionale Beschreibung der Liste"
        ></textarea>
      </div>

      <!-- Tags -->
      <div class="form-field mb-4">
        <span class="form-field__label">{MESSAGES.LABEL_TAGS}</span>
        <TagInput
          selectedIds={localTagIds}
          onchange={(ids: string[]) => {
            localTagIds = ids;
          }}
        />
      </div>

      <!-- Code Settings Row -->
      <div class="mb-4">
        <h4 class="mb-2 text-sm font-semibold text-(--color-text-secondary)">Code-Einstellungen</h4>
        <div class="grid grid-cols-3 gap-3">
          <!-- Code Prefix -->
          <div class="form-field">
            <label
              class="form-field__label"
              for="list-prefix">{MESSAGES.LABEL_CODE_PREFIX} *</label
            >
            <input
              type="text"
              id="list-prefix"
              class="form-field__control"
              bind:value={localCodePrefix}
              required
              minlength="2"
              maxlength="5"
              pattern="[A-Za-z]{'{'}2,5}"
              placeholder="KRN"
              style="text-transform: uppercase;"
            />
            <span class="form-field__message">{MESSAGES.HINT_CODE_PREFIX}</span>
          </div>

          <!-- Separator -->
          <div class="form-field">
            <label
              class="form-field__label"
              for="list-separator">{MESSAGES.LABEL_CODE_SEPARATOR}</label
            >
            <input
              type="text"
              id="list-separator"
              class="form-field__control"
              bind:value={localCodeSeparator}
              maxlength="3"
              placeholder="-"
            />
          </div>

          <!-- Digits -->
          <div class="form-field">
            <span class="form-field__label">{MESSAGES.LABEL_CODE_DIGITS}</span>
            <div class="dropdown">
              <button
                type="button"
                class="dropdown__trigger"
                class:active={activeDropdown === 'digits'}
                onclick={() => {
                  toggleDropdown('digits');
                }}
              >
                <span>{digitsLabel}</span>
                <i class="fas fa-chevron-down"></i>
              </button>
              <div
                class="dropdown__menu"
                class:active={activeDropdown === 'digits'}
              >
                {#each CODE_DIGIT_OPTIONS as opt (opt.value)}
                  <button
                    type="button"
                    class="dropdown__option"
                    class:dropdown__option--selected={localCodeDigits === opt.value}
                    onclick={() => {
                      localCodeDigits = opt.value;
                      closeAllDropdowns();
                    }}
                  >
                    {opt.label}
                  </button>
                {/each}
              </div>
            </div>
          </div>
        </div>

        <!-- Code Preview -->
        {#if codePreview.length > 0}
          <div class="mt-2 text-sm text-(--color-text-secondary)">
            {MESSAGES.HINT_CODE_EXAMPLE}: <code class="font-semibold">{codePreview}</code>
          </div>
        {/if}
      </div>

      <!-- Icon Picker -->
      <div class="form-field mb-4">
        <span class="form-field__label">{MESSAGES.LABEL_ICON}</span>
        <div class="icon-picker-grid">
          {#each LIST_ICON_OPTIONS as opt (opt.icon)}
            <button
              type="button"
              class="icon-picker-item"
              class:icon-picker-item--active={localIcon === opt.icon}
              title={opt.label}
              onclick={() => {
                localIcon = opt.icon;
              }}
            >
              <i class="fas {opt.icon}"></i>
              <span class="icon-picker-item__label">{opt.label}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Status (edit mode only) -->
      {#if isEditMode}
        <div class="form-field mb-4">
          <span class="form-field__label">Status</span>
          <div class="dropdown">
            <button
              type="button"
              class="dropdown__trigger"
              class:active={activeDropdown === 'status'}
              onclick={() => {
                toggleDropdown('status');
              }}
            >
              <span>{statusLabel}</span>
              <i class="fas fa-chevron-down"></i>
            </button>
            <div
              class="dropdown__menu"
              class:active={activeDropdown === 'status'}
            >
              {#each FORM_STATUS_OPTIONS as opt (opt.value)}
                <button
                  type="button"
                  class="dropdown__option"
                  class:dropdown__option--selected={localIsActive === opt.value}
                  onclick={() => {
                    localIsActive = opt.value;
                    closeAllDropdowns();
                  }}
                >
                  {opt.label}
                </button>
              {/each}
            </div>
          </div>
        </div>
      {/if}
    </div>

    <div class="ds-modal__footer">
      <button
        type="button"
        class="btn btn-cancel"
        onclick={onclose}>Abbrechen</button
      >
      <button
        type="submit"
        class="btn btn-secondary"
        disabled={submitting || !isValid}
      >
        {#if submitting}
          <span class="spinner-ring spinner-ring--sm mr-2"></span>
        {/if}
        Speichern
      </button>
    </div>
  </form>
</div>

<style>
  .icon-picker-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 0.5rem;
  }

  .icon-picker-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 0.25rem;
    border: 1px solid var(--color-border, rgb(255 255 255 / 10%));
    border-radius: 0.5rem;
    background: transparent;
    color: var(--color-text-secondary, #aaa);
    cursor: pointer;
    transition: all 150ms ease;
    font-size: 1.25rem;
  }

  .icon-picker-item:hover {
    background: var(--color-glass-hover, rgb(255 255 255 / 8%));
    color: var(--color-text-primary, #fff);
  }

  .icon-picker-item--active {
    border-color: var(--color-primary, #2196f3);
    background: rgb(33 150 243 / 15%);
    color: var(--color-primary, #2196f3);
  }

  .icon-picker-item__label {
    font-size: 0.625rem;
    text-align: center;
    line-height: 1.2;
  }
</style>
