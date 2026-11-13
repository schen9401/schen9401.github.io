import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { experiences, skills, mountExplorer } from '../landing-explorer.js';
import { constellationGeometry, constellationScene } from '../landing-constellation.js';

class Element {
  constructor(tag, document) {
    this.tag = tag;
    this.ownerDocument = document;
    this.children = [];
    this.attrs = new Map();
    this.dataset = {};
    this.style = { setProperty(name, value) { this[name] = value; } };
    this.listeners = new Map();
    this.className = '';
    this.text = '';
    this.classList = {
      add: (value) => this.classList.toggle(value, true),
      contains: (value) => this.className.split(' ').includes(value),
      toggle: (value, enabled) => {
        const names = new Set(this.className.split(' ').filter(Boolean));
        if (enabled) names.add(value);
        else names.delete(value);
        this.className = [...names].join(' ');
      },
    };
  }
  get textContent() { return this.text + this.children.map((child) => child.textContent).join(''); }
  set textContent(value) { this.text = value; this.replaceChildren(); }
  set id(value) { this.setAttribute('id', value); }
  get id() { return this.getAttribute('id'); }
  setAttribute(name, value) { this.attrs.set(name, value); }
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  append(...children) {
    for (const child of children) {
      child.remove();
      child.parent = this;
      this.children.push(child);
    }
  }
  after(child) {
    child.remove();
    child.parent = this.parent;
    this.parent.children.splice(this.parent.children.indexOf(this) + 1, 0, child);
  }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
  }
  replaceChildren(...children) {
    for (const child of this.children) child.parent = null;
    this.children = [];
    this.append(...children);
  }
  contains(node) { return this === node || this.children.some((child) => child.contains(node)); }
  matches(selector) {
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
    if (selector.startsWith('[')) {
      const [, name, expected] = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
      const key = name.replace(/^data-/, '').replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      const actual = name.startsWith('data-') ? this.dataset[key] : this.getAttribute(name);
      return expected === undefined ? actual !== undefined && actual !== null : actual === expected;
    }
    return this.tag === selector;
  }
  closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector); }
  querySelectorAll(selector) {
    return this.children.flatMap((child) => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  addEventListener(name, callback) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(callback);
  }
  removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
  emit(name, event = {}) { for (const callback of this.listeners.get(name) ?? []) callback(event); }
  focus() {
    if (this.ownerDocument.activeElement === this) return;
    this.ownerDocument.activeElement = this;
    for (let parent = this; parent; parent = parent.parent) parent.emit('focusin', { target: this });
  }
}

function setup(onChange) {
  const document = { activeElement: null };
  document.createElement = document.createElementNS = (...args) => new Element(args.at(-1), document);
  document.createTextNode = (text) => {
    const node = new Element('#text', document);
    node.textContent = text;
    return node;
  };
  const root = document.createElement('div');
  const page = document.createElement('body');
  const footer = document.createElement('footer');
  page.append(root, footer);
  document.querySelector = (selector) => page.querySelector(selector);
  for (const key of ['explorerNodes', 'explorerDetail', 'explorerEmpty', 'explorerStatus']) {
    const node = document.createElement('div');
    node.dataset[key] = '';
    root.append(node);
  }
  const reset = document.createElement('button');
  reset.dataset.explorerReset = '';
  footer.append(reset);
  const summary = document.createElement('summary');
  summary.dataset.fieldModelSummary = '';
  root.append(summary);
  const controller = mountExplorer(root, onChange);
  const graph = root.querySelector('[data-explorer-nodes]');
  const detail = root.querySelector('[data-explorer-detail]');
  const empty = root.querySelector('[data-explorer-empty]');
  const node = (id) => graph.querySelector(`[data-node="${id}"]`);
  const hover = (id, pointerType = 'mouse') => graph.emit('pointerover', { target: node(id), pointerType });
  const click = (id, detail = 0) => graph.emit('click', { target: node(id), detail });
  return { root, document, controller, graph, detail, empty, node, hover, click, reset: () => reset.emit('click') };
}

test('both maps open without a selected star or autofocus and show empty-state guidance', () => {
  let state;
  const ui = setup((next) => { state = next; });
  assert.equal(ui.detail.textContent, '');
  assert.equal(ui.empty.hidden, false);
  assert.equal(ui.node('microsoft').getAttribute('aria-pressed'), 'false');
  assert.equal(ui.graph.querySelectorAll('.is-selected').length, 0);
  assert.equal(state.experience, null);
  assert.equal(state.item, null);
  assert.equal(state.pinned, false);
  assert.equal(state.expanded, false);
  assert.deepEqual(state.discovered, []);
  assert.equal(ui.document.activeElement, null);
  ui.click('toast');
  ui.controller.setMode('skills');
  assert.equal(ui.detail.textContent, '');
  assert.equal(ui.empty.hidden, false);
  assert.equal(ui.node('vibe-coding').getAttribute('aria-pressed'), 'false');
  assert.equal(ui.graph.querySelectorAll('.is-selected').length, 0);
  assert.deepEqual(state.discovered, ['toast']);
  assert.equal(ui.document.activeElement, null);
  ui.click('game');
  ui.controller.setMode('experience');
  assert.equal(ui.detail.textContent, '', 'Returning to a map does not restore an older selection');
  assert.equal(ui.empty.hidden, false);
  assert.equal(ui.graph.querySelectorAll('button').length, 4);
  assert.equal(state.expanded, false);
  ui.controller.setMode('skills');
  assert.equal(ui.detail.textContent, '');
  assert.equal(ui.empty.hidden, false);
  ui.controller.destroy();
});

test('empty-state guidance hides for previews and selections and returns after Reset or Escape', () => {
  const ui = setup();
  ui.hover('toast');
  assert.equal(ui.detail.querySelector('h2').textContent, 'Toast');
  assert.equal(ui.empty.hidden, true);
  ui.reset();
  assert.equal(ui.empty.hidden, false);
  ui.node('goto').focus();
  assert.equal(ui.empty.hidden, true);
  ui.root.emit('keydown', { key: 'Escape', preventDefault() {} });
  assert.equal(ui.empty.hidden, false);
  assert.equal(ui.document.activeElement, ui.node('goto'));
  ui.controller.setMode('skills');
  assert.equal(ui.empty.hidden, false);
  ui.hover('iot');
  assert.equal(ui.detail.querySelector('h2').textContent, 'IoT design');
  assert.equal(ui.empty.hidden, true);
  ui.reset();
  assert.equal(ui.empty.hidden, false);
  ui.hover('game');
  assert.equal(ui.detail.querySelector('h2').textContent, 'Game design');
  assert.equal(ui.empty.hidden, true);
  ui.reset();
  ui.click('vibe-coding');
  ui.hover('iot');
  assert.equal(ui.detail.querySelector('h2').textContent, 'Vibe-coding', 'An explicit skill pin still blocks hover previews');
  assert.equal(ui.empty.hidden, true);
  ui.detail.querySelector('a').focus();
  ui.root.emit('keydown', { key: 'Escape', preventDefault() {} });
  assert.equal(ui.document.activeElement, ui.node('vibe-coding'));
  assert.equal(ui.node('vibe-coding').getAttribute('aria-pressed'), 'false');
  assert.equal(ui.detail.textContent, '');
  assert.equal(ui.empty.hidden, false);
  ui.hover('research');
  assert.equal(ui.detail.querySelector('h2').textContent, 'Research', 'Previews remain available after clearing a selection');
  assert.equal(ui.empty.hidden, true);
  ui.controller.destroy();
});

test('experience previews consolidate company and date; only activation unfolds projects', () => {
  const ui = setup();
  assert.equal(ui.graph.querySelectorAll('button').length, 4);
  assert.equal(ui.detail.textContent, '');
  for (const experience of experiences) {
    ui.reset();
    ui.hover(experience.id);
    const attribute = experience.projects.length ? 'aria-expanded' : 'aria-pressed';
    assert.equal(ui.node(experience.id).getAttribute(attribute), 'false');
    assert.equal(ui.graph.querySelectorAll('button').length, 4, 'Hover alone does not unfold project stars');
    ui.click(experience.id);
    assert.equal(ui.node(experience.id).getAttribute(attribute), 'true');
    assert.equal(ui.graph.querySelector('.explorer-projects').hidden, !experience.projects.length);
    assert.equal(ui.graph.querySelector('.explorer-projects').querySelectorAll('button').length, experience.projects.length);
    assert.equal(ui.detail.querySelector('h2').textContent, experience.label);
    assert.match(ui.detail.textContent, new RegExp(experience.year));
    assert.equal(ui.detail.querySelector('img')?.src, experience.image);
    for (const other of experiences.filter(({ id }) => id !== experience.id)) {
      assert.equal(ui.node(other.id).getAttribute(other.projects.length ? 'aria-expanded' : 'aria-pressed'), 'false');
      assert.ok(other.projects.every(({ id }) => !ui.node(id)));
    }
    const version = ui.root.dataset.explorerState;
    ui.hover(experience.id);
    assert.equal(ui.root.dataset.explorerState, version, 'Moving across the same dot does not rebuild content');
  }
  ui.controller.destroy();
});

test('every experience star includes its date caption in the native button text', () => {
  const ui = setup();
  for (const experience of experiences) {
    const button = ui.node(experience.id);
    const caption = button.querySelector('.explorer-node-date');
    assert.equal(caption.textContent.trim(), experience.year);
    assert.equal(caption.getAttribute('aria-hidden'), null, 'Dates are also available to screen readers');
    assert.ok(button.textContent.includes(`${experience.label} ${experience.year}`));
  }
  ui.controller.setMode('skills');
  assert.equal(ui.graph.querySelectorAll('.explorer-node-date').length, 0);
  ui.controller.setMode('experience');
  assert.equal(ui.graph.querySelectorAll('.explorer-node-date').length, 4);
  assert.match(ui.root.querySelector('[data-explorer-status]').textContent, /4 selected experiences/);
  ui.controller.destroy();
});

test('Microsoft selects a current chapter without inventing projects or an empty disclosure', () => {
  const ui = setup();
  ui.click('toast');
  ui.node('cash').focus();
  ui.click('microsoft', 1);
  const button = ui.node('microsoft');
  assert.equal(ui.document.activeElement, button, 'Focus is restored before the previous project group disappears');
  assert.equal(button.getAttribute('aria-expanded'), null);
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  assert.equal(button.getAttribute('aria-controls'), 'explorer-detail');
  assert.equal(ui.graph.querySelectorAll('button').length, 4);
  assert.equal(ui.graph.querySelector('.explorer-projects').hidden, true);
  assert.equal(ui.graph.querySelectorAll('.explorer-node--project').length, 0);
  assert.equal(ui.graph.querySelector('.explorer-connections').querySelectorAll('line').length, 0);
  assert.equal(ui.detail.querySelector('h2').textContent, 'Microsoft');
  assert.match(ui.detail.textContent, /2024–now/);
  assert.match(ui.detail.textContent, /AI-native CRM for sellers with agents and Copilot/);
  assert.equal(ui.detail.querySelector('a').href, 'resume/');
  assert.match(ui.detail.querySelector('a').textContent, /View résumé/);
  assert.doesNotMatch(ui.root.querySelector('[data-explorer-status]').textContent, /Projects available|unfold projects/);
  ui.click('microsoft');
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  ui.reset();
  assert.equal(button.classList.contains('is-discovered'), false);
  ui.controller.destroy();
});

test('Microsoft shows its sourced logo, not a generic mark or invented product screenshot', async () => {
  const ui = setup();
  ui.hover('microsoft');
  const logo = ui.detail.querySelector('img');
  assert.equal(logo.src, 'assets/work/microsoft-logo.svg');
  assert.equal(logo.alt, 'Microsoft logo.');
  assert.equal(logo.classList.contains('explorer-image--logo'), true);
  assert.equal(logo.width, 102);
  assert.equal(logo.height, 102);
  const copy = ui.detail.querySelector('.explorer-detail-copy');
  assert.ok(copy.contains(ui.detail.querySelector('h2')));
  assert.ok(copy.contains(ui.detail.querySelector('.explorer-kicker')));
  assert.ok(copy.contains(ui.detail.querySelector('.explorer-description')));
  assert.ok(copy.contains(ui.detail.querySelector('a')));
  assert.equal(ui.detail.children[0].className, 'explorer-visual', 'The image remains in the left column');
  const heading = ui.detail.querySelector('.explorer-heading--experience');
  assert.equal(heading.querySelector('h2').textContent, 'Microsoft');
  assert.equal(heading.querySelector('.explorer-kicker').textContent, '2024–now');
  assert.equal(heading.querySelector('.explorer-heading-separator').textContent, ' · ');
  assert.equal(ui.detail.querySelector('.explorer-glyph'), null);
  assert.match(ui.detail.textContent, /native mobile foundations for immersive video, voice, and chat/);
  assert.match(ui.detail.textContent, /helping studio PMs, engineers, and designers bring designs to production faster/);
  ui.hover('toast');
  assert.equal(ui.detail.querySelector('img').classList.contains('explorer-image--logo'), false);
  assert.equal(ui.detail.querySelector('img').width, 124, 'Product screenshot sizing is unchanged');
  ui.hover('microsoft');
  assert.equal(ui.detail.querySelector('img').classList.contains('explorer-image--logo'), true);
  const svg = await readFile(new URL('../assets/work/microsoft-logo.svg', import.meta.url), 'utf8');
  assert.match(svg, /<svg\b/);
  for (const color of ['#f35325', '#81bc06', '#05a6f0', '#ffba08']) assert.ok(svg.includes(color));
  assert.doesNotMatch(svg, /<script\b|<foreignObject\b|<image\b|\bon\w+=|\bhref=|javascript:/i);
  ui.controller.destroy();
});

test('company overviews tell concise design stories grounded in the supplied industries', () => {
  const ui = setup();
  const contexts = {
    microsoft: ['AI-native CRM', 'sellers', 'agents', 'Copilot', 'native mobile foundations', 'immersive video, voice, and chat', 'code-ready Sales Toolkit', 'studio PMs, engineers, and designers', 'designs to production faster'],
    toast: ['fintech', 'restaurant POS'],
    bevi: ['hydration', 'IoT', 'smart water cooler'],
    goto: ['UCaaS', 'VoIP', 'contact centers', 'calling'],
  };
  for (const experience of experiences) {
    ui.reset();
    ui.hover(experience.id);
    const caption = ui.detail.querySelector('.explorer-description').textContent;
    assert.equal(caption, experience.description);
    for (const context of contexts[experience.id]) assert.ok(caption.includes(context), `${experience.label}: ${context}`);
    assert.equal(caption.match(/[.!?](?:\s|$)/g)?.length, experience.id === 'microsoft' ? 2 : 1, 'Microsoft summarizes AI-native selling and studio enablement; the other captions remain unchanged');
    const highlights = ui.detail.querySelectorAll('strong').map((node) => node.textContent);
    assert.deepEqual(highlights, experience.highlights || [], 'Only the requested Microsoft highlights receive semantic emphasis');
    if (experience.id === 'microsoft') {
      assert.ok(caption.split(/\s+/).length <= 37, 'Keep the full Microsoft scope in fewer than the original 41 words');
      assert.ok(caption.length <= 249, 'The concise summary remains shorter without clipping or smaller type');
    }
  }
  ui.controller.destroy();
});

test('project previews use their own imagery and accurate case or snapshot destinations', () => {
  const ui = setup();
  for (const experience of experiences) {
    ui.click(experience.id);
    for (const project of experience.projects) {
      ui.hover(project.id);
      assert.equal(ui.detail.querySelector('h2').textContent, project.title);
      assert.equal(ui.detail.querySelector('a').href, project.href);
      assert.match(ui.detail.textContent, new RegExp(project.kind));
      const image = ui.detail.querySelector('img');
      assert.equal(image?.src, project.image, 'A screenshot is never borrowed from another project');
      const selectedLines = ui.graph.querySelectorAll('line').filter((line) => line.classList.contains('is-selected'));
      assert.ok(selectedLines.length >= 1 && selectedLines.length <= 2, 'The path lights the actual adjoining constellation edges');
    }
  }
  ui.controller.destroy();
});

test('disclosure callbacks distinguish pointer unfolding, stable keyboard activation, and collapse', () => {
  const changes = [];
  const ui = setup((state) => changes.push(state));
  ui.hover('toast');
  assert.equal(changes.at(-1).expanded, false);
  assert.equal(changes.at(-1).source, 'preview');
  ui.click('toast', 1);
  assert.equal(changes.at(-1).animate, true);
  assert.equal(changes.at(-1).expanded, true);
  ui.click('toast');
  assert.equal(changes.at(-1).expanded, false);
  assert.equal(changes.at(-1).pinned, false);
  assert.equal(ui.node('toast').getAttribute('aria-expanded'), 'false');
  ui.click('bevi');
  assert.equal(changes.at(-1).animate, false);
  assert.equal(changes.at(-1).expanded, true);
  ui.controller.destroy();
});

test('project target visibility, native tab order, and SVG endpoints follow the same projected scene', () => {
  const ui = setup();
  ui.click('toast', 1);
  const model = constellationGeometry(experiences, skills);
  const options = { expanded: 'toast', width: 640, height: 520 };
  ui.controller.updateScene(constellationScene(model, { ...options, unfold: 0 }));
  for (const { id } of experiences[0].projects) {
    assert.equal(ui.node(id).style.visibility, 'hidden');
    assert.equal(ui.node(id).tabIndex, -1);
  }
  const scene = constellationScene(model, { ...options, unfold: 1 });
  ui.controller.updateScene(scene);
  for (const star of scene.nodes) {
    const node = ui.node(star.id);
    assert.equal(node.style.left, `${star.x}px`);
    assert.equal(node.style.top, `${star.y}px`);
    assert.equal(node.style.height, '104px', 'Collision geometry and the native text target have the same height');
    assert.equal(node.style.visibility, 'visible');
    assert.equal(node.style.opacity, '1', 'Depth never dims the readable label');
    assert.equal(node.tabIndex, 0);
  }
  for (const [index, { from, to }] of scene.edges.entries()) {
    const line = ui.graph.querySelectorAll('line')[index];
    assert.deepEqual(['x1', 'y1', 'x2', 'y2'].map((name) => Number(line.getAttribute(name))), [from.x, from.y, to.x, to.y]);
  }
  ui.controller.destroy();
});

test('routine focus changes do not compete with screen-reader focus announcements', () => {
  const ui = setup();
  const status = ui.root.querySelector('[data-explorer-status]');
  const initial = status.textContent;
  ui.node('toast').focus();
  ui.node('goto').focus();
  assert.equal(status.textContent, initial);
  ui.click('goto');
  const activated = status.textContent;
  assert.notEqual(activated, initial);
  ui.node('wallboard').focus();
  assert.equal(status.textContent, activated);
  ui.controller.destroy();
});

test('click and touch pin content until reset or another explicit selection', () => {
  const ui = setup();
  ui.hover('toast', 'touch');
  assert.equal(ui.node('closeout'), null, 'Touch never triggers hover-only content');
  ui.click('toast');
  assert.equal(ui.node('toast').getAttribute('aria-expanded'), 'true');
  ui.hover('goto');
  assert.ok(ui.node('closeout'), 'A pin survives pointer movement to another experience');
  ui.click('cash');
  assert.equal(ui.node('cash').getAttribute('aria-pressed'), 'true');
  ui.hover('closeout');
  assert.equal(ui.detail.querySelector('h2').textContent, 'Cash Drawer 2.0');
  ui.click('bevi');
  assert.ok(ui.node('dispensing'));
  ui.reset();
  assert.equal(ui.graph.querySelectorAll('button').length, 4);
  assert.equal(ui.graph.querySelector('.explorer-projects').hidden, true);
  assert.equal(ui.detail.textContent, '');
  assert.equal(ui.empty.hidden, false);
  ui.controller.destroy();
});

test('keyboard tab order follows the selected experience into its project group', () => {
  const ui = setup();
  ui.node('toast').focus();
  assert.equal(ui.node('closeout'), null, 'Focus previews; keyboard activation unfolds');
  ui.click('toast');
  const buttons = ui.graph.querySelectorAll('button');
  assert.deepEqual(buttons.map(({ dataset }) => dataset.node), ['toast', 'closeout', 'cash', 'web', 'pos', 'goto', 'bevi', 'microsoft']);
  ui.node('closeout').focus();
  assert.equal(ui.detail.querySelector('h2').textContent, 'Check-centered closeout');
  assert.equal(ui.document.activeElement, ui.node('closeout'));
  ui.hover('goto');
  assert.equal(ui.document.activeElement, ui.node('closeout'), 'Pointer movement cannot remove focused project content');
  ui.detail.querySelector('a').focus();
  ui.hover('goto');
  assert.equal(ui.detail.querySelector('h2').textContent, 'Check-centered closeout', 'The preview stays reachable while its link is focused');
  let prevented = false;
  ui.root.emit('keydown', { key: 'Escape', preventDefault() { prevented = true; } });
  assert.ok(prevented);
  assert.equal(ui.document.activeElement, ui.node('toast'));
  assert.equal(ui.graph.querySelector('.explorer-projects').hidden, true);
  assert.equal(ui.node('toast').getAttribute('aria-expanded'), 'false');
  ui.node('goto').focus();
  ui.click('goto');
  assert.ok(ui.node('wallboard'));
  ui.controller.destroy();
});

test('skill model exposes eight concise details and safely clears focused or pinned branches', () => {
  const ui = setup();
  ui.click('toast');
  ui.node('cash').focus();
  ui.controller.setMode('skills');
  assert.equal(ui.document.activeElement, ui.root.querySelector('[data-field-model-summary]'));
  assert.equal(ui.graph.querySelectorAll('button').length, 8);
  assert.equal(ui.graph.querySelector('.explorer-projects').hidden, true);
  for (const skill of skills) {
    ui.node(skill.id).focus();
    assert.equal(ui.detail.querySelector('h2').textContent, skill.label);
    assert.equal(ui.detail.querySelector('a').href, skill.href);
  }
  ui.node('illustration').focus();
  const link = ui.detail.querySelector('a');
  assert.equal(link.target, '_blank');
  assert.equal(link.rel, 'noopener noreferrer');
  assert.match(link.textContent, /Figma access may be required/);
  link.focus();
  ui.reset();
  assert.equal(ui.document.activeElement, ui.node('illustration'));
  assert.equal(ui.detail.textContent, '');
  assert.equal(ui.empty.hidden, false);
  ui.controller.setMode('experience');
  assert.equal(ui.graph.querySelectorAll('button').length, 4);
  assert.equal(ui.detail.textContent, '');
  assert.equal(ui.empty.hidden, false);
  assert.ok(ui.graph.querySelectorAll('button').every((button) => (button.getAttribute('aria-expanded') || button.getAttribute('aria-pressed')) === 'false'));
  ui.controller.destroy();
});

test('exploration needs no Canvas or animation API and all listeners are removed on cleanup', () => {
  const ui = setup();
  ui.node('bevi').focus();
  ui.click('bevi');
  ui.click('dispensing');
  assert.match(ui.detail.textContent, /A more personal pour/);
  ui.controller.setMode('skills');
  ui.click('game');
  assert.equal(ui.detail.querySelector('a').href, 'work/cattia.html');
  ui.controller.destroy();
  const targets = [ui.root, ui.graph, ui.document.querySelector('[data-explorer-reset]')];
  assert.ok(targets.every((target) => [...target.listeners.values()].every((set) => set.size === 0)));
});

test('each explored chapter leaves decorative starlight, survives Escape and skill mode, and clears on Reset', () => {
  let state;
  const ui = setup((next) => { state = next; });
  const model = constellationGeometry(experiences, skills);
  const scene = (yaw = 0) => {
    ui.controller.updateScene(constellationScene(model, {
      mode: state.mode, expanded: state.expanded ? state.experience : null, discovered: state.discovered,
      width: 640, height: 520, camera: { yaw, pitch: .12 },
    }));
    return ui.graph.querySelector('.explorer-memories');
  };
  ui.hover('toast');
  assert.deepEqual(state.discovered, [], 'Hover alone does not collect a chapter');
  ui.click('toast');
  assert.deepEqual(state.discovered, ['toast']);
  assert.ok(ui.node('toast').classList.contains('is-discovered'));
  assert.match(ui.node('toast').textContent, /explored chapter/);
  assert.equal(scene().querySelectorAll('circle').length, 0, 'The active project stars already have native controls');
  ui.click('goto');
  const memories = scene();
  assert.equal(memories.getAttribute('aria-hidden'), 'true');
  assert.equal(memories.querySelectorAll('circle').length, 4);
  assert.equal(memories.querySelectorAll('line').length, 4);
  assert.equal(ui.graph.querySelectorAll('button').length, 9, 'Remembered stars never become duplicate focus targets');
  const star = memories.querySelector('circle');
  const before = star.getAttribute('cx');
  scene(1);
  assert.equal(memories.querySelector('circle'), star, 'Rotation updates cached SVG nodes rather than rebuilding the graph');
  assert.notEqual(star.getAttribute('cx'), before);
  ui.root.emit('keydown', { key: 'Escape', preventDefault() {} });
  assert.equal(scene().querySelectorAll('circle').length, 9);
  assert.equal(ui.detail.textContent, '');
  assert.equal(ui.empty.hidden, false);
  assert.deepEqual(state.discovered, ['toast', 'goto']);
  ui.controller.setMode('skills');
  assert.equal(scene().querySelectorAll('circle').length, 0);
  assert.deepEqual(state.discovered, ['toast', 'goto']);
  ui.controller.setMode('experience');
  assert.equal(scene().querySelectorAll('circle').length, 9);
  ui.reset();
  assert.equal(scene().querySelectorAll('circle').length, 0);
  assert.deepEqual(state.discovered, []);
  assert.equal(ui.node('toast').classList.contains('is-discovered'), false);
  assert.equal(ui.detail.textContent, '');
  assert.equal(ui.empty.hidden, false);
  ui.controller.destroy();
});

test('snapshot fragments open and scroll to the intended brief without changing unrelated details', async () => {
  const script = await readFile(new URL('../site.js', import.meta.url), 'utf8');
  const snapshots = new Map(['toast-web', 'pos-dashboard', 'bevi', 'grasshopper', 'supervisor-dashboard', 'outbound-dialer'].map((id) => [id, {
    open: false, scrolls: 0, matches: (selector) => selector === 'details.snapshot',
    scrollIntoView() { this.scrolls++; },
  }]));
  const listeners = new Map();
  const window = { location: { hash: '#toast-web' }, addEventListener(name, callback) { listeners.set(name, callback); } };
  const document = {
    body: { classList: { contains: () => false } },
    getElementById: (id) => snapshots.get(id),
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  runInNewContext(script, { document, window });
  assert.equal(snapshots.get('toast-web').open, true);
  assert.equal(snapshots.get('bevi').open, false);
  window.location.hash = '#bevi';
  listeners.get('hashchange')();
  assert.equal(snapshots.get('bevi').open, true);
  assert.equal(snapshots.get('bevi').scrolls, 1);
  window.location.hash = '#unknown';
  assert.doesNotThrow(() => listeners.get('hashchange')());
});

test('dragging either map does not replace previews as moving stars cross the pointer', () => {
  const ui = setup();
  ui.hover('toast');
  const version = ui.root.dataset.explorerState;
  ui.root.dataset.fieldDragging = 'true';
  ui.hover('goto');
  assert.equal(ui.root.dataset.explorerState, version);
  assert.equal(ui.detail.querySelector('h2').textContent, 'Toast');
  ui.root.dataset.fieldDragging = 'false';
  ui.hover('goto');
  assert.match(ui.detail.textContent, /UCaaS/);
  ui.controller.setMode('skills');
  ui.hover('iot');
  ui.root.dataset.fieldDragging = 'true';
  ui.hover('game');
  assert.equal(ui.detail.querySelector('h2').textContent, 'IoT design');
  ui.root.dataset.fieldDragging = 'false';
  ui.hover('game');
  assert.equal(ui.detail.querySelector('h2').textContent, 'Game design');
  ui.controller.destroy();
});

test('arrow traversal selects available anchors and projects, wraps and preserves native focus and pin states', () => {
  const ui = setup();
  ui.controller.selectAdjacent(-1);
  assert.equal(ui.node('microsoft').getAttribute('aria-pressed'), 'true');
  ui.controller.selectAdjacent(1);
  assert.equal(ui.node('toast').getAttribute('aria-expanded'), 'true');
  ui.controller.selectAdjacent(1);
  assert.equal(ui.node('closeout').getAttribute('aria-pressed'), 'true');
  ui.node('closeout').focus();
  assert.equal(ui.node('closeout').getAttribute('aria-pressed'), 'true', 'Focusing the selected star does not unpin it');
  ui.controller.selectAdjacent(1);
  assert.equal(ui.node('cash').getAttribute('aria-pressed'), 'true');
  assert.equal(ui.document.activeElement, ui.node('cash'));
  ui.controller.selectAdjacent(-1);
  ui.controller.selectAdjacent(-1);
  assert.equal(ui.document.activeElement, ui.node('toast'));
  assert.equal(ui.node('toast').getAttribute('aria-expanded'), 'true', 'Browsing to the parent does not collapse its projects');
  assert.equal(ui.detail.querySelector('h2').textContent, 'Toast');
  ui.controller.setMode('skills');
  ui.controller.selectAdjacent(-1);
  assert.equal(ui.node('vibe-coding').getAttribute('aria-pressed'), 'true');
  assert.equal(ui.detail.querySelector('h2').textContent, 'Vibe-coding');
  ui.controller.selectAdjacent(1);
  assert.equal(ui.node('iot').getAttribute('aria-pressed'), 'true');
  ui.controller.selectAdjacent(-1);
  assert.equal(ui.detail.querySelector('a').href, 'work/');
  assert.match(ui.root.querySelector('[data-explorer-status]').textContent, /Vibe-coding/);
  assert.doesNotMatch(ui.root.querySelector('[data-explorer-status]').textContent, /prototyping|North Star/);
  ui.controller.destroy();
});

test('image-free details omit generic letter tiles and redundant skill metadata', () => {
  const ui = setup();
  ui.click('toast');
  ui.hover('pos');
  assert.equal(ui.detail.querySelector('.explorer-visual'), null);
  assert.equal(ui.detail.querySelector('.explorer-kicker').textContent, 'Toast · Brief snapshot');
  ui.controller.setMode('skills');
  ui.click('research');
  assert.equal(ui.detail.querySelector('h2').textContent, 'Research');
  assert.equal(ui.detail.querySelector('.explorer-kicker'), null);
  assert.equal(ui.detail.querySelector('.explorer-description'), null);
  assert.equal(ui.detail.querySelector('.explorer-visual'), null);
  assert.equal(ui.graph.querySelector('.explorer-connections').querySelectorAll('line').length, 0);
  ui.click('vibe-coding');
  assert.equal(ui.graph.querySelectorAll('.explorer-node--north-star').length, 1);
  assert.equal(ui.node('vibe-coding').querySelector('.explorer-node-guidance'), null);
  assert.equal(ui.node('vibe-coding').querySelector('.explorer-node-label').textContent, 'Vibe-coding');
  assert.equal(ui.node('vibe-coding').textContent, 'Vibe-coding');
  assert.equal(ui.node('vibe-coding').querySelectorAll('wbr').length, 0);
  assert.equal(ui.node('vibe-coding').getAttribute('aria-pressed'), 'true');
  ui.controller.destroy();
});

test('focusing another anchor does not collapse or reflow an open constellation before activation', () => {
  const changes = [];
  const ui = setup((state) => changes.push(state));
  ui.click('toast', 1);
  const version = ui.root.dataset.explorerState;
  ui.node('goto').focus();
  assert.equal(ui.root.dataset.explorerState, version);
  assert.equal(ui.node('toast').getAttribute('aria-expanded'), 'true');
  assert.ok(ui.node('closeout'), 'Pointer or keyboard focus alone must not tear down the displayed constellation');
  ui.click('goto', 1);
  assert.equal(ui.node('goto').getAttribute('aria-expanded'), 'true');
  assert.ok(ui.node('wallboard'));
  assert.equal(changes.at(-1).animate, true);
  assert.equal(changes.at(-1).experience, 'goto');
  ui.controller.destroy();
});
