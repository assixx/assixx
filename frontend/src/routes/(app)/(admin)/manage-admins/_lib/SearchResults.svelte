<script lang="ts">
  import SearchResultUser from '$lib/components/SearchResultUser.svelte';

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
    <SearchResultUser
      id={admin.id}
      firstName={admin.firstName}
      lastName={admin.lastName}
      username={admin.username}
      email={admin.email}
      imageUrl={admin.profilePicture}
      employeeNumber={admin.employeeNumber}
      role="admin"
      position={getPositionDisplay(admin.position ?? '')}
      query={searchQuery}
      onclick={() => {
        onresultClick(admin.id);
      }}
    />
  {/each}
  {#if filteredAdmins.length > 5}
    <div class="search-input__result-item search-input__result-more">
      {filteredAdmins.length - 5}
      {MESSAGES.SEARCH_MORE_RESULTS}
    </div>
  {/if}
{/if}
