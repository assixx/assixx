<script lang="ts">
  import ConfirmModal from '$design-system/components/confirm-modal/ConfirmModal.svelte';

  import type { DepartmentMessages } from './constants';

  interface Props {
    show: boolean;
    showForceDeleteModal: boolean;
    forceDeleteMessage: string;
    messages: DepartmentMessages;
    oncancel: () => void;
    onconfirm: () => void;
    onCloseForceDelete: () => void;
    onForceDelete: () => void;
  }

  const {
    show,
    showForceDeleteModal,
    forceDeleteMessage,
    messages,
    oncancel,
    onconfirm,
    onCloseForceDelete,
    onForceDelete,
  }: Props = $props();
</script>

<ConfirmModal
  {show}
  id="delete-department-confirm-modal"
  title={messages.DELETE_CONFIRM_TITLE}
  {onconfirm}
  {oncancel}
>
  <strong>ACHTUNG:</strong>
  {messages.DELETE_CONFIRM_WARNING}
  <br /><br />
  {messages.DELETE_CONFIRM_MESSAGE}
</ConfirmModal>

<ConfirmModal
  show={showForceDeleteModal}
  id="force-delete-department-modal"
  title={messages.FORCE_DELETE_TITLE}
  variant="warning"
  confirmLabel={messages.DELETE_TITLE}
  onconfirm={onForceDelete}
  oncancel={onCloseForceDelete}
>
  {forceDeleteMessage}
</ConfirmModal>
