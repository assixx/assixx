<!--
  Rate Limit Page
  1:1 Migration from frontend/src/pages/rate-limit.html

  Standalone page (no app layout) - displays countdown timer when user hits rate limit
  Automatically redirects to /login after timer expires
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  import { goto } from '$app/navigation';

  // =============================================================================
  // CONSTANTS
  // =============================================================================

  const RATE_LIMIT_DURATION = 20 * 1000; // 20 seconds in milliseconds

  // =============================================================================
  // STATE (Svelte 5 Runes)
  // =============================================================================

  let timeLeft = $state(20);
  let countdownText = $state('0:20');
  let timer: ReturnType<typeof setInterval> | null = null;

  // =============================================================================
  // HELPER FUNCTIONS
  // =============================================================================

  /**
   * Clear all authentication tokens from storage
   */
  function clearAuthTokens(): void {
    if (typeof window === 'undefined') return;

    localStorage.removeItem('token');
    localStorage.removeItem('accessToken');
    // NOTE: refreshToken is in HttpOnly cookie, cleared by backend on /auth/logout
    localStorage.removeItem('userRole');
    sessionStorage.clear();
  }

  /**
   * Initialize rate limit timestamp
   */
  function initializeTimestamp(): number {
    if (typeof window === 'undefined') return Date.now();

    const storedTimestamp = localStorage.getItem('rateLimitTimestamp');

    if (storedTimestamp === null) {
      // First time on rate limit page - set timestamp
      const timestamp = Date.now();
      localStorage.setItem('rateLimitTimestamp', timestamp.toString());
      return timestamp;
    }

    const timestamp = Number.parseInt(storedTimestamp, 10);

    // Clean up old timestamp if expired (>20 seconds old)
    if (Date.now() - timestamp > RATE_LIMIT_DURATION) {
      localStorage.removeItem('rateLimitTimestamp');
      const newTimestamp = Date.now();
      localStorage.setItem('rateLimitTimestamp', newTimestamp.toString());
      return newTimestamp;
    }

    return timestamp;
  }

  /**
   * Calculate remaining time in seconds
   */
  function getRemainingTime(rateLimitTimestamp: number): number {
    const elapsed = Date.now() - rateLimitTimestamp;
    const remaining = Math.max(0, RATE_LIMIT_DURATION - elapsed);
    return Math.floor(remaining / 1000);
  }

  /**
   * Format time as M:SS
   */
  function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Handle expired rate limit - redirect to login
   */
  function handleExpiredRateLimit(): void {
    countdownText = 'Weiterleitung...';

    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }

    // Clear the timestamp
    if (typeof window !== 'undefined') {
      localStorage.removeItem('rateLimitTimestamp');
    }

    // Redirect to login after short delay
    setTimeout(() => {
      void goto('/login?ratelimit=expired', { replaceState: true });
    }, 1000);
  }

  /**
   * Update countdown display
   */
  function updateCountdown(): void {
    if (timeLeft <= 0) {
      handleExpiredRateLimit();
      return;
    }

    countdownText = formatTime(timeLeft);
    timeLeft--;
  }

  /**
   * Start countdown timer
   */
  function startCountdown(rateLimitTimestamp: number): void {
    timeLeft = getRemainingTime(rateLimitTimestamp);

    if (timeLeft > 0) {
      // Start timer if there's time remaining
      timer = setInterval(() => {
        updateCountdown();
      }, 1000);
      updateCountdown(); // Initial call
    } else {
      // Time already expired, redirect immediately
      countdownText = 'Weiterleitung...';

      if (typeof window !== 'undefined') {
        localStorage.removeItem('rateLimitTimestamp');
      }

      setTimeout(() => {
        void goto('/login?ratelimit=expired', { replaceState: true });
      }, 500);
    }
  }

  // =============================================================================
  // LIFECYCLE
  // =============================================================================

  onMount(() => {
    clearAuthTokens();
    const rateLimitTimestamp = initializeTimestamp();
    startCountdown(rateLimitTimestamp);
  });

  onDestroy(() => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  });
</script>

<svelte:head>
  <title>Zu viele Anfragen - Assixx</title>
  <!-- Google Material Symbols -->
  <link
    rel="stylesheet"
    href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=hourglass_check"
  />
</svelte:head>

<div class="flex min-h-screen items-center justify-center p-5">
  <div class="card animate-fade-in-up w-full max-w-[450px] text-center">
    <span class="rate-limit-icon material-symbols-outlined"
      >hourglass_check</span
    >
    <h1 class="mb-4 text-[28px] font-bold text-(--color-text-primary)">
      Zu viele Anfragen
    </h1>
    <p class="mb-8 text-base leading-relaxed text-(--color-text-secondary)">
      Sie haben die maximale Anzahl an Anfragen überschritten. Bitte warten Sie
      einen Moment, bevor Sie es erneut versuchen.
    </p>
    <div
      class="mb-8 rounded-(--radius-xl) border border-[oklch(63.24%_0.1562_249.76/20%)] bg-[oklch(63.24%_0.1562_249.76/10%)] p-6"
    >
      <div class="mb-4 text-sm text-(--color-text-secondary)">
        Versuchen Sie es wieder in:
      </div>
      <div class="countdown text-[32px] font-bold text-(--color-primary)">
        {countdownText}
      </div>
    </div>
  </div>
</div>

<style>
  /* Entry animation for card */
  .animate-fade-in-up {
    animation: fade-in-up 0.6s ease-out;
  }

  @keyframes fade-in-up {
    from {
      transform: translateY(30px);
      opacity: 0%;
    }

    to {
      transform: translateY(0);
      opacity: 100%;
    }
  }

  /* Icon with pulse animation */
  .rate-limit-icon {
    display: inline-block;
    margin-bottom: var(--spacing-6);
    font-size: 64px;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      transform: scale(1);
      opacity: 100%;
    }

    50% {
      transform: scale(1.1);
      opacity: 80%;
    }
  }

  /* Monospace font for countdown timer */
  .countdown {
    font-family: Outfit, monospace;
  }
</style>
