<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  import { resolvePositionDisplay } from '$lib/types/hierarchy-labels.js';

  import { MESSAGES } from './_lib/constants.js';
  import {
    buildUserSlug,
    filterBySearch,
    formatDate,
    getAvatarColorIndex,
    getAvailabilityInfo,
    getInitials,
    getRoleBadgeClass,
    getRoleLabel,
  } from './_lib/utils.js';

  import type { PageData } from './$types.js';
  import type { TeamMember, TeamOption } from './_lib/types.js';

  interface Props {
    data: PageData;
  }

  const { data }: Props = $props();

  const teams: TeamOption[] = $derived(data.teams);
  const members: TeamMember[] = $derived(data.members);
  const selectedTeamId: number | null = $derived(data.selectedTeamId);

  const hierarchyLabels = $derived(data.hierarchyLabels);

  let searchQuery: string = $state('');

  const filteredMembers: TeamMember[] = $derived(filterBySearch(members, searchQuery));

  function handleTeamChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const teamId = select.value;
    void goto(`${resolve('/my-team')}?team=${teamId}`, { invalidateAll: true });
  }

  function navigateToProfile(member: TeamMember): void {
    const slug = buildUserSlug(member);
    void goto(resolve(`/user/${slug}`));
  }

  function handleSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    searchQuery = input.value;
  }
</script>

<div class="container">
  <div class="card">
    <div class="card__header">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="card__title">
            <i class="fas fa-user-friends mr-2"></i>
            Meine {hierarchyLabels.team}
          </h2>
          <p class="mt-2 text-(--color-text-secondary)">Übersicht deiner Mitglieder</p>
        </div>

        {#if teams.length > 1}
          <div class="team-selector">
            <label
              for="team-select"
              class="form-field__label">{hierarchyLabels.team}</label
            >
            <select
              id="team-select"
              class="form-field__control"
              value={selectedTeamId}
              onchange={handleTeamChange}
            >
              {#each teams as team (team.id)}
                <option value={team.id}>{team.name}</option>
              {/each}
            </select>
          </div>
        {:else if teams.length === 1}
          <span class="badge badge--primary">{teams[0]?.name ?? ''}</span>
        {/if}
      </div>

      {#if members.length > 0}
        <div class="mt-6 flex items-center justify-between gap-4">
          <div class="search-input-wrapper max-w-80">
            <div
              class="search-input"
              id="my-team-search-container"
            >
              <i class="search-input__icon fas fa-search"></i>
              <input
                type="search"
                id="my-team-search"
                class="search-input__field"
                placeholder={MESSAGES.SEARCH_PLACEHOLDER}
                autocomplete="off"
                value={searchQuery}
                oninput={handleSearchInput}
              />
              <button
                type="button"
                class="search-input__clear"
                class:search-input__clear--visible={searchQuery.length > 0}
                aria-label="Suche leeren"
                onclick={() => {
                  searchQuery = '';
                }}
              >
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>
          <span class="text-sm whitespace-nowrap text-(--color-text-secondary)">
            {filteredMembers.length}
            {filteredMembers.length === 1 ? 'Mitglied' : 'Mitglieder'}
          </span>
        </div>
      {/if}
    </div>

    <div class="card__body">
      {#if teams.length === 0}
        <div class="empty-state">
          <div class="empty-state__icon">
            <i class="fas fa-users-slash"></i>
          </div>
          <h3 class="empty-state__title">{MESSAGES.NO_TEAM}</h3>
        </div>
      {:else if filteredMembers.length === 0 && searchQuery !== ''}
        <div class="empty-state">
          <div class="empty-state__icon">
            <i class="fas fa-search"></i>
          </div>
          <h3 class="empty-state__title">Keine Ergebnisse für "{searchQuery}"</h3>
        </div>
      {:else if members.length === 0}
        <div class="empty-state">
          <div class="empty-state__icon">
            <i class="fas fa-users"></i>
          </div>
          <h3 class="empty-state__title">{MESSAGES.NO_MEMBERS}</h3>
        </div>
      {:else}
        <div class="table-responsive">
          <table
            class="data-table data-table--hover data-table--striped data-table--actions-hover"
            id="my-team-table"
          >
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">E-Mail</th>
                <th scope="col">Position</th>
                <th scope="col">Rolle</th>
                <th scope="col">Verfügbarkeit</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredMembers as member (member.id)}
                {@const availability = getAvailabilityInfo(member.availabilityStatus)}
                {@const initials = getInitials(member.firstName, member.lastName)}
                {@const colorIndex = getAvatarColorIndex(member.firstName, member.lastName)}
                <tr>
                  <td>
                    <button
                      type="button"
                      class="member-link"
                      onclick={() => {
                        navigateToProfile(member);
                      }}
                    >
                      <span class="avatar avatar--sm avatar--color-{colorIndex}">
                        <span class="avatar__initials">{initials}</span>
                      </span>
                      <span class="member-link__name">
                        {member.firstName}
                        {member.lastName}
                      </span>
                    </button>
                  </td>
                  <td>
                    <a
                      href="mailto:{member.email}"
                      class="email-link">{member.email}</a
                    >
                  </td>
                  <td>{resolvePositionDisplay(member.position ?? '—', hierarchyLabels)}</td>
                  <td>
                    <span class="badge {getRoleBadgeClass(member.role)}">
                      {getRoleLabel(member.role, `${hierarchyLabels.teamLeadPrefix}leiter`)}
                    </span>
                  </td>
                  <td>
                    <span class="badge {availability.badgeClass}">
                      {availability.label}
                    </span>
                    {#if member.availabilityStart !== undefined}
                      <span class="availability-dates">
                        {formatDate(member.availabilityStart)}
                        {#if member.availabilityEnd !== undefined}
                          – {formatDate(member.availabilityEnd)}
                        {/if}
                      </span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .team-selector {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
  }

  .team-selector select {
    min-width: 200px;
  }

  .member-link {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    color: var(--color-primary);
    font-size: inherit;
    text-align: left;
  }

  .member-link:hover .member-link__name {
    text-decoration: underline;
  }

  .member-link__name {
    font-weight: 500;
  }

  .email-link {
    color: var(--color-text-secondary);
    text-decoration: none;
  }

  .email-link:hover {
    color: var(--color-primary);
    text-decoration: underline;
  }

  .availability-dates {
    display: block;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    margin-top: 0.125rem;
  }
</style>
