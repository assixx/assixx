<script lang="ts">
  import { kvpDetailState } from './state.svelte';

  interface Props {
    onconfirm: () => void;
  }

  const { onconfirm }: Props = $props();
</script>

{#if kvpDetailState.showShareModal}
  <div class="modal-overlay modal-overlay--active">
    <div class="ds-modal ds-modal--md">
      <div class="ds-modal__header">
        <h3 class="ds-modal__title">Vorschlag teilen</h3>
        <button
          type="button"
          class="ds-modal__close"
          aria-label="Schliessen"
          onclick={() => {
            kvpDetailState.closeShareModal();
          }}
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="ds-modal__body">
        <p class="mb-6">
          Waehlen Sie die Organisationsebene aus, auf der Sie diesen Vorschlag teilen moechten:
        </p>

        <div class="choice-group">
          <!-- Team -->
          <label class="choice-card choice-card--lg">
            <input
              type="radio"
              name="orgLevel"
              value="team"
              class="choice-card__input"
              checked={kvpDetailState.selectedShareLevel === 'team'}
              onchange={() => {
                kvpDetailState.setSelectedShareLevel('team');
              }}
            />
            <span class="choice-card__text">
              Team
              <span class="choice-card__description">Fuer alle Team-Mitglieder sichtbar</span>
            </span>
            <!-- Dropdown inside label like Legacy -->
            {#if kvpDetailState.selectedShareLevel === 'team'}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="dropdown"
                data-dropdown="shareTeam"
                onclick={(e) => {
                  e.stopPropagation();
                }}
              >
                <button
                  type="button"
                  class="dropdown__trigger"
                  class:active={kvpDetailState.activeDropdown === 'shareTeam'}
                  onclick={(e) => {
                    e.preventDefault();
                    kvpDetailState.toggleDropdown('shareTeam');
                  }}
                >
                  <span>
                    {kvpDetailState.selectedOrgId !== null
                      ? (kvpDetailState.teams.find((t) => t.id === kvpDetailState.selectedOrgId)
                          ?.name ?? 'Team auswaehlen...')
                      : 'Team auswaehlen...'}
                  </span>
                  <i class="fas fa-chevron-down"></i>
                </button>
                <div
                  class="dropdown__menu"
                  class:active={kvpDetailState.activeDropdown === 'shareTeam'}
                >
                  {#each kvpDetailState.teams as team (team.id)}
                    <button
                      type="button"
                      class="dropdown__option"
                      onclick={(e) => {
                        e.preventDefault();
                        kvpDetailState.setSelectedOrgId(team.id);
                        kvpDetailState.closeAllDropdowns();
                      }}
                    >
                      {team.name}
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
          </label>

          <!-- Department -->
          <label class="choice-card choice-card--lg">
            <input
              type="radio"
              name="orgLevel"
              value="department"
              class="choice-card__input"
              checked={kvpDetailState.selectedShareLevel === 'department'}
              onchange={() => {
                kvpDetailState.setSelectedShareLevel('department');
              }}
            />
            <span class="choice-card__text">
              Abteilung
              <span class="choice-card__description">Fuer Ihre gesamte Abteilung sichtbar</span>
            </span>
            <!-- Dropdown inside label like Legacy -->
            {#if kvpDetailState.selectedShareLevel === 'department'}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="dropdown"
                data-dropdown="shareDept"
                onclick={(e) => {
                  e.stopPropagation();
                }}
              >
                <button
                  type="button"
                  class="dropdown__trigger"
                  class:active={kvpDetailState.activeDropdown === 'shareDept'}
                  onclick={(e) => {
                    e.preventDefault();
                    kvpDetailState.toggleDropdown('shareDept');
                  }}
                >
                  <span>
                    {kvpDetailState.selectedOrgId !== null
                      ? (kvpDetailState.departments.find(
                          (d) => d.id === kvpDetailState.selectedOrgId,
                        )?.name ?? 'Abteilung auswaehlen...')
                      : 'Abteilung auswaehlen...'}
                  </span>
                  <i class="fas fa-chevron-down"></i>
                </button>
                <div
                  class="dropdown__menu"
                  class:active={kvpDetailState.activeDropdown === 'shareDept'}
                >
                  {#each kvpDetailState.departments as dept (dept.id)}
                    <button
                      type="button"
                      class="dropdown__option"
                      onclick={(e) => {
                        e.preventDefault();
                        kvpDetailState.setSelectedOrgId(dept.id);
                        kvpDetailState.closeAllDropdowns();
                      }}
                    >
                      {dept.name}
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
          </label>

          <!-- Area -->
          <label class="choice-card choice-card--lg">
            <input
              type="radio"
              name="orgLevel"
              value="area"
              class="choice-card__input"
              checked={kvpDetailState.selectedShareLevel === 'area'}
              onchange={() => {
                kvpDetailState.setSelectedShareLevel('area');
              }}
            />
            <span class="choice-card__text">
              Bereich
              <span class="choice-card__description">Fuer alle im gleichen Bereich sichtbar</span>
            </span>
            <!-- Dropdown inside label like Legacy -->
            {#if kvpDetailState.selectedShareLevel === 'area'}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="dropdown"
                data-dropdown="shareArea"
                onclick={(e) => {
                  e.stopPropagation();
                }}
              >
                <button
                  type="button"
                  class="dropdown__trigger"
                  class:active={kvpDetailState.activeDropdown === 'shareArea'}
                  onclick={(e) => {
                    e.preventDefault();
                    kvpDetailState.toggleDropdown('shareArea');
                  }}
                >
                  <span>
                    {kvpDetailState.selectedOrgId !== null
                      ? (kvpDetailState.areas.find((a) => a.id === kvpDetailState.selectedOrgId)
                          ?.name ?? 'Bereich auswaehlen...')
                      : 'Bereich auswaehlen...'}
                  </span>
                  <i class="fas fa-chevron-down"></i>
                </button>
                <div
                  class="dropdown__menu"
                  class:active={kvpDetailState.activeDropdown === 'shareArea'}
                >
                  {#each kvpDetailState.areas as area (area.id)}
                    <button
                      type="button"
                      class="dropdown__option"
                      onclick={(e) => {
                        e.preventDefault();
                        kvpDetailState.setSelectedOrgId(area.id);
                        kvpDetailState.closeAllDropdowns();
                      }}
                    >
                      {area.name}
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
          </label>

          <!-- Company -->
          <label class="choice-card choice-card--lg">
            <input
              type="radio"
              name="orgLevel"
              value="company"
              class="choice-card__input"
              checked={kvpDetailState.selectedShareLevel === 'company'}
              onchange={() => {
                kvpDetailState.setSelectedShareLevel('company');
              }}
            />
            <span class="choice-card__text">
              Firma
              <span class="choice-card__description">Fuer die gesamte Firma sichtbar</span>
            </span>
          </label>
        </div>
      </div>
      <div class="ds-modal__footer ds-modal__footer--right">
        <button
          type="button"
          class="btn btn-cancel"
          onclick={() => {
            kvpDetailState.closeShareModal();
          }}
        >
          Abbrechen
        </button>
        <button
          type="button"
          class="btn btn-modal"
          onclick={onconfirm}
          disabled={kvpDetailState.isSharing}
        >
          {#if kvpDetailState.isSharing}
            <i class="fas fa-spinner fa-spin"></i>
          {/if}
          Teilen
        </button>
      </div>
    </div>
  </div>
{/if}
