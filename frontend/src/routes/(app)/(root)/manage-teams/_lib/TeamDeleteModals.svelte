<script lang="ts">
  import ConfirmModal from '$design-system/components/confirm-modal/ConfirmModal.svelte';

  import { MESSAGES } from './constants';

  interface Props {
    show: boolean;
    showForceDeleteModal: boolean;
    forceDeleteMemberCount: number;
    oncancel: () => void;
    onconfirm: () => void;
    oncloseForceDelete: () => void;
    onforceDelete: () => void;
  }

  const {
    show,
    showForceDeleteModal,
    forceDeleteMemberCount,
    oncancel,
    onconfirm,
    oncloseForceDelete,
    onforceDelete,
  }: Props = $props();
</script>

<ConfirmModal
  {show}
  id="delete-team-confirm-modal"
  title={MESSAGES.DELETE_CONFIRM_TITLE}
  {onconfirm}
  {oncancel}
>
  <strong>ACHTUNG:</strong>
  {MESSAGES.DELETE_CONFIRM_MESSAGE}
</ConfirmModal>

<ConfirmModal
  show={showForceDeleteModal}
  id="team-force-delete-modal"
  title={MESSAGES.FORCE_DELETE_TITLE}
  variant="warning"
  confirmLabel={MESSAGES.DELETE_TITLE}
  onconfirm={onforceDelete}
  oncancel={oncloseForceDelete}
>
  {MESSAGES.forceDeleteMessage(forceDeleteMemberCount)}
</ConfirmModal>
