<!--
  ConfirmModal.svelte
  Reusable design-system confirmation dialog (danger / warning / info / success)

  Usage:
    <ConfirmModal show={...} title="..." onconfirm={...} oncancel={...}>
      <strong>ACHTUNG:</strong> Diese Aktion ist unwiderruflich.
    </ConfirmModal>
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  type Variant = 'danger' | 'warning' | 'info' | 'success';

  interface Props {
    show: boolean;
    title: string;
    children: Snippet;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: Variant;
    /** Font Awesome icon class, e.g. 'fa-exclamation-triangle' */
    icon?: string;
    submitting?: boolean;
    id?: string;
    onconfirm: () => void;
    oncancel: () => void;
  }

  const {
    show,
    title,
    children,
    confirmLabel = 'Endgültig löschen',
    cancelLabel = 'Abbrechen',
    variant = 'danger',
    icon = 'fa-exclamation-triangle',
    submitting = false,
    id = 'confirm-modal',
    onconfirm,
    oncancel,
  }: Props = $props();

  function handleOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) oncancel();
  }

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
    onclick={handleOverlayClick}
    onkeydown={(e) => {
      if (e.key === 'Escape') oncancel();
    }}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
      class="confirm-modal confirm-modal--{variant}"
      onclick={(e) => {
        e.stopPropagation();
      }}
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
      <div class="confirm-modal__actions">
        <button
          type="button"
          class="confirm-modal__btn confirm-modal__btn--cancel"
          onclick={oncancel}>{cancelLabel}</button
        >
        <button
          type="button"
          class="confirm-modal__btn {btnVariantClass}"
          disabled={submitting}
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
