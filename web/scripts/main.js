/** Application entry point: wires the store, viewport, panels, and runner client. */

import { element, formatValue, replaceChildren, selectInput } from './dom.js';
import { BottomPanel } from './panels/bottom-panel.js';
import { InspectorPanel } from './panels/inspector.js';
import { SceneTreePanel } from './panels/scene-tree.js';
import {
  SCHEMA_VERSION,
  createDefaultProject,
  createParticle,
  createSampleProject,
  nextParticleId,
  projectToJson,
} from './project.js';
import { RunnerClient } from './runner-client.js';
import { ProjectStore } from './store.js';
import { Viewport } from './viewport.js';

const store = new ProjectStore(createSampleProject());
const runner = new RunnerClient();

const references = {
  canvas: document.querySelector('#viewport-canvas'),
  sceneTree: document.querySelector('#scene-tree'),
  inspector: document.querySelector('#inspector'),
  bottomTabs: document.querySelector('#bottom-tabs'),
  bottomContent: document.querySelector('#bottom-content'),
  bottomBadge: document.querySelector('#bottom-badge'),
  toolbarTools: document.querySelector('#toolbar-tools'),
  toolbarView: document.querySelector('#toolbar-view'),
  projectName: document.querySelector('#project-name'),
  cursorReadout: document.querySelector('#cursor-readout'),
  connection: document.querySelector('#connection-status'),
  dialog: document.querySelector('#json-dialog'),
  dialogBody: document.querySelector('#json-dialog-body'),
  dialogTitle: document.querySelector('#json-dialog-title'),
  fileInput: document.querySelector('#file-input'),
  toast: document.querySelector('#toast'),
};

const viewport = new Viewport(references.canvas, store);
const sceneTree = new SceneTreePanel(references.sceneTree, store);
const inspector = new InspectorPanel(references.inspector, store);
const bottomPanel = new BottomPanel(
  {
    tabBar: references.bottomTabs,
    content: references.bottomContent,
    countBadge: references.bottomBadge,
  },
  store,
);

function showToast(message, tone = 'info') {
  references.toast.textContent = message;
  references.toast.className = `toast toast--${tone} is-visible`;
  window.setTimeout(() => {
    references.toast.className = 'toast';
  }, 3200);
}

function openDialog(title, body) {
  references.dialogTitle.textContent = title;
  references.dialogBody.textContent = body;
  references.dialog.showModal();
}

function downloadJson() {
  const project = store.project;
  const blob = new Blob([projectToJson(project)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = element('a', {
    href: url,
    download: `${project.name.replace(/[^\w-]+/g, '-').toLowerCase() || 'project'}.json`,
  });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast('Project JSON exported.', 'ok');
}

function importProjectText(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    showToast('That file is not valid JSON.', 'error');
    return;
  }
  if (typeof parsed !== 'object' || parsed === null || !Array.isArray(parsed.particles)) {
    showToast('That file does not look like a HOOMD GUI project.', 'error');
    return;
  }
  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    showToast(
      `Unsupported schema version ${parsed.schemaVersion}. This build reads version ${SCHEMA_VERSION}.`,
      'error',
    );
    return;
  }
  const project = { ...createDefaultProject(), ...parsed };
  store.replaceProject(project, 'import');
  viewport.fitToBox();
  showToast(`Loaded "${project.name}".`, 'ok');
}

function deleteSelection() {
  const selection = new Set(store.ui.selection);
  if (selection.size === 0) {
    return;
  }
  store.update((project) => {
    project.particles = project.particles.filter((particle) => !selection.has(particle.id));
  }, 'delete');
  store.updateUi((ui) => {
    ui.selection = [];
  }, 'selection');
}

function duplicateSelection() {
  const selected = store.selectedParticles();
  if (selected.length === 0) {
    return;
  }
  const created = [];
  store.update((project) => {
    for (const particle of selected) {
      const id = nextParticleId(project);
      const copy = createParticle({
        id,
        type: particle.type,
        x: particle.position.x + 1.0,
        y: particle.position.y + 1.0,
        layer: particle.layer,
      });
      copy.customAttributes = { ...particle.customAttributes };
      copy.fixed = particle.fixed;
      project.particles.push(copy);
      created.push(id);
    }
  }, 'duplicate');
  store.updateUi((ui) => {
    ui.selection = created;
  }, 'selection');
}

function buildToolbar() {
  const toolButtons = [
    { id: 'select', label: 'Select', hint: 'V' },
    { id: 'add', label: 'Add Particle', hint: 'A' },
  ].map((tool) => {
    const button = element('button', {
      className: 'button button--tool',
      type: 'button',
      title: `${tool.label} (${tool.hint})`,
    }, [
      element('span', { text: tool.label }),
      element('kbd', { text: tool.hint }),
    ]);
    button.dataset.tool = tool.id;
    button.addEventListener('click', () => {
      store.updateUi((ui) => {
        ui.tool = tool.id;
      }, 'tool');
    });
    return button;
  });

  const typeSelector = element('span', { className: 'toolbar__group-inline' });

  replaceChildren(
    references.toolbarTools,
    ...toolButtons,
    element('span', { className: 'toolbar__divider' }),
    typeSelector,
  );

  const renderTypeSelector = () => {
    replaceChildren(
      typeSelector,
      element('span', { className: 'toolbar__label', text: 'New particle type' }),
      selectInput({
        value: store.ui.activeType,
        options: store.project.particleTypes.map((type) => ({
          value: type.name,
          label: type.name,
        })),
        onCommit: (value) =>
          store.updateUi((ui) => {
            ui.activeType = value;
          }, 'active-type'),
      }),
    );
  };
  renderTypeSelector();

  const viewToggles = [
    { id: 'showGrid', label: 'Grid' },
    { id: 'showPeriodicImages', label: 'Periodic images' },
  ].map((toggle) => {
    const checkbox = element('input', { type: 'checkbox', className: 'checkbox' });
    checkbox.checked = store.ui[toggle.id];
    checkbox.addEventListener('change', () => {
      store.updateUi((ui) => {
        ui[toggle.id] = checkbox.checked;
      }, 'view');
    });
    return element('label', { className: 'toolbar__toggle' }, [
      checkbox,
      element('span', { text: toggle.label }),
    ]);
  });

  const fitButton = element('button', {
    className: 'button button--ghost',
    type: 'button',
    text: 'Fit',
    title: 'Fit the box in the viewport (F)',
  });
  fitButton.addEventListener('click', () => viewport.fitToBox());

  const zoomOut = element('button', { className: 'button button--ghost', type: 'button', text: '−' });
  zoomOut.addEventListener('click', () => viewport.zoomBy(1 / 1.25));
  const zoomIn = element('button', { className: 'button button--ghost', type: 'button', text: '+' });
  zoomIn.addEventListener('click', () => viewport.zoomBy(1.25));

  replaceChildren(references.toolbarView, ...viewToggles, zoomOut, zoomIn, fitButton);

  store.subscribe((reason) => {
    for (const button of toolButtons) {
      button.classList.toggle('is-active', button.dataset.tool === store.ui.tool);
    }
    references.canvas.style.cursor = store.ui.tool === 'add' ? 'crosshair' : 'default';
    if (reason === 'load' || reason === 'import' || reason === 'active-type') {
      renderTypeSelector();
    }
  });
  for (const button of toolButtons) {
    button.classList.toggle('is-active', button.dataset.tool === store.ui.tool);
  }
}

function bindMenuActions() {
  const actions = {
    'new-project': () => {
      store.replaceProject(createDefaultProject(), 'load');
      viewport.fitToBox();
      showToast('Created an empty project.', 'ok');
    },
    'load-sample': () => {
      store.replaceProject(createSampleProject(), 'load');
      viewport.fitToBox();
      showToast('Loaded the sample project.', 'ok');
    },
    'import-project': () => references.fileInput.click(),
    'export-project': downloadJson,
    'view-json': () => openDialog('Project JSON', projectToJson(store.project)),
    undo: () => {
      if (!store.undo()) {
        showToast('Nothing to undo.');
      }
    },
    redo: () => {
      if (!store.redo()) {
        showToast('Nothing to redo.');
      }
    },
  };

  for (const [action, handler] of Object.entries(actions)) {
    const button = document.querySelector(`[data-action="${action}"]`);
    button?.addEventListener('click', handler);
  }

  references.fileInput.addEventListener('change', async () => {
    const [file] = references.fileInput.files ?? [];
    if (file) {
      importProjectText(await file.text());
    }
    references.fileInput.value = '';
  });

  references.projectName.addEventListener('change', () => {
    store.update((project) => {
      project.name = references.projectName.value;
    }, 'rename');
  });

  document.querySelector('#json-dialog-close')?.addEventListener('click', () => {
    references.dialog.close();
  });
}

function bindKeyboard() {
  window.addEventListener('keydown', (event) => {
    const target = event.target;
    const isTextEntry =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement;
    if (isTextEntry) {
      return;
    }

    const accelerator = event.metaKey || event.ctrlKey;
    if (accelerator && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        store.redo();
      } else {
        store.undo();
      }
      return;
    }
    if (accelerator && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      duplicateSelection();
      return;
    }
    if (accelerator && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      store.updateUi((ui) => {
        ui.selection = store.project.particles.map((particle) => particle.id);
      }, 'selection');
      return;
    }
    if (accelerator) {
      return;
    }

    switch (event.key) {
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        deleteSelection();
        break;
      case 'Escape':
        store.updateUi((ui) => {
          ui.selection = [];
        }, 'selection');
        break;
      case 'v':
      case 'V':
        store.updateUi((ui) => {
          ui.tool = 'select';
        }, 'tool');
        break;
      case 'a':
      case 'A':
        store.updateUi((ui) => {
          ui.tool = 'add';
        }, 'tool');
        break;
      case 'f':
      case 'F':
        viewport.fitToBox();
        break;
      default:
        break;
    }
  });
}

function bindRunnerStatus() {
  runner.subscribe((status) => {
    const connected = status.connected;
    const label = connected ? 'Python Connected' : 'Static Demo Mode';
    const detail = connected
      ? `HOOMD ${status.version?.hoomd ?? 'unknown'} · runner ${status.version?.runner ?? '?'}`
      : 'Editing works offline. Start the Local Runner for validation and execution.';

    replaceChildren(
      references.connection,
      element('span', { className: `dot ${connected ? 'dot--ok' : 'dot--idle'}` }),
      element('span', { className: 'connection__label', text: label }),
      element('span', { className: 'connection__detail', text: detail }),
    );
    references.connection.title = detail;
  });
  runner.start();
}

function bindCursorReadout() {
  viewport.onCursorMove((position) => {
    references.cursorReadout.textContent = position
      ? `x ${formatValue(position.x, 2)}  y ${formatValue(position.y, 2)} σ`
      : '';
  });
}

function syncProjectName() {
  store.subscribe((reason) => {
    if (reason !== 'rename') {
      references.projectName.value = store.project.name;
    }
  });
  references.projectName.value = store.project.name;
}

viewport.attach();
sceneTree.attach();
inspector.attach();
bottomPanel.attach();
buildToolbar();
bindMenuActions();
bindKeyboard();
bindRunnerStatus();
bindCursorReadout();
syncProjectName();
viewport.fitToBox();
