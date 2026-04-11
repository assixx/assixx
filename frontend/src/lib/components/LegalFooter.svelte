<script lang="ts">
  import { resolve } from '$app/paths';

  interface Props {
    compact?: boolean;
  }

  const { compact = false }: Props = $props();

  const year = new Date().getFullYear();
</script>

{#if compact}
  <div class="legal-footer legal-footer--compact">
    <span class="legal-footer__copy">&copy; {year} Assixx</span>
    <span class="legal-footer__sep">&middot;</span>
    <a href={resolve('/impressum')}>Impressum</a>
    <span class="legal-footer__sep">&middot;</span>
    <a href={resolve('/datenschutz')}>Datenschutz</a>
  </div>
{:else}
  <footer class="legal-footer">
    <span class="legal-footer__copy">&copy; {year} Assixx. Alle Rechte vorbehalten.</span>
    <nav class="legal-footer__links">
      <a href={resolve('/impressum')}>Impressum</a>
      <span class="legal-footer__sep">&middot;</span>
      <a href={resolve('/datenschutz')}>Datenschutz</a>
    </nav>
  </footer>
{/if}

<style>
  .legal-footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: var(--spacing-2) var(--spacing-4);
    border-top: var(--glass-border);
    padding: var(--spacing-6) 5%;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    text-align: center;
  }

  .legal-footer--compact {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: var(--spacing-1) var(--spacing-2);
    border-top: none;
    padding: 0;
    color: var(--color-text-secondary);
    font-size: 0.8125rem;
    text-align: center;
  }

  .legal-footer__links {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
  }

  .legal-footer__sep {
    color: var(--color-text-secondary);
    opacity: 0.5;
  }

  .legal-footer a {
    transition: color 0.2s ease;
    color: var(--color-text-secondary);
    text-decoration: none;
  }

  .legal-footer a:hover {
    color: var(--color-primary);
    text-decoration: underline;
  }
</style>
