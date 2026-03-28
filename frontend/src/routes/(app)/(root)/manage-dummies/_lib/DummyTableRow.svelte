<script lang="ts">
  import { IS_ACTIVE_BADGE_CLASSES, IS_ACTIVE_LABELS, MESSAGES } from './constants';

  import type { DummyUser } from './types';

  interface Props {
    dummy: DummyUser;
    onedit: (dummy: DummyUser) => void;
    ondelete: (dummy: DummyUser) => void;
  }

  const { dummy, onedit, ondelete }: Props = $props();

  const statusLabel = $derived(IS_ACTIVE_LABELS[dummy.isActive] ?? 'Unbekannt');
  const statusClass = $derived(IS_ACTIVE_BADGE_CLASSES[dummy.isActive] ?? 'badge--secondary');
  const areasDisplay = $derived(dummy.areaNames.length > 0 ? dummy.areaNames.join(', ') : '—');
  const deptsDisplay = $derived(
    dummy.departmentNames.length > 0 ? dummy.departmentNames.join(', ') : '—',
  );
</script>

<tr>
  <td>
    <div class="flex items-center gap-2">
      <i class="fas fa-desktop text-muted"></i>
      <strong>{dummy.displayName}</strong>
    </div>
  </td>
  <td class="text-muted text-sm">{dummy.email}</td>
  <td class="text-muted text-sm">{dummy.employeeNumber}</td>
  <td>
    {#if dummy.teamNames.length > 0}
      {#each dummy.teamNames as team (team)}
        <span class="badge badge--sm badge--info mr-1">{team}</span>
      {/each}
    {:else}
      <span class="text-muted">—</span>
    {/if}
  </td>
  <td class="text-sm">{areasDisplay}</td>
  <td class="text-sm">{deptsDisplay}</td>
  <td>
    <span class="badge {statusClass}">{statusLabel}</span>
  </td>
  <td>
    <div class="flex gap-2">
      <button
        type="button"
        class="action-icon action-icon--edit"
        title={MESSAGES.BTN_EDIT}
        aria-label="{MESSAGES.BTN_EDIT} {dummy.displayName}"
        onclick={() => {
          onedit(dummy);
        }}
      >
        <i class="fas fa-edit"></i>
      </button>
      <button
        type="button"
        class="action-icon action-icon--delete"
        title={MESSAGES.BTN_DELETE}
        aria-label="{MESSAGES.BTN_DELETE} {dummy.displayName}"
        onclick={() => {
          ondelete(dummy);
        }}
      >
        <i class="fas fa-trash"></i>
      </button>
    </div>
  </td>
</tr>
