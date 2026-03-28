<script lang="ts">
  import { getApprovalStatusOptions } from './constants';
  import { kvpDetailState } from './state.svelte';
  import { getStatusText, canUpdateStatus } from './utils';

  import type { KvpStatus, KvpSuggestion } from './types';

  interface Props {
    suggestion: KvpSuggestion;
    hasApprovalConfig: boolean;
    onstatuschange: (status: KvpStatus) => void;
  }

  const { suggestion, hasApprovalConfig, onstatuschange }: Props = $props();

  const effectiveRole = $derived(kvpDetailState.effectiveRole);
  const canEdit = $derived(canUpdateStatus(effectiveRole, kvpDetailState.canManage));
  const availableOptions = $derived(getApprovalStatusOptions(suggestion.status, hasApprovalConfig));
  const isLocked = $derived(canEdit && hasApprovalConfig && availableOptions.length === 0);
</script>

{#if canEdit && !isLocked}
  <!-- Editable Status Dropdown -->
  <div
    class="dropdown"
    data-dropdown="status"
  >
    <button
      type="button"
      class="dropdown__trigger"
      class:active={kvpDetailState.activeDropdown === 'status'}
      onclick={() => {
        kvpDetailState.toggleDropdown('status');
      }}
    >
      <span>{getStatusText(suggestion.status)}</span>
      <i class="fas fa-chevron-down"></i>
    </button>
    <div
      class="dropdown__menu"
      class:active={kvpDetailState.activeDropdown === 'status'}
    >
      {#each availableOptions as option (option.value)}
        <button
          type="button"
          class="dropdown__option"
          onclick={() => {
            onstatuschange(option.value);
          }}
        >
          {option.label}
        </button>
      {/each}
    </div>
  </div>
{:else if isLocked}
  <!-- Locked status (approval workflow in progress) -->
  <span class="data-list__value">
    {getStatusText(suggestion.status)}
    <i
      class="fas fa-lock"
      title="Status wird durch Freigabe-Workflow gesteuert"
    ></i>
  </span>
{:else}
  <!-- Read-only status (no edit permission) -->
  <span class="data-list__value">{getStatusText(suggestion.status)}</span>
{/if}
