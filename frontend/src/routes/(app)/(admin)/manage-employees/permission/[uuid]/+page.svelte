<script lang="ts">
  /**
   * Permission Management - Page Component
   * @module manage-employees/permission/[uuid]/+page
   *
   * Categorized permission UI using choice-card design system components.
   * Pure UI - no backend logic yet.
   */
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  import { showSuccessAlert, showWarningAlert } from '$lib/utils';

  import type { PageData } from './$types';

  // =============================================================================
  // SSR DATA
  // =============================================================================

  const { data }: { data: PageData } = $props();

  const employee = $derived(data.employee);
  const error = $derived(data.error);

  // =============================================================================
  // PERMISSION STATE (UI only - not persisted yet)
  // =============================================================================

  interface ModulePermission {
    key: string;
    label: string;
    icon: string;
    canRead: boolean;
    canWrite: boolean;
    canDelete: boolean;
  }

  interface PermissionCategory {
    key: string;
    label: string;
    icon: string;
    modules: ModulePermission[];
  }

  const categories = $state<PermissionCategory[]>([
    {
      key: 'blackboard',
      label: 'Schwarzes Brett',
      icon: 'fa-clipboard',
      modules: [
        {
          key: 'blackboard-notes',
          label: 'Notes',
          icon: 'fa-sticky-note',
          canRead: false,
          canWrite: false,
          canDelete: false,
        },
        {
          key: 'blackboard-archive',
          label: 'Archivieren',
          icon: 'fa-archive',
          canRead: false,
          canWrite: false,
          canDelete: false,
        },
      ],
    },
  ]);

  // =============================================================================
  // PERMISSION LABELS
  // =============================================================================

  const PERMISSION_LABELS: Record<
    'canRead' | 'canWrite' | 'canDelete',
    string
  > = {
    canRead: 'Leseberechtigung',
    canWrite: 'Schreibberechtigung',
    canDelete: 'Löschberechtigung',
  };

  // =============================================================================
  // HANDLERS
  // =============================================================================

  /**
   * Show toast notification when a permission checkbox is toggled.
   * bind:checked updates state first, then onchange fires with the new value.
   */
  function handlePermissionToggle(
    perm: ModulePermission,
    type: 'canRead' | 'canWrite' | 'canDelete',
  ): void {
    const isActive = perm[type];
    const label = PERMISSION_LABELS[type];

    if (isActive) {
      showSuccessAlert(`${label} für "${perm.label}" aktiviert`);
    } else {
      showWarningAlert(`${label} für "${perm.label}" deaktiviert`);
    }
  }

  // =============================================================================
  // HELPERS
  // =============================================================================

  function resolvePath(path: string): string {
    return (resolve as (p: string) => string)(path);
  }

  function goBack(): void {
    void goto(resolvePath('/manage-employees'));
  }
</script>

<svelte:head>
  <title
    >Berechtigungen - {employee?.firstName ?? ''}
    {employee?.lastName ?? ''} - Assixx</title
  >
</svelte:head>

<div class="container">
  <!-- Back Button -->
  <div class="mb-4">
    <button
      type="button"
      class="btn btn-light"
      onclick={goBack}
    >
      <i class="fas fa-arrow-left mr-2"></i>Zurück zur Mitarbeiterverwaltung
    </button>
  </div>

  <div class="card">
    <div class="card__header">
      <h2 class="card__title">
        <i class="fas fa-shield-alt mr-2"></i>
        Berechtigungen
      </h2>
      {#if employee}
        <p class="mt-1 text-[var(--color-text-secondary)]">
          <i class="fas fa-user mr-1"></i>
          {employee.firstName}
          {employee.lastName}
        </p>
      {/if}
    </div>

    <div class="card__body">
      {#if error}
        <div class="p-6 text-center">
          <i
            class="fas fa-exclamation-triangle mb-4 text-4xl text-[var(--color-danger)]"
          ></i>
          <p class="text-[var(--color-text-secondary)]">{error}</p>
        </div>
      {:else}
        <div class="flex flex-col gap-8">
          {#each categories as category (category.key)}
            <!-- Category Header -->
            <div>
              <h3
                class="mb-4 border-b border-[var(--color-glass-border)] pb-2 text-lg font-semibold text-[var(--color-text-primary)]"
              >
                <i class="fas {category.icon} mr-2 text-[var(--color-primary)]"
                ></i>
                {category.label}
              </h3>

              <!-- Module Rows -->
              <div class="flex flex-col gap-4">
                {#each category.modules as perm (perm.key)}
                  <div
                    class="flex items-center gap-6 max-sm:flex-col max-sm:items-start"
                  >
                    <!-- Module Name -->
                    <div
                      class="min-w-48 shrink-0 font-medium text-[var(--color-text-primary)]"
                    >
                      <i
                        class="fas {perm.icon} mr-2 text-[var(--color-text-secondary)]"
                      ></i>
                      {perm.label}
                    </div>

                    <!-- Permission Choice Cards (inline) -->
                    <div class="flex flex-wrap gap-16">
                      <div class="flex items-center gap-2">
                        <label class="choice-card">
                          <input
                            type="checkbox"
                            class="choice-card__input"
                            bind:checked={perm.canRead}
                            onchange={() => {
                              handlePermissionToggle(perm, 'canRead');
                            }}
                          />
                          <span class="choice-card__text">
                            <i
                              class="fas fa-eye mr-1 text-[var(--color-primary)]"
                            ></i>
                            Lesen
                          </span>
                        </label>
                        <span class="tooltip">
                          <i class="fas fa-info-circle"></i>
                          <span
                            class="tooltip__content tooltip__content--info tooltip__content--right"
                            role="tooltip"
                          >
                            Daten und Inhalte einsehen, ohne sie zu verändern.
                          </span>
                        </span>
                      </div>

                      <div class="flex items-center gap-2">
                        <label class="choice-card">
                          <input
                            type="checkbox"
                            class="choice-card__input"
                            bind:checked={perm.canWrite}
                            onchange={() => {
                              handlePermissionToggle(perm, 'canWrite');
                            }}
                          />
                          <span class="choice-card__text">
                            <i
                              class="fas fa-pencil-alt mr-1 text-[var(--color-primary)]"
                            ></i>
                            Schreiben
                          </span>
                        </label>
                        <span class="tooltip">
                          <i class="fas fa-info-circle"></i>
                          <span
                            class="tooltip__content tooltip__content--info tooltip__content--right"
                            role="tooltip"
                          >
                            Neue Einträge erstellen und bestehende bearbeiten.
                          </span>
                        </span>
                      </div>

                      <div class="flex items-center gap-2">
                        <label class="choice-card">
                          <input
                            type="checkbox"
                            class="choice-card__input"
                            bind:checked={perm.canDelete}
                            onchange={() => {
                              handlePermissionToggle(perm, 'canDelete');
                            }}
                          />
                          <span class="choice-card__text">
                            <i
                              class="fas fa-trash-alt mr-1 text-[var(--color-primary)]"
                            ></i>
                            Löschen
                          </span>
                        </label>
                        <span class="tooltip">
                          <i class="fas fa-info-circle"></i>
                          <span
                            class="tooltip__content tooltip__content--info tooltip__content--right"
                            role="tooltip"
                          >
                            Einträge dauerhaft löschen. Kann nicht rückgängig
                            gemacht werden.
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
