<script lang="ts">
  /**
   * StatusBadge — Displays work order status as a styled badge.
   */
  import { STATUS_LABELS, STATUS_BADGE_CLASSES, STATUS_ICONS } from '../../_lib/constants';

  import type { WorkOrderStatus } from '../../_lib/types';

  interface Props {
    status: WorkOrderStatus;
  }

  const { status }: Props = $props();

  const label = $derived(STATUS_LABELS[status]);
  const badgeClass = $derived(STATUS_BADGE_CLASSES[status]);
  const icon = $derived(STATUS_ICONS[status]);
</script>

<span class="badge {badgeClass}">
  <i class="fas {icon}"></i>
  {label}
</span>
