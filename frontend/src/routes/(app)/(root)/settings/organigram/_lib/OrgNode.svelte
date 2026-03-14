<!--
  OrgNode — Einzelner verschiebbarer Organigramm-Block
  Drag & Drop bewegt nur diesen Node (Kinder bleiben stehen).
  Für Gruppen-Verschiebung → Hall-Drag im OrgCanvas.
-->
<script lang="ts">
  import { ENTITY_COLORS } from './constants.js';
  import {
    getFontSize,
    getIsLocked,
    getPanX,
    getPanY,
    getZoom,
    moveNodeOnly,
    setHoveredNodeKey,
  } from './state.svelte.js';

  import type { OrgEntityType, RenderNode } from './types.js';

  interface Props {
    node: RenderNode;
    svgElement: SVGSVGElement;
    ondblclicknode?: (entityType: OrgEntityType, entityUuid: string) => void;
  }

  const { node, svgElement, ondblclicknode }: Props = $props();

  const colors = $derived(ENTITY_COLORS[node.entityType]);
  const isLocked = $derived(getIsLocked());
  const nodeFontSize = $derived(getFontSize());

  let isDragging = $state(false);
  let dragOffsetX = $state(0);
  let dragOffsetY = $state(0);

  function nodeKey(): string {
    return `${node.entityType}:${node.entityUuid}`;
  }

  function truncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen - 1) + '\u2026';
  }

  function handlePointerDown(event: PointerEvent): void {
    // Linksklick auf Node darf nie Canvas-Pan auslösen
    if (event.button === 0 && !event.shiftKey) {
      event.stopPropagation();
    }
    if (isLocked) return;
    if (event.button !== 0 || event.shiftKey) return;
    event.preventDefault();

    const rect = svgElement.getBoundingClientRect();
    const z = getZoom();
    const px = getPanX();
    const py = getPanY();

    const svgX = (event.clientX - rect.left - px) / z;
    const svgY = (event.clientY - rect.top - py) / z;

    dragOffsetX = svgX - node.x;
    dragOffsetY = svgY - node.y;
    isDragging = true;

    (event.currentTarget as Element).setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!isDragging) return;
    event.preventDefault();

    const rect = svgElement.getBoundingClientRect();
    const z = getZoom();
    const px = getPanX();
    const py = getPanY();

    const svgX = (event.clientX - rect.left - px) / z;
    const svgY = (event.clientY - rect.top - py) / z;

    moveNodeOnly(
      node.entityType,
      node.entityUuid,
      svgX - dragOffsetX,
      svgY - dragOffsetY,
    );
  }

  function handlePointerUp(): void {
    isDragging = false;
  }

  function handleMouseEnter(): void {
    if (!isDragging) {
      setHoveredNodeKey(nodeKey());
    }
  }

  function handleMouseLeave(): void {
    if (!isDragging) {
      setHoveredNodeKey('');
    }
  }

  function handleDblClick(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    ondblclicknode?.(node.entityType, node.entityUuid);
  }
</script>

<g
  class="org-node"
  class:org-node--dragging={isDragging}
  class:org-node--locked={isLocked}
  transform="translate({node.x}, {node.y})"
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  ondblclick={handleDblClick}
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  role="group"
  aria-label="{node.name} ({node.entityType})"
>
  <!-- ClipPath für abgerundeten Akzentstreifen -->
  <defs>
    <clipPath id="clip-{node.entityUuid}">
      <rect
        width={node.width}
        height={node.height}
        rx="8"
        ry="8"
      />
    </clipPath>
  </defs>

  <!-- Hintergrund -->
  <rect
    width={node.width}
    height={node.height}
    rx="8"
    ry="8"
    fill={colors.bg}
    stroke="var(--glass-border, rgba(255,255,255,0.12))"
    stroke-width={isDragging ? 2 : 1}
    class="node-bg"
  />

  <!-- Farbiger Streifen oben (geclippt an Kartenform) -->
  <rect
    width={node.width}
    height="4"
    fill={colors.border}
    clip-path="url(#clip-{node.entityUuid})"
  />

  <!-- Name (Details per Doppelklick im Modal) -->
  <text
    x={node.width / 2}
    y={node.height / 2}
    text-anchor="middle"
    dominant-baseline="central"
    class="node-name"
    fill="var(--color-text-primary)"
    font-size="{nodeFontSize}px"
  >
    {truncate(node.name, 22)}
  </text>
</g>

<style>
  .org-node {
    cursor: grab;
    touch-action: none;
  }

  .org-node--locked {
    cursor: default;
  }

  .org-node:hover .node-bg {
    filter: brightness(1.12);
  }

  .org-node--dragging {
    cursor: grabbing;
    opacity: 85%;
  }

  .org-node--dragging .node-bg {
    filter: drop-shadow(0 4px 12px rgb(0 0 0 / 25%));
  }

  .node-name {
    font-weight: 600;
    pointer-events: none;
    user-select: none;
  }
</style>
