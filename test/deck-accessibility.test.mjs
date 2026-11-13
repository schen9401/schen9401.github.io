import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../presentation/deck-accessibility.js', import.meta.url), 'utf8');

class Element {
  constructor() {
    this.classes = new Set();
    this.attributes = new Map();
    this.children = [];
    this.clientHeight = 600;
    this.scrollHeight = 600;
    this.classList = { contains: (name) => this.classes.has(name) };
    this.style = { getPropertyValue: () => '' };
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
  hasAttribute(name) { return this.attributes.has(name); }
  toggleAttribute(name, enabled) {
    if (enabled) this.setAttribute(name, '');
    else this.removeAttribute(name);
  }
  contains() { return false; }
  append() {}
  addEventListener() {}
  focus() {}
  querySelector() { return new Element(); }
  querySelectorAll() { return []; }
}

function mountDeck() {
  const slides = Array.from({ length: 23 }, () => new Element());
  slides[0].classes.add('is-active');
  const ids = new Map(['deck', 'sidebar', 'menuBtn', 'prev', 'next', 'fontDown', 'fontUp', 'presentBtn'].map((id) => [id, new Element()]));
  const deck = ids.get('deck');
  deck.querySelectorAll = () => slides;
  const observers = new Map();
  const resizeObservers = new Map();
  const controls = new Element();
  const home = new Element();
  const keyHandlers = new Map();
  let ready;
  const document = {
    activeElement: null,
    documentElement: new Element(),
    getElementById: (id) => ids.get(id),
    createElement: () => new Element(),
    querySelector: (selector) => selector === '.stage-controls' ? controls : home,
    addEventListener(name, callback) {
      if (name === 'DOMContentLoaded') ready = callback;
      else keyHandlers.set(name, callback);
    },
  };
  runInNewContext(source, {
    document,
    Element,
    MutationObserver: class {
      constructor(callback) { this.callback = callback; }
      observe(target) { observers.set(target, this.callback); }
    },
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; }
      observe(target) { resizeObservers.set(target, this.callback); }
    },
  });
  ready();
  return {
    previous: ids.get('prev'),
    next: ids.get('next'),
    slides, deck, document, controls, home,
    sidebar: ids.get('sidebar'),
    fullscreen: ids.get('presentBtn'),
    syncFullscreen() { keyHandlers.get('fullscreenchange')(); },
    resize() { resizeObservers.get(deck)(); },
    keydown(event) { keyHandlers.get('keydown')(event); },
    syncSidebar() { observers.get(ids.get('sidebar'))(); },
    setActive(index, hidden = []) {
      for (const [i, slide] of slides.entries()) {
        slide.classes.delete('is-active');
        slide.classes.delete('hide');
        if (i === index) slide.classes.add('is-active');
        if (hidden.includes(i)) slide.classes.add('hide');
      }
      observers.get(deck)();
    },
  };
}

test('slide controls follow the rendered slide rather than the stale runtime index', () => {
  const deck = mountDeck();
  assert.equal(deck.previous.disabled, true);
  assert.equal(deck.next.disabled, false);
  deck.setActive(1);
  assert.equal(deck.previous.disabled, false);
  assert.equal(deck.next.disabled, false);
  deck.setActive(22);
  assert.equal(deck.previous.disabled, false);
  assert.equal(deck.next.disabled, true);
  deck.setActive(0);
  assert.equal(deck.previous.disabled, true);
  assert.equal(deck.next.disabled, false);
});

test('overflowing slides remain keyboard-scrollable without using the deck text-size controls', () => {
  const mounted = mountDeck();
  const slide = mounted.slides[0];
  assert.equal(slide.tabIndex, -1);
  slide.scrollHeight = 900;
  mounted.resize();
  assert.equal(slide.tabIndex, 0);
  assert.equal(slide.attributes.get('aria-describedby'), 'deck-text-status');
  assert.equal(mounted.deck.hasAttribute('data-wheel-pass'), true);
  assert.equal(mounted.deck.hasAttribute('data-swipe-pass'), true);
  const target = new Element();
  target.closest = (selector) => selector === '#deck > .slide' ? slide : null;
  let stopped = 0;
  mounted.keydown({ target, key: 'ArrowDown', stopPropagation() { stopped++; } });
  assert.equal(stopped, 1, 'Up/down scroll the focused overflowing slide instead of changing slides');
  mounted.keydown({ target, key: 'ArrowRight', stopPropagation() { stopped++; } });
  assert.equal(stopped, 1, 'Left/right still reach the slide-navigation runtime');
  mounted.setActive(1);
  assert.equal(slide.tabIndex, -1);
  assert.equal(mounted.deck.hasAttribute('data-wheel-pass'), false);
  slide.scrollHeight = 600;
  mounted.setActive(0);
  assert.equal(slide.tabIndex, -1);
  assert.equal(slide.hasAttribute('aria-describedby'), false);
});

test('the slide navigator also makes the external presentation-home link inert', () => {
  const mounted = mountDeck();
  mounted.sidebar.classes.add('open');
  mounted.syncSidebar();
  assert.equal(mounted.home.inert, true);
  assert.equal(mounted.controls.inert, true);
  mounted.sidebar.classes.delete('open');
  mounted.syncSidebar();
  assert.equal(mounted.home.inert, false);
  assert.equal(mounted.controls.inert, false);
  mounted.fullscreen.setAttribute('aria-label', 'Exit fullscreen');
  mounted.fullscreen.setAttribute('aria-pressed', 'true');
  mounted.syncFullscreen();
  assert.equal(mounted.fullscreen.attributes.get('aria-label'), 'Fullscreen', 'A toggle keeps the same name when its pressed state changes');
  assert.equal(mounted.fullscreen.attributes.get('aria-pressed'), 'true');
});

test('slide controls honor hidden slides and the single-visible-slide boundary', () => {
  const deck = mountDeck();
  deck.setActive(1, [0]);
  assert.equal(deck.previous.disabled, true);
  assert.equal(deck.next.disabled, false);
  deck.setActive(21, [22]);
  assert.equal(deck.previous.disabled, false);
  assert.equal(deck.next.disabled, true);
  deck.setActive(22, Array.from({ length: 22 }, (_, i) => i));
  assert.equal(deck.previous.disabled, true);
  assert.equal(deck.next.disabled, true);
});
