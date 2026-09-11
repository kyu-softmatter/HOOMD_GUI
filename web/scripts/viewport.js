/**
 * Canvas 2D simulation viewport.
 *
 * All particle positions are stored in simulation coordinates. The camera
 * converts them to screen pixels for drawing and converts pointer positions
 * back to simulation coordinates for editing.
 */

import { computeOutOfBounds, computeOverlaps } from './analysis.js';
import { createParticle, findParticleType, nextParticleId, particleDiameter } from './project.js';

const PALETTE = {
  background: '#0f1420',
  gridMinor: 'rgba(148, 163, 184, 0.10)',
  gridMajor: 'rgba(148, 163, 184, 0.20)',
  axis: 'rgba(148, 163, 184, 0.38)',
  boxFill: 'rgba(56, 78, 122, 0.16)',
  periodicFace: '#5eead4',
  wallFace: '#f8b4b4',
  ghost: 'rgba(148, 163, 184, 0.30)',
  selection: '#ffffff',
  hover: 'rgba(255, 255, 255, 0.55)',
  invalid: '#f87171',
  rubberBand: 'rgba(94, 234, 212, 0.18)',
  rubberBandEdge: '#5eead4',
  label: 'rgba(226, 232, 240, 0.85)',
};

const MINIMUM_SCALE = 1.5;
const MAXIMUM_SCALE = 400;
const DRAG_THRESHOLD_PIXELS = 3;

export class Viewport {
  #canvas;
  #context;
  #store;
  #mode = 'idle';
  #pointerStart = null;
  #lastPointer = null;
  #dragMoved = false;
  #rubberBand = null;
  #overlapping = new Set();
  #outOfBounds = new Set();
  #cursorListeners = new Set();

  constructor(canvas, store) {
    this.#canvas = canvas;
    this.#context = canvas.getContext('2d');
    this.#store = store;
  }

  /** Wire up resize handling and pointer input, then draw the first frame. */
  attach() {
    const observer = new ResizeObserver(() => this.#resize());
    observer.observe(this.#canvas.parentElement ?? this.#canvas);
    this.#resize();

    this.#canvas.addEventListener('pointerdown', (event) => this.#onPointerDown(event));
    this.#canvas.addEventListener('pointermove', (event) => this.#onPointerMove(event));
    this.#canvas.addEventListener('pointerup', (event) => this.#onPointerUp(event));
    this.#canvas.addEventListener('pointercancel', () => this.#endGesture(false));
    this.#canvas.addEventListener('pointerleave', () => this.#emitCursor(null));
    this.#canvas.addEventListener('wheel', (event) => this.#onWheel(event), { passive: false });
    this.#canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    this.#store.subscribe(() => this.refresh());
    this.refresh();
  }

  /** Register a callback that receives simulation coordinates under the pointer. */
  onCursorMove(listener) {
    this.#cursorListeners.add(listener);
    return () => this.#cursorListeners.delete(listener);
  }

  /** Recompute derived highlighting and redraw. */
  refresh() {
    const project = this.#store.project;
    this.#overlapping = computeOverlaps(project);
    this.#outOfBounds = computeOutOfBounds(project);
    this.render();
  }

  /** Convert a simulation position to canvas pixels. */
  toScreen(x, y) {
    const { camera } = this.#store.ui;
    const { width, height } = this.#cssSize();
    return {
      x: width / 2 + (x - camera.x) * camera.scale,
      y: height / 2 - (y - camera.y) * camera.scale,
    };
  }

  /** Convert canvas pixels to a simulation position. */
  toSimulation(screenX, screenY) {
    const { camera } = this.#store.ui;
    const { width, height } = this.#cssSize();
    return {
      x: camera.x + (screenX - width / 2) / camera.scale,
      y: camera.y - (screenY - height / 2) / camera.scale,
    };
  }

  /** Move the camera so that the whole box fits with a margin. */
  fitToBox() {
    const { lx, ly } = this.#store.project.box;
    const { width, height } = this.#cssSize();
    if (width === 0 || height === 0) {
      return;
    }
    const scale = Math.min(width / (lx * 1.15), height / (ly * 1.15));
    this.#store.updateUi((ui) => {
      ui.camera = { x: 0, y: 0, scale: clamp(scale, MINIMUM_SCALE, MAXIMUM_SCALE) };
    }, 'camera');
  }

  /** Zoom around the centre of the viewport by a multiplicative factor. */
  zoomBy(factor) {
    this.#store.updateUi((ui) => {
      ui.camera.scale = clamp(ui.camera.scale * factor, MINIMUM_SCALE, MAXIMUM_SCALE);
    }, 'camera');
  }

  render() {
    const context = this.#context;
    const { width, height } = this.#cssSize();
    if (width === 0 || height === 0) {
      return;
    }

    context.save();
    context.setTransform(this.#pixelRatio(), 0, 0, this.#pixelRatio(), 0, 0);
    context.fillStyle = PALETTE.background;
    context.fillRect(0, 0, width, height);

    const project = this.#store.project;
    const ui = this.#store.ui;

    if (ui.showGrid) {
      this.#drawGrid(width, height);
    }
    this.#drawBoxFill(project);
    if (ui.showPeriodicImages) {
      this.#drawPeriodicImages(project);
    }
    this.#drawWallRegions(project);
    this.#drawBoxFaces(project);
    this.#drawParticles(project, ui);
    this.#drawRubberBand();
    this.#drawScaleBar(width, height);
    context.restore();
  }

  #cssSize() {
    return { width: this.#canvas.clientWidth, height: this.#canvas.clientHeight };
  }

  #pixelRatio() {
    return window.devicePixelRatio || 1;
  }

  #resize() {
    const ratio = this.#pixelRatio();
    const { width, height } = this.#cssSize();
    this.#canvas.width = Math.max(1, Math.round(width * ratio));
    this.#canvas.height = Math.max(1, Math.round(height * ratio));
    this.render();
  }

  #drawGrid(width, height) {
    const context = this.#context;
    const { scale } = this.#store.ui.camera;
    const step = niceStep(80 / scale);
    const topLeft = this.toSimulation(0, 0);
    const bottomRight = this.toSimulation(width, height);

    context.lineWidth = 1;
    for (let index = 0; index < 2; index += 1) {
      const isMajor = index === 1;
      const spacing = isMajor ? step * 5 : step;
      context.strokeStyle = isMajor ? PALETTE.gridMajor : PALETTE.gridMinor;
      context.beginPath();
      const firstX = Math.ceil(topLeft.x / spacing) * spacing;
      for (let x = firstX; x <= bottomRight.x; x += spacing) {
        const screenX = Math.round(this.toScreen(x, 0).x) + 0.5;
        context.moveTo(screenX, 0);
        context.lineTo(screenX, height);
      }
      const firstY = Math.ceil(bottomRight.y / spacing) * spacing;
      for (let y = firstY; y <= topLeft.y; y += spacing) {
        const screenY = Math.round(this.toScreen(0, y).y) + 0.5;
        context.moveTo(0, screenY);
        context.lineTo(width, screenY);
      }
      context.stroke();
    }

    context.strokeStyle = PALETTE.axis;
    context.beginPath();
    const origin = this.toScreen(0, 0);
    context.moveTo(Math.round(origin.x) + 0.5, 0);
    context.lineTo(Math.round(origin.x) + 0.5, height);
    context.moveTo(0, Math.round(origin.y) + 0.5);
    context.lineTo(width, Math.round(origin.y) + 0.5);
    context.stroke();
  }

  #boxRect(project, offsetX = 0, offsetY = 0) {
    const halfX = project.box.lx / 2;
    const halfY = project.box.ly / 2;
    const topLeft = this.toScreen(-halfX + offsetX, halfY + offsetY);
    const bottomRight = this.toScreen(halfX + offsetX, -halfY + offsetY);
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };
  }

  #drawBoxFill(project) {
    const rect = this.#boxRect(project);
    this.#context.fillStyle = PALETTE.boxFill;
    this.#context.fillRect(rect.x, rect.y, rect.width, rect.height);
  }

  #periodicOffsets(project) {
    const offsets = [];
    const periodicX = project.boundaries.x.mode === 'periodic';
    const periodicY = project.boundaries.y.mode === 'periodic';
    const columns = periodicX ? [-1, 0, 1] : [0];
    const rows = periodicY ? [-1, 0, 1] : [0];
    for (const column of columns) {
      for (const row of rows) {
        if (column === 0 && row === 0) {
          continue;
        }
        offsets.push({ x: column * project.box.lx, y: row * project.box.ly });
      }
    }
    return offsets;
  }

  #drawPeriodicImages(project) {
    const offsets = this.#periodicOffsets(project);
    if (offsets.length === 0) {
      return;
    }
    const context = this.#context;
    context.save();
    context.globalAlpha = 0.32;
    for (const offset of offsets) {
      const rect = this.#boxRect(project, offset.x, offset.y);
      context.setLineDash([4, 4]);
      context.strokeStyle = PALETTE.ghost;
      context.lineWidth = 1;
      context.strokeRect(rect.x, rect.y, rect.width, rect.height);
      context.setLineDash([]);
      for (const particle of project.particles) {
        const type = findParticleType(project, particle.type);
        const centre = this.toScreen(
          particle.position.x + offset.x,
          particle.position.y + offset.y,
        );
        const radius = (particleDiameter(project, particle) / 2) * this.#store.ui.camera.scale;
        if (!this.#isVisible(centre, radius)) {
          continue;
        }
        context.beginPath();
        context.arc(centre.x, centre.y, Math.max(radius, 1), 0, Math.PI * 2);
        context.fillStyle = type?.color ?? PALETTE.ghost;
        context.fill();
      }
    }
    context.restore();
  }

  #drawWallRegions(project) {
    const context = this.#context;
    const halfX = project.box.lx / 2;
    const halfY = project.box.ly / 2;

    const bands = [];
    if (project.boundaries.x.mode === 'walls') {
      const { minimum, maximum } = project.boundaries.x;
      bands.push({ x0: -halfX, x1: -halfX + minimum.padding, y0: -halfY, y1: halfY });
      bands.push({ x0: halfX - maximum.padding, x1: halfX, y0: -halfY, y1: halfY });
    }
    if (project.boundaries.y.mode === 'walls') {
      const { minimum, maximum } = project.boundaries.y;
      bands.push({ x0: -halfX, x1: halfX, y0: -halfY, y1: -halfY + minimum.padding });
      bands.push({ x0: -halfX, x1: halfX, y0: halfY - maximum.padding, y1: halfY });
    }

    for (const band of bands) {
      const topLeft = this.toScreen(band.x0, band.y1);
      const bottomRight = this.toScreen(band.x1, band.y0);
      context.save();
      context.beginPath();
      context.rect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
      context.clip();
      context.fillStyle = 'rgba(248, 180, 180, 0.08)';
      context.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
      context.strokeStyle = 'rgba(248, 180, 180, 0.30)';
      context.lineWidth = 1;
      context.beginPath();
      const spacing = 9;
      const extent = Math.abs(bottomRight.x - topLeft.x) + Math.abs(bottomRight.y - topLeft.y);
      for (let offset = -extent; offset < extent; offset += spacing) {
        context.moveTo(topLeft.x + offset, topLeft.y);
        context.lineTo(topLeft.x + offset + extent, topLeft.y + extent);
      }
      context.stroke();
      context.restore();
    }
  }

  #drawBoxFaces(project) {
    const context = this.#context;
    const rect = this.#boxRect(project);
    const periodicX = project.boundaries.x.mode === 'periodic';
    const periodicY = project.boundaries.y.mode === 'periodic';

    const faces = [
      { periodic: periodicX, from: [rect.x, rect.y], to: [rect.x, rect.y + rect.height] },
      {
        periodic: periodicX,
        from: [rect.x + rect.width, rect.y],
        to: [rect.x + rect.width, rect.y + rect.height],
      },
      {
        periodic: periodicY,
        from: [rect.x, rect.y + rect.height],
        to: [rect.x + rect.width, rect.y + rect.height],
      },
      { periodic: periodicY, from: [rect.x, rect.y], to: [rect.x + rect.width, rect.y] },
    ];

    for (const face of faces) {
      context.beginPath();
      context.setLineDash(face.periodic ? [10, 6] : []);
      context.lineWidth = face.periodic ? 1.5 : 3;
      context.strokeStyle = face.periodic ? PALETTE.periodicFace : PALETTE.wallFace;
      context.moveTo(face.from[0], face.from[1]);
      context.lineTo(face.to[0], face.to[1]);
      context.stroke();
    }
    context.setLineDash([]);

    // Paired arrows mark which faces wrap into each other.
    context.fillStyle = PALETTE.periodicFace;
    if (periodicX) {
      this.#drawWrapArrow(rect.x, rect.y + rect.height / 2, -1, 0);
      this.#drawWrapArrow(rect.x + rect.width, rect.y + rect.height / 2, 1, 0);
    }
    if (periodicY) {
      this.#drawWrapArrow(rect.x + rect.width / 2, rect.y, 0, -1);
      this.#drawWrapArrow(rect.x + rect.width / 2, rect.y + rect.height, 0, 1);
    }
  }

  #drawWrapArrow(x, y, directionX, directionY) {
    const context = this.#context;
    const size = 7;
    context.save();
    context.translate(x + directionX * 10, y + directionY * 10);
    context.rotate(Math.atan2(directionY, directionX));
    context.beginPath();
    context.moveTo(size, 0);
    context.lineTo(-size * 0.6, size * 0.6);
    context.lineTo(-size * 0.6, -size * 0.6);
    context.closePath();
    context.fill();
    context.restore();
  }

  #isVisible(centre, radius) {
    const { width, height } = this.#cssSize();
    return (
      centre.x + radius >= 0 &&
      centre.x - radius <= width &&
      centre.y + radius >= 0 &&
      centre.y - radius <= height
    );
  }

  #drawParticles(project, ui) {
    const context = this.#context;
    const selection = new Set(ui.selection);
    const hiddenLayers = new Set(
      project.layers.filter((layer) => !layer.visible).map((layer) => layer.id),
    );

    for (const particle of project.particles) {
      if (hiddenLayers.has(particle.layer)) {
        continue;
      }
      const type = findParticleType(project, particle.type);
      const centre = this.toScreen(particle.position.x, particle.position.y);
      const radius = Math.max(
        (particleDiameter(project, particle) / 2) * ui.camera.scale,
        1.5,
      );
      if (!this.#isVisible(centre, radius + 6)) {
        continue;
      }

      context.beginPath();
      context.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
      context.fillStyle = type?.color ?? '#94a3b8';
      context.fill();

      const invalid = this.#overlapping.has(particle.id) || this.#outOfBounds.has(particle.id);
      if (invalid) {
        context.lineWidth = 2;
        context.strokeStyle = PALETTE.invalid;
        context.stroke();
      }
      if (particle.fixed) {
        context.lineWidth = 1.5;
        context.strokeStyle = 'rgba(15, 20, 32, 0.75)';
        context.setLineDash([3, 3]);
        context.stroke();
        context.setLineDash([]);
      }
      if (selection.has(particle.id)) {
        context.beginPath();
        context.arc(centre.x, centre.y, radius + 3.5, 0, Math.PI * 2);
        context.lineWidth = 2;
        context.strokeStyle = PALETTE.selection;
        context.stroke();
      } else if (ui.hoveredId === particle.id) {
        context.beginPath();
        context.arc(centre.x, centre.y, radius + 2.5, 0, Math.PI * 2);
        context.lineWidth = 1.5;
        context.strokeStyle = PALETTE.hover;
        context.stroke();
      }
    }
  }

  #drawRubberBand() {
    if (!this.#rubberBand) {
      return;
    }
    const context = this.#context;
    const { x0, y0, x1, y1 } = this.#rubberBand;
    const rect = {
      x: Math.min(x0, x1),
      y: Math.min(y0, y1),
      width: Math.abs(x1 - x0),
      height: Math.abs(y1 - y0),
    };
    context.fillStyle = PALETTE.rubberBand;
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
    context.strokeStyle = PALETTE.rubberBandEdge;
    context.lineWidth = 1;
    context.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width, rect.height);
  }

  #drawScaleBar(width, height) {
    const context = this.#context;
    const { scale } = this.#store.ui.camera;
    const length = niceStep(120 / scale);
    const pixels = length * scale;
    const x = width - pixels - 20;
    // Sit above the viewport hint line so the two never overlap.
    const y = height - 36;

    context.strokeStyle = PALETTE.label;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + pixels, y);
    context.moveTo(x, y - 4);
    context.lineTo(x, y + 4);
    context.moveTo(x + pixels, y - 4);
    context.lineTo(x + pixels, y + 4);
    context.stroke();

    context.fillStyle = PALETTE.label;
    context.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.textAlign = 'center';
    context.fillText(`${formatNumber(length)} σ`, x + pixels / 2, y - 8);
    context.textAlign = 'left';
  }

  #particleAt(screenX, screenY) {
    const project = this.#store.project;
    const point = this.toSimulation(screenX, screenY);
    const hiddenLayers = new Set(
      project.layers.filter((layer) => !layer.visible).map((layer) => layer.id),
    );
    // Iterate backwards so the particle drawn last wins the hit test.
    for (let index = project.particles.length - 1; index >= 0; index -= 1) {
      const particle = project.particles[index];
      if (hiddenLayers.has(particle.layer)) {
        continue;
      }
      const radius = Math.max(
        particleDiameter(project, particle) / 2,
        6 / this.#store.ui.camera.scale,
      );
      const dx = point.x - particle.position.x;
      const dy = point.y - particle.position.y;
      if (dx * dx + dy * dy <= radius * radius) {
        return particle;
      }
    }
    return null;
  }

  #localPoint(event) {
    const rect = this.#canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  #onPointerDown(event) {
    try {
      this.#canvas.setPointerCapture(event.pointerId);
    } catch {
      // Capture is an optimisation; a released pointer must not break editing.
    }
    const point = this.#localPoint(event);
    this.#pointerStart = point;
    this.#lastPointer = point;
    this.#dragMoved = false;

    const wantsPan = event.button === 1 || event.button === 2 || event.altKey;
    if (wantsPan) {
      this.#mode = 'panning';
      return;
    }

    const ui = this.#store.ui;
    if (ui.tool === 'add') {
      this.#addParticleAt(point);
      return;
    }

    const hit = this.#particleAt(point.x, point.y);
    if (hit) {
      const alreadySelected = ui.selection.includes(hit.id);
      if (event.shiftKey) {
        this.#store.updateUi((state) => {
          state.selection = alreadySelected
            ? state.selection.filter((id) => id !== hit.id)
            : [...state.selection, hit.id];
        }, 'selection');
      } else if (!alreadySelected) {
        this.#store.updateUi((state) => {
          state.selection = [hit.id];
        }, 'selection');
      }
      if (this.#store.ui.selection.includes(hit.id)) {
        this.#mode = 'dragging';
        this.#store.beginGesture();
      }
      return;
    }

    this.#mode = 'rubber';
    this.#rubberBand = { x0: point.x, y0: point.y, x1: point.x, y1: point.y };
    if (!event.shiftKey) {
      this.#store.updateUi((state) => {
        state.selection = [];
      }, 'selection');
    }
  }

  #onPointerMove(event) {
    const point = this.#localPoint(event);
    this.#emitCursor(this.toSimulation(point.x, point.y));

    if (this.#mode === 'idle') {
      const hit = this.#particleAt(point.x, point.y);
      const hoveredId = hit?.id ?? null;
      if (hoveredId !== this.#store.ui.hoveredId) {
        this.#store.updateUi((state) => {
          state.hoveredId = hoveredId;
        }, 'hover');
      }
      this.#canvas.style.cursor =
        this.#store.ui.tool === 'add' ? 'crosshair' : hit ? 'move' : 'default';
      return;
    }

    if (!this.#lastPointer) {
      return;
    }
    const deltaX = point.x - this.#lastPointer.x;
    const deltaY = point.y - this.#lastPointer.y;
    if (
      Math.abs(point.x - this.#pointerStart.x) > DRAG_THRESHOLD_PIXELS ||
      Math.abs(point.y - this.#pointerStart.y) > DRAG_THRESHOLD_PIXELS
    ) {
      this.#dragMoved = true;
    }
    this.#lastPointer = point;

    if (this.#mode === 'panning') {
      const { scale } = this.#store.ui.camera;
      this.#store.updateUi((state) => {
        state.camera.x -= deltaX / scale;
        state.camera.y += deltaY / scale;
      }, 'camera');
      return;
    }

    if (this.#mode === 'dragging' && this.#dragMoved) {
      const { scale } = this.#store.ui.camera;
      const selection = new Set(this.#store.ui.selection);
      this.#store.updateTransient((project) => {
        for (const particle of project.particles) {
          if (selection.has(particle.id) && !particle.fixed) {
            particle.position.x += deltaX / scale;
            particle.position.y -= deltaY / scale;
          }
        }
      }, 'drag');
      return;
    }

    if (this.#mode === 'rubber' && this.#rubberBand) {
      this.#rubberBand.x1 = point.x;
      this.#rubberBand.y1 = point.y;
      this.render();
    }
  }

  #onPointerUp(event) {
    if (this.#mode === 'rubber' && this.#rubberBand && this.#dragMoved) {
      this.#applyRubberBandSelection(event.shiftKey);
    }
    this.#endGesture(true);
  }

  #endGesture(commit) {
    if (this.#mode === 'dragging') {
      this.#store.commitGesture(commit && this.#dragMoved);
      if (commit && this.#dragMoved) {
        this.#store.notify('drag-end');
      }
    }
    this.#mode = 'idle';
    this.#pointerStart = null;
    this.#lastPointer = null;
    this.#dragMoved = false;
    if (this.#rubberBand) {
      this.#rubberBand = null;
      this.render();
    }
  }

  #applyRubberBandSelection(additive) {
    const { x0, y0, x1, y1 } = this.#rubberBand;
    const corner1 = this.toSimulation(Math.min(x0, x1), Math.min(y0, y1));
    const corner2 = this.toSimulation(Math.max(x0, x1), Math.max(y0, y1));
    const bounds = {
      minX: Math.min(corner1.x, corner2.x),
      maxX: Math.max(corner1.x, corner2.x),
      minY: Math.min(corner1.y, corner2.y),
      maxY: Math.max(corner1.y, corner2.y),
    };
    const project = this.#store.project;
    const inside = project.particles
      .filter(
        (particle) =>
          particle.position.x >= bounds.minX &&
          particle.position.x <= bounds.maxX &&
          particle.position.y >= bounds.minY &&
          particle.position.y <= bounds.maxY,
      )
      .map((particle) => particle.id);

    this.#store.updateUi((state) => {
      state.selection = additive ? [...new Set([...state.selection, ...inside])] : inside;
    }, 'selection');
  }

  #addParticleAt(point) {
    const position = this.toSimulation(point.x, point.y);
    const project = this.#store.project;
    const type = this.#store.ui.activeType ?? project.particleTypes[0]?.name ?? 'A';
    const id = nextParticleId(project);
    this.#store.update((draft) => {
      draft.particles.push(createParticle({ id, type, x: position.x, y: position.y }));
    }, 'add-particle');
    this.#store.updateUi((state) => {
      state.selection = [id];
    }, 'selection');
  }

  #onWheel(event) {
    event.preventDefault();
    const point = this.#localPoint(event);
    const before = this.toSimulation(point.x, point.y);
    const factor = Math.exp(-event.deltaY * 0.0015);
    this.#store.updateUi((state) => {
      state.camera.scale = clamp(state.camera.scale * factor, MINIMUM_SCALE, MAXIMUM_SCALE);
    }, 'camera');
    const after = this.toSimulation(point.x, point.y);
    this.#store.updateUi((state) => {
      state.camera.x += before.x - after.x;
      state.camera.y += before.y - after.y;
    }, 'camera');
  }

  #emitCursor(position) {
    for (const listener of this.#cursorListeners) {
      listener(position);
    }
  }
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

/** Return a rounded 1-2-5 step close to the requested size. */
function niceStep(target) {
  const exponent = Math.floor(Math.log10(Math.max(target, 1e-9)));
  const base = 10 ** exponent;
  const normalized = target / base;
  if (normalized < 1.5) {
    return base;
  }
  if (normalized < 3.5) {
    return 2 * base;
  }
  if (normalized < 7.5) {
    return 5 * base;
  }
  return 10 * base;
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '');
}
