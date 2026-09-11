/**
 * Observable project store with undo and redo.
 *
 * The store separates two kinds of state:
 *
 * - `project` holds physical values and is what gets exported and validated.
 * - `ui` holds selection, camera, active tool, and display toggles. It is
 *   never written to a project file and never enters the undo history.
 */

const HISTORY_LIMIT = 100;

export class ProjectStore {
  #project;
  #ui;
  #undoStack = [];
  #redoStack = [];
  #listeners = new Set();
  #pendingSnapshot = null;

  constructor(project) {
    this.#project = project;
    this.#ui = {
      tool: 'select',
      activeType: 'A',
      selection: [],
      hoveredId: null,
      camera: { x: 0, y: 0, scale: 18 },
      showGrid: true,
      showPeriodicImages: true,
      showWellField: true,
      bottomTab: 'validation',
    };
  }

  get project() {
    return this.#project;
  }

  get ui() {
    return this.#ui;
  }

  get canUndo() {
    return this.#undoStack.length > 0;
  }

  get canRedo() {
    return this.#redoStack.length > 0;
  }

  /** Register a listener and return a function that removes it. */
  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Notify every listener that state changed. */
  notify(reason = 'change') {
    for (const listener of this.#listeners) {
      listener(reason);
    }
  }

  /** Apply an undoable change to the project. */
  update(mutator, reason = 'project') {
    const snapshot = structuredClone(this.#project);
    mutator(this.#project);
    this.#pushHistory(snapshot);
    this.notify(reason);
  }

  /**
   * Apply a change without recording history.
   *
   * Used for continuous gestures such as dragging, which record a single
   * history entry through `beginGesture` and `commitGesture` instead.
   */
  updateTransient(mutator, reason = 'project') {
    mutator(this.#project);
    this.notify(reason);
  }

  /** Capture the state before a continuous gesture starts. */
  beginGesture() {
    this.#pendingSnapshot = structuredClone(this.#project);
  }

  /** Record a single history entry for a finished gesture. */
  commitGesture(changed = true) {
    if (this.#pendingSnapshot && changed) {
      this.#pushHistory(this.#pendingSnapshot);
    }
    this.#pendingSnapshot = null;
  }

  /** Change UI-only state. */
  updateUi(mutator, reason = 'ui') {
    mutator(this.#ui);
    this.notify(reason);
  }

  /** Replace the whole project, for example after loading a file. */
  replaceProject(project, reason = 'load') {
    this.#pushHistory(structuredClone(this.#project));
    this.#project = project;
    this.#ui.selection = [];
    this.#ui.hoveredId = null;
    this.notify(reason);
  }

  undo() {
    if (this.#undoStack.length === 0) {
      return false;
    }
    this.#redoStack.push(structuredClone(this.#project));
    this.#project = this.#undoStack.pop();
    this.#pruneSelection();
    this.notify('undo');
    return true;
  }

  redo() {
    if (this.#redoStack.length === 0) {
      return false;
    }
    this.#undoStack.push(structuredClone(this.#project));
    this.#project = this.#redoStack.pop();
    this.#pruneSelection();
    this.notify('redo');
    return true;
  }

  /** Return the currently selected particles. */
  selectedParticles() {
    const selected = new Set(this.#ui.selection);
    return this.#project.particles.filter((particle) => selected.has(particle.id));
  }

  #pushHistory(snapshot) {
    this.#undoStack.push(snapshot);
    if (this.#undoStack.length > HISTORY_LIMIT) {
      this.#undoStack.shift();
    }
    this.#redoStack.length = 0;
  }

  #pruneSelection() {
    const existing = new Set(this.#project.particles.map((particle) => particle.id));
    this.#ui.selection = this.#ui.selection.filter((id) => existing.has(id));
  }
}
