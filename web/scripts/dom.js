/** Small DOM helpers shared by the interface panels. */

/** Create an element with attributes, dataset entries, and children. */
export function element(tagName, options = {}, children = []) {
  const node = document.createElement(tagName);
  const { className, text, dataset, attributes, ...rest } = options;

  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  for (const [key, value] of Object.entries(dataset ?? {})) {
    node.dataset[key] = String(value);
  }
  for (const [key, value] of Object.entries(attributes ?? {})) {
    node.setAttribute(key, String(value));
  }
  for (const [key, value] of Object.entries(rest)) {
    node[key] = value;
  }
  for (const child of children) {
    node.append(child);
  }
  return node;
}

/** Replace every child of a container. */
export function replaceChildren(container, ...children) {
  container.replaceChildren(...children);
}

/** Build a labelled form row. */
export function field(labelText, control, hint) {
  const label = element('label', { className: 'field' }, [
    element('span', { className: 'field__label', text: labelText }),
    control,
  ]);
  if (hint) {
    label.append(element('span', { className: 'field__hint', text: hint }));
  }
  return label;
}

/** Build a number input bound to a change handler. */
export function numberInput({ value, step = 'any', min, max, onCommit, disabled = false }) {
  const input = element('input', {
    className: 'input input--number',
    type: 'number',
    value: String(value),
    step: String(step),
    disabled,
  });
  if (min !== undefined) {
    input.min = String(min);
  }
  if (max !== undefined) {
    input.max = String(max);
  }
  input.addEventListener('change', () => {
    const parsed = Number.parseFloat(input.value);
    if (Number.isFinite(parsed)) {
      onCommit(parsed);
    } else {
      input.value = String(value);
    }
  });
  return input;
}

/** Build a text input bound to a change handler. */
export function textInput({ value, onCommit, placeholder = '' }) {
  const input = element('input', {
    className: 'input',
    type: 'text',
    value,
    placeholder,
  });
  input.addEventListener('change', () => onCommit(input.value));
  return input;
}

/** Build a select control bound to a change handler. */
export function selectInput({ value, options, onCommit }) {
  const select = element('select', { className: 'input' });
  for (const option of options) {
    select.append(
      element('option', { value: option.value, text: option.label, selected: option.value === value }),
    );
  }
  select.addEventListener('change', () => onCommit(select.value));
  return select;
}

/** Format a number for compact display. */
export function formatValue(value, digits = 3) {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return Number.parseFloat(value.toFixed(digits)).toString();
}
