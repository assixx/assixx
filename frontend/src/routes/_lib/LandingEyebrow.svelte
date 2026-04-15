<!--
  LandingEyebrow.svelte
  Shared eyebrow treatment for landing-page sections — bracket-label
  centred between two short gradient-hairlines. Used by ModuleGrid,
  SecuritySection and PricingSection so the visual rhythm across all
  three is identical. Accent defaults to --color-primary; pass a
  custom one if a section needs a different hue. Tuning the hairline
  intensity is a single literal below (--eyebrow-hairline-alpha).
-->
<script lang="ts">
  interface Props {
    /** Full label text, typically bracketed e.g. `[ MODULE // 01 — 04 ]`. */
    text: string;
    /** Optional colour override. Defaults to the brand primary. */
    accent?: string;
  }

  const { text, accent = 'var(--color-primary)' }: Props = $props();
</script>

<p
  class="landing-eyebrow"
  style="--eyebrow-accent: {accent};"
>
  {text}
</p>

<style>
  /*
    Eyebrow with flanking gradient-hairlines (technical-drawing flavour).
    Flex layout centers the label between two short hairlines that fade
    in toward the text. Tune --eyebrow-hairline-alpha to change how
    prominent the lines feel across ALL sections at once.
  */
  .landing-eyebrow {
    --eyebrow-hairline-alpha: 65%;

    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--spacing-4);
    margin: 0 0 var(--spacing-4) 0;

    color: var(--eyebrow-accent);
    font-family: ui-monospace, 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    animation: fade-in-up var(--duration-slow) var(--ease-out) both;
  }

  .landing-eyebrow::before,
  .landing-eyebrow::after {
    content: '';
    display: block;
    width: clamp(40px, 8vw, 88px);
    height: 1px;
  }

  .landing-eyebrow::before {
    background: linear-gradient(
      to right,
      transparent,
      color-mix(in oklch, var(--eyebrow-accent) var(--eyebrow-hairline-alpha), transparent)
    );
  }

  .landing-eyebrow::after {
    background: linear-gradient(
      to left,
      transparent,
      color-mix(in oklch, var(--eyebrow-accent) var(--eyebrow-hairline-alpha), transparent)
    );
  }
</style>
