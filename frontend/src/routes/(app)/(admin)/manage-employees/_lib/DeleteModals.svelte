<script lang="ts">
  import ConfirmModal from '$design-system/components/confirm-modal/ConfirmModal.svelte';

  import { MESSAGES } from './constants';

  interface Props {
    show: boolean;
    oncancel: () => void;
    onconfirm: () => void;
  }

  const { show, oncancel, onconfirm }: Props = $props();
</script>

<ConfirmModal
  {show}
  id="delete-employee-confirm-modal"
  title={MESSAGES.DELETE_CONFIRM_TITLE}
  {onconfirm}
  {oncancel}
>
  <strong>ACHTUNG:</strong>
  {MESSAGES.DELETE_CONFIRM_MESSAGE}
</ConfirmModal>
