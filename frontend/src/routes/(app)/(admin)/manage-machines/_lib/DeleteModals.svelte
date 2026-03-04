<script lang="ts">
  import ConfirmModal from '$design-system/components/confirm-modal/ConfirmModal.svelte';

  import { MESSAGES } from './constants';
  import { machineState } from './state.svelte';

  interface Props {
    ondelete: () => void;
  }

  const { ondelete }: Props = $props();
</script>

<ConfirmModal
  show={machineState.showDeleteModal}
  id="delete-machine-confirm-modal"
  title={MESSAGES.MODAL_DELETE_CONFIRM_TITLE}
  onconfirm={ondelete}
  oncancel={() => {
    machineState.closeDeleteModal();
  }}
>
  <strong>{MESSAGES.DELETE_FINAL_WARNING}</strong>
  <br /><br />
  {MESSAGES.DELETE_FINAL_INFO}
</ConfirmModal>
