<script lang="ts">
  /**
   * WelcomeHero — Welcome banner with animated sakura petals.
   * Self-contained: owns floatingDotsCount state and onMount lifecycle.
   *
   * Wind reaction: cursor proximity blows petals out of reach via a quadratic
   * falloff so the user can never quite touch one. Implemented as
   * rAF-throttled mousemove → per-petal `--wind-x/-y` CSS custom properties →
   * standalone `translate` that composes additively with the existing float
   * keyframes (CSS Transforms 2: `translate` and `transform` stack, do not
   * overwrite). (Issue: dashboard hero polish, 2026-04-25)
   */
  import { onMount } from 'svelte';

  import { FLOATING_DOTS_COUNT, MESSAGES } from './constants';

  interface Props {
    /** Employee display name shown in the hero greeting */
    employeeName: string;
  }

  const { employeeName }: Props = $props();

  // Render petals in SSR markup (no $state + onMount gating).
  // WHY: previously `$state(0)` + onMount-assignment delayed petals until after
  // JS hydration → ~1 s pop-in on first paint. Constant value is SSR-safe and
  // visible at first byte. (Issue: dashboard hero perf, 2026-04-25)
  const floatingDotsCount = FLOATING_DOTS_COUNT;

  // Petal refs — populated by `bind:this` on mount; written to imperatively to
  // set per-element `--wind-x/-y`. `$state` keeps Svelte 5's array-index binding
  // semantics happy without forcing reactivity into the markup.
  const petalEls: HTMLDivElement[] = $state([]);

  /**
   * Wind reaction tuning.
   *
   * REACTION_RADIUS — distance (px) at which a petal starts fleeing the cursor.
   * MAX_PUSH        — max displacement (px) when cursor is dead-centre on a
   *                   petal. Quadratic falloff makes the flee feel like wind:
   *                   gentle near the boundary, snappy near the cursor — petal
   *                   always escapes before the cursor visually overlaps it.
   */
  const REACTION_RADIUS = 100;
  const MAX_PUSH = 75;

  let rafId = 0;
  let cursorX = -9999;
  let cursorY = -9999;
  // Cached once at mount: gating the handler entirely is cheaper than calling
  // matchMedia on every event tick.
  let reducedMotion = false;

  function updatePetals(): void {
    rafId = 0;
    const radiusSq = REACTION_RADIUS * REACTION_RADIUS;

    // Two-pass to avoid layout thrashing: batch all `getBoundingClientRect()`
    // reads first, then all `setProperty` writes. `translate` and `transform`
    // are independent CSS properties (CSS Transforms 2 spec) — they stack
    // ADDITIVELY, so wind composes with the keyframe float without fighting it.
    const updates: { el: HTMLDivElement; x: number; y: number }[] = [];
    for (const petal of petalEls) {
      const rect = petal.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = cx - cursorX;
      const dy = cy - cursorY;
      const distSq = dx * dx + dy * dy;

      if (distSq > radiusSq) {
        updates.push({ el: petal, x: 0, y: 0 });
        continue;
      }

      const dist = Math.sqrt(distSq);
      const strength = 1 - dist / REACTION_RADIUS;
      const pushMag = strength * strength * MAX_PUSH;
      const dirX = dist > 0 ? dx / dist : 0;
      const dirY = dist > 0 ? dy / dist : 0;
      updates.push({ el: petal, x: dirX * pushMag, y: dirY * pushMag });
    }

    for (const { el, x, y } of updates) {
      el.style.setProperty('--wind-x', `${x.toFixed(1)}px`);
      el.style.setProperty('--wind-y', `${y.toFixed(1)}px`);
    }
  }

  function handlePointerMove(e: MouseEvent): void {
    if (reducedMotion) return;
    cursorX = e.clientX;
    cursorY = e.clientY;
    if (rafId !== 0) return;
    rafId = requestAnimationFrame(updatePetals);
  }

  function handlePointerLeave(): void {
    if (reducedMotion) return;
    // Cursor left the hero — relax all petals back to their natural drift.
    cursorX = -9999;
    cursorY = -9999;
    for (const petal of petalEls) {
      petal.style.setProperty('--wind-x', '0px');
      petal.style.setProperty('--wind-y', '0px');
    }
  }

  onMount(() => {
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Triggers fade-in for blackboard widget — see blackboard-widget.css `.loaded`.
    setTimeout(() => {
      document.body.classList.add('loaded');
    }, 100);

    return () => {
      if (rafId !== 0) cancelAnimationFrame(rafId);
    };
  });
</script>

<!--
  role="presentation" — the mousemove/leave handlers drive a purely
  decorative cursor-aware sakura-petal wind effect (no semantic action,
  no keyboard equivalent, irrelevant on touch). Suppresses the
  a11y_no_static_element_interactions warning correctly without faking
  an interactive role. WAI-ARIA 1.1: role="presentation" === role="none".
-->
<div
  class="welcome-hero-custom relative mb-8 flex min-h-[120px] items-center
    justify-between overflow-hidden px-4 py-4
    md:px-6 md:py-5 lg:px-8 lg:py-6"
  role="presentation"
  onmousemove={handlePointerMove}
  onmouseleave={handlePointerLeave}
>
  <!-- Floating sakura petals (generated via floatingDotsCount).
       Wind reaction: cursor proximity drives `--wind-x/-y` per petal so the
       blossoms drift just out of reach — see handlePointerMove in <script>. -->
  <div class="floating-elements">
    {#each Array(floatingDotsCount) as _, i (i)}
      <div
        class="floating-dot"
        bind:this={petalEls[i]}
      ></div>
    {/each}
  </div>

  <!-- Welcome content -->
  <div class="relative z-10">
    <h1 class="mb-1 text-xl font-bold md:text-2xl lg:text-3xl">
      {MESSAGES.welcomeBack}
    </h1>
    <p class="welcome-subtitle text-base md:text-lg">
      {MESSAGES.niceToSeeYou}&nbsp;
      <span class="employee-name-hero text-2xl font-bold">{employeeName}</span>
    </p>
  </div>
</div>

<style>
  .welcome-subtitle {
    color: var(--color-text-secondary);
  }

  .employee-name-hero {
    background: linear-gradient(
      135deg,
      var(--color-text-secondary) 0%,
      var(--color-text-secondary) 33%,
      oklch(55.31% 0.1943 255.69) 66%,
      oklch(77.78% 0.1186 233.08) 83%,
      oklch(59.25% 0.2653 356.48) 100%
    );
    background-size: 300% 300%;
    background-clip: text;
    color: transparent;
    font-size: 2rem;
    animation: aurora 10s ease infinite;
  }

  @keyframes aurora {
    0% {
      background-position: 0% 50%;
    }

    50% {
      background-position: 100% 50%;
    }

    100% {
      background-position: 0% 50%;
    }
  }

  /* Floating Elements Container */
  .floating-elements {
    position: absolute;
    z-index: 1;
    inset: 0;

    /* Isolate paint area: 24 box-shadow petals must not invalidate parent paints */
    contain: layout paint;
    pointer-events: none;
  }

  /* Floating Petal Base (Sakura) */
  .floating-dot {
    position: absolute;
    animation: float 15s infinite ease-in-out;

    /* Promote to GPU layer: prevents box-shadow repaint on every transform tick.
       `translate` is hinted alongside `transform` because the wind handler
       animates it independently of the keyframe-driven transform. */
    will-change: transform, translate;

    /* Wind reaction: `--wind-x/-y` are set imperatively from handlePointerMove
       (see <script> in this file). The standalone `translate` property is
       applied INDEPENDENTLY of `transform` per CSS Transforms 2 spec, so it
       composes with the keyframe-driven `transform` (float animation) instead
       of overwriting it. Snappy ease-out: fast initial flee (escape!), gentle
       settle (relaxes back when the cursor leaves the radius). */
    translate: var(--wind-x, 0) var(--wind-y, 0);
    transition: translate 0.35s cubic-bezier(0.22, 1, 0.36, 1);
    box-shadow:
      0 0 4px oklch(84.74% 0.0858 9.04 / 40%),
      inset 0 0 2px color-mix(in oklch, var(--color-white) 60%, transparent);
    border-radius: 80% 0 55% 50% / 55% 0 80% 50%;
    background: linear-gradient(
      to top right,
      oklch(72.3% 0.1286 10.28) 0%,
      oklch(83.15% 0.0716 10.66) 45%,
      oklch(96.51% 0.0142 10.08) 100%
    );
    width: 12px;
    height: 8px;
  }

  .floating-dot:nth-child(1) {
    top: 20%;
    left: 10%;
    animation-delay: -1s;
  }

  .floating-dot:nth-child(2) {
    top: 60%;
    left: 20%;
    animation-delay: -2s;
  }

  .floating-dot:nth-child(3) {
    top: 30%;
    right: 15%;
    animation-delay: -3s;
  }

  .floating-dot:nth-child(4) {
    right: 25%;
    bottom: 40%;
    animation-delay: -4s;
  }

  .floating-dot:nth-child(5) {
    top: 80%;
    left: 35%;
    animation-delay: -5s;
    width: 9px;
    height: 6px;
  }

  .floating-dot:nth-child(6) {
    top: 10%;
    right: 40%;
    animation-delay: -6s;
    width: 15px;
    height: 10px;
  }

  .floating-dot:nth-child(7) {
    bottom: 20%;
    left: 45%;
    animation-delay: -7s;
    width: 9px;
    height: 6px;
  }

  .floating-dot:nth-child(8) {
    top: 45%;
    right: 5%;
    animation-delay: -8s;
    width: 18px;
    height: 12px;
  }

  .floating-dot:nth-child(9) {
    top: 5%;
    left: 50%;
    animation-delay: -2.5s;
    width: 6px;
    height: 4px;
  }

  .floating-dot:nth-child(10) {
    right: 60%;
    bottom: 10%;
    animation-delay: -3.5s;
    width: 15px;
    height: 10px;
  }

  .floating-dot:nth-child(11) {
    top: 70%;
    left: 8%;
    animation-delay: -4.5s;
    width: 9px;
    height: 6px;
  }

  .floating-dot:nth-child(12) {
    top: 35%;
    left: 60%;
    animation-delay: -5.5s;
    width: 12px;
    height: 8px;
  }

  .floating-dot:nth-child(13) {
    bottom: 30%;
    left: 15%;
    animation-delay: -1.2s;
    width: 6px;
    height: 4px;
  }

  .floating-dot:nth-child(14) {
    top: 15%;
    right: 30%;
    animation-delay: -2.2s;
    width: 18px;
    height: 12px;
  }

  .floating-dot:nth-child(15) {
    right: 10%;
    bottom: 50%;
    animation-delay: -3.2s;
    width: 9px;
    height: 6px;
  }

  .floating-dot:nth-child(16) {
    top: 55%;
    left: 25%;
    animation-delay: -4.2s;
    width: 15px;
    height: 10px;
  }

  .floating-dot:nth-child(17) {
    top: 25%;
    left: 75%;
    animation-delay: -1.8s;
    width: 6px;
    height: 4px;
  }

  .floating-dot:nth-child(18) {
    bottom: 5%;
    left: 55%;
    animation-delay: -2.8s;
    width: 12px;
    height: 8px;
  }

  .floating-dot:nth-child(19) {
    top: 85%;
    right: 20%;
    animation-delay: -3.8s;
    width: 9px;
    height: 6px;
  }

  .floating-dot:nth-child(20) {
    top: 40%;
    right: 45%;
    animation-delay: -4.8s;
    width: 15px;
    height: 10px;
  }

  .floating-dot:nth-child(21) {
    right: 70%;
    bottom: 25%;
    animation-delay: -1.5s;
    width: 6px;
    height: 4px;
  }

  .floating-dot:nth-child(22) {
    top: 65%;
    left: 70%;
    animation-delay: -2.5s;
    width: 18px;
    height: 12px;
  }

  .floating-dot:nth-child(23) {
    top: 12%;
    left: 30%;
    animation-delay: -3.5s;
    width: 9px;
    height: 6px;
  }

  .floating-dot:nth-child(24) {
    bottom: 35%;
    left: 85%;
    animation-delay: -4.5s;
    width: 12px;
    height: 8px;
  }

  /* Float Animation (Horizontal) */
  @keyframes float {
    0% {
      transform: translateY(0) translateX(0) rotate(0deg);
      opacity: 70%;
    }

    25% {
      transform: translateY(-8px) translateX(25px) rotate(45deg);
      opacity: 90%;
    }

    50% {
      transform: translateY(-15px) translateX(-5px) rotate(90deg);
      opacity: 100%;
    }

    75% {
      transform: translateY(-8px) translateX(-30px) rotate(135deg);
      opacity: 90%;
    }

    100% {
      transform: translateY(0) translateX(0) rotate(180deg);
      opacity: 70%;
    }
  }

  /* Float Animation (Vertical Fall) */
  @keyframes float-down {
    0% {
      transform: translateY(0) translateX(0) rotate(0deg);
      opacity: 70%;
    }

    25% {
      transform: translateY(20px) translateX(8px) rotate(60deg);
      opacity: 90%;
    }

    50% {
      transform: translateY(35px) translateX(-5px) rotate(120deg);
      opacity: 100%;
    }

    75% {
      transform: translateY(20px) translateX(-10px) rotate(180deg);
      opacity: 90%;
    }

    100% {
      transform: translateY(0) translateX(0) rotate(240deg);
      opacity: 70%;
    }
  }

  /* Apply vertical fall to every 3rd petal */
  .floating-dot:nth-child(3n) {
    animation-name: float-down;
  }

  /* prefers-reduced-motion: keep the existing float animation (pre-change
     behavior) but disable the wind reaction — no sudden darts for users
     sensitive to motion. JS handler also short-circuits via `reducedMotion`. */
  @media (prefers-reduced-motion: reduce) {
    .floating-dot {
      transition: none;
      translate: none;
    }
  }
</style>
