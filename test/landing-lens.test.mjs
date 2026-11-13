import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lensMap, lensPosition, mountLens } from '../landing-lens.js';

class Target {
  listeners = new Map();
  addEventListener(name, callback) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(callback);
  }
  removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
  emit(name, event = {}) { for (const callback of this.listeners.get(name) ?? []) callback(event); }
}

class Element extends Target {
  constructor(tag, className = '') {
    super();
    this.tag = tag;
    this.className = className;
    this.children = [];
    this.attrs = new Map();
    this.style = { setProperty(name, value) { this[name] = value; } };
    this.dataset = {};
    this.textContent = '';
    this.width = 1200;
    this.height = 760;
    this.bounds = { left: 700, top: 180, right: 1260, bottom: 560, height: 380 };
    this.context = {
      copies: 0, clearRect() {}, drawImage() { this.copies++; },
      createImageData(width, height) { return { data: new Uint8ClampedArray(width * height * 4) }; },
      putImageData() {},
    };
  }
  get attributes() { return [...this.attrs.keys()].map((name) => ({ name })); }
  setAttribute(name, value) { this.attrs.set(name, value); }
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  hasAttribute(name) { return this.attrs.has(name); }
  removeAttribute(name) { this.attrs.delete(name); }
  append(child) { child.parent = this; this.children.push(child); }
  remove() { this.parent.children = this.parent.children.filter((child) => child !== this); }
  replaceWith(replacement) {
    const index = this.parent.children.indexOf(this);
    replacement.parent = this.parent;
    this.parent.children[index] = replacement;
  }
  getContext() { return this.context; }
  toDataURL() { return 'data:image/png;base64,test'; }
  getBoundingClientRect() { return this.bounds; }
  matches(selector) {
    if (selector === '*') return true;
    if (selector === '.field-topline > span') return this.tag === 'span' && this.parent.className === 'field-topline';
    if (selector === '.explorer-connections line') return this.tag === 'line' && this.parent.className === 'explorer-connections';
    if (selector === '.explorer-memories line') return this.tag === 'line' && this.parent.className === 'explorer-memories';
    if (selector === '.explorer-memories circle') return this.tag === 'circle' && this.parent.className === 'explorer-memories';
    if (selector.startsWith('.')) return this.className.split(' ').includes(selector.slice(1));
    if (selector.startsWith('[')) return this.hasAttribute(selector.slice(1, -1));
    return this.tag === selector;
  }
  querySelectorAll(selector) {
    if (selector.startsWith(':scope >')) {
      return this.children.filter((child) => selector.split(', ').some((part) => child.matches(part.replace(':scope > ', ''))));
    }
    return this.children.flatMap((child) => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  cloneNode() {
    const clone = new Element(this.tag, this.className);
    clone.attrs = new Map(this.attrs);
    clone.dataset = { ...this.dataset };
    clone.textContent = this.textContent;
    clone.context = this.context ? { ...this.context } : null;
    for (const child of this.children) clone.append(child.cloneNode(true));
    return clone;
  }
}

function setup({ reduced = false, touch = false, canvasAvailable = true } = {}) {
  const document = new Target();
  document.hidden = false;
  document.documentElement = new Target();
  document.createElement = (tag) => new Element(tag);
  document.createElementNS = (_namespace, tag) => new Element(tag);
  const root = new Element('body', 'landing-page');
  root.ownerDocument = document;
  root.clientWidth = 1280;
  root.bounds = { height: 720 };
  const add = (parent, tag, className, attribute) => {
    const element = new Element(tag, className);
    if (attribute) element.setAttribute(attribute, '');
    parent.append(element);
    return element;
  };
  const header = add(root, 'header', 'site-header');
  const link = add(header, 'a', 'wordmark', 'href');
  link.setAttribute('id', 'home-link');
  const main = add(root, 'main', 'landing-main', 'id');
  const field = add(main, 'div', 'signal-field', 'data-signal-field');
  field.dataset.motionPlaying = String(!reduced);
  field.dataset.fieldState = 'running';
  const topline = add(field, 'div', 'field-topline');
  const modes = add(topline, 'details', 'field-model-switcher', 'data-field-model');
  modes.setAttribute('name', 'constellation-tools');
  add(modes, 'summary', 'field-model-summary', 'data-field-model-label').textContent = 'Experience';
  const source = add(field, 'canvas', '', 'data-field-canvas');
  if (!canvasAvailable) source.context = null;
  const empty = add(topline, 'div', 'explorer-empty', 'data-explorer-empty');
  empty.setAttribute('hidden', '');
  add(empty, 'p', 'field-caption').textContent = 'Select a star to explore my chapters.';
  const graph = add(field, 'div', 'explorer-nodes', 'data-explorer-nodes');
  const memories = add(graph, 'svg', 'explorer-memories');
  memories.setAttribute('viewBox', '0 0 640 520');
  const memoryLine = add(memories, 'line', '');
  for (const name of ['x1', 'y1', 'x2', 'y2']) memoryLine.setAttribute(name, '100');
  const memoryStar = add(memories, 'circle', '');
  memoryStar.setAttribute('cx', '100');
  memoryStar.setAttribute('cy', '140');
  const connections = add(graph, 'svg', 'explorer-connections');
  connections.setAttribute('viewBox', '0 0 640 520');
  const line = add(connections, 'line', '');
  for (const name of ['x1', 'y1', 'x2', 'y2']) line.setAttribute(name, '100');
  add(graph, 'button', 'explorer-node', 'data-node').setAttribute('id', 'test-experience');
  const detail = add(field, 'div', 'explorer-detail', 'data-explorer-detail');
  add(detail, 'h2', 'explorer-title').textContent = 'Follow a connection.';
  const footer = add(root, 'footer', 'landing-footer');
  const toggle = add(footer, 'button', 'field-button', 'data-lens-toggle');
  toggle.setAttribute('aria-pressed', 'true');
  const label = add(toggle, 'span', '', 'data-lens-label');
  label.textContent = 'On';
  const notice = add(field, 'p', '', 'data-field-error');
  notice.hidden = true;
  const environment = new Target();
  environment.scrollX = 0;
  environment.scrollY = 0;
  const queries = new Map();
  environment.matchMedia = (query) => {
    if (!queries.has(query)) {
      const target = new Target();
      target.matches = query.includes('pointer: fine') ? !touch : query.includes('reduced-motion') ? reduced : false;
      queries.set(query, target);
    }
    return queries.get(query);
  };
  let nextId = 0;
  const frames = new Map();
  environment.requestAnimationFrame = (callback) => { frames.set(++nextId, callback); return nextId; };
  environment.cancelAnimationFrame = (id) => frames.delete(id);
  const observers = [];
  environment.ResizeObserver = environment.MutationObserver = class {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  };
  const controller = mountLens(root, environment);
  const overlay = root.querySelector('.glass-overlay');
  const view = root.querySelector('.glass-lens-view');
  let timestamp = 0;
  return {
    document, root, field, source, toggle, label, notice, environment, queries, frames, observers, controller, overlay, view,
    move(x, y, pointerType = 'mouse') { environment.emit('pointermove', { clientX: x, clientY: y, pointerType }); },
    state() { observers[1].callback(); },
    advance(delta = 40) {
      timestamp += delta;
      const callbacks = [...frames.values()];
      frames.clear();
      for (const callback of callbacks) callback(timestamp);
    },
  };
}

test('compact 48px lens magnifies 1.4 times and stays centered after scrolling', () => {
  for (const [x, y, scrollX, scrollY] of [[0, 0, 0, 0], [300, 240, 0, 0], [1200, 680, 0, 900], [150, 100, 20, 200]]) {
    const position = lensPosition(x, y, scrollX, scrollY);
    assert.equal(position.zoom, 1.4);
    assert.ok(Math.abs((x + scrollX) * position.zoom + position.contentX - 24) < 1e-8);
    assert.ok(Math.abs((y + scrollY) * position.zoom + position.contentY - 24) < 1e-8);
    assert.equal(position.left + 24, x);
    assert.equal(position.top + 24, y);
  }
});

test('the droplet map leaves the center crisp and refracts the rim toward its center', () => {
  const pixels = lensMap();
  assert.equal(pixels.length, 48 * 48 * 4);
  const at = (x, y) => [...pixels.slice((y * 48 + x) * 4, (y * 48 + x) * 4 + 4)];
  assert.deepEqual(at(24, 24), [128, 128, 128, 255]);
  assert.deepEqual(at(18, 18), [128, 128, 128, 255]);
  assert.ok(at(0, 24)[0] > 200 && at(47, 24)[0] < 55);
  assert.ok(at(24, 0)[1] > 200 && at(24, 47)[1] < 55);
  for (let index = 3; index < pixels.length; index += 4) assert.equal(pixels[index], 255);
});

test('lens is an inert visual copy without duplicate IDs, disclosure groups, links, or live regions', () => {
  const lens = setup();
  assert.equal(lens.overlay.getAttribute('aria-hidden'), 'true');
  assert.ok(lens.overlay.hasAttribute('inert'));
  for (const element of lens.view.querySelectorAll('*')) {
    assert.ok(element.attributes.every(({ name }) => !['id', 'name', 'href', 'role', 'tabindex'].includes(name) && !name.startsWith('aria-')));
  }
  assert.equal(lens.field.querySelector('.field-model-switcher').getAttribute('name'), 'constellation-tools');
  assert.ok(lens.root.querySelector('.site-header').querySelector('a').hasAttribute('href'));
  const filter = lens.overlay.querySelector('filter');
  assert.equal(filter.getAttribute('id'), 'landing-liquid-refraction');
  assert.equal(filter.getAttribute('width'), '48', 'Refraction is restricted to the small lens, not the full page');
  assert.equal(filter.getAttribute('height'), '48');
  assert.equal(filter.querySelector('feImage').getAttribute('width'), '48');
  assert.equal(filter.querySelector('feImage').getAttribute('height'), '48');
  assert.match(filter.querySelector('feImage').getAttribute('href'), /^data:image\/png/);
  assert.equal(filter.querySelector('feDisplacementMap').getAttribute('in2'), 'lens-map');
  lens.controller.destroy();
});

test('text magnifies without a permanent render loop; Canvas stays live only under the lens', () => {
  const lens = setup();
  lens.move(300, 300);
  lens.advance();
  assert.ok(lens.overlay.hasAttribute('data-active'));
  assert.match(lens.view.style.transform, /scale\(1\.4\)/);
  assert.equal(lens.frames.size, 0);
  lens.move(900, 300);
  lens.advance();
  assert.equal(lens.frames.size, 1);
  assert.equal(lens.view.querySelector('canvas').context.copies, 1);
  lens.move(910, 300);
  lens.advance(10);
  assert.match(lens.root.querySelector('.glass-lens').style.transform, /886px/);
  assert.equal(lens.view.querySelector('canvas').context.copies, 1, 'Pointer movement stays responsive without increasing Canvas copy rate');
  lens.advance(30);
  assert.equal(lens.view.querySelector('canvas').context.copies, 2);
  lens.move(300, 300);
  lens.advance();
  for (let frame = 0; frame < 60 && lens.frames.size; frame++) lens.advance();
  assert.equal(lens.frames.size, 0);
  lens.environment.scrollY = 200;
  lens.environment.emit('scroll');
  lens.advance();
  assert.match(lens.view.style.transform, /-676px/);
  lens.controller.destroy();
});

test('pointer motion briefly deforms the liquid contour and optics, then settles without an idle loop', () => {
  const lens = setup();
  const droplet = lens.root.querySelector('.glass-lens');
  const refraction = lens.overlay.querySelector('feDisplacementMap');
  lens.move(200, 200);
  lens.advance();
  lens.move(225, 210);
  lens.advance();
  assert.notEqual(droplet.style.borderRadius, '50%');
  assert.ok(Number(refraction.getAttribute('scale')) > 10);
  assert.equal(lens.frames.size, 1);
  for (let frame = 0; frame < 60 && lens.frames.size; frame++) lens.advance();
  assert.equal(droplet.style.borderRadius, '50%');
  assert.equal(refraction.getAttribute('scale'), '10');
  assert.equal(lens.frames.size, 0);
  lens.move(250, 230);
  lens.advance();
  lens.document.emit('keydown');
  assert.equal(droplet.style.borderRadius, '50%');
  assert.equal(lens.frames.size, 0);
  lens.controller.destroy();
});

test('dynamic explorer copies stay current and inert without replacing the live Canvas mirror', () => {
  const lens = setup();
  lens.move(300, 300);
  lens.advance();
  assert.equal(lens.frames.size, 0);
  const mirror = lens.view.querySelector('canvas');
  lens.field.querySelector('.explorer-title').textContent = 'Senior product designer';
  lens.field.querySelector('.explorer-nodes').querySelector('button').setAttribute('aria-expanded', 'true');
  lens.field.querySelector('.field-model-switcher').querySelector('summary').textContent = 'Skills';
  lens.field.dataset.explorerState = '1';
  lens.state();
  assert.equal(lens.frames.size, 1, 'A selection updates even while the pointer is stationary over text');
  lens.advance();
  assert.equal(lens.view.querySelector('.explorer-title').textContent, 'Senior product designer');
  assert.equal(lens.view.querySelector('.field-model-switcher').querySelector('summary').textContent, 'Skills');
  assert.equal(lens.view.querySelector('.field-model-switcher').getAttribute('name'), null, 'Refreshed lens copies cannot close the real disclosure');
  const button = lens.view.querySelector('.explorer-nodes').querySelector('button');
  assert.ok(!button.hasAttribute('aria-expanded') && !button.hasAttribute('id') && !button.hasAttribute('data-node'));
  assert.equal(lens.view.querySelector('canvas'), mirror);
  assert.equal(lens.frames.size, 0);
  lens.field.querySelector('.explorer-title').textContent = 'Game design experience';
  lens.field.dataset.explorerState = '2';
  lens.state();
  lens.advance();
  assert.equal(lens.view.querySelector('.explorer-title').textContent, 'Game design experience');
  lens.controller.destroy();
});

test('the lens mirrors empty-state visibility and invitation copy', () => {
  const lens = setup();
  lens.move(300, 300);
  lens.advance();
  const empty = lens.field.querySelector('.explorer-empty');
  assert.equal(lens.view.querySelector('.explorer-empty').hasAttribute('hidden'), true);
  empty.removeAttribute('hidden');
  lens.field.dataset.explorerState = '1';
  lens.state();
  lens.advance();
  assert.equal(lens.view.querySelector('.explorer-empty').hasAttribute('hidden'), false);
  assert.equal(lens.view.querySelector('.field-caption').textContent, empty.querySelector('.field-caption').textContent);
  empty.setAttribute('hidden', '');
  empty.querySelector('.field-caption').textContent = 'Select a star to explore.';
  lens.field.dataset.explorerState = '2';
  lens.state();
  lens.advance();
  assert.equal(lens.view.querySelector('.explorer-empty').hasAttribute('hidden'), true);
  assert.equal(lens.view.querySelector('.field-caption').textContent, 'Select a star to explore.');
  lens.controller.destroy();
});

test('an idle Canvas needs no permanent lens loop and an open Controls dropdown suppresses the lens', () => {
  const lens = setup();
  lens.field.dataset.fieldState = 'idle';
  lens.move(900, 300);
  lens.advance();
  assert.equal(lens.frames.size, 0);
  assert.equal(lens.view.querySelector('canvas').context.copies, 1);
  lens.field.dataset.controlsOpen = 'true';
  lens.state();
  assert.equal(lens.overlay.hasAttribute('data-active'), false);
  lens.move(910, 310);
  assert.equal(lens.frames.size, 0);
  lens.field.dataset.controlsOpen = 'false';
  lens.state();
  lens.move(900, 300);
  lens.advance();
  assert.equal(lens.overlay.hasAttribute('data-active'), true);
  for (let frame = 0; frame < 60 && lens.frames.size; frame++) lens.advance();
  assert.equal(lens.frames.size, 0);
  lens.controller.destroy();
});

test('rotating native stars and connection endpoints stay aligned in the cached live lens', () => {
  const lens = setup();
  const node = lens.field.querySelector('.explorer-node');
  const connections = lens.field.querySelector('.explorer-connections');
  const line = connections.querySelector('line');
  node.style.cssText = 'left: 140px; top: 180px; --star-alpha: .8';
  lens.move(900, 300);
  lens.advance();
  const mirror = lens.view.querySelector('canvas');
  const copy = lens.view.querySelector('.explorer-node');
  assert.equal(copy.style.cssText, node.style.cssText);
  node.style.cssText = 'left: 220px; top: 200px; --star-alpha: .9';
  connections.setAttribute('viewBox', '0 0 600 440');
  line.setAttribute('x1', '220');
  line.setAttribute('y2', '300');
  lens.advance();
  assert.equal(lens.view.querySelector('canvas'), mirror);
  assert.equal(lens.view.querySelector('.explorer-node'), copy);
  assert.equal(copy.style.cssText, node.style.cssText);
  assert.equal(lens.view.querySelector('.explorer-connections').getAttribute('viewBox'), '0 0 600 440');
  assert.equal(lens.view.querySelector('.explorer-connections line').getAttribute('x1'), '220');
  assert.equal(lens.view.querySelector('.explorer-connections line').getAttribute('y2'), '300');
  const memories = lens.field.querySelector('.explorer-memories');
  memories.setAttribute('viewBox', '0 0 600 440');
  memories.querySelector('line').setAttribute('x1', '240');
  memories.querySelector('circle').setAttribute('cx', '260');
  memories.querySelector('circle').setAttribute('cy', '160');
  memories.querySelector('circle').style.cssText = 'opacity: .45';
  lens.advance();
  assert.equal(lens.view.querySelector('.explorer-memories').getAttribute('viewBox'), '0 0 600 440');
  assert.equal(lens.view.querySelector('.explorer-memories line').getAttribute('x1'), '240');
  assert.equal(lens.view.querySelector('.explorer-memories circle').getAttribute('cx'), '260');
  assert.equal(lens.view.querySelector('.explorer-memories circle').getAttribute('cy'), '160');
  assert.equal(lens.view.querySelector('.explorer-memories circle').style.cssText, 'opacity: .45');
  assert.ok(!copy.hasAttribute('data-node'));
  lens.controller.destroy();
});

test('orbit dragging suppresses the lens without disabling its preference or leaving a render loop', () => {
  const lens = setup();
  lens.move(900, 300);
  lens.advance();
  assert.ok(lens.overlay.hasAttribute('data-active'));
  lens.field.dataset.fieldDragging = 'true';
  lens.state();
  assert.ok(!lens.overlay.hasAttribute('data-active'));
  assert.equal(lens.frames.size, 0);
  assert.equal(lens.toggle.getAttribute('aria-pressed'), 'true');
  lens.field.dataset.fieldDragging = 'false';
  lens.state();
  lens.move(900, 300);
  lens.advance();
  assert.ok(lens.overlay.hasAttribute('data-active'));
  lens.controller.destroy();
});

test('refraction-image failure is explicit while ordinary magnification remains available', (t) => {
  const error = t.mock.method(console, 'error', () => {});
  const lens = setup();
  const image = lens.overlay.querySelector('feImage');
  image.emit('error');
  assert.equal(lens.root.querySelector('.glass-lens-surface').style.filter, 'none');
  assert.equal(lens.notice.hidden, false);
  assert.match(lens.notice.textContent, /magnifier remains available/);
  assert.equal(error.mock.callCount(), 1);
  lens.move(300, 300);
  lens.advance();
  assert.ok(lens.overlay.hasAttribute('data-active'));
  lens.controller.destroy();
  assert.equal(image.listeners.get('error').size, 0);
});

test('glass can be toggled independently and keyboard use immediately removes the lens', () => {
  const lens = setup();
  lens.move(300, 300);
  lens.advance();
  lens.toggle.emit('click');
  assert.equal(lens.toggle.getAttribute('aria-pressed'), 'false');
  assert.equal(lens.label.textContent, 'Off');
  assert.ok(!lens.overlay.hasAttribute('data-active'));
  lens.move(300, 300);
  assert.equal(lens.frames.size, 0);
  lens.toggle.emit('click');
  lens.move(300, 300);
  lens.advance();
  lens.document.emit('keydown', { key: 'Tab' });
  assert.ok(!lens.overlay.hasAttribute('data-active'));
  assert.equal(lens.frames.size, 0);
  lens.controller.destroy();
});

test('shared pause, reduced motion, touch, forced colors, and page lifecycle suppress the lens', () => {
  const lens = setup({ reduced: true });
  lens.move(300, 300);
  assert.equal(lens.frames.size, 0);
  lens.field.dataset.motionPlaying = 'true';
  lens.state();
  lens.move(300, 300);
  lens.advance();
  assert.ok(lens.overlay.hasAttribute('data-active'), 'Explicit Play can opt in to motion');
  lens.field.dataset.motionPlaying = 'false';
  lens.state();
  assert.ok(!lens.overlay.hasAttribute('data-active'));
  lens.field.dataset.motionPlaying = 'true';
  lens.state();
  lens.move(300, 300, 'touch');
  assert.equal(lens.frames.size, 0);
  const forced = lens.queries.get('(forced-colors: active)');
  forced.matches = true;
  forced.emit('change');
  assert.ok(lens.toggle.hidden);
  lens.move(300, 300);
  assert.equal(lens.frames.size, 0);
  forced.matches = false;
  forced.emit('change');
  lens.environment.emit('pagehide');
  lens.move(300, 300);
  assert.equal(lens.frames.size, 0);
  lens.environment.emit('pageshow');
  lens.move(900, 300);
  lens.advance();
  lens.document.hidden = true;
  lens.document.emit('visibilitychange');
  assert.equal(lens.frames.size, 0);
  lens.controller.destroy();
  const touch = setup({ touch: true });
  assert.ok(touch.toggle.hidden);
  touch.move(300, 300);
  assert.equal(touch.frames.size, 0);
  touch.controller.destroy();
});

test('cleanup cancels frames, removes the visual copy, and unregisters every listener', () => {
  const lens = setup();
  lens.move(900, 300);
  lens.advance();
  lens.controller.destroy();
  assert.equal(lens.frames.size, 0);
  assert.equal(lens.root.querySelector('.glass-overlay'), null);
  assert.ok(lens.toggle.hidden);
  assert.ok(lens.observers.every((observer) => observer.disconnected));
  const targets = [lens.document, lens.document.documentElement, lens.environment, lens.toggle, ...lens.queries.values()];
  assert.ok(targets.every((target) => [...target.listeners.values()].every((set) => set.size === 0)));
});

test('unavailable Canvas leaves the original page intact and reports the lens failure', (t) => {
  const error = t.mock.method(console, 'error', () => {});
  const lens = setup({ canvasAvailable: false });
  assert.equal(lens.controller, null);
  assert.equal(lens.root.querySelector('.glass-overlay'), null);
  assert.ok(lens.toggle.hidden);
  assert.equal(lens.notice.hidden, false);
  assert.match(lens.notice.textContent, /original page remains fully usable/);
  assert.equal(error.mock.callCount(), 1);
});
