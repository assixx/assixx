<script lang="ts">
  /**
   * StatusBadge — Color-coded badge for inventory item status
   */
  import { ITEM_STATUS_BADGE_CLASSES, ITEM_STATUS_ICONS, ITEM_STATUS_LABELS } from './constants';

  import type { InventoryItemStatus } from './types';

  interface Props {
    status: InventoryItemStatus;
    count?: number;
  }

  const { status, count }: Props = $props();

  const label = $derived(ITEM_STATUS_LABELS[status]);
  const badgeClass = $derived(ITEM_STATUS_BADGE_CLASSES[status]);
  const icon = $derived(ITEM_STATUS_ICONS[status]);
</script>

<span
  class="badge {badgeClass}"
  title="{count !== undefined ? `${count} ` : ''}{label}"
>
  <i class="fas {icon} mr-1"></i>
  {#if count !== undefined}
    {count}
  {:else}
    {label}
  {/if}
</span>
