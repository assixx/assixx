<!--
  ConfirmModal.svelte
  Reusable design-system confirmation dialog (danger / warning / info / success)

  Usage:
    <ConfirmModal show={...} title="..." onconfirm={...} oncancel={...}>
      <strong>ACHTUNG:</strong> Diese Aktion ist unwiderruflich.
    </ConfirmModal>

  With extra content (e.g. textarea, list) between message and buttons:
    <ConfirmModal show={...} title="..." onconfirm={...} oncancel={...}>
      Bitte geben Sie einen Grund an:
      {#snippet extra()}
        <div class="confirm-modal__input-group">
          <textarea class="confirm-modal__input" ...></textarea>
        </div>
      {/snippet}
    </ConfirmModal>
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  type Variant = 'danger' | 'warning' | 'info' | 'success';

  interface Props {
    show: boolean;
    title: string;
    children: Snippet;
    /** Optional content rendered between message and buttons (e.g. textarea, list) */
    extra?: Snippet;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: Variant;
    /** Font Awesome icon class, e.g. 'fa-exclamation-triangle' */
    icon?: string;
    submitting?: boolean;
    /** Additional disable condition for the confirm button (independent of submitting) */
    confirmDisabled?: boolean;
    /** Center-align action buttons with min-width */
    centered?: boolean;
    /** Wider modal (700px) for forms with textareas */
    wide?: boolean;
    id?: string;
    onconfirm: () => void;
    oncancel: () => void;
  }

  const {
    show,
    title,
    children,
    extra,
    confirmLabel = 'Endgültig löschen',
    cancelLabel = 'Abbrechen',
    variant = 'danger',
    icon = 'fa-exclamation-triangle',
    submitting = false,
    confirmDisabled = false,
    centered = false,
    wide = false,
    id = 'confirm-modal',
    onconfirm,
    oncancel,
  }: Props = $props();

  const btnVariantClass = $derived(
    variant === 'danger' ? 'confirm-modal__btn--danger'
    : variant === 'warning' ? 'confirm-modal__btn--warning'
    : variant === 'info' ? 'confirm-modal__btn--info'
    : 'confirm-modal__btn--success',
  );
</script>

{#if show}
  <div
    {id}
    class="modal-overlay modal-overlay--active"
    role="dialog"
    aria-modal="true"
    aria-labelledby="{id}-title"
    tabindex="-1"
  >
    <div
      class="confirm-modal confirm-modal--{variant}"
      style={wide ? 'width: 100%; max-width: 560px' : ''}
    >
      <div class="confirm-modal__icon">
        <i class="fas {icon}"></i>
      </div>
      <h3
        class="confirm-modal__title"
        id="{id}-title"
      >
        {title}
      </h3>
      <p class="confirm-modal__message">
        {@render children()}
      </p>
      {#if extra}
        {@render extra()}
      {/if}
      <div class="confirm-modal__actions{centered ? ' confirm-modal__actions--centered' : ''}">
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--cancel{centered ?
            ' confirm-modal__btn--wide'
          : ''}"
          disabled={submitting}
          onclick={oncancel}>{cancelLabel}</button
        >
        <button
          type="button"
          class="confirm-modal__btn {btnVariantClass}{centered ? ' confirm-modal__btn--wide' : ''}"
          disabled={submitting || confirmDisabled}
          onclick={onconfirm}
        >
          {#if submitting}
            <span class="spinner-ring spinner-ring--sm mr-2"></span>
          {/if}
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}
