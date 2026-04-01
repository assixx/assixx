<script lang="ts">
  import PermissionDenied from '$lib/components/PermissionDenied.svelte';
  import { resolvePositionDisplay } from '$lib/types/hierarchy-labels.js';

  import { MESSAGES, ROLE_LABELS } from './_lib/constants.js';

  import type { PageData } from './$types.js';
  import type { UserProfile } from './_lib/types.js';

  interface Props {
    data: PageData;
  }

  const { data }: Props = $props();

  const profile: UserProfile | null = $derived(data.profile);
  const permissionDenied: boolean = $derived(data.permissionDenied);

  const hierarchyLabels = $derived(data.hierarchyLabels);

  const avatarColorIndex: number = $derived(
    profile !== null ? (profile.firstName.charCodeAt(0) + profile.lastName.charCodeAt(0)) % 10 : 0,
  );

  function formatAvailabilityDate(dateStr: string | null): string {
    if (dateStr === null || dateStr === '') return '';
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function getAvailabilityLabel(status: string | null): string {
    const labels: Record<string, string> = {
      available: 'Verfügbar',
      unavailable: 'Nicht verfügbar',
      vacation: 'Urlaub',
      sick: 'Krank',
      training: 'Schulung',
      other: 'Sonstiges',
    };
    if (status === null || status === '') return 'Verfügbar';
    return labels[status] ?? status;
  }

  function getAvailabilityBadgeClass(status: string | null): string {
    const classes: Record<string, string> = {
      available: 'badge--success',
      unavailable: 'badge--danger',
      vacation: 'badge--warning',
      sick: 'badge--danger',
      training: 'badge--info',
      other: 'badge--secondary',
    };
    if (status === null || status === '') return 'badge--success';
    return classes[status] ?? 'badge--secondary';
  }
</script>

{#if permissionDenied}
  <PermissionDenied />
{:else if profile !== null}
  <div class="container">
    <!-- Profile Header -->
    <div class="card profile-header">
      <div class="card__body">
        <div class="flex items-center gap-6">
          <div class="avatar avatar--xl avatar--color-{avatarColorIndex}">
            {#if profile.profilePicture !== null && profile.profilePicture !== ''}
              <img
                src="/api/v2/users/{profile.uuid}/profile-picture"
                alt="{profile.firstName} {profile.lastName}"
                class="avatar__image"
              />
            {:else}
              <span class="avatar__initials">
                {profile.firstName.charAt(0)}{profile.lastName.charAt(0)}
              </span>
            {/if}
          </div>
          <div>
            <h1 class="profile-name">{profile.firstName} {profile.lastName}</h1>
            {#if profile.position !== null}
              <p class="mt-1 text-(--color-text-secondary)">
                {resolvePositionDisplay(profile.position, hierarchyLabels)}
              </p>
            {/if}
            <span class="badge badge--role-{profile.role} mt-2">
              {ROLE_LABELS[profile.role] ?? profile.role}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Info Sections -->
    <div class="profile-grid">
      <!-- Persönliche Informationen -->
      <div class="card">
        <div class="card__header">
          <h2 class="card__title">
            <i class="fas fa-user mr-2"></i>
            {MESSAGES.SECTION_PERSONAL}
          </h2>
        </div>
        <div class="card__body">
          <dl class="info-list">
            <div class="info-list__row">
              <dt>{MESSAGES.LABEL_EMAIL}</dt>
              <dd>
                <a
                  href="mailto:{profile.email}"
                  class="email-link">{profile.email}</a
                >
              </dd>
            </div>
            {#if profile.position !== null}
              <div class="info-list__row">
                <dt>{MESSAGES.LABEL_POSITION}</dt>
                <dd>{resolvePositionDisplay(profile.position, hierarchyLabels)}</dd>
              </div>
            {/if}
            {#if profile.employeeNumber !== null}
              <div class="info-list__row">
                <dt>{MESSAGES.LABEL_EMPLOYEE_NR}</dt>
                <dd>{profile.employeeNumber}</dd>
              </div>
            {/if}
            {#if profile.phone !== null}
              <div class="info-list__row">
                <dt>{MESSAGES.LABEL_PHONE}</dt>
                <dd>{profile.phone}</dd>
              </div>
            {/if}
          </dl>
        </div>
      </div>

      <!-- Organisation -->
      <div class="card">
        <div class="card__header">
          <h2 class="card__title">
            <i class="fas fa-sitemap mr-2"></i>
            {MESSAGES.SECTION_ORG}
          </h2>
        </div>
        <div class="card__body">
          <dl class="info-list">
            {#if profile.teamNames !== null && profile.teamNames.length > 0}
              <div class="info-list__row">
                <dt>{hierarchyLabels.team}</dt>
                <dd class="flex flex-wrap gap-1">
                  {#each profile.teamNames as teamName (teamName)}
                    <span class="badge badge--primary">{teamName}</span>
                  {/each}
                </dd>
              </div>
            {/if}
            {#if profile.departmentNames !== null && profile.departmentNames.length > 0}
              <div class="info-list__row">
                <dt>{hierarchyLabels.department}</dt>
                <dd class="flex flex-wrap gap-1">
                  {#each profile.departmentNames as deptName (deptName)}
                    <span class="badge badge--secondary">{deptName}</span>
                  {/each}
                </dd>
              </div>
            {/if}
            {#if (profile.teamNames === null || profile.teamNames.length === 0) && (profile.departmentNames === null || profile.departmentNames.length === 0)}
              <div class="info-list__row">
                <dt>Zuordnung</dt>
                <dd class="text-(--color-text-secondary)">Keine Zuordnung</dd>
              </div>
            {/if}
          </dl>
        </div>
      </div>

      <!-- Verfügbarkeit -->
      <div class="card profile-section--full">
        <div class="card__header">
          <h2 class="card__title">
            <i class="fas fa-clock mr-2"></i>
            {MESSAGES.SECTION_AVAILABILITY}
          </h2>
        </div>
        <div class="card__body">
          <dl class="info-list">
            <div class="info-list__row">
              <dt>{MESSAGES.LABEL_STATUS}</dt>
              <dd>
                <span class="badge {getAvailabilityBadgeClass(profile.availabilityStatus)}">
                  {getAvailabilityLabel(profile.availabilityStatus)}
                </span>
              </dd>
            </div>
            {#if profile.availabilityStart !== null}
              <div class="info-list__row">
                <dt>{MESSAGES.LABEL_PERIOD}</dt>
                <dd>
                  {formatAvailabilityDate(profile.availabilityStart)}
                  {#if profile.availabilityEnd !== null}
                    – {formatAvailabilityDate(profile.availabilityEnd)}
                  {/if}
                </dd>
              </div>
            {/if}
            {#if profile.availabilityNotes !== null && profile.availabilityNotes !== ''}
              <div class="info-list__row">
                <dt>{MESSAGES.LABEL_NOTES}</dt>
                <dd>{profile.availabilityNotes}</dd>
              </div>
            {/if}
          </dl>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .profile-header {
    margin-bottom: var(--spacing-6);
  }

  .profile-name {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0;
  }

  .profile-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--spacing-6);
  }

  @media (width >= 640px) {
    .profile-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  .profile-section--full {
    grid-column: 1 / -1;
  }

  .info-list {
    margin: 0;
  }

  .info-list__row {
    display: flex;
    padding: var(--spacing-2) 0;
    border-bottom: 1px solid var(--glass-border, rgb(255 255 255 / 10%));
  }

  .info-list__row:last-child {
    border-bottom: none;
  }

  .info-list__row dt {
    flex: 0 0 140px;
    color: var(--color-text-secondary);
    font-weight: 500;
    font-size: 0.875rem;
  }

  .info-list__row dd {
    flex: 1;
    margin: 0;
    color: var(--color-text-primary);
  }

  .email-link {
    color: var(--color-primary);
    text-decoration: none;
  }

  .email-link:hover {
    text-decoration: underline;
  }
</style>
