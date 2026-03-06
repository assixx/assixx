<script lang="ts">
  import ConfirmModal from '$design-system/components/confirm-modal/ConfirmModal.svelte';

  import { MESSAGES } from './constants';

  interface Props {
    show: boolean;
    loading?: boolean;
    oncancel: () => void;
    onconfirm: () => void;
  }

  const { show, loading = false, oncancel, onconfirm }: Props = $props();
</script>

<ConfirmModal
  {show}
  id="blackboard-delete-confirm-modal"
  title={MESSAGES.DELETE_FINAL_TITLE}
  submitting={loading}
  {onconfirm}
  {oncancel}
>
  <strong>ACHTUNG:</strong>
  {MESSAGES.DELETE_FINAL_MESSAGE}
</ConfirmModal>
