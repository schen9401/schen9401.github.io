import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mountTrail } from '../landing-trail.js';

class Target {
  listeners = new Map();
  addEventListener(name, callback) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(callback);
  }
  removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
  emit(name, event = {}) { for (const callback of this.listeners.get(name) ?? []) callback(event); }
}

function setup({ playing = true, touch = false, canvasAvailable = true } = {}) {
  const document = new Target();
  document.hidden = false;
  document.documentElement = new Target();
  document.documentElement.clientWidth = 1280;
  const environment = new Target();
  environment.innerHeight = 720;
  environment.devicePixelRatio = 3;
  const queries = new Map();
  environment.matchMedia = (query) => {
    if (!queries.has(query)) {
      const target = new Target();
      target.matches = query.includes('pointer: fine') ? !touch : query.includes('reduced-motion') ? !playing : false;
      queries.set(query, target);
    }
    return queries.get(query);
  };
  let nextId = 0;
  const frames = new Map();
  environment.requestAnimationFrame = (callback) => { frames.set(++nextId, callback); return nextId; };
  environment.cancelAnimationFrame = (id) => frames.delete(id);
  let observer;
  environment.MutationObserver = class {
    constructor(callback) { this.callback = callback; observer = this; }
    observe() {}
    disconnect() { this.disconnected = true; }
  };
  const notice = { hidden: true, textContent: '' };
  const field = { dataset: { motionPlaying: String(playing) }, querySelector: () => notice };
  const root = { ownerDocument: document, children: [], querySelector: () => field, append(node) { this.children.push(node); } };
  const context = {
    fills: [], draws: 0,
    clearRect() { this.fills = []; this.draws++; },
    setTransform(...args) { this.transform = args; },
    fillRect(...rect) { this.fills.push({ rect, style: this.fillStyle }); },
  };
  const canvas = {
    attrs: new Map(),
    setAttribute(name, value) { this.attrs.set(name, value); },
    getContext() { return canvasAvailable ? context : null; },
    remove() { root.children = root.children.filter((node) => node !== this); },
  };
  document.createElement = () => canvas;
  const controller = mountTrail(root, environment);
  let timestamp = 0;
  return {
    root, document, environment, queries, frames, context, canvas, controller, field, notice,
    get observer() { return observer; },
    move(x = 320, y = 300, pointerType = 'mouse') { environment.emit('pointermove', { clientX: x, clientY: y, pointerType }); },
    play(value) { field.dataset.motionPlaying = String(value); observer.callback(); },
    advance(delta = 40) {
      timestamp += delta;
      const callbacks = [...frames.values()];
      frames.clear();
      for (const callback of callbacks) callback(timestamp);
    },
  };
}

const alpha = (fill) => Number(fill.style.match(/rgba\(255,255,255,([^)]+)\)/)[1]);

test('trail is decorative, initially idle, resolution-capped, and strictly monochrome', () => {
  const trail = setup();
  assert.equal(trail.canvas.attrs.get('aria-hidden'), 'true');
  assert.ok(trail.canvas.attrs.has('inert'));
  assert.equal(trail.canvas.hidden, true);
  assert.equal(trail.frames.size, 0);
  assert.equal(trail.canvas.width, 2560);
  assert.equal(trail.canvas.height, 1440);
  assert.deepEqual(trail.context.transform, [2, 0, 0, 2, 0, 0]);
  trail.move(100, 100);
  trail.advance();
  assert.equal(trail.canvas.hidden, false);
  assert.ok(trail.context.fills.length > 10);
  for (const fill of trail.context.fills) {
    assert.ok(fill.rect.every(Number.isFinite));
    assert.ok(fill.rect[0] >= 44 && fill.rect[1] >= 44, 'Initial entry does not draw a line from the viewport origin');
    assert.ok(alpha(fill) > 0 && alpha(fill) <= .18);
  }
  const luminance = (channel) => (channel / 255 <= .04045 ? channel / 255 / 12.92 : ((channel / 255 + .055) / 1.055) ** 2.4);
  const brightestBackground = 8 + (255 - 8) * .18;
  assert.ok((luminance(163) + .05) / (luminance(brightestBackground) + .05) >= 4.5, 'Even the brightest trail pixel preserves muted-text contrast');
  trail.controller.destroy();
});

test('stationary pixels decay completely within 1.1 seconds and stop scheduling frames', () => {
  const trail = setup();
  trail.move();
  trail.advance();
  const initial = alpha(trail.context.fills[0]);
  trail.advance(550);
  assert.ok(alpha(trail.context.fills[0]) < initial);
  trail.advance(550);
  assert.equal(trail.context.fills.length, 0);
  assert.equal(trail.frames.size, 0);
  assert.equal(trail.canvas.hidden, true);
  trail.controller.destroy();
});

test('fast movement is interpolated while painting and live-cell counts stay bounded', () => {
  const trail = setup();
  trail.move(100, 300);
  trail.advance();
  const brightest = trail.context.fills.reduce((a, b) => alpha(a) > alpha(b) ? a : b);
  trail.move(900, 300);
  trail.advance();
  assert.ok(trail.context.fills.some(({ rect: [x, y] }) => x > 450 && x < 550 && Math.abs(y - 300) < 20));
  const retained = trail.context.fills.find(({ rect }) => rect[0] === brightest.rect[0] && rect[1] === brightest.rect[1]);
  assert.ok(alpha(retained) >= alpha(brightest) * .8, 'Overlapping brush edges do not erase the stronger pixels behind the cursor');
  const drawn = trail.context.draws;
  for (let index = 0; index < 20; index++) trail.move(950 + index, 310);
  assert.equal(trail.frames.size, 1, 'Pointer events cannot spawn duplicate loops');
  trail.advance(10);
  assert.equal(trail.context.draws, drawn);
  trail.advance(30);
  assert.equal(trail.context.draws, drawn + 1);
  for (let index = 0; index < 50; index++) {
    trail.move(40 + (index % 10) * 125, 40 + Math.floor(index / 10) * 145);
    trail.advance();
    assert.ok(trail.context.fills.length <= 2400);
  }
  trail.controller.destroy();
});

test('trail follows shared play intent, not the field’s offscreen suspension or lens toggle', () => {
  const trail = setup({ playing: false });
  trail.move();
  assert.equal(trail.frames.size, 0, 'Reduced-motion defaults stay still');
  trail.play(true);
  trail.field.dataset.fieldState = 'suspended';
  trail.field.dataset.lensEnabled = 'false';
  trail.move();
  trail.advance();
  assert.equal(trail.canvas.hidden, false, 'Explicit Play enables the trail independently of the lens and field viewport');
  trail.play(false);
  assert.equal(trail.frames.size, 0);
  assert.equal(trail.canvas.hidden, true);
  trail.environment.emit('pageshow');
  trail.move();
  assert.equal(trail.frames.size, 0, 'A user pause persists');
  trail.controller.destroy();
});

test('keyboard, touch, scroll, pointer exit, focus loss, and page lifecycle clear the trail', () => {
  const trail = setup();
  for (const [target, event] of [
    [trail.document, 'keydown'], [trail.document.documentElement, 'pointerleave'],
    [trail.environment, 'scroll'], [trail.environment, 'blur'],
  ]) {
    trail.move();
    trail.advance();
    target.emit(event);
    assert.equal(trail.frames.size, 0, event);
    assert.equal(trail.canvas.hidden, true, event);
  }
  trail.move();
  trail.advance();
  trail.move(300, 300, 'touch');
  assert.equal(trail.canvas.hidden, true);
  trail.move();
  trail.advance();
  trail.document.hidden = true;
  trail.document.emit('visibilitychange');
  trail.move();
  assert.equal(trail.frames.size, 0);
  trail.document.hidden = false;
  trail.document.emit('visibilitychange');
  trail.move();
  trail.advance();
  trail.environment.emit('pagehide');
  trail.move();
  assert.equal(trail.frames.size, 0);
  trail.environment.emit('pageshow');
  trail.move();
  assert.equal(trail.frames.size, 1);
  trail.controller.destroy();
});

test('pointer and system preferences suppress drawing, and teardown removes every listener', () => {
  const trail = setup({ touch: true });
  trail.move();
  assert.equal(trail.frames.size, 0);
  const fine = trail.queries.get('(hover: hover) and (pointer: fine)');
  fine.matches = true;
  fine.emit('change');
  trail.move();
  trail.advance();
  const forced = trail.queries.get('(forced-colors: active)');
  forced.matches = true;
  forced.emit('change');
  trail.move();
  assert.equal(trail.frames.size, 0);
  assert.equal(trail.canvas.hidden, true);
  forced.matches = false;
  forced.emit('change');
  trail.move();
  trail.advance();
  trail.play(false);
  trail.queries.get('(prefers-reduced-motion: reduce)').emit('change');
  assert.equal(trail.frames.size, 0);
  trail.controller.destroy();
  assert.equal(trail.root.children.length, 0);
  assert.ok(trail.observer.disconnected);
  const targets = [trail.document, trail.document.documentElement, trail.environment, ...trail.queries.values()];
  assert.ok(targets.every((target) => [...target.listeners.values()].every((set) => set.size === 0)));
  trail.move();
  assert.equal(trail.frames.size, 0);
});

test('resize clears old viewport coordinates and Canvas failure is reported explicitly', (t) => {
  const trail = setup();
  trail.move();
  trail.advance();
  trail.document.documentElement.clientWidth = 375;
  trail.environment.innerHeight = 812;
  trail.environment.emit('resize');
  assert.equal(trail.canvas.width, 750);
  assert.equal(trail.canvas.height, 1624);
  assert.equal(trail.canvas.hidden, true);
  assert.equal(trail.frames.size, 0);
  trail.move(800, 200);
  assert.equal(trail.frames.size, 0, 'Out-of-viewport points are ignored');
  trail.controller.destroy();
  const error = t.mock.method(console, 'error', () => {});
  const unavailable = setup({ canvasAvailable: false });
  assert.equal(unavailable.controller, null);
  assert.equal(unavailable.frames.size, 0);
  assert.equal(unavailable.root.children.length, 0);
  assert.equal(unavailable.notice.hidden, false);
  assert.match(unavailable.notice.textContent, /pixel trail is unavailable/);
  assert.equal(error.mock.callCount(), 1);
});
