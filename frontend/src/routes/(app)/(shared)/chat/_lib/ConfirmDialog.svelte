<script lang="ts">
  import ConfirmModal from '$design-system/components/confirm-modal/ConfirmModal.svelte';

  import { MESSAGES } from './constants';

  interface Props {
    show: boolean;
    message: string;
    onclose: () => void;
    onconfirm: () => void;
  }

  const { show, message, onclose, onconfirm }: Props = $props();
</script>

<ConfirmModal
  {show}
  id="chat-confirm-dialog"
  title={MESSAGES.labelConfirmDelete}
  confirmLabel={MESSAGES.labelDelete}
  cancelLabel={MESSAGES.labelCancel}
  {onconfirm}
  oncancel={onclose}
>
  {message}
</ConfirmModal>
