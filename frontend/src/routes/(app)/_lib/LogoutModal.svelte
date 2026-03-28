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
  }

  const { isVisible, onCancel, onConfirm }: Props = $props();
</script>

<ConfirmModal
  show={isVisible}
  id="logout-modal"
  title="Abmeldung bestätigen"
  variant="info"
  icon="fa-sign-out-alt"
  confirmLabel="Abmelden"
  centered
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
