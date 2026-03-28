<script lang="ts">
  import ConfirmModal from '$design-system/components/confirm-modal/ConfirmModal.svelte';

  interface Props {
    onclose: () => void;
    onconfirm: () => void;
  }

  const { onclose, onconfirm }: Props = $props();
</script>

<ConfirmModal
  show={true}
  id="calendar-delete-confirm-modal"
  title="Termin Löschen"
  icon="fa-trash"
  confirmLabel="Löschen"
  {onconfirm}
  oncancel={onclose}
>
  Möchten Sie diesen Termin wirklich Löschen? Diese Aktion kann nicht rückgängig gemacht werden.
</ConfirmModal>
