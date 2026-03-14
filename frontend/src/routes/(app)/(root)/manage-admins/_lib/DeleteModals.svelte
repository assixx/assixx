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
  id="delete-admin-confirm-modal"
  title={MESSAGES.MODAL_DELETE_CONFIRM_TITLE}
  {onconfirm}
  {oncancel}
>
  <strong>{MESSAGES.DELETE_FINAL_WARNING}</strong>
  <br /><br />
  {MESSAGES.DELETE_FINAL_INFO}
</ConfirmModal>
