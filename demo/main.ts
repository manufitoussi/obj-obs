import { get, isEqual, notify, observe, set } from '../src/index.js';
import type { ChangeEvent } from '../src/index.js';

type Dict = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Observed object

/** Properties mapped to accessors that notify their changes, like Synapps actors. */
function notifyingProperties(initial: Dict): Dict {
  const values = { ...initial };
  const properties: Dict = {};
  for (const key of Object.keys(values)) {
    Object.defineProperty(properties, key, {
      enumerable: true,
      get: () => values[key],
      set: (value: unknown) => {
        const oldValue = values[key];
        if (Object.is(oldValue, value)) return;
        values[key] = value;
        notify(properties, key, oldValue, value);
      },
    });
  }

  return properties;
}

function createActor(name: string, color: string, content: string, width: number): Dict {
  return { name, properties: notifyingProperties({ color, content, width }) };
}

function createState(): Dict {
  return {
    synapp: { name: 'Ma synapp' },
    actors: {
      text1: createActor('Texte 1', '#e63946', 'Bonjour', 160),
      text2: createActor('Texte 2', '#457b9d', 'Monde', 120),
    },
  };
}

/** The demo works on `root.state`, so that the whole state can be replaced and followed. */
const root: { state: Dict } = { state: createState() };

function statePath(path: string): string {
  return path ? `state.${path}` : 'state';
}

// ---------------------------------------------------------------------------
// Helpers

const $ = <T extends Element = HTMLElement>(selector: string) => document.querySelector(selector) as T;

function format(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (typeof value === 'number' && Number.isNaN(value)) return 'NaN';
  if (typeof value === 'function') return 'ƒ';
  if (value instanceof Date) return `Date(${value.toISOString()})`;
  if (value instanceof Map) return `Map(${value.size})`;
  if (value instanceof Set) return `Set(${value.size})`;
  try {
    const json = JSON.stringify(value);
    return json.length > 80 ? `${json.slice(0, 77)}…` : json;
  } catch {
    return String(value);
  }
}

function evaluate(expression: string): unknown {
  return new Function(`return (${expression});`)();
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: (Node | string)[]) {
  const element = Object.assign(document.createElement(tag), props);
  element.append(...children);
  return element;
}

function code(text: string) {
  return el('code', { textContent: text });
}

/** Runs an action, logging its errors. */
function attempt(action: () => void) {
  try {
    action();
  } catch (error) {
    log('error', [`${error instanceof Error ? error.name + ': ' + error.message : String(error)}`]);
    if (error instanceof AggregateError) {
      error.errors.forEach((e) => log('error', [`  · ${e instanceof Error ? e.message : String(e)}`]));
    }
  }

  scheduleRender();
}

// ---------------------------------------------------------------------------
// Journal

let logIndex = 0;

function log(kind: 'event' | 'action' | 'error' | 'info', parts: (Node | string)[]) {
  const time = new Date().toLocaleTimeString('fr-FR', { hour12: false });
  const item = el('li', { className: kind }, el('span', { className: 'time', textContent: `${++logIndex} · ${time}` }), ...parts);
  $('#log').prepend(item);
  const items = $('#log').children;
  while (items.length > 300) items[items.length - 1].remove();
}

$('#clear-log').addEventListener('click', () => {
  $('#log').replaceChildren();
});

function logEvent(label: string, event: ChangeEvent) {
  const leafKey = event.path.split('.').pop();
  log('event', [
    code(label),
    ' : ',
    code(format(event.oldValue)),
    ' → ',
    code(format(event.newValue)),
    event.changed.key === leafKey ? '' : el('span', { className: 'hint', textContent: ` (via le changement de ${event.changed.key})` }),
  ]);
}

// ---------------------------------------------------------------------------
// Tree of the observed object

function writeMode(): 'set' | 'assign' {
  return ($('input[name="write-mode"]:checked') as HTMLInputElement).value as 'set' | 'assign';
}

/** Assigns without set(): only accessors calling notify() are noticed. */
function assign(path: string, value: unknown) {
  const keys = statePath(path).split('.');
  const last = keys.pop() as string;
  const parent = get(root, keys.join('.') as string) as Dict | null;
  if (!parent || typeof parent !== 'object') throw new Error(`"${keys.join('.')}" n'est pas un objet.`);
  parent[last] = value;
}

function write(path: string, value: unknown, mode = writeMode()) {
  log('action', [mode === 'set' ? 'set(' : 'affectation ', code(path), mode === 'set' ? ', ' : ' = ', code(format(value)), mode === 'set' ? ')' : '']);
  if (mode === 'set') set(root, statePath(path), value);
  else assign(path, value);
}

function parseInput(input: HTMLInputElement, previous: unknown): unknown {
  if (typeof previous === 'number') return input.valueAsNumber;
  return input.value;
}

function renderTree(value: unknown, path: string): HTMLElement {
  if (!value || typeof value !== 'object') {
    return el('span', { className: 'null', textContent: format(value) });
  }

  const list = el('ul', { className: 'tree' });
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    const isAccessor = !!Object.getOwnPropertyDescriptor(value, key)?.get;
    const label = el('span', { className: isAccessor ? 'key accessor' : 'key', textContent: key, title: childPath });
    if (child && typeof child === 'object') {
      list.append(el('li', {}, label, renderTree(child, childPath)));
      continue;
    }

    const input = document.createElement('input');
    if (typeof child === 'number') input.type = 'number';
    else if (typeof child === 'string' && /^#[0-9a-f]{6}$/i.test(child)) input.type = 'color';
    input.value = child == null ? '' : String(child);
    input.dataset.path = childPath;
    input.addEventListener('change', () => attempt(() => write(childPath, parseInput(input, child))));
    list.append(el('li', {}, label, input));
  }

  return list;
}

function collectPaths(value: unknown, path: string, paths: string[]) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    paths.push(childPath);
    collectPaths(child, childPath, paths);
  }
}

// ---------------------------------------------------------------------------
// Preview: actors drawn from observers, like a view bound to the model

const preview = $('#preview');
const actorViews = new Map<string, HTMLElement>();

function drawActor(id: string) {
  const actor = get(root, `state.actors.${id}` as string) as Dict | null;
  let view = actorViews.get(id);
  if (!view) {
    view = el('div', { className: 'actor' });
    actorViews.set(id, view);
    preview.append(view);
  }

  if (!actor) {
    view.className = 'actor missing';
    view.textContent = `${id} : null`;
    view.removeAttribute('style');
    return;
  }

  const properties = (actor.properties ?? {}) as Dict;
  view.className = 'actor';
  view.style.background = String(properties.color ?? 'transparent');
  view.style.width = `${Number(properties.width) || 0}px`;
  view.replaceChildren(el('strong', { textContent: String(actor.name ?? id) }), el('span', { textContent: String(properties.content ?? '') }));
  view.animate([{ outlineColor: 'var(--accent)' }, { outlineColor: 'transparent' }], { duration: 500 });
}

for (const id of ['text1', 'text2']) {
  for (const field of ['name', 'properties.color', 'properties.content', 'properties.width']) {
    observe(root, `state.actors.${id}.${field}`, () => drawActor(id));
  }

  drawActor(id);
}

// ---------------------------------------------------------------------------
// Observers

interface ObserverEntry {
  id: number;
  path: string;
  throws: boolean;
  calls: number;
  last?: ChangeEvent;
  dispose: () => void;
  view: HTMLElement;
}

let observerId = 0;
const observers = new Map<number, ObserverEntry>();

function renderObserver(entry: ObserverEntry) {
  const remove = el('button', { className: 'small', textContent: 'dispose()' });
  remove.addEventListener('click', () => {
    entry.dispose();
    observers.delete(entry.id);
    entry.view.remove();
    log('action', ['dispose() de ', code(entry.path)]);
  });
  entry.view.replaceChildren(
    el('div', {}, code(entry.path), entry.throws ? el('span', { className: 'badge error', textContent: 'lève une erreur' }) : ''),
    el('div', { className: 'hint' }, `${entry.calls} appel${entry.calls > 1 ? 's' : ''}`, entry.last ? ` · dernier : ${format(entry.last.oldValue)} → ${format(entry.last.newValue)}` : ''),
    remove,
  );
}

$<HTMLFormElement>('#observer-form').addEventListener('submit', (submit) => {
  submit.preventDefault();
  const form = submit.target as HTMLFormElement;
  const path = (form.elements.namedItem('path') as HTMLInputElement).value.trim();
  const throws = (form.elements.namedItem('throws') as HTMLInputElement).checked;
  const entry: ObserverEntry = { id: ++observerId, path, throws, calls: 0, dispose: () => {}, view: el('li') };
  entry.dispose = observe(root, statePath(path), (event) => {
    entry.calls++;
    entry.last = event;
    logEvent(`#${entry.id} ${path}`, event);
    renderObserver(entry);
    entry.view.animate([{ background: 'var(--flash)' }, { background: 'transparent' }], { duration: 600 });
    if (throws) throw new Error(`L'observateur #${entry.id} (${path}) a échoué.`);
  });
  observers.set(entry.id, entry);
  renderObserver(entry);
  $('#observers').append(entry.view);
  log('action', ['observe(', code(path), ')']);
});

// ---------------------------------------------------------------------------
// Bindings, on the model of BasicBinding

let bindingId = 0;

function bind(source: string, target: string, canWrite: boolean, onetime: boolean): () => void {
  const sourcePath = statePath(source);
  const targetPath = statePath(target);
  const read = () => {
    const value = get(root, sourcePath as string);
    if (!isEqual(value, get(root, targetPath as string))) set(root, targetPath as string, value);
  };
  const writeBack = () => {
    const value = get(root, targetPath as string);
    if (!isEqual(value, get(root, sourcePath as string))) set(root, sourcePath as string, value);
  };

  const disposers: (() => void)[] = [];
  if (!onetime) disposers.push(observe(root, sourcePath, read));
  read();
  if (canWrite) disposers.push(observe(root, targetPath, writeBack));
  return () => disposers.forEach((dispose) => dispose());
}

$<HTMLFormElement>('#binding-form').addEventListener('submit', (submit) => {
  submit.preventDefault();
  const form = submit.target as HTMLFormElement;
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement;
  const source = field('source').value.trim();
  const target = field('target').value.trim();
  const canWrite = field('canWrite').checked;
  const onetime = field('onetime').checked;
  attempt(() => {
    const id = ++bindingId;
    log('action', [`liaison #${id} `, code(target), canWrite ? ' ⇄ ' : ' ← ', code(source), onetime ? ' (lecture unique)' : '']);
    const dispose = bind(source, target, canWrite, onetime);
    const remove = el('button', { className: 'small', textContent: 'Supprimer' });
    const view = el(
      'li',
      {},
      el('div', {}, code(target), canWrite ? ' ⇄ ' : ' ← ', code(source)),
      el('div', { className: 'hint', textContent: [canWrite && 'écriture activée', onetime && 'lecture unique'].filter(Boolean).join(' · ') || 'lecture synchronisée' }),
      remove,
    );
    remove.addEventListener('click', () => {
      dispose();
      view.remove();
      log('action', [`liaison #${id} supprimée`]);
    });
    $('#bindings').append(view);
  });
});

// ---------------------------------------------------------------------------
// Actions

$<HTMLFormElement>('#action-form').addEventListener('submit', (submit) => {
  submit.preventDefault();
  const form = submit.target as HTMLFormElement;
  const action = (submit.submitter as HTMLButtonElement).value;
  const path = (form.elements.namedItem('path') as HTMLInputElement).value.trim();
  const expression = (form.elements.namedItem('value') as HTMLInputElement).value;
  const output = $('#action-result');
  attempt(() => {
    output.textContent = '';
    if (action === 'get') {
      const value = get(root, statePath(path) as string);
      output.textContent = `get("${path}") = ${format(value)}`;
      return;
    }

    if (action === 'notify') {
      const value = get(root, statePath(path) as string);
      log('action', ['notify(', code(path), ')']);
      notify(root, statePath(path), value, value);
      return;
    }

    write(path, evaluate(expression), action as 'set' | 'assign');
  });
});

$('#replace-properties').addEventListener('click', () =>
  attempt(() =>
    write('actors.text1.properties', notifyingProperties({ color: '#f4a261', content: 'Remplacé', width: 200 }), 'set'),
  ),
);

$('#null-actor').addEventListener('click', () => attempt(() => write('actors.text1', null, 'set')));

$('#reset-state').addEventListener('click', () => {
  attempt(() => {
    log('action', ['set(', code('state'), ', nouvel objet)']);
    set(root, 'state', createState());
  });
});

// ---------------------------------------------------------------------------
// isEqual

$<HTMLFormElement>('#equal-form').addEventListener('submit', (submit) => {
  submit.preventDefault();
  const form = submit.target as HTMLFormElement;
  const output = $('#equal-result');
  try {
    const a = evaluate((form.elements.namedItem('a') as HTMLTextAreaElement).value);
    const b = evaluate((form.elements.namedItem('b') as HTMLTextAreaElement).value);
    const equal = isEqual(a, b);
    output.className = equal ? 'ok' : 'ko';
    output.textContent = `isEqual(a, b) = ${equal}`;
  } catch (error) {
    output.className = 'ko';
    output.textContent = String(error);
  }
});

// ---------------------------------------------------------------------------
// Performance

let perfObjects: { a: { b: { c: { d: number } } } }[] = [];
let perfDisposers: (() => void)[] = [];
let perfCalls = 0;

/** Used JS heap, in Chromium only (`performance.memory`), not collected: an approximation. */
function heapSize(): number | undefined {
  return (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
}

let bytesPerObservation: number | undefined;

function time(label: string, action: () => void) {
  const start = performance.now();
  action();
  const duration = performance.now() - start;
  const heap = heapSize();
  const memory = [
    heap === undefined ? '' : `tas ≈ ${(heap / 1e6).toFixed(0)} Mo`,
    bytesPerObservation === undefined ? '' : `≈ ${bytesPerObservation.toFixed(0)} o par observation`,
  ].filter(Boolean);
  $('#perf-result').textContent = [
    `${label} : ${duration.toFixed(1)} ms`,
    `${perfObjects.length} objets, ${perfDisposers.length} observations, ${perfCalls} notifications`,
    ...memory,
  ].join(' · ');
}

$<HTMLFormElement>('#perf-form').addEventListener('submit', (submit) => {
  submit.preventDefault();
  const form = submit.target as HTMLFormElement;
  const step = (submit.submitter as HTMLButtonElement).value;
  const count = Math.max(1, Number((form.elements.namedItem('count') as HTMLInputElement).value) || 1);
  const onChange = () => perfCalls++;

  if (step === 'create') {
    time(`Création et observation de ${count} objets`, () => {
      perfDisposers.forEach((dispose) => dispose());
      perfCalls = 0;
      perfObjects = Array.from({ length: count }, (_, i) => ({ a: { b: { c: { d: i } } } }));
      const before = heapSize();
      perfDisposers = perfObjects.map((o) => observe(o, 'a.b.c.d', onChange));
      const after = heapSize();
      bytesPerObservation = before === undefined || after === undefined ? undefined : (after - before) / count;
    });
  } else if (step === 'change') {
    time('Modification de a.b.c.d', () => perfObjects.forEach((o) => set(o, 'a.b.c.d', o.a.b.c.d + 1)));
  } else if (step === 'replace') {
    time('Remplacement de a.b', () => perfObjects.forEach((o) => set(o, 'a.b', { c: { d: -o.a.b.c.d } })));
  } else if (step === 'dispose') {
    time('Désobservation', () => {
      perfDisposers.forEach((dispose) => dispose());
      perfDisposers = [];
    });
  }
});

// ---------------------------------------------------------------------------
// Rendering

let renderPending = false;

function scheduleRender() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => {
    renderPending = false;
    $('#tree').replaceChildren(renderTree(root.state, ''));
    const paths: string[] = [];
    collectPaths(root.state, '', paths);
    $('#paths').replaceChildren(...paths.map((path) => el('option', { value: path })));
  });
}

// Any change in the state refreshes the tree.
observe(root, 'state', scheduleRender);
for (const id of ['text1', 'text2']) {
  for (const field of ['name', 'properties', 'properties.color', 'properties.content', 'properties.width']) {
    observe(root, `state.actors.${id}.${field}`, scheduleRender);
  }
}
observe(root, 'state.actors', scheduleRender);
observe(root, 'state.synapp.name', scheduleRender);

scheduleRender();
log('info', ['Prêt. Les deux acteurs de l\'aperçu sont dessinés par des observateurs.']);
