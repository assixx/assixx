<!--
  AddDomainModal.svelte
  Modal for adding a new tenant domain. Wraps the design-system `ConfirmModal`
  with a single text input. Submission triggers the parent's `onsubmit(domain)`
  callback; the parent (`+page.svelte`) handles the API call, success/error
  toasts, instructions-panel population, and `closeAddModal()`.

  Form state (input value, submitting flag) lives in `state-ui.svelte.ts` so
  it survives `{#if show}` mount/unmount cycles consistently and so the
  §5.4.1 "modal open/close isolation" unit test can assert reset-on-close
  without touching component internals.

  @see masterplan §5.1 — AddDomainModal, §5.4.1 — modal-isolation test
-->
<script lang="ts">
  import ConfirmModal from '$design-system/components/confirm-modal/ConfirmModal.svelte';

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

  function handleConfirm(): void {
    if (trimmed.length === 0 || submitting) return;
    onsubmit(trimmed);
  }
</script>

<ConfirmModal
  {show}
  title="Domain hinzufügen"
  variant="info"
  icon="fa-globe"
  confirmLabel="Hinzufügen"
  cancelLabel="Abbrechen"
  {submitting}
  confirmDisabled={trimmed.length === 0}
  wide
  onconfirm={handleConfirm}
  oncancel={closeAddModal}
>
  Trage die Firmen-Domain ein, die Du verifizieren möchtest. Nach dem Hinzufügen bekommst Du den
  TXT-Eintrag, den Du in Deiner DNS-Zone setzen musst.
  {#snippet extra()}
    <div class="mt-4">
      <label
        for="add-domain-input"
        class="mb-2 block text-sm font-medium">Domain</label
      >
      <input
        id="add-domain-input"
        class="input w-full"
        type="text"
        placeholder="z.B. firma.de"
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
        disabled={submitting}
        value={domain}
        oninput={(e) => {
          setAddModalDomain(e.currentTarget.value);
        }}
        data-testid="add-domain-input"
      />
      <p class="mt-2 text-sm text-(--color-text-secondary)">
        Freemail-Provider (Gmail, Outlook, GMX, …) und Wegwerf-Domains werden serverseitig
        abgelehnt.
      </p>
    </div>
  {/snippet}
</ConfirmModal>
