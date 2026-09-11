/** Inspector panel for the current selection, box, boundaries, and run settings. */

import {
  ATTRIBUTE_KEY_PATTERN,
  BOUNDARY_MODES,
  RESERVED_ATTRIBUTE_KEYS,
  SIMULATION_MODES,
  createBoundary,
} from '../project.js';
import { element, field, formatValue, numberInput, replaceChildren, selectInput } from '../dom.js';

export class InspectorPanel {
  #container;
  #store;
  #attributeError = null;

  constructor(container, store) {
    this.#container = container;
    this.#store = store;
  }

  attach() {
    this.#store.subscribe((reason) => {
      if (reason === 'camera' || reason === 'hover') {
        return;
      }
      this.render();
    });
    this.render();
  }

  render() {
    const project = this.#store.project;
    const selected = this.#store.selectedParticles();

    const sections = [];
    if (selected.length > 0) {
      sections.push(this.#selectionSection(project, selected));
      sections.push(this.#attributesSection(project, selected));
    } else {
      sections.push(
        this.#section('Selection', [
          element('p', {
            className: 'muted',
            text: 'Select a particle in the viewport or scene tree to edit it.',
          }),
        ]),
      );
    }
    sections.push(this.#boxSection(project));
    sections.push(this.#boundarySection(project));
    sections.push(this.#runSection(project));

    replaceChildren(this.#container, ...sections);
  }

  #section(title, children) {
    return element('section', { className: 'inspector__section' }, [
      element('h3', { className: 'inspector__title', text: title }),
      element('div', { className: 'inspector__body' }, children),
    ]);
  }

  #selectionSection(project, selected) {
    const children = [];

    if (selected.length === 1) {
      const [particle] = selected;
      children.push(
        element('div', { className: 'inspector__identity' }, [
          element('span', { className: 'chip', text: particle.id }),
        ]),
        field(
          'Position X (σ)',
          numberInput({
            value: particle.position.x,
            step: 0.1,
            onCommit: (value) => this.#setPosition(particle.id, 'x', value),
          }),
        ),
        field(
          'Position Y (σ)',
          numberInput({
            value: particle.position.y,
            step: 0.1,
            onCommit: (value) => this.#setPosition(particle.id, 'y', value),
          }),
        ),
      );
    } else {
      const centroidX =
        selected.reduce((total, particle) => total + particle.position.x, 0) / selected.length;
      const centroidY =
        selected.reduce((total, particle) => total + particle.position.y, 0) / selected.length;
      children.push(
        element('div', { className: 'inspector__identity' }, [
          element('span', { className: 'chip', text: `${selected.length} particles selected` }),
        ]),
        this.#readout('Centroid', `${formatValue(centroidX, 2)}, ${formatValue(centroidY, 2)} σ`),
      );
    }

    const typeValues = new Set(selected.map((particle) => particle.type));
    children.push(
      field(
        'Type',
        selectInput({
          value: typeValues.size === 1 ? [...typeValues][0] : '',
          options: [
            ...(typeValues.size === 1 ? [] : [{ value: '', label: 'Mixed' }]),
            ...project.particleTypes.map((type) => ({ value: type.name, label: type.name })),
          ],
          onCommit: (value) => {
            if (value) {
              this.#applyToSelection((particle) => {
                particle.type = value;
              }, 'set-type');
            }
          },
        }),
        'Diameter and mass come from the type definition.',
      ),
    );

    const fixedValues = new Set(selected.map((particle) => particle.fixed));
    const fixedCheckbox = element('input', {
      type: 'checkbox',
      className: 'checkbox',
      checked: fixedValues.size === 1 && [...fixedValues][0],
    });
    fixedCheckbox.indeterminate = fixedValues.size > 1;
    fixedCheckbox.addEventListener('change', () => {
      this.#applyToSelection((particle) => {
        particle.fixed = fixedCheckbox.checked;
      }, 'set-fixed');
    });
    children.push(
      element('label', { className: 'field field--inline' }, [
        fixedCheckbox,
        element('span', { className: 'field__label', text: 'Fixed in place' }),
      ]),
    );

    const activeType = project.particleTypes.find(
      (type) => typeValues.size === 1 && type.name === [...typeValues][0],
    );
    if (activeType) {
      children.push(
        this.#readout('Diameter', `${formatValue(activeType.diameter)} σ`),
        this.#readout('Mass', formatValue(activeType.mass)),
      );
    }

    return this.#section('Transform', children);
  }

  #attributesSection(project, selected) {
    const children = [];
    if (selected.length > 1) {
      children.push(
        element('p', {
          className: 'muted',
          text: 'Select a single particle to edit custom attributes.',
        }),
      );
      return this.#section('Custom Attributes', children);
    }

    const [particle] = selected;
    const keys = Object.keys(particle.customAttributes).sort();
    if (keys.length === 0) {
      children.push(element('p', { className: 'muted', text: 'No custom attributes.' }));
    }

    for (const key of keys) {
      const row = element('div', { className: 'attribute-row' }, [
        element('span', { className: 'attribute-row__key', text: key }),
        numberInput({
          value: particle.customAttributes[key],
          onCommit: (value) => this.#setAttribute(particle.id, key, value),
        }),
        element('span', { className: 'badge badge--stored', text: 'stored', title: 'No feature consumes this attribute yet.' }),
      ]);
      const remove = element('button', {
        className: 'icon-button',
        type: 'button',
        text: '×',
        title: `Remove ${key}`,
      });
      remove.addEventListener('click', () => this.#removeAttribute(particle.id, key));
      row.append(remove);
      children.push(row);
    }

    const keyInput = element('input', {
      className: 'input',
      type: 'text',
      placeholder: 'a1',
    });
    const valueInput = element('input', {
      className: 'input input--number',
      type: 'number',
      step: 'any',
      placeholder: '0.0',
    });
    const addButton = element('button', {
      className: 'button button--small',
      type: 'button',
      text: 'Add Attribute',
    });
    addButton.addEventListener('click', () => {
      const error = this.#addAttribute(particle.id, keyInput.value.trim(), valueInput.value);
      this.#attributeError = error;
      if (!error) {
        keyInput.value = '';
        valueInput.value = '';
      }
      this.render();
    });

    children.push(
      element('div', { className: 'attribute-add' }, [keyInput, valueInput, addButton]),
    );
    if (this.#attributeError) {
      children.push(element('p', { className: 'inline-error', text: this.#attributeError }));
    }

    return this.#section('Custom Attributes', children);
  }

  #boxSection(project) {
    return this.#section('Box', [
      field(
        'Length X (σ)',
        numberInput({
          value: project.box.lx,
          min: 0,
          step: 1,
          onCommit: (value) =>
            this.#store.update((draft) => {
              draft.box.lx = value;
            }, 'box'),
        }),
      ),
      field(
        'Length Y (σ)',
        numberInput({
          value: project.box.ly,
          min: 0,
          step: 1,
          onCommit: (value) =>
            this.#store.update((draft) => {
              draft.box.ly = value;
            }, 'box'),
        }),
      ),
    ]);
  }

  #boundarySection(project) {
    const children = [
      element('p', {
        className: 'muted',
        text: 'A periodic boundary links a pair of opposite faces, so both faces change together.',
      }),
    ];

    for (const axis of ['x', 'y']) {
      const boundary = project.boundaries[axis];
      const label = axis === 'x' ? 'Left (−X) ↔ Right (+X)' : 'Bottom (−Y) ↔ Top (+Y)';
      children.push(
        field(
          label,
          selectInput({
            value: boundary.mode,
            options: BOUNDARY_MODES.map((mode) => ({
              value: mode,
              label: mode === 'periodic' ? 'Periodic' : 'Walls',
            })),
            onCommit: (mode) =>
              this.#store.update((draft) => {
                draft.boundaries[axis] = createBoundary(mode);
              }, 'boundary'),
          }),
        ),
      );

      if (boundary.mode === 'walls') {
        for (const face of ['minimum', 'maximum']) {
          children.push(
            field(
              `${face === 'minimum' ? 'Lower' : 'Upper'} wall padding (σ)`,
              numberInput({
                value: boundary[face].padding,
                min: 0,
                step: 0.1,
                onCommit: (value) =>
                  this.#store.update((draft) => {
                    draft.boundaries[axis][face].padding = value;
                  }, 'boundary'),
              }),
            ),
          );
        }
      }
    }

    return this.#section('Boundaries', children);
  }

  #runSection(project) {
    return this.#section('Run Settings', [
      field(
        'Simulation mode',
        selectInput({
          value: project.run.mode,
          options: SIMULATION_MODES.map((mode) => ({ value: mode.id, label: mode.label })),
          onCommit: (value) =>
            this.#store.update((draft) => {
              draft.run.mode = value;
            }, 'run'),
        }),
        'Hard and soft disks use different HOOMD-blue algorithms.',
      ),
      field(
        'Timestep dt',
        numberInput({
          value: project.run.dt,
          min: 0,
          step: 0.001,
          disabled: project.run.mode !== 'md',
          onCommit: (value) =>
            this.#store.update((draft) => {
              draft.run.dt = value;
            }, 'run'),
        }),
      ),
      field(
        'Temperature kT',
        numberInput({
          value: project.run.kT,
          min: 0,
          step: 0.1,
          onCommit: (value) =>
            this.#store.update((draft) => {
              draft.run.kT = value;
            }, 'run'),
        }),
      ),
      field(
        'Steps',
        numberInput({
          value: project.run.steps,
          min: 1,
          step: 1000,
          onCommit: (value) =>
            this.#store.update((draft) => {
              draft.run.steps = Math.round(value);
            }, 'run'),
        }),
      ),
      field(
        'Random seed',
        numberInput({
          value: project.run.seed,
          min: 0,
          step: 1,
          onCommit: (value) =>
            this.#store.update((draft) => {
              draft.run.seed = Math.round(value);
            }, 'run'),
        }),
      ),
    ]);
  }

  #readout(label, value) {
    return element('div', { className: 'readout' }, [
      element('span', { className: 'readout__label', text: label }),
      element('span', { className: 'readout__value', text: value }),
    ]);
  }

  #setPosition(particleId, axis, value) {
    this.#store.update((draft) => {
      const particle = draft.particles.find((entry) => entry.id === particleId);
      if (particle) {
        particle.position[axis] = value;
      }
    }, 'set-position');
  }

  #applyToSelection(mutator, reason) {
    const selection = new Set(this.#store.ui.selection);
    this.#store.update((draft) => {
      for (const particle of draft.particles) {
        if (selection.has(particle.id)) {
          mutator(particle);
        }
      }
    }, reason);
  }

  /** Validate and add one custom attribute. Returns an error message or null. */
  #addAttribute(particleId, key, rawValue) {
    if (!key) {
      return 'Enter an attribute key.';
    }
    if (!ATTRIBUTE_KEY_PATTERN.test(key)) {
      return 'Keys must start with a letter or underscore and contain only letters, digits, and underscores.';
    }
    if (RESERVED_ATTRIBUTE_KEYS.includes(key)) {
      return `"${key}" is a reserved built-in field name.`;
    }
    const particle = this.#store.project.particles.find((entry) => entry.id === particleId);
    if (particle && key in particle.customAttributes) {
      return `This particle already defines "${key}".`;
    }
    const value = Number.parseFloat(rawValue);
    if (!Number.isFinite(value)) {
      return 'Enter a finite numeric value.';
    }

    this.#store.update((draft) => {
      const target = draft.particles.find((entry) => entry.id === particleId);
      if (!target) {
        return;
      }
      target.customAttributes[key] = value;
      if (!(key in draft.attributeDefinitions)) {
        draft.attributeDefinitions[key] = { type: 'number', default: 0.0 };
      }
    }, 'add-attribute');
    return null;
  }

  #setAttribute(particleId, key, value) {
    this.#store.update((draft) => {
      const particle = draft.particles.find((entry) => entry.id === particleId);
      if (particle) {
        particle.customAttributes[key] = value;
      }
    }, 'set-attribute');
  }

  #removeAttribute(particleId, key) {
    this.#store.update((draft) => {
      const particle = draft.particles.find((entry) => entry.id === particleId);
      if (particle) {
        delete particle.customAttributes[key];
      }
    }, 'remove-attribute');
  }
}
