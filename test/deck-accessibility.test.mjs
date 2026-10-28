import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../presentation/deck-accessibility.js', import.meta.url), 'utf8');

class Element {
  constructor() {
    this.classes = new Set();
    this.attributes = new Map();
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
  const ids = new Map(['deck', 'sidebar', 'menuBtn', 'prev', 'next', 'fontDown', 'fontUp'].map((id) => [id, new Element()]));
  const deck = ids.get('deck');
  deck.querySelectorAll = () => slides;
  const observers = new Map();
  let ready;
  const document = {
    activeElement: null,
    documentElement: new Element(),
    getElementById: (id) => ids.get(id),
    createElement: () => new Element(),
    querySelector: () => new Element(),
    addEventListener(name, callback) {
      if (name === 'DOMContentLoaded') ready = callback;
    },
  };
  runInNewContext(source, {
    document,
    Element,
    MutationObserver: class {
      constructor(callback) { this.callback = callback; }
      observe(target) { observers.set(target, this.callback); }
    },
  });
  ready();
  return {
    previous: ids.get('prev'),
    next: ids.get('next'),
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
