import assert from 'node:assert/strict';
import { test } from 'node:test';
import { networkGeometry, networkPoint, mountField, projectPoint } from '../landing-field.js';

class Target {
  listeners = new Map();
  dataset = {};
  attrs = new Map();
  children = [];
  classList = { toggle() {} };
  setAttribute(name, value) { this.attrs.set(name, value); }
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  focus() { this.ownerDocument.activeElement = this; }
  addEventListener(name, callback) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(callback);
  }
  removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
  emit(name, event = {}) { for (const callback of this.listeners.get(name) ?? []) callback({ currentTarget: this, ...event }); }
  contains(element) { return element === this || this.children.some((child) => child.contains(element)); }
  setPointerCapture(id) { this.captured = id; }
  hasPointerCapture(id) { return this.captured === id; }
  releasePointerCapture() { this.captured = null; }
}

function setup({ reducedMotion = false, touch = false, canvasAvailable = true } = {}) {
  const document = new Target();
  document.hidden = false;
  document.body = new Target();
  document.body.ownerDocument = document;
  const environment = new Target();
  environment.devicePixelRatio = 3;
  const queries = new Map();
  environment.matchMedia = (query) => {
    if (!queries.has(query)) {
      const target = new Target();
      target.matches = query.includes('reduced-motion') ? reducedMotion : query.includes('pointer: fine') ? !touch : false;
      queries.set(query, target);
    }
    return queries.get(query);
  };
  let nextId = 0;
  const frames = new Map();
  environment.requestAnimationFrame = (callback) => { frames.set(++nextId, callback); return nextId; };
  environment.cancelAnimationFrame = (id) => frames.delete(id);
  const observers = [];
  environment.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  };
  environment.ResizeObserver = class {
    observe() {}
    disconnect() { this.disconnected = true; }
  };
  const root = new Target();
  root.dataset = {};
  root.ownerDocument = document;
  const nodes = new Map();
  const footerSelectors = new Set(['[data-field-left]', '[data-field-right]', '[data-field-options]', '[data-explorer-reset]']);
  root.querySelector = (selector) => footerSelectors.has(selector) ? null : nodes.get(selector);
  root.querySelectorAll = () => [nodes.get('[data-field-mode="experience"]'), nodes.get('[data-field-mode="skills"]')];
  document.querySelector = (selector) => nodes.get(selector);
  for (const selector of ['[data-field-canvas]', '[data-field-stage]', '[data-field-mode="experience"]', '[data-field-mode="skills"]', '[data-field-model]', '[data-field-model-summary]', '[data-field-model-label]', '[data-field-status]', '[data-field-controls]', '[data-field-error]', '[data-field-left]', '[data-field-right]', '[data-field-options]', '[data-explorer-reset]']) {
    const node = new Target();
    node.ownerDocument = document;
    nodes.set(selector, node);
  }
  for (const mode of ['experience', 'skills']) {
    const button = nodes.get(`[data-field-mode="${mode}"]`);
    button.dataset.fieldMode = mode;
    button.setAttribute('aria-pressed', String(mode === 'experience'));
  }
  const modelOptions = nodes.get('[data-field-model]');
  const modelSummary = nodes.get('[data-field-model-summary]');
  modelOptions.open = false;
  modelOptions.querySelector = () => modelSummary;
  modelOptions.children = [modelSummary, ...root.querySelectorAll('[data-field-mode]')];
  const summary = new Target();
  summary.ownerDocument = document;
  const options = nodes.get('[data-field-options]');
  options.open = false;
  options.querySelector = (selector) => selector === 'summary' ? summary : nodes.get(selector);
  options.children = [summary, nodes.get('[data-field-left]'), nodes.get('[data-field-right]'), nodes.get('[data-explorer-reset]')];
  nodes.get('[data-field-controls]').hidden = true;
  nodes.get('[data-field-error]').hidden = true;
  const arcs = [];
  const segments = [];
  const strokes = [];
  const context = {
    clearRect() { arcs.length = segments.length = strokes.length = 0; },
    setTransform() {},
    beginPath() {},
    moveTo(x, y) { this.start = [x, y]; },
    lineTo(x, y) { segments.push([...this.start, x, y]); },
    closePath() {},
    stroke() { strokes.push({ style: this.strokeStyle, width: this.lineWidth }); },
    fill() {},
    arc(...args) { arcs.push(args); },
  };
  nodes.get('[data-field-canvas]').getContext = () => canvasAvailable ? context : null;
  nodes.get('[data-field-stage]').getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 600 });
  const controller = mountField(root, environment);
  let timestamp = 0;
  return {
    root, nodes, frames, queries, environment, document, arcs, segments, strokes, controller, options, summary, modelOptions, modelSummary,
    intersect(value) { observers[0].callback([{ isIntersecting: value }]); },
    advance(delta = 40) {
      timestamp += delta;
      const callbacks = [...frames.values()];
      frames.clear();
      for (const callback of callbacks) callback(timestamp);
    },
    form: nodes.get('[data-field-mode="skills"]'),
    changeMode(value = 'skills') {
      nodes.get(`[data-field-mode="${value}"]`).emit('click');
    },
    turn(direction = 1) {
      nodes.get('[data-field-stage]').emit('keydown', { key: direction > 0 ? 'ArrowRight' : 'ArrowLeft', shiftKey: true, preventDefault() {} });
    },
  };
}

test('both pointer modes initialize without a visible rotation hint', () => {
  for (const touch of [false, true]) {
    const field = setup({ touch });
    assert.equal(field.nodes.has('.field-hint'), false);
    assert.ok(field.controller);
    field.controller.destroy();
  }
});

test('both network topologies are deterministic, sparse, and fully connected', () => {
  const model = networkGeometry();
  assert.deepEqual(model, networkGeometry());
  assert.equal(model.nodes.length, 60);
  assert.ok(model.links.length < 360);
  const keys = new Set();
  for (const link of model.links) {
    assert.ok(link.from >= 0 && link.from < link.to && link.to < model.nodes.length);
    assert.ok(link.mesh || link.layers);
    const key = `${link.from}:${link.to}`;
    assert.ok(!keys.has(key));
    keys.add(key);
    if (link.layers) assert.equal(Math.floor(link.to / 12) - Math.floor(link.from / 12), 1);
  }
  for (const mode of ['mesh', 'layers']) {
    const reached = new Set([0]);
    const queue = [0];
    for (let cursor = 0; cursor < queue.length; cursor++) {
      for (const link of model.links.filter((link) => link[mode])) {
        const other = link.from === queue[cursor] ? link.to : link.to === queue[cursor] ? link.from : null;
        if (other !== null && !reached.has(other)) { reached.add(other); queue.push(other); }
      }
    }
    assert.equal(reached.size, model.nodes.length, `${mode}: no disconnected neurons`);
  }
});

test('network geometry stays finite and bounded through every model and perspective', () => {
  const { nodes } = networkGeometry();
  for (const morph of [0, .25, .5, .75, 1]) {
    for (const node of nodes) {
      for (const time of [0, 7]) {
        const point = networkPoint(node, morph, time);
        assert.ok(point.every(Number.isFinite));
        assert.ok(Math.hypot(...point) < 1.4);
        const projected = projectPoint(point, 2, { x: 1.2, y: -1.2 }, 100);
        assert.ok(Object.values(projected).every(Number.isFinite));
        assert.ok(Math.abs(projected.x) < 200 && Math.abs(projected.y) < 200);
      }
    }
  }
  assert.notDeepEqual(networkPoint(nodes[0], 0, 0), networkPoint(nodes[0], 1, 0));
});

test('ambient signals remain stationary on actual connections without unstoppable automatic motion', () => {
  const field = setup();
  const { links } = networkGeometry();
  const mesh = links.filter((link) => link.mesh);
  const carrying = links.filter((link, index) => link.mesh && index % 9 === 0);
  const progress = () => carrying.map((link, index) => {
    const [x0, y0, x1, y1] = field.segments[mesh.indexOf(link)];
    const [x, y] = field.arcs[index];
    const dx = x1 - x0;
    const dy = y1 - y0;
    assert.ok(Math.abs((x - x0) * dy - (y - y0) * dx) < 1e-7);
    const amount = ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy);
    assert.ok(amount >= -1e-8 && amount <= 1 + 1e-8);
    return amount;
  });
  field.advance();
  const before = progress();
  field.advance(40);
  assert.deepEqual(progress(), before);
  assert.equal(field.frames.size, 0);
  field.controller.destroy();
});

test('the sky starts idle and the pill switcher changes models without starting autoplay', () => {
  const field = setup();
  assert.equal(field.root.dataset.fieldState, 'idle');
  assert.equal(field.nodes.get('[data-field-canvas]').width, 1200, 'DPR is capped at two');
  field.advance();
  assert.equal(field.frames.size, 0);
  const snapshot = () => JSON.stringify([field.arcs, field.segments]);
  const frozen = snapshot();
  field.advance(10000);
  assert.equal(snapshot(), frozen, 'Both nodes and connecting edges freeze');
  field.changeMode();
  assert.equal(field.root.dataset.fieldForm, 'skills');
  assert.equal(field.nodes.get('[data-field-status]').textContent, 'Current model: Skills.');
  assert.equal(field.form.getAttribute('aria-pressed'), 'true');
  assert.equal(field.nodes.get('[data-field-mode="experience"]').getAttribute('aria-pressed'), 'false');
  assert.equal(field.nodes.get('[data-field-model-label]').textContent, 'Skills');
  assert.equal(field.document.activeElement, field.modelSummary);
  assert.equal(field.nodes.get('[data-field-stage]').getAttribute('aria-label'), 'My skills constellation');
  assert.equal(snapshot(), frozen, 'Skills retain the same still starry background instead of becoming a layer diagram');
  assert.equal(field.frames.size, 0, 'Changing form does not introduce automatic motion');
  field.changeMode();
  assert.equal(field.root.dataset.fieldForm, 'skills', 'Choosing the current option does not toggle to the opposite model');
  field.changeMode('experience');
  assert.equal(field.root.dataset.fieldForm, 'network');
  assert.equal(field.nodes.get('[data-field-status]').textContent, 'Current model: Career.');
  assert.equal(field.nodes.get('[data-field-model-label]').textContent, 'Career');
  assert.equal(field.nodes.get('[data-field-stage]').getAttribute('aria-label'), 'My career constellation');
  field.controller.destroy();
  assert.equal(field.frames.size, 0);
});

test('the model pill closes on selection, Escape or outside interaction without leaking focus or lens state', () => {
  const field = setup();
  field.modelOptions.open = true;
  field.modelOptions.emit('toggle');
  assert.equal(field.root.dataset.controlsOpen, 'true', 'The lens hides while either disclosure is open');
  field.form.focus();
  field.document.emit('keydown', { key: 'Escape', preventDefault() {}, stopPropagation() {} });
  assert.equal(field.modelOptions.open, false);
  assert.equal(field.document.activeElement, field.modelSummary);
  field.modelOptions.emit('toggle');
  assert.equal(field.root.dataset.controlsOpen, 'false');
  field.modelOptions.open = true;
  field.document.emit('pointerdown', { target: field.form });
  assert.equal(field.modelOptions.open, true, 'Pointer interaction inside the panel does not dismiss a pending choice');
  field.changeMode();
  assert.equal(field.modelOptions.open, false);
  assert.equal(field.document.activeElement, field.modelSummary);
  field.modelOptions.open = true;
  field.changeMode();
  assert.equal(field.modelOptions.open, false, 'Choosing the current model still dismisses the panel');
  field.modelOptions.open = true;
  field.form.focus();
  field.document.emit('pointerdown', { target: field.nodes.get('[data-field-stage]') });
  assert.equal(field.modelOptions.open, false);
  assert.equal(field.document.activeElement, field.modelSummary);
  field.controller.destroy();
});

test('opening either disclosure closes the other while preserving lens suppression', () => {
  const field = setup();
  field.options.open = true;
  field.options.emit('toggle');
  field.modelOptions.open = true;
  field.modelOptions.emit('toggle');
  assert.equal(field.options.open, false);
  assert.equal(field.modelOptions.open, true);
  assert.equal(field.root.dataset.controlsOpen, 'true');
  field.options.emit('toggle');
  assert.equal(field.root.dataset.controlsOpen, 'true', 'The closing disclosure does not re-enable the lens');
  field.options.open = true;
  field.options.emit('toggle');
  assert.equal(field.modelOptions.open, false);
  assert.equal(field.options.open, true);
  assert.equal(field.root.dataset.controlsOpen, 'true');
  field.controller.destroy();
});

test('reduced motion stays static while preserving intentional rotation and preference changes', () => {
  const field = setup({ reducedMotion: true });
  assert.equal(field.frames.size, 0);
  assert.equal(field.root.dataset.fieldState, 'static');
  assert.equal(field.root.dataset.motionPlaying, 'false');
  assert.ok(field.arcs.length >= 60 && field.segments.length > 60, 'Static neurons and connecting edges are still rendered');
  field.turn();
  assert.ok(Number(field.root.dataset.fieldYaw) > 0);
  assert.equal(field.frames.size, 0);
  const preference = field.queries.get('(prefers-reduced-motion: reduce)');
  preference.matches = false;
  preference.emit('change');
  assert.equal(field.root.dataset.motionPlaying, 'true');
  assert.equal(field.root.dataset.fieldState, 'idle');
  assert.equal(field.frames.size, 0, 'Changing a preference never starts an idle orbit');
  field.controller.destroy();
});

test('field suspends offscreen, in hidden tabs, during page lifecycle, and in forced colors', () => {
  const field = setup();
  field.turn();
  assert.equal(field.frames.size, 1);
  field.intersect(false);
  assert.equal(field.frames.size, 0);
  field.intersect(true);
  assert.equal(field.frames.size, 0, 'The view settles while suspended instead of resuming autoplay');
  field.turn();
  field.document.hidden = true;
  field.document.emit('visibilitychange');
  assert.equal(field.frames.size, 0);
  field.document.hidden = false;
  field.document.emit('visibilitychange');
  assert.equal(field.frames.size, 0);
  field.turn();
  field.environment.emit('pagehide');
  assert.equal(field.frames.size, 0);
  field.environment.emit('pageshow');
  assert.equal(field.frames.size, 0);
  const forced = field.queries.get('(forced-colors: active)');
  forced.matches = true;
  forced.emit('change');
  assert.equal(field.frames.size, 0);
  assert.equal(field.root.dataset.motionPlaying, 'false');
  assert.notEqual(field.form.disabled, true, 'Textual skill exploration remains available in system colors');
  field.changeMode();
  assert.equal(field.root.dataset.fieldForm, 'skills');
  assert.equal(field.frames.size, 0);
  forced.matches = false;
  forced.emit('change');
  field.intersect(false);
  field.intersect(true);
  assert.equal(field.frames.size, 0, 'Returning onscreen does not start automatic motion');
  field.controller.destroy();
});

test('mouse bends the field while touch does not create hover-driven motion', () => {
  const regular = setup();
  const mouse = setup();
  regular.advance();
  mouse.environment.emit('pointermove', { pointerType: 'mouse', clientX: 450, clientY: 400 });
  mouse.advance();
  assert.notEqual(JSON.stringify(regular.arcs), JSON.stringify(mouse.arcs));
  assert.ok(Math.max(...mouse.strokes.map(({ width }) => width)) > Math.max(...regular.strokes.map(({ width }) => width)), 'Nearby connections brighten and thicken');
  const touch = setup({ touch: true });
  touch.environment.emit('pointermove', { pointerType: 'touch', clientX: 450, clientY: 400 });
  touch.advance();
  assert.equal(JSON.stringify(regular.arcs), JSON.stringify(touch.arcs));
  regular.controller.destroy();
  mouse.controller.destroy();
  touch.controller.destroy();
});

test('drawing is frame-rate bounded and lifecycle synchronization cannot duplicate loops', () => {
  const field = setup();
  field.turn();
  field.advance();
  const start = JSON.stringify(field.arcs);
  field.advance(10);
  assert.equal(JSON.stringify(field.arcs), start, 'The next display frame does not redraw before 33ms');
  field.advance(30);
  assert.notEqual(JSON.stringify(field.arcs), start);
  field.intersect(true);
  field.document.emit('visibilitychange');
  field.environment.emit('pageshow');
  assert.equal(field.frames.size, 1);
  field.controller.destroy();
  const listeners = [field.root, field.document, field.environment, ...field.nodes.values(), ...field.queries.values()];
  assert.ok(listeners.every((target) => [...target.listeners.values()].every((set) => set.size === 0)));
  field.environment.emit('pageshow');
  assert.equal(field.frames.size, 0);
});

test('plain arrows browse stars rather than rotating; Shift arrows retain deliberate keyboard rotation', () => {
  const field = setup({ reducedMotion: true });
  const start = Number(field.root.dataset.fieldYaw);
  field.nodes.get('[data-field-right]').emit('click');
  assert.equal(Number(field.root.dataset.fieldYaw), start);
  field.nodes.get('[data-field-left]').emit('click');
  assert.equal(Number(field.root.dataset.fieldYaw), start);
  let prevented = false;
  field.nodes.get('[data-field-stage]').emit('keydown', { key: 'ArrowLeft', preventDefault() { prevented = true; } });
  assert.ok(prevented);
  assert.equal(Number(field.root.dataset.fieldYaw), start);
  field.turn(-1);
  assert.ok(Number(field.root.dataset.fieldYaw) < start);
  assert.equal(field.frames.size, 0);
  field.controller.destroy();
});

test('drag rotates the actual model, suppresses its trailing click, and cleans up capture', () => {
  const field = setup({ reducedMotion: true });
  const stage = field.nodes.get('[data-field-stage]');
  const target = { closest: () => null };
  stage.emit('pointerdown', { target, button: 0, pointerType: 'mouse', pointerId: 7, clientX: 100, clientY: 100 });
  stage.emit('pointermove', { pointerId: 7, clientX: 104, clientY: 100, preventDefault() {} });
  assert.equal(field.root.dataset.fieldDragging, undefined, 'A tap is not interpreted as a drag');
  stage.emit('pointermove', { pointerId: 7, clientX: 160, clientY: 110, preventDefault() {} });
  assert.equal(field.root.dataset.fieldDragging, 'true');
  assert.notEqual(Number(field.root.dataset.fieldYaw), 0);
  assert.equal(stage.captured, 7);
  stage.emit('pointerup');
  assert.equal(field.root.dataset.fieldDragging, 'false');
  assert.equal(stage.captured, null);
  let cancelled = 0;
  stage.emit('click', { detail: 1, preventDefault() { cancelled++; }, stopPropagation() { cancelled++; } });
  assert.equal(cancelled, 2);
  assert.equal(field.frames.size, 0);
  field.controller.destroy();
});

test('touch leaves vertical page scrolling available and only a horizontal gesture starts orbiting', () => {
  const field = setup({ touch: true, reducedMotion: true });
  const stage = field.nodes.get('[data-field-stage]');
  stage.emit('pointerdown', { target: { closest: () => null }, button: 0, pointerType: 'touch', pointerId: 3, clientX: 100, clientY: 100 });
  stage.emit('pointermove', { pointerId: 3, clientX: 103, clientY: 130, preventDefault() { assert.fail('Vertical scrolling must not be prevented'); } });
  assert.equal(field.root.dataset.fieldDragging, undefined);
  stage.emit('pointercancel');
  stage.emit('pointerdown', { target: { closest: () => null }, button: 0, pointerType: 'touch', pointerId: 4, clientX: 100, clientY: 100 });
  stage.emit('pointermove', { pointerId: 4, clientX: 150, clientY: 104, preventDefault() {} });
  assert.equal(field.root.dataset.fieldDragging, 'true');
  field.environment.emit('blur');
  assert.equal(stage.captured, null);
  assert.equal(field.root.dataset.fieldDragging, 'false');
  field.controller.destroy();
});

test('hiding the page releases an active orbit, ignores secondary pointers, and preserves keyboard clicks', () => {
  const field = setup({ reducedMotion: true });
  const stage = field.nodes.get('[data-field-stage]');
  const start = { target: { closest: () => null }, button: 0, pointerType: 'mouse', pointerId: 7, clientX: 100, clientY: 100 };
  stage.emit('pointerdown', start);
  stage.emit('pointerdown', { ...start, pointerId: 8, isPrimary: false });
  stage.emit('pointermove', { pointerId: 7, clientX: 150, clientY: 100, preventDefault() {} });
  assert.equal(stage.captured, 7);
  stage.emit('pointerup', { pointerId: 8 });
  assert.equal(stage.captured, 7);
  field.document.hidden = true;
  field.document.emit('visibilitychange');
  assert.equal(stage.captured, null);
  assert.equal(field.root.dataset.fieldDragging, 'false');
  stage.emit('click', { detail: 0, preventDefault() { assert.fail('A later keyboard click must not be swallowed'); } });
  assert.equal(field.frames.size, 0);
  field.controller.destroy();
});

test('unavailable Canvas preserves the static fallback and exposes an explicit notice', (t) => {
  const error = t.mock.method(console, 'error', () => {});
  const field = setup({ canvasAvailable: false });
  assert.ok(field.controller);
  assert.equal(field.frames.size, 0);
  assert.equal(field.nodes.get('[data-field-error]').hidden, false);
  assert.match(field.nodes.get('[data-field-error]').textContent, /static network is shown/);
  assert.equal(field.nodes.get('[data-field-controls]').hidden, false);
  assert.equal(field.root.dataset.fieldState, 'static');
  field.changeMode();
  assert.equal(field.root.dataset.fieldForm, 'skills');
  assert.equal(field.frames.size, 0);
  assert.equal(field.root.dataset.fieldReady, undefined);
  assert.equal(error.mock.callCount(), 1);
  field.controller.destroy();
});

test('orbiting prevents native drag-and-drop without cancelling taps or pointer focus', () => {
  const field = setup({ reducedMotion: true });
  const stage = field.nodes.get('[data-field-stage]');
  stage.emit('pointerdown', {
    target: { closest: () => null }, button: 0, pointerType: 'mouse', pointerId: 7, clientX: 100, clientY: 100,
    preventDefault() { assert.fail('Ordinary pointerdown must retain native focus and click behavior'); },
  });

  let prevented = false;
  stage.emit('dragstart', { preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  stage.emit('pointerup');
  stage.emit('click', { detail: 1, preventDefault() { assert.fail('A tap must not be swallowed'); } });
  field.controller.destroy();
  assert.equal(stage.listeners.get('dragstart').size, 0);
});

test('intentional camera rotation eases and stops scheduling frames once settled', () => {
  const field = setup();
  const stage = field.nodes.get('[data-field-stage]');
  stage.emit('pointerenter');
  field.advance();
  const start = Number(field.root.dataset.fieldYaw);
  field.turn();
  assert.equal(Number(field.root.dataset.fieldYaw), start);
  field.advance();
  const next = Number(field.root.dataset.fieldYaw);
  assert.ok(next > start && next < start + .1);
  for (let frame = 0; frame < 90; frame++) field.advance();
  const settled = Number(field.root.dataset.fieldYaw);
  assert.ok(Math.abs(settled - .3) < .001);
  assert.equal(field.frames.size, 0);
  assert.equal(field.root.dataset.fieldState, 'idle');
  stage.emit('keydown', { key: 'ArrowLeft', shiftKey: true, preventDefault() {} });
  assert.equal(Number(field.root.dataset.fieldYaw), settled, 'Keyboard arrows also start from the current view');
  field.advance();
  assert.ok(Number(field.root.dataset.fieldYaw) < settled && Number(field.root.dataset.fieldYaw) > settled - .1);
  field.controller.destroy();
});

test('long camera turns use the short direction and a bounded angular speed', () => {
  const field = setup();
  field.nodes.get('[data-field-stage]').emit('pointerenter');
  field.advance();
  for (let click = 0; click < 12; click++) field.turn();
  assert.equal(Number(field.root.dataset.fieldYaw), 0);
  field.advance(40);
  const yaw = Number(field.root.dataset.fieldYaw);
  assert.ok(yaw < 0, 'A target just past pi takes the shorter leftward turn');
  assert.ok(Math.abs(yaw) <= .0481, 'A distant target cannot create a large first-frame camera lurch');
  field.controller.destroy();
});

test('Accessibility keeps arrow activation available across focus changes', () => {
  const field = setup();
  assert.equal(field.root.querySelector('[data-field-options]'), null, 'Accessibility lives in the footer, not inside the map');
  assert.equal(field.options.hidden, false);
  field.options.open = true;
  for (const selector of ['[data-field-left]', '[data-field-right]']) {
    const arrow = field.nodes.get(selector);
    arrow.focus();
    field.nodes.get('[data-field-stage]').focus();
    field.options.emit('focusout', { relatedTarget: field.nodes.get('[data-field-stage]') });
    assert.equal(field.options.open, true, 'Focus movement must not hide a pending pointer-click target');
    arrow.emit('click');
    assert.equal(field.options.open, true, 'Browsing stars leaves Accessibility open');
  }
  field.controller.destroy();
});

test('Accessibility supports Escape, outside dismissal and focus restoration without clearing a chapter', () => {
  const field = setup();
  field.options.open = true;
  field.options.emit('toggle');
  assert.equal(field.root.dataset.controlsOpen, 'true');
  field.nodes.get('[data-field-right]').focus();
  let prevented = false;
  let stopped = false;
  field.document.emit('keydown', { key: 'Escape', preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
  assert.ok(prevented && stopped, 'Escape is consumed before the explorer clears its selection');
  assert.equal(field.options.open, false);
  assert.equal(field.document.activeElement, field.summary);
  field.options.open = true;
  field.document.emit('pointerdown', { target: field.summary });
  assert.equal(field.options.open, true);
  field.nodes.get('[data-field-right]').focus();
  field.document.emit('pointerdown', { target: field.nodes.get('[data-field-stage]') });
  assert.equal(field.options.open, false);
  assert.equal(field.document.activeElement, field.summary);
  field.options.open = true;
  field.nodes.get('[data-explorer-reset]').focus();
  field.nodes.get('[data-explorer-reset]').emit('click');
  assert.equal(field.options.open, false);
  assert.equal(field.document.activeElement, field.summary);
  field.controller.destroy();
});

test('outside dismissal recovers native body focus without overriding another focusable target', () => {
  for (const model of [false, true]) {
    for (const focusable of [false, true]) {
      const field = setup();
      field.advance();
      const pane = model ? field.modelOptions : field.options;
      const trigger = model ? field.modelSummary : field.summary;
      const inside = model ? field.form : field.nodes.get('[data-field-right]');
      const outside = field.nodes.get('[data-field-stage]');
      pane.open = true;
      inside.focus();
      field.document.emit('pointerdown', { target: outside });
      assert.equal(pane.open, false);
      assert.equal(field.document.activeElement, trigger);
      field.document.activeElement = focusable ? outside : field.document.body;
      field.advance();
      assert.equal(field.document.activeElement, focusable ? outside : trigger);
      field.controller.destroy();
      assert.equal(field.frames.size, 0);
    }
  }
});
