<script lang="ts">
  import ConfirmModal from '$design-system/components/confirm-modal/ConfirmModal.svelte';

  import { MESSAGES } from './constants';

  interface Props {
    show: boolean;
    showForceDeleteModal: boolean;
    forceDeleteMessage: string;
    oncancel: () => void;
    onconfirm: () => void;
    onCloseForceDelete: () => void;
    onForceDelete: () => void;
  }

  const {
    show,
    showForceDeleteModal,
    forceDeleteMessage,
    oncancel,
    onconfirm,
    onCloseForceDelete,
    onForceDelete,
  }: Props = $props();
</script>

<ConfirmModal
  {show}
  id="delete-department-confirm-modal"
  title={MESSAGES.DELETE_CONFIRM_TITLE}
  {onconfirm}
  {oncancel}
>
  <strong>ACHTUNG:</strong>
  {MESSAGES.DELETE_CONFIRM_WARNING}
  <br /><br />
  {MESSAGES.DELETE_CONFIRM_MESSAGE}
</ConfirmModal>

<ConfirmModal
  show={showForceDeleteModal}
  id="force-delete-department-modal"
  title={MESSAGES.FORCE_DELETE_TITLE}
  variant="warning"
  confirmLabel={MESSAGES.DELETE_TITLE}
  onconfirm={onForceDelete}
  oncancel={onCloseForceDelete}
>
  {forceDeleteMessage}
</ConfirmModal>
