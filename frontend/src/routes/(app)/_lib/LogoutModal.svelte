<!--
  LogoutModal.svelte
  Logout confirmation dialog using ConfirmModal design-system component
  Extracted from +layout.svelte for max-lines compliance
-->
<script lang="ts">
  import ConfirmModal from '$design-system/components/confirm-modal/ConfirmModal.svelte';

  interface Props {
    isVisible: boolean;
    onCancel: () => void;
    onConfirm: () => void;
    /**
     * While true: both buttons are disabled and a spinner renders on the
     * confirm button. Used by ADR-050 Amendment (Logout → Apex) so the
     * modal stays as the UX anchor from confirm-click until the apex
     * login page paints (browser paint-hold keeps the modal as the last
     * frame during the cross-origin hard-nav → no blank-flash between
     * old and new document).
     */
    submitting?: boolean;
  }

  const { isVisible, onCancel, onConfirm, submitting = false }: Props = $props();
</script>

<ConfirmModal
  show={isVisible}
  id="logout-modal"
  title="Abmeldung bestätigen"
  variant="info"
  icon="fa-sign-out-alt"
  confirmLabel="Abmelden"
  centered
  {submitting}
  onconfirm={onConfirm}
  oncancel={onCancel}
>
  Möchten Sie sich wirklich abmelden?<br />
  <small><i class="fas fa-info-circle"></i> Alle ungespeicherten Änderungen gehen verloren.</small>
</ConfirmModal>

<style>
  :global(#logout-modal) {
    align-items: flex-start;
    padding-top: 18vh;
  }
</style>
