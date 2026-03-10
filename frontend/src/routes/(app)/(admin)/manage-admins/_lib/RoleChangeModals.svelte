<!--
  RoleChangeModals.svelte
  Confirm modals for upgrading admin to root and downgrading admin to employee.
-->
<script lang="ts">
  import ConfirmModal from '$design-system/components/confirm-modal/ConfirmModal.svelte';

  import { MESSAGES } from './constants';

  // =============================================================================
  // PROPS
  // =============================================================================

  interface Props {
    showUpgradeModal: boolean;
    showDowngradeModal: boolean;
    upgradeLoading: boolean;
    downgradeLoading: boolean;
    oncloseUpgrade: () => void;
    oncloseDowngrade: () => void;
    onconfirmUpgrade: () => void;
    onconfirmDowngrade: () => void;
  }

  const {
    showUpgradeModal,
    showDowngradeModal,
    upgradeLoading,
    downgradeLoading,
    oncloseUpgrade,
    oncloseDowngrade,
    onconfirmUpgrade,
    onconfirmDowngrade,
  }: Props = $props();
</script>

<!-- Upgrade Confirm Modal -->
<ConfirmModal
  show={showUpgradeModal}
  id="upgrade-confirm-modal"
  title={MESSAGES.UPGRADE_TITLE}
  variant="warning"
  icon="fa-arrow-up"
  confirmLabel={MESSAGES.UPGRADE_CONFIRM_BUTTON}
  cancelLabel={MESSAGES.BTN_CANCEL}
  submitting={upgradeLoading}
  onconfirm={onconfirmUpgrade}
  oncancel={oncloseUpgrade}
>
  <strong>{MESSAGES.UPGRADE_CONFIRM_MESSAGE}</strong>
</ConfirmModal>

<!-- Downgrade Confirm Modal -->
<ConfirmModal
  show={showDowngradeModal}
  id="downgrade-confirm-modal"
  title={MESSAGES.UPGRADE_TITLE}
  variant="warning"
  icon="fa-arrow-down"
  confirmLabel={MESSAGES.DOWNGRADE_CONFIRM_BUTTON}
  cancelLabel={MESSAGES.BTN_CANCEL}
  submitting={downgradeLoading}
  onconfirm={onconfirmDowngrade}
  oncancel={oncloseDowngrade}
>
  <strong>{MESSAGES.DOWNGRADE_CONFIRM_MESSAGE}</strong>
</ConfirmModal>
