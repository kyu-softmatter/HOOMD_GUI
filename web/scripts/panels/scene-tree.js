/** Scene tree panel listing the structural parts of the project. */

import { element, formatValue, replaceChildren } from '../dom.js';

/** Maximum number of particle rows rendered before the list is truncated. */
const MAXIMUM_PARTICLE_ROWS = 300;

export class SceneTreePanel {
  #container;
  #store;
  #collapsed = new Set();

  constructor(container, store) {
    this.#container = container;
    this.#store = store;
  }

  attach() {
    this.#store.subscribe(() => this.render());
    this.render();
  }

  render() {
    const project = this.#store.project;
    const ui = this.#store.ui;

    replaceChildren(
      this.#container,
      this.#section('box', 'Box', [
        this.#leaf(`${formatValue(project.box.lx)} × ${formatValue(project.box.ly)} σ`),
        this.#leaf(`${project.box.dimensions}D orthorhombic`),
      ]),
      this.#section('boundaries', 'Boundaries', [
        this.#boundaryLeaf('X', project.boundaries.x),
        this.#boundaryLeaf('Y', project.boundaries.y),
      ]),
      this.#section(
        'types',
        `Particle Types (${project.particleTypes.length})`,
        project.particleTypes.map((type) => this.#typeLeaf(type, ui.activeType === type.name)),
      ),
      this.#section(
        'particles',
        `Particles (${project.particles.length})`,
        this.#particleRows(project, ui),
      ),
      this.#section('wells', `Potential Wells (${project.potentialWells.length})`, [
        this.#leaf('No wells yet.', 'tree__leaf--muted'),
      ]),
      this.#section(
        'layers',
        `Layers (${project.layers.length})`,
        project.layers.map((layer) => this.#layerRow(layer)),
      ),
    );
  }

  #section(key, title, children) {
    const collapsed = this.#collapsed.has(key);
    const toggle = element('button', {
      className: 'tree__header',
      type: 'button',
      attributes: { 'aria-expanded': String(!collapsed) },
    }, [
      element('span', { className: 'tree__chevron', text: collapsed ? '▸' : '▾' }),
      element('span', { text: title }),
    ]);
    toggle.addEventListener('click', () => {
      if (collapsed) {
        this.#collapsed.delete(key);
      } else {
        this.#collapsed.add(key);
      }
      this.render();
    });

    const section = element('section', { className: 'tree__section' }, [toggle]);
    if (!collapsed) {
      section.append(element('div', { className: 'tree__body' }, children));
    }
    return section;
  }

  #leaf(text, extraClass = '') {
    return element('div', { className: `tree__leaf ${extraClass}`.trim(), text });
  }

  #boundaryLeaf(axis, boundary) {
    const periodic = boundary.mode === 'periodic';
    return element('div', { className: 'tree__leaf' }, [
      element('span', {
        className: `badge ${periodic ? 'badge--periodic' : 'badge--wall'}`,
        text: periodic ? 'periodic' : 'walls',
      }),
      element('span', { text: axis === 'X' ? 'Left ↔ Right' : 'Bottom ↔ Top' }),
    ]);
  }

  #typeLeaf(type, isActive) {
    const row = element('button', {
      className: `tree__leaf tree__leaf--button ${isActive ? 'is-active' : ''}`.trim(),
      type: 'button',
      title: `Use type ${type.name} for new particles`,
    }, [
      element('span', {
        className: 'swatch',
        attributes: { style: `background:${type.color}` },
      }),
      element('span', { text: type.name }),
      element('span', {
        className: 'tree__meta',
        text: `d=${formatValue(type.diameter)} m=${formatValue(type.mass)}`,
      }),
    ]);
    row.addEventListener('click', () => {
      this.#store.updateUi((ui) => {
        ui.activeType = type.name;
      }, 'active-type');
    });
    return row;
  }

  #particleRows(project, ui) {
    if (project.particles.length === 0) {
      return [this.#leaf('No particles yet.', 'tree__leaf--muted')];
    }

    const selection = new Set(ui.selection);
    const visible = project.particles.slice(0, MAXIMUM_PARTICLE_ROWS);
    const rows = visible.map((particle) => {
      const type = project.particleTypes.find((entry) => entry.name === particle.type);
      const row = element('button', {
        className: `tree__leaf tree__leaf--button ${selection.has(particle.id) ? 'is-selected' : ''}`.trim(),
        type: 'button',
      }, [
        element('span', {
          className: 'swatch swatch--small',
          attributes: { style: `background:${type?.color ?? '#94a3b8'}` },
        }),
        element('span', { text: particle.id }),
        element('span', {
          className: 'tree__meta',
          text: `${formatValue(particle.position.x, 2)}, ${formatValue(particle.position.y, 2)}`,
        }),
      ]);
      row.addEventListener('click', (event) => {
        this.#store.updateUi((state) => {
          if (event.shiftKey) {
            state.selection = state.selection.includes(particle.id)
              ? state.selection.filter((id) => id !== particle.id)
              : [...state.selection, particle.id];
          } else {
            state.selection = [particle.id];
          }
        }, 'selection');
      });
      return row;
    });

    if (project.particles.length > MAXIMUM_PARTICLE_ROWS) {
      rows.push(
        this.#leaf(
          `Showing ${MAXIMUM_PARTICLE_ROWS} of ${project.particles.length} particles.`,
          'tree__leaf--muted',
        ),
      );
    }
    return rows;
  }

  #layerRow(layer) {
    const checkbox = element('input', {
      type: 'checkbox',
      checked: layer.visible,
      className: 'checkbox',
    });
    checkbox.addEventListener('change', () => {
      this.#store.update((project) => {
        const target = project.layers.find((entry) => entry.id === layer.id);
        if (target) {
          target.visible = checkbox.checked;
        }
      }, 'layer-visibility');
    });
    return element('label', { className: 'tree__leaf tree__leaf--row' }, [
      checkbox,
      element('span', { text: layer.name }),
    ]);
  }
}
