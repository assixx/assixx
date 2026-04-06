<script lang="ts">
  /**
   * ListModal — Create/Edit inventory list modal
   *
   * Fields: title, description, category (with autocomplete),
   * code prefix, separator, digits, icon, isActive (edit only).
   */
  import { FORM_STATUS_OPTIONS } from '@assixx/shared/constants';

  import { loadCategories } from './api';
  import { DEFAULT_LIST_ICON, LIST_ICON_OPTIONS, MESSAGES } from './constants';
  import { categoryState } from './state.svelte';
  import { getCodePreview } from './utils';

  import type { FormIsActiveStatus } from './types';

  interface Props {
    isEditMode: boolean;
    modalTitle: string;
    formTitle: string;
    formDescription: string;
    formCategory: string;
    formCodePrefix: string;
    formCodeSeparator: string;
    formCodeDigits: number;
    formIcon: string;
    formIsActive: FormIsActiveStatus;
    submitting: boolean;
    onclose: () => void;
    onsubmit: (data: SubmitData) => void;
  }

  export interface SubmitData {
    title: string;
    description: string;
    category: string;
    codePrefix: string;
    codeSeparator: string;
    codeDigits: number;
    icon: string;
    isActive: FormIsActiveStatus;
  }

  const {
    isEditMode,
    modalTitle,
    formTitle,
    formDescription,
    formCategory,
    formCodePrefix,
    formCodeSeparator,
    formCodeDigits,
    formIcon,
    formIsActive,
    submitting,
    onclose,
    onsubmit,
  }: Props = $props();

  // Local form state (synced from props via $effect)
  let localTitle = $state('');
  let localDescription = $state('');
  let localCategory = $state('');
  let localCodePrefix = $state('');
  let localCodeSeparator = $state('-');
  let localCodeDigits = $state(3);
  let localIcon = $state(DEFAULT_LIST_ICON);
  let localIsActive = $state<FormIsActiveStatus>(1);

  // Category autocomplete
  let showCategorySuggestions = $state(false);
  let categoryInputFocused = $state(false);

  // Sync props to local state
  $effect(() => {
    localTitle = formTitle;
    localDescription = formDescription;
    localCategory = formCategory;
    localCodePrefix = formCodePrefix;
    localCodeSeparator = formCodeSeparator;
    localCodeDigits = formCodeDigits;
    localIcon = formIcon;
    localIsActive = formIsActive;
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
      category: localCategory.trim(),
      codePrefix: localCodePrefix.trim().toUpperCase(),
      codeSeparator: localCodeSeparator,
      codeDigits: localCodeDigits,
      icon: localIcon.trim(),
      isActive: localIsActive,
    });
  }

  async function handleCategoryInput(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    localCategory = input.value;

    if (localCategory.trim().length >= 1) {
      const suggestions = await loadCategories(localCategory.trim());
      categoryState.setSuggestions(suggestions);
      showCategorySuggestions = suggestions.length > 0;
    } else {
      showCategorySuggestions = false;
    }
  }

  function selectCategory(cat: string): void {
    localCategory = cat;
    showCategorySuggestions = false;
  }

  function handleCategoryBlur(): void {
    // Delay to allow click on suggestion
    setTimeout(() => {
      categoryInputFocused = false;
      showCategorySuggestions = false;
    }, 150);
  }
</script>

<div
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

      <!-- Category with autocomplete -->
      <div
        class="form-field mb-4"
        style="position: relative;"
      >
        <label
          class="form-field__label"
          for="list-category">{MESSAGES.LABEL_CATEGORY}</label
        >
        <input
          type="text"
          id="list-category"
          class="form-field__control"
          value={localCategory}
          oninput={(e) => void handleCategoryInput(e)}
          onfocus={() => {
            categoryInputFocused = true;
          }}
          onblur={handleCategoryBlur}
          maxlength="100"
          placeholder="z.B. Hebezeuge, Fahrzeuge, Steigtechnik"
          autocomplete="off"
        />
        {#if showCategorySuggestions && categoryInputFocused}
          <div class="category-suggestions">
            {#each categoryState.suggestions as cat (cat)}
              <button
                type="button"
                class="category-suggestions__item"
                onmousedown={() => {
                  selectCategory(cat);
                }}
              >
                {cat}
              </button>
            {/each}
          </div>
        {/if}
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
            <label
              class="form-field__label"
              for="list-digits">{MESSAGES.LABEL_CODE_DIGITS}</label
            >
            <select
              id="list-digits"
              class="form-field__control"
              bind:value={localCodeDigits}
            >
              <option value={2}>2 (01-99)</option>
              <option value={3}>3 (001-999)</option>
              <option value={4}>4 (0001-9999)</option>
              <option value={5}>5 (00001-99999)</option>
            </select>
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
          <label
            class="form-field__label"
            for="list-status">Status</label
          >
          <select
            id="list-status"
            class="form-field__control"
            bind:value={localIsActive}
          >
            {#each FORM_STATUS_OPTIONS as opt (opt.value)}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
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
        class="btn btn-primary"
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

  .category-suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 50;
    background: var(--color-glass-bg, rgb(30 30 46 / 95%));
    border: 1px solid var(--color-border, rgb(255 255 255 / 10%));
    border-radius: 0.5rem;
    box-shadow: 0 4px 12px rgb(0 0 0 / 30%);
    max-height: 200px;
    overflow-y: auto;
  }

  .category-suggestions__item {
    display: block;
    width: 100%;
    padding: 0.5rem 0.75rem;
    text-align: left;
    border: none;
    background: transparent;
    color: var(--color-text-primary, #fff);
    cursor: pointer;
    font-size: 0.875rem;
  }

  .category-suggestions__item:hover {
    background: var(--color-glass-hover, rgb(255 255 255 / 10%));
  }
</style>
