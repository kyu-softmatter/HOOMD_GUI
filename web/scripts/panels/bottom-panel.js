/** Bottom dock with potential preview, timeline, and validation messages. */

import { packingFraction, plural, validateProject } from '../analysis.js';
import { element, formatValue, replaceChildren } from '../dom.js';

const TABS = [
  { id: 'potential', label: 'Potential Preview' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'validation', label: 'Validation Messages' },
];

export class BottomPanel {
  #tabBar;
  #content;
  #store;
  #countBadge;

  constructor({ tabBar, content, countBadge }, store) {
    this.#tabBar = tabBar;
    this.#content = content;
    this.#countBadge = countBadge;
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
    const activeTab = this.#store.ui.bottomTab;
    replaceChildren(
      this.#tabBar,
      ...TABS.map((tab) => {
        const button = element('button', {
          className: `tab ${tab.id === activeTab ? 'is-active' : ''}`.trim(),
          type: 'button',
          text: tab.label,
          attributes: { 'aria-selected': String(tab.id === activeTab), role: 'tab' },
        });
        button.addEventListener('click', () => {
          this.#store.updateUi((ui) => {
            ui.bottomTab = tab.id;
          }, 'bottom-tab');
        });
        return button;
      }),
    );

    const issues = validateProject(this.#store.project);
    const errorCount = issues.filter((issue) => issue.severity === 'error').length;
    const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
    this.#countBadge.textContent =
      errorCount + warningCount === 0
        ? 'No blocking issues'
        : `${errorCount} ${plural(errorCount, 'error', 'errors')} · `
          + `${warningCount} ${plural(warningCount, 'warning', 'warnings')}`;
    this.#countBadge.className = `status-pill ${
      errorCount > 0 ? 'status-pill--error' : warningCount > 0 ? 'status-pill--warning' : 'status-pill--ok'
    }`;

    if (activeTab === 'validation') {
      replaceChildren(this.#content, this.#validationView(issues));
    } else if (activeTab === 'potential') {
      replaceChildren(this.#content, this.#potentialView());
    } else {
      replaceChildren(this.#content, this.#timelineView());
    }
  }

  #validationView(issues) {
    const project = this.#store.project;
    const summary = element('div', { className: 'validation__summary' }, [
      this.#stat('Particles', String(project.particles.length)),
      this.#stat('Types', String(project.particleTypes.length)),
      this.#stat('Packing fraction', formatValue(packingFraction(project), 3)),
      this.#stat(
        'Box',
        `${formatValue(project.box.lx)} × ${formatValue(project.box.ly)} σ`,
      ),
    ]);

    const list = element('ul', { className: 'validation__list' });
    if (issues.length === 0) {
      list.append(
        element('li', { className: 'validation__item validation__item--ok' }, [
          element('span', { className: 'validation__icon', text: '✓' }),
          element('span', { text: 'The editor found no problems in this configuration.' }),
        ]),
      );
    }
    for (const issue of issues) {
      const item = element('li', { className: `validation__item validation__item--${issue.severity}` }, [
        element('span', {
          className: 'validation__icon',
          text: issue.severity === 'error' ? '!' : issue.severity === 'warning' ? '▲' : 'i',
        }),
        element('div', { className: 'validation__text' }, [
          element('span', { text: issue.message }),
          element('code', { className: 'validation__code', text: issue.code }),
        ]),
      ]);
      if (issue.targets?.length) {
        const select = element('button', {
          className: 'button button--small',
          type: 'button',
          text: `Select ${issue.targets.length}`,
        });
        select.addEventListener('click', () => {
          this.#store.updateUi((ui) => {
            ui.selection = [...issue.targets];
          }, 'selection');
        });
        item.append(select);
      }
      list.append(item);
    }

    return element('div', { className: 'validation' }, [
      summary,
      list,
      element('p', {
        className: 'muted validation__note',
        text: 'These are browser-side checks. The Local Runner performs the authoritative validation.',
      }),
    ]);
  }

  #stat(label, value) {
    return element('div', { className: 'stat' }, [
      element('span', { className: 'stat__label', text: label }),
      element('span', { className: 'stat__value', text: value }),
    ]);
  }

  #potentialView() {
    return this.#placeholder(
      'Potential preview',
      'Pair potential and force curves appear here once the interaction editor exists. '
        + 'The project model does not define interactions yet.',
    );
  }

  #timelineView() {
    return this.#placeholder(
      'Timeline',
      'The timeline scrubs prescribed potential-well motion and sample trajectories. '
        + 'It activates once potential wells are part of the project model.',
    );
  }

  #placeholder(title, description) {
    return element('div', { className: 'placeholder' }, [
      element('h4', { className: 'placeholder__title', text: title }),
      element('p', { className: 'placeholder__text', text: description }),
      element('span', { className: 'badge badge--planned', text: 'Not implemented yet' }),
    ]);
  }
}
