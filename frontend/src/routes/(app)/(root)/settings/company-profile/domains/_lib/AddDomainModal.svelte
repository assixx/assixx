<!--
  AddDomainModal.svelte
  Form-modal for adding a new tenant domain (Phase-5 polish 2026-04-19:
  design-system `ds-modal` pattern — mirrors AdminFormModal; previous
  `ConfirmModal` wrapper was semantically wrong (confirm-modals are for
  yes/no confirmations, not form input).

  Submission triggers the parent's `onsubmit(domain)` callback; the parent
  (`+page.svelte`) handles the API call, success/error toasts, instructions-
  panel population, and `closeAddModal()`.

  Form state (input value, submitting flag) lives in `state-ui.svelte.ts` so
  it survives `{#if show}` mount/unmount cycles consistently and so the
  §5.4.1 "modal open/close isolation" unit test can assert reset-on-close
  without touching component internals.

  @see masterplan §5.1 — AddDomainModal, §5.4.1 — modal-isolation test
       AdminFormModal.svelte — canonical ds-modal pattern reference
-->
<script lang="ts">
  import {
    closeAddModal,
    getAddModalDomain,
    getAddModalSubmitting,
    setAddModalDomain,
  } from './state-ui.svelte.js';

  interface Props {
    show: boolean;
    onsubmit: (domain: string) => void;
  }

  const { show, onsubmit }: Props = $props();

  // Read facade state via getter calls — Svelte 5 invalidates this $derived
  // expression whenever the underlying $state in `state-ui.svelte.ts` changes.
  const domain = $derived(getAddModalDomain());
  const submitting = $derived(getAddModalSubmitting());
  const trimmed = $derived(domain.trim());

  function handleSubmit(e: Event): void {
    e.preventDefault();
    if (trimmed.length === 0 || submitting) return;
    onsubmit(trimmed);
  }
</script>

{#if show}
  <div
    id="add-domain-modal"
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="add-domain-modal-title"
    tabindex="-1"
  >
    <form
      id="add-domain-form"
      class="ds-modal"
      onsubmit={handleSubmit}
    >
      <div class="ds-modal__header">
        <h3
          class="ds-modal__title"
          id="add-domain-modal-title"
        >
          <i class="fas fa-globe mr-2"></i>
          Domain hinzufügen
        </h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schließen"
          onclick={closeAddModal}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body">
        <p class="mb-4 text-sm text-(--color-text-secondary)">
          Trage die Firmen-Domain ein, die Du verifizieren möchtest. Nach dem Hinzufügen bekommst Du
          den TXT-Eintrag für Deine DNS-Zone.
        </p>
        <div class="form-field">
          <label
            class="form-field__label"
            for="add-domain-input"
          >
            Domain <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="add-domain-input"
            name="domain"
            class="form-field__control"
            placeholder="z.B. firma.de"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
            required
            disabled={submitting}
            value={domain}
            oninput={(e: Event) => {
              setAddModalDomain((e.currentTarget as HTMLInputElement).value);
            }}
            data-testid="add-domain-input"
          />
          <span class="form-field__message text-(--color-text-secondary)">
            Freemail-Provider (Gmail, Outlook, GMX, …) und Wegwerf-Domains werden serverseitig
            abgelehnt.
          </span>
        </div>
      </div>

      <div class="ds-modal__footer">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={closeAddModal}>Abbrechen</button
        >
        <button
          type="submit"
          class="btn btn-secondary"
          disabled={submitting || trimmed.length === 0}
        >
          {#if submitting}<span class="spinner-ring spinner-ring--sm mr-2"></span>{/if}
          Hinzufügen
        </button>
      </div>
    </form>
  </div>
{/if}
