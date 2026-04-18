<!--
  DomainRow.svelte
  One row in the domains table — domain text, status badge, primary marker,
  added-date, action buttons (verify / make-primary / remove).

  Action callbacks bubble to `+page.svelte` which calls the state-data
  mutations (`verifyDomain` / `setPrimary` / `removeDomain`). The row is dumb:
  no API, no state mutation. `isPending` disables actions during in-flight
  calls so the user can't double-click.

  @see masterplan §5.1 — DomainRow
-->
<script lang="ts">
  import type { TenantDomain } from './types.js';

  interface Props {
    domain: TenantDomain;
    /** True when ANY action on this specific row is in-flight (page-level guard). */
    isPending: boolean;
    onverify: (id: string) => void;
    onprimary: (id: string) => void;
    onremove: (id: string) => void;
  }

  const { domain, isPending, onverify, onprimary, onremove }: Props = $props();

  /**
   * Map status → badge variant. The design-system has `--active` / `--warning`
   * / `--inactive` semantic variants — we map `verified` → active (green),
   * `pending` → warning (orange/amber), `failed`/`expired` → inactive (gray).
   */
  const statusVariant = $derived(
    domain.status === 'verified' ? 'badge--active'
    : domain.status === 'pending' ? 'badge--warning'
    : 'badge--inactive',
  );

  const statusLabel = $derived(
    domain.status === 'verified' ? 'Verifiziert'
    : domain.status === 'pending' ? 'Ausstehend'
    : domain.status === 'failed' ? 'Fehlgeschlagen'
    : 'Abgelaufen',
  );

  /** German-locale short date — `de-DE` matches the rest of the UI. */
  const formattedDate = $derived(
    new Date(domain.createdAt).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
  );
</script>

<tr
  data-testid="domain-row"
  data-domain-id={domain.id}
>
  <td class="font-mono break-all">{domain.domain}</td>
  <td>
    <span
      class="badge {statusVariant}"
      data-testid="domain-status">{statusLabel}</span
    >
  </td>
  <td class="text-center">
    {#if domain.isPrimary}
      <i
        class="fas fa-star text-(--color-warning)"
        aria-label="Primär-Domain"
        title="Primär-Domain"
      ></i>
    {/if}
  </td>
  <td>{formattedDate}</td>
  <td>
    <div class="flex justify-end gap-2">
      {#if domain.status !== 'verified'}
        <button
          type="button"
          class="btn btn-primary btn-sm"
          disabled={isPending}
          onclick={() => {
            onverify(domain.id);
          }}
          data-testid="verify-btn"
        >
          Jetzt verifizieren
        </button>
      {/if}
      {#if domain.status === 'verified' && !domain.isPrimary}
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          disabled={isPending}
          onclick={() => {
            onprimary(domain.id);
          }}
          data-testid="primary-btn"
        >
          Als Primär setzen
        </button>
      {/if}
      <button
        type="button"
        class="btn btn-danger btn-sm"
        disabled={isPending}
        onclick={() => {
          onremove(domain.id);
        }}
        aria-label="Domain entfernen"
        data-testid="remove-btn"
      >
        <i
          class="fas fa-trash"
          aria-hidden="true"
        ></i>
      </button>
    </div>
  </td>
</tr>
