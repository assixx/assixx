<script lang="ts">
  import type { Document } from './types';
  import { DB_CATEGORY_LABELS } from './constants';
  import { formatDateTime } from './utils';

  interface Props {
    show: boolean;
    document: Document | null;
    onclose: () => void;
    onsubmit: (data: EditData) => void;
    submitting: boolean;
  }

  export interface EditData {
    documentName: string;
    category: string;
    tags: string[];
  }

  const { show, document, onclose, onsubmit, submitting }: Props = $props();

  // Form State
  let editDocName = $state('');
  let editCategory = $state('');
  let editTags = $state('');
  let categoryDropdownOpen = $state(false);

  // Initialize form when document changes
  $effect(() => {
    if (document) {
      editDocName = document.filename;
      editCategory = document.category;
      editTags = document.tags?.join(', ') ?? '';
    }
  });

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }

  function selectCategory(category: string) {
    editCategory = category;
    categoryDropdownOpen = false;
  }

  function handleSubmit() {
    const parsedTags = editTags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    onsubmit({
      documentName: editDocName.trim(),
      category: editCategory,
      tags: parsedTags,
    });
  }

  // Outside click handler (use globalThis.document to avoid collision with prop)
  $effect(() => {
    if (categoryDropdownOpen) {
      const handleOutsideClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const el = globalThis.document.getElementById('edit-category-dropdown');
        if (el && !el.contains(target)) categoryDropdownOpen = false;
      };
      globalThis.document.addEventListener('click', handleOutsideClick);
      return () => globalThis.document.removeEventListener('click', handleOutsideClick);
    }
  });
</script>

{#if show && document}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div id="edit-modal" class="modal-overlay modal-overlay--active" onclick={handleOverlayClick}>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <form
      id="edit-form"
      class="ds-modal ds-modal--md"
      onclick={(e) => e.stopPropagation()}
      onsubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">
          <i class="fas fa-edit mr-2"></i>
          Dokument bearbeiten
        </h3>
        <button type="button" class="ds-modal__close" onclick={onclose} aria-label="Schließen">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body">
        <!-- Document Name -->
        <div class="form-field">
          <label class="form-field__label form-field__label--required" for="edit-doc-name"
            >Dokumentname</label
          >
          <input
            type="text"
            id="edit-doc-name"
            name="name"
            class="form-field__control"
            placeholder="z.B. Arbeitsvertrag 2025"
            bind:value={editDocName}
            required
          />
        </div>

        <!-- Category Selection -->
        <div class="form-field">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="form-field__label form-field__label--required">Kategorie</label>
          <div class="dropdown w-full" id="edit-category-dropdown">
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
                  {#if editCategory}
                    {DB_CATEGORY_LABELS[editCategory] ?? editCategory}
                  {:else}
                    Kategorie wählen...
                  {/if}
                </span>
              </span>
              <i class="fas fa-chevron-down"></i>
            </button>
            <div class="dropdown__menu" class:active={categoryDropdownOpen}>
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div class="dropdown__option" onclick={() => selectCategory('general')}>
                <i class="fas fa-folder"></i>
                Allgemein
              </div>
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div class="dropdown__option" onclick={() => selectCategory('work')}>
                <i class="fas fa-briefcase"></i>
                Arbeit
              </div>
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div class="dropdown__option" onclick={() => selectCategory('personal')}>
                <i class="fas fa-user"></i>
                Persönlich
              </div>
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div class="dropdown__option" onclick={() => selectCategory('salary')}>
                <i class="fas fa-money-bill-wave"></i>
                Gehalt
              </div>
            </div>
          </div>
        </div>

        <!-- Tags -->
        <div class="form-field">
          <label class="form-field__label" for="edit-doc-tags">Tags</label>
          <input
            type="text"
            id="edit-doc-tags"
            name="tags"
            class="form-field__control"
            placeholder="z.B. vertrag, 2025, personal (kommagetrennt)"
            bind:value={editTags}
          />
          <small class="form-field__message">Tags helfen beim späteren Suchen und Filtern</small>
        </div>

        <!-- Info about current file -->
        <div class="p-3 bg-surface-2 rounded-lg border border-border-subtle">
          <div class="text-sm text-content-secondary">
            <div class="flex items-center gap-2 mb-1">
              <i class="fas fa-file"></i>
              <span>Originaldatei: {document.storedFilename}</span>
            </div>
            <div class="flex items-center gap-2">
              <i class="fas fa-calendar"></i>
              <span>Hochgeladen: {formatDateTime(document.uploadedAt)}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="ds-modal__footer">
        <button type="button" class="btn btn-cancel" onclick={onclose}>Abbrechen</button>
        <button type="submit" class="btn btn-modal" disabled={submitting}>
          {#if submitting}
            <span class="spinner-ring spinner-ring--sm mr-2"></span>
          {:else}
            <i class="fas fa-save mr-2"></i>
          {/if}
          Speichern
        </button>
      </div>
    </form>
  </div>
{/if}
