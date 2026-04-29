<!--
  /versioninfo — Version info & developer changelog page.

  Shows:
  - Current app version (build-time constant from vite `define`)
  - Development-status disclaimer
  - Rendered root CHANGELOG.md (aggregated from backend/frontend/shared by
    scripts/aggregate-changelog.mjs — see docs/how-to/HOW-TO-USE-CHANGESETS.md)
  - "Fehler melden" button → scrolls to inline bug-report form (Phase 3)

  DOMPurify runs client-side only. SSR would require jsdom; we avoid the
  dependency by sanitising in `$effect` after hydration. The CHANGELOG is
  a project-owned artefact, so the HTML is trusted — sanitisation is
  defence-in-depth to satisfy svelte/no-at-html-tags and no-unsanitized.
-->
<script lang="ts">
  import DOMPurify from 'dompurify';

  import BugReportForm from './_lib/BugReportForm.svelte';

  import type { PageData } from './$types';

  const appVersion: string = __APP_VERSION__;

  const { data }: { data: PageData } = $props();

  // DOMPurify needs DOM APIs (window/document) and is not safe during SSR.
  // `$derived.by` with a `typeof window` guard returns '' on the server and the
  // sanitised HTML once hydration reaches the client — no hydration mismatch
  // because both outputs settle deterministically on their respective sides.
  const sanitizedChangelog: string = $derived.by(() => {
    if (typeof window === 'undefined') return '';
    return DOMPurify.sanitize(data.changelogHtml, {
      USE_PROFILES: { html: true },
    });
  });
</script>

<svelte:head>
  <title>Versionsinfo · Assixx</title>
</svelte:head>

<div class="versioninfo-wrapper">
  <!-- Header: Version & Disclaimer -->
  <section class="version-hero">
    <div class="hero-badge">
      <i class="fas fa-code-branch"></i>
      <span class="hero-version">v{appVersion}</span>
    </div>

    <h1 class="hero-title">Assixx Versionsinfo</h1>

    <p class="hero-disclaimer">
      Diese Anwendung befindet sich in aktiver Entwicklung. Einzelne Funktionen können unvollständig
      sein oder sich noch ändern — bitte etwas Nachsicht, wenn dir ein Fehler auffällt. Am
      hilfreichsten ist, wenn du ihn
      <a
        href="#bug-report"
        class="inline-link">direkt meldest</a
      >
      — jede Meldung geht unmittelbar an das Entwicklerteam.
    </p>

    <div class="hero-actions">
      <a
        href="#bug-report"
        class="btn btn-primary"
      >
        <i class="fas fa-bug"></i>
        Fehler melden
      </a>
      <!-- Link to public roadmap & disclaimer page (Beta-Phase, Hosting, RTO/RPO).
           Surfaces the long-term plan to authenticated users on /versioninfo. -->
      <a
        href="/disclaimer"
        class="btn btn-cancel"
      >
        <i class="fas fa-route"></i>
        Roadmap ansehen
      </a>
    </div>
  </section>

  <!-- Changelog -->
  <section
    class="card changelog-card"
    aria-labelledby="changelog-heading"
  >
    <div class="card__header">
      <h2
        id="changelog-heading"
        class="card__title"
      >
        <i class="fas fa-history"></i>
        Änderungshistorie
      </h2>
      <p class="card__subtitle">
        Aggregiert aus Backend-, Frontend- und Shared-Änderungen per Changesets.
      </p>
    </div>

    <div class="card__body">
      {#if sanitizedChangelog === ''}
        <!-- SSR / pre-hydration placeholder. Replaced once $effect runs. -->
        <div
          class="skeleton skeleton--text"
          aria-hidden="true"
        ></div>
        <div
          class="skeleton skeleton--text"
          aria-hidden="true"
        ></div>
        <div
          class="skeleton skeleton--text skeleton--short"
          aria-hidden="true"
        ></div>
      {:else}
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- Client-sanitised (DOMPurify) from project-owned CHANGELOG.md -->
        <div class="changelog-content">{@html sanitizedChangelog}</div>
      {/if}
    </div>
  </section>

  <!-- Bug-Report Anchor (Form arrives in Phase 3) -->
  <section
    id="bug-report"
    class="card bug-report-card"
    aria-labelledby="bug-report-heading"
  >
    <div class="card__header">
      <h2
        id="bug-report-heading"
        class="card__title"
      >
        <i class="fas fa-bug"></i>
        Fehler melden
      </h2>
      <p class="card__subtitle">
        Die Nachricht geht direkt an <strong>info@assixx.com</strong>.
      </p>
    </div>

    <div class="card__body">
      <BugReportForm />
    </div>
  </section>
</div>

<style>
  .versioninfo-wrapper {
    display: flex;
    flex-direction: column;
    gap: 24px;

    margin: 0 auto;
    padding: 24px;

    max-width: 920px;
  }

  /* Hero block — page identity + disclaimer + primary CTA */
  .version-hero {
    display: flex;
    flex-direction: column;
    gap: 16px;

    padding: 32px;

    border: var(--glass-border);
    border-radius: var(--radius-xl);
    background: var(--glass-bg);

    text-align: left;
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    align-self: flex-start;

    padding: 4px 12px;

    border: 1px solid var(--color-primary);
    border-radius: var(--radius-pill, 999px);
    background: color-mix(in oklch, var(--color-primary) 12%, transparent);

    color: var(--color-primary);
    font-weight: 600;
    font-size: 0.75rem;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .hero-version {
    font-variant-numeric: tabular-nums;
  }

  .hero-title {
    margin: 0;
    color: var(--color-text-primary);
    font-weight: 600;
    font-size: 1.75rem;
    line-height: 1.2;
  }

  .hero-disclaimer {
    margin: 0;
    max-width: 64ch;
    color: var(--color-text-secondary);
    font-size: 0.95rem;
    line-height: 1.6;
  }

  .inline-link {
    color: var(--color-primary);
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 3px;
  }

  .hero-actions {
    display: flex;
    gap: 12px;
    margin-top: 8px;
  }

  /* Changelog content — styles markdown output from marked */
  .changelog-content :global(h2) {
    margin-top: 24px;
    margin-bottom: 8px;
    padding-bottom: 4px;

    border-bottom: 1px solid
      var(--glass-border-color, color-mix(in oklch, var(--color-white) 10%, transparent));

    color: var(--color-primary);
    font-size: 1.1rem;
  }

  .changelog-content :global(h2:first-child) {
    margin-top: 0;
  }

  .changelog-content :global(h3) {
    margin-top: 16px;
    margin-bottom: 6px;

    color: var(--color-text-primary);
    font-size: 0.95rem;
  }

  .changelog-content :global(ul) {
    margin: 8px 0;
    padding-left: 20px;
    list-style: disc;
  }

  .changelog-content :global(li) {
    margin-bottom: 4px;
    color: var(--color-text-secondary);
    line-height: 1.6;
  }

  .changelog-content :global(code) {
    padding: 1px 6px;

    border-radius: 4px;
    background: color-mix(in oklch, var(--color-white) 8%, transparent);

    font-size: 0.85em;
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, monospace);
  }

  /* Skeleton loaders while sanitisation runs on client */
  .skeleton {
    margin-bottom: 10px;

    border-radius: 4px;

    background: linear-gradient(
      90deg,
      color-mix(in oklch, var(--color-white) 4%, transparent) 0%,
      color-mix(in oklch, var(--color-white) 10%, transparent) 50%,
      color-mix(in oklch, var(--color-white) 4%, transparent) 100%
    );

    background-size: 200% 100%;
    animation: skeleton-pulse 1.5s ease-in-out infinite;
  }

  .skeleton--text {
    width: 100%;
    height: 14px;
  }

  .skeleton--short {
    width: 60%;
  }

  @keyframes skeleton-pulse {
    0% {
      background-position: 200% 0;
    }

    100% {
      background-position: -200% 0;
    }
  }

  @media (width <= 640px) {
    .versioninfo-wrapper {
      padding: 16px;
    }

    .version-hero {
      padding: 20px;
    }

    .hero-title {
      font-size: 1.5rem;
    }
  }
</style>
