<script lang="ts">
  import { resolve } from '$app/paths';

  interface Props {
    compact?: boolean;
  }

  const { compact = false }: Props = $props();

  const year = new Date().getFullYear();
</script>

{#if compact}
  <div class="legal-footer-compact">
    <div class="legal-footer-compact__inner">
      <span class="legal-footer-compact__copy">&copy; {year} Assixx</span>
      <span
        class="legal-footer-compact__dot"
        aria-hidden="true">&bull;</span
      >
      <a href={resolve('/impressum')}>Impressum</a>
      <span
        class="legal-footer-compact__dot"
        aria-hidden="true">&bull;</span
      >
      <a href={resolve('/datenschutz')}>Datenschutz</a>
    </div>
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
  /* Non-compact variant (fallback, rarely used now) */
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

  /* --------------------------------------------------------------------- */
  /* Compact variant — sits at end of page flow, visible on scroll-to-end  */
  /* --------------------------------------------------------------------- */

  .legal-footer-compact {
    width: 100%;
    border-top: 1px solid color-mix(in oklch, var(--color-text-secondary) 18%, transparent);
  }

  .legal-footer-compact__inner {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: var(--spacing-3);
    margin: 0 auto;
    padding: var(--spacing-3) var(--spacing-5);
    max-width: 1200px;
    color: var(--text-secondary);
    font-size: 0.8125rem;
    letter-spacing: 0.01em;
    text-align: center;
  }

  .legal-footer-compact__copy {
    color: var(--text-secondary);
    font-weight: 500;
  }

  .legal-footer-compact__dot {
    color: var(--text-secondary);
    opacity: 0.35;
  }

  .legal-footer-compact a {
    position: relative;
    padding-bottom: 1px;
    transition: color 0.2s ease;
    color: var(--text-secondary);
    text-decoration: none;
  }

  .legal-footer-compact a::after {
    content: '';
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    transform: scaleX(0);
    transform-origin: center;
    transition: transform 0.25s var(--ease-out, ease-out);
    background: var(--color-primary);
    height: 1px;
  }

  .legal-footer-compact a:hover {
    color: var(--color-primary);
  }

  .legal-footer-compact a:hover::after {
    transform: scaleX(1);
  }

  @media (prefers-reduced-motion: reduce) {
    .legal-footer-compact a::after {
      transition: none;
    }
  }
</style>
