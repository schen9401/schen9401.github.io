import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const script = await readFile(new URL('../presentation/motion.js', import.meta.url), 'utf8');

function setup({ reduced = false, deck = false, blocked = false } = {}) {
  const notices = [];
  const errors = [];
  const warnings = [];
  const observers = [];
  const mutations = [];
  const figure = {
    querySelector: (selector) => notices.find((notice) => `.${notice.className}` === selector),
    append: (notice) => notices.push(notice),
  };
  const slide = { active: true, classList: { contains: () => slide.active } };
  const sidebar = { open: false, classList: { contains: () => sidebar.open } };
  const videos = Array.from({ length: 2 }, (_, index) => Object.assign(new EventTarget(), {
    id: `video-${index}`,
    paused: true,
    error: null,
    muted: false,
    playCalls: 0,
    querySelectorAll: () => [],
    querySelector: () => ({ getAttribute: () => `${index}.mp4` }),
    closest: (selector) => selector === '.slide' ? (deck ? slide : null) : figure,
    play() {
      this.playCalls++;
      if (blocked) return Promise.reject(Object.assign(new Error('Blocked'), { name: 'NotAllowedError' }));
      this.paused = false;
      this.dispatchEvent(new Event('play'));
      this.dispatchEvent(new Event('playing'));
      return Promise.resolve();
    },
    pause() {
      if (this.paused) return;
      this.paused = true;
      this.dispatchEvent(new Event('pause'));
    },
  }));
  const button = Object.assign(new EventTarget(), {
    hidden: true,
    getAttribute: () => videos.map((video) => video.id).join(' '),
  });
  const scope = {
    id: deck ? 'deck' : '',
    querySelectorAll: (selector) => selector.startsWith('video') ? videos : [button],
  };
  const document = Object.assign(new EventTarget(), {
    hidden: false,
    querySelector: () => scope,
    getElementById: (id) => id === 'deck' ? (deck ? scope : null) : id === 'sidebar' ? sidebar : videos.find((video) => video.id === id),
    createElement: () => ({ setAttribute() {}, remove() { notices.splice(notices.indexOf(this), 1); } }),
  });
  const preference = Object.assign(new EventTarget(), { matches: reduced });
  class IntersectionObserver {
    constructor(callback) { observers.push(callback); }
    observe() {}
  }
  class MutationObserver {
    constructor(callback) { mutations.push(callback); }
    observe() {}
  }
  runInNewContext(script, {
    document,
    window: { matchMedia: () => preference, IntersectionObserver },
    IntersectionObserver,
    MutationObserver,
    console: { error: (...args) => errors.push(args), warn: (...args) => warnings.push(args) },
  });
  const intersect = (visible) => observers[0](videos.map((target) => ({ target, isIntersecting: visible, intersectionRatio: visible ? 1 : 0 })));
  return { videos, button, document, preference, intersect, mutations, slide, sidebar, notices, errors, warnings };
}

test('both device animations start when visible and pause offscreen or in a hidden page', () => {
  const state = setup();
  state.intersect(true);
  assert.ok(state.videos.every((video) => !video.paused && video.muted));
  assert.equal(state.button.textContent, 'Pause animations');
  state.intersect(false);
  assert.ok(state.videos.every((video) => video.paused));
  state.intersect(true);
  assert.ok(state.videos.every((video) => !video.paused));
  state.document.hidden = true;
  state.document.dispatchEvent(new Event('visibilitychange'));
  assert.ok(state.videos.every((video) => video.paused));
  state.document.hidden = false;
  state.document.dispatchEvent(new Event('visibilitychange'));
  assert.ok(state.videos.every((video) => !video.paused));
});

test('reduced motion prevents automatic playback but permits explicit play', () => {
  const state = setup({ reduced: true });
  state.intersect(true);
  assert.ok(state.videos.every((video) => video.paused && video.playCalls === 0));
  state.button.dispatchEvent(new Event('click'));
  assert.ok(state.videos.every((video) => !video.paused));
  state.preference.dispatchEvent(new Event('change'));
  assert.ok(state.videos.every((video) => video.paused));
});

test('a user pause survives leaving and returning to the viewport', () => {
  const state = setup();
  state.intersect(true);
  state.videos[0].pause();
  state.intersect(false);
  state.intersect(true);
  assert.equal(state.videos[0].paused, true);
  assert.equal(state.videos[1].paused, false);
  state.button.dispatchEvent(new Event('click'));
  assert.ok(state.videos.every((video) => video.paused));
  assert.equal(state.button.textContent, 'Play animations');
  state.intersect(false);
  state.intersect(true);
  assert.ok(state.videos.every((video) => video.paused));
  state.button.dispatchEvent(new Event('click'));
  assert.ok(state.videos.every((video) => !video.paused));
});

test('only active slides animate and opening the navigator pauses playback', () => {
  const state = setup({ deck: true });
  state.slide.active = false;
  state.intersect(true);
  assert.ok(state.videos.every((video) => video.paused));
  state.slide.active = true;
  state.mutations[0]();
  assert.ok(state.videos.every((video) => !video.paused));
  state.sidebar.open = true;
  state.mutations[1]();
  assert.ok(state.videos.every((video) => video.paused));
  state.sidebar.open = false;
  state.mutations[1]();
  assert.ok(state.videos.every((video) => !video.paused));
});

test('blocked autoplay is reported and is not repeatedly retried', async () => {
  const state = setup({ blocked: true });
  state.intersect(true);
  await Promise.resolve();
  assert.match(state.notices[0].textContent, /Press Play/);
  assert.equal(state.warnings.length, 2);
  state.intersect(true);
  assert.ok(state.videos.every((video) => video.playCalls === 1));
  assert.equal(state.errors.length, 0);
});

test('media failures are shown explicitly and logged', () => {
  const state = setup();
  state.videos[0].error = new Error('Unsupported or missing media');
  state.videos[0].dispatchEvent(new Event('error'));
  state.intersect(true);
  assert.match(state.notices[0].textContent, /animation could not load/);
  assert.equal(state.errors.length, 1);
  assert.equal(state.videos[0].playCalls, 0);
});
