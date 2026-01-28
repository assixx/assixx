<script lang="ts">
  import HighlightText from '$lib/components/HighlightText.svelte';

  import { MESSAGES } from './constants';
  import { getPositionDisplay } from './utils';

  import type { Admin } from './types';

  // =============================================================================
  // PROPS
  // =============================================================================

  interface Props {
    searchQuery: string;
    filteredAdmins: Admin[];
    onresultClick: (adminId: number) => void;
  }

  const { searchQuery, filteredAdmins, onresultClick }: Props = $props();
</script>

{#if searchQuery && filteredAdmins.length === 0}
  <div class="search-input__no-results">
    {MESSAGES.SEARCH_NO_RESULTS} "{searchQuery}"
  </div>
{:else if searchQuery}
  {#each filteredAdmins.slice(0, 5) as admin (admin.id)}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="search-input__result-item"
      onclick={() => {
        onresultClick(admin.id);
      }}
    >
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <div style="font-weight: 500; color: var(--color-text-primary);">
          <HighlightText
            text={`${admin.firstName} ${admin.lastName}`}
            query={searchQuery}
          />
        </div>
        <div style="font-size: 0.813rem; color: var(--color-text-secondary);">
          <HighlightText
            text={admin.email}
            query={searchQuery}
          />
        </div>
        <div
          style="font-size: 0.75rem; color: var(--color-text-muted); display: flex; gap: 8px;"
        >
          <span>
            <HighlightText
              text={getPositionDisplay(admin.position ?? '')}
              query={searchQuery}
            />
          </span>
          {#if admin.employeeNumber}
            <span>
              • <HighlightText
                text={admin.employeeNumber}
                query={searchQuery}
              />
            </span>
          {/if}
        </div>
      </div>
    </div>
  {/each}
  {#if filteredAdmins.length > 5}
    <div
      class="search-input__result-item"
      style="font-size: 0.813rem; color: var(--color-primary); text-align: center;
        border-top: 1px solid rgb(255 255 255 / 5%);"
    >
      {filteredAdmins.length - 5}
      {MESSAGES.SEARCH_MORE_RESULTS}
    </div>
  {/if}
{/if}
