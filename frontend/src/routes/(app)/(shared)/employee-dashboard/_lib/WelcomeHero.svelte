<script lang="ts">
  /**
   * WelcomeHero — Welcome banner with animated sakura petals.
   * Self-contained: owns floatingDotsCount state and onMount lifecycle.
   */
  import { onMount } from 'svelte';

  import { FLOATING_DOTS_COUNT, MESSAGES } from './constants';

  interface Props {
    /** Employee display name shown in the hero greeting */
    employeeName: string;
  }

  const { employeeName }: Props = $props();

  let floatingDotsCount = $state(0);

  onMount(() => {
    floatingDotsCount = FLOATING_DOTS_COUNT;

    setTimeout(() => {
      document.body.classList.add('loaded');
    }, 100);
  });
</script>

<div
  class="welcome-hero-custom relative mb-8 flex min-h-[120px] items-center
    justify-between overflow-hidden rounded-xl border border-white/10 px-4 py-4
    text-white shadow-sm backdrop-blur-[20px] backdrop-saturate-[180%]
    md:px-6 md:py-5 lg:px-8 lg:py-6"
>
  <!-- Floating sakura petals (generated via floatingDotsCount) -->
  <div class="floating-elements">
    {#each Array(floatingDotsCount) as _, i (i)}
      <div class="floating-dot"></div>
    {/each}
  </div>

  <!-- Welcome content -->
  <div class="relative z-10">
    <h1 class="mb-1 text-xl font-bold md:text-2xl lg:text-3xl">
      {MESSAGES.welcomeBack}
    </h1>
    <p class="text-base text-white/90 md:text-lg">
      {MESSAGES.niceToSeeYou}&nbsp;
      <span class="employee-name-hero text-2xl font-bold">{employeeName}</span>
    </p>
  </div>
</div>

<style>
  /* Welcome Hero Custom Background */
  .welcome-hero-custom {
    background: var(--glass-bg);
    background-image:
      radial-gradient(
        circle at 20% 80%,
        rgb(255 255 255 / 10%) 0%,
        transparent 50%
      ),
      radial-gradient(
        circle at 80% 20%,
        rgb(39 72 89) 0%,
        rgb(35 84 114 / 63%) 50%
      );
  }

  .employee-name-hero {
    background: linear-gradient(
      135deg,
      #ff0080 0%,
      #7928ca 33%,
      #0070f3 66%,
      #38bdf8 83%,
      #ff0080 100%
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
    pointer-events: none;
  }

  /* Floating Petal Base (Sakura) */
  .floating-dot {
    position: absolute;
    animation: float 15s infinite ease-in-out;
    box-shadow:
      0 0 4px rgb(255 182 193 / 40%),
      inset 0 0 2px rgb(255 255 255 / 60%);
    border-radius: 80% 0 55% 50% / 55% 0 80% 50%;
    background: linear-gradient(
      to top right,
      #ff85a2 0%,
      #ffb7c5 45%,
      #fff0f3 100%
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
</style>
