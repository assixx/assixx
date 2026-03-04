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
  id="delete-root-confirm-modal"
  title={MESSAGES.DELETE_FINAL_TITLE}
  {onconfirm}
  {oncancel}
>
  <strong>ACHTUNG:</strong>
  {MESSAGES.DELETE_FINAL_WARNING}
  <br /><br />
  {MESSAGES.DELETE_FINAL_MESSAGE}
</ConfirmModal>
