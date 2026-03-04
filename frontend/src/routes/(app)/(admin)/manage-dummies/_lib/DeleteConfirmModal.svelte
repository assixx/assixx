<script lang="ts">
  import ConfirmModal from '$design-system/components/confirm-modal/ConfirmModal.svelte';

  import { MESSAGES } from './constants';

  interface Props {
    show: boolean;
    submitting: boolean;
    oncancel: () => void;
    onconfirm: () => void;
  }

  const { show, submitting, oncancel, onconfirm }: Props = $props();
</script>

<ConfirmModal
  {show}
  id="dummy-delete-confirm-modal"
  title={MESSAGES.DELETE_CONFIRM_FINAL}
  {submitting}
  {onconfirm}
  {oncancel}
>
  <strong>ACHTUNG:</strong>
  {MESSAGES.DELETE_CONFIRM_TEXT}
</ConfirmModal>
