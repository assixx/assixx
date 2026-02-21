<script lang="ts">
  /**
   * CardFlip — CSS 3D perspective flip wrapper.
   * Uses Svelte 5 snippets for front/back content slots.
   * GPU-accelerated via transform3d (Risk R4 mitigation).
   */
  import type { Snippet } from 'svelte';

  interface Props {
    isFlipped: boolean;
    front: Snippet;
    back: Snippet;
  }

  const { isFlipped, front, back }: Props = $props();
</script>

<div
  class="card-flip"
  class:card-flip--flipped={isFlipped}
>
  <div class="card-flip__inner">
    <div class="card-flip__front">
      {@render front()}
    </div>
    <div class="card-flip__back">
      {@render back()}
    </div>
  </div>
</div>

<style>
  .card-flip {
    perspective: 1000px;
    width: 100%;
    height: 100%;
  }

  .card-flip__inner {
    position: relative;
    width: 100%;
    height: 100%;
    transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1);
    transform-style: preserve-3d;
  }

  .card-flip--flipped .card-flip__inner {
    transform: rotateY(180deg);
  }

  .card-flip__front,
  .card-flip__back {
    position: absolute;
    inset: 0;
    backface-visibility: hidden;
    border-radius: inherit;
    overflow: hidden;
  }

  .card-flip__back {
    transform: rotateY(180deg);
  }

  /* Respect user's motion preference */
  @media (prefers-reduced-motion: reduce) {
    .card-flip__inner {
      transition: none;
    }
  }
</style>
