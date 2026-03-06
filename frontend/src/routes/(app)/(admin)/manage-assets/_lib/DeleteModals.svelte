<script lang="ts">
  import ConfirmModal from '$design-system/components/confirm-modal/ConfirmModal.svelte';

  import { MESSAGES } from './constants';
  import { assetState } from './state.svelte';

  interface Props {
    ondelete: () => void;
  }

  const { ondelete }: Props = $props();
</script>

<ConfirmModal
  show={assetState.showDeleteModal}
  id="delete-asset-confirm-modal"
  title={MESSAGES.MODAL_DELETE_CONFIRM_TITLE}
  onconfirm={ondelete}
  oncancel={() => {
    assetState.closeDeleteModal();
  }}
>
  <strong>{MESSAGES.DELETE_FINAL_WARNING}</strong>
  <br /><br />
  {MESSAGES.DELETE_FINAL_INFO}
</ConfirmModal>
