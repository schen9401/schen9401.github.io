const RADIUS = 24;
const ZOOM = 1.4;

export function lensMap() {
  const size = RADIUS * 2;
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x + .5 - RADIUS) / RADIUS;
      const ny = (y + .5 - RADIUS) / RADIUS;
      const bend = Math.min(1, Math.max(0, (Math.hypot(nx, ny) - .6) / .4)) ** 2;
      const offset = (y * size + x) * 4;
      pixels[offset] = 128 - nx * bend * 100;
      pixels[offset + 1] = 128 - ny * bend * 100;
      pixels[offset + 2] = 128;
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}

export function lensPosition(x, y, scrollX = 0, scrollY = 0) {
  return {
    left: x - RADIUS,
    top: y - RADIUS,
    contentX: RADIUS - (x + scrollX) * ZOOM,
    contentY: RADIUS - (y + scrollY) * ZOOM,
    zoom: ZOOM,
  };
}

export function mountLens(root, environment = window) {
  const document = root.ownerDocument;
  const field = root.querySelector('[data-signal-field]');
  const sourceCanvas = field.querySelector('canvas');
  const toggle = root.querySelector('[data-lens-toggle]');
  const label = toggle.querySelector('[data-lens-label]');
  const fine = environment.matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = environment.matchMedia('(prefers-reduced-motion: reduce)');
  const forced = environment.matchMedia('(forced-colors: active)');
  toggle.hidden = !fine.matches || forced.matches;
  const overlay = document.createElement('div');
  overlay.className = 'glass-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('inert', '');
  const lens = document.createElement('div');
  lens.className = 'glass-lens';
  const view = document.createElement('div');
  view.className = 'landing-page glass-lens-view';
  for (const element of root.querySelectorAll(':scope > .site-header, :scope > .landing-main, :scope > .landing-footer')) {
    view.append(element.cloneNode(true));
  }
  const labels = ['[data-lens-label]'];
  const regions = ['.field-model-switcher', '.explorer-nodes', '.explorer-detail', '.explorer-empty']
    .map((selector) => [root.querySelector(selector), view.querySelector(selector)])
    .filter(([source, copy]) => source && copy);
  // The lens is a non-interactive visual copy, never a second page or focus target.
  function sanitize(copy) {
    for (const element of [copy, ...copy.querySelectorAll('*')]) {
      for (const { name } of [...element.attributes]) {
        if (['id', 'name', 'href', 'role', 'tabindex', 'autofocus'].includes(name) || name.startsWith('aria-') || (name.startsWith('data-') && name !== 'data-field-ready')) {
          element.removeAttribute(name);
        }
      }
    }
    return copy;
  }
  sanitize(view);
  const mirror = view.querySelector('canvas');
  const context = mirror.getContext('2d');
  const map = document.createElement('canvas');
  map.width = map.height = RADIUS * 2;
  const mapContext = map.getContext('2d');
  if (!context || !mapContext) {
    toggle.hidden = true;
    const notice = field.querySelector('[data-field-error]');
    notice.hidden = false;
    notice.textContent = 'The glass lens is unavailable in this browser. The original page remains fully usable.';
    console.error('Landing lens: Canvas 2D is unavailable.');
    return null;
  }
  const pixels = mapContext.createImageData(map.width, map.height);
  pixels.data.set(lensMap());
  mapContext.putImageData(pixels, 0, 0);
  const svg = (tag, attributes) => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    return element;
  };
  const optics = svg('svg', { class: 'glass-optics', width: '0', height: '0' });
  const filter = svg('filter', {
    id: 'landing-liquid-refraction', filterUnits: 'userSpaceOnUse',
    x: '0', y: '0', width: String(map.width), height: String(map.height), 'color-interpolation-filters': 'sRGB',
  });
  const image = svg('feImage', { href: map.toDataURL(), width: String(map.width), height: String(map.height), result: 'lens-map' });
  const refraction = svg('feDisplacementMap', { in: 'SourceGraphic', in2: 'lens-map', scale: '10', xChannelSelector: 'R', yChannelSelector: 'G' });
  filter.append(image);
  filter.append(refraction);
  optics.append(filter);
  const surface = document.createElement('div');
  surface.className = 'glass-lens-surface';
  surface.append(view);
  lens.append(surface);
  overlay.append(optics);
  overlay.append(lens);
  root.append(overlay);
  let enabled = true;
  let inside = false;
  let activePage = true;
  let destroyed = false;
  let frame = null;
  let lastCopy = null;
  let dirty = false;
  let contentDirty = false;
  let explorerState = field.dataset.explorerState;
  const pointer = { x: 0, y: 0 };
  const liquid = { x: 0, y: 0, targetX: 0, targetY: 0 };

  function resetLiquid() {
    liquid.x = liquid.y = liquid.targetX = liquid.targetY = 0;
    lens.style.borderRadius = '50%';
    lens.style.setProperty('--glass-light-x', '26%');
    lens.style.setProperty('--glass-light-y', '20%');
    refraction.setAttribute('scale', '10');
  }

  function relaxLiquid() {
    if (!liquid.x && !liquid.y && !liquid.targetX && !liquid.targetY) return false;
    liquid.x += (liquid.targetX - liquid.x) * .35;
    liquid.y += (liquid.targetY - liquid.y) * .35;
    liquid.targetX *= .7;
    liquid.targetY *= .7;
    if (Math.max(Math.abs(liquid.x), Math.abs(liquid.y), Math.abs(liquid.targetX), Math.abs(liquid.targetY)) < .015) {
      resetLiquid();
      return false;
    }
    lens.style.borderRadius = `${50 + liquid.x}% ${50 - liquid.x}% ${50 + liquid.x}% ${50 - liquid.x}% / ${50 - liquid.y}% ${50 + liquid.y}% ${50 - liquid.y}% ${50 + liquid.y}%`;
    lens.style.setProperty('--glass-light-x', `${26 + liquid.x * 4}%`);
    lens.style.setProperty('--glass-light-y', `${20 + liquid.y * 4}%`);
    refraction.setAttribute('scale', String(10 + Math.hypot(liquid.x, liquid.y) * 1.2));
    return true;
  }

  function opticsError() {
    surface.style.filter = 'none';
    const notice = field.querySelector('[data-field-error]');
    notice.hidden = false;
    notice.textContent = 'Glass refraction could not load. The magnifier remains available.';
    console.error('Landing lens: Unable to load the local refraction map.');
  }
  image.addEventListener('error', opticsError);

  const motionPlaying = () => field.dataset.motionPlaying === undefined ? !reduced.matches : field.dataset.motionPlaying === 'true';
  const canFollow = () => enabled && inside && activePage && !destroyed && !document.hidden && fine.matches && !forced.matches && motionPlaying() && field.dataset.fieldDragging !== 'true' && field.dataset.controlsOpen !== 'true';

  function hide() {
    inside = false;
    overlay.removeAttribute('data-active');
    if (frame !== null) environment.cancelAnimationFrame(frame);
    frame = null;
    lastCopy = null;
    resetLiquid();
  }

  function schedule() {
    if (canFollow() && frame === null) frame = environment.requestAnimationFrame(render);
  }

  function render(timestamp) {
    frame = null;
    if (!canFollow()) { hide(); return; }
    const bounds = sourceCanvas.getBoundingClientRect();
    const sample = RADIUS / ZOOM;
    const overCanvas = pointer.x + sample > bounds.left && pointer.x - sample < bounds.right && pointer.y + sample > bounds.top && pointer.y - sample < bounds.bottom;
    if (dirty) {
      if (contentDirty) {
        for (const region of regions) {
          const copy = sanitize(region[0].cloneNode(true));
          region[1].replaceWith(copy);
          region[1] = copy;
        }
        contentDirty = false;
      }
      const position = lensPosition(pointer.x, pointer.y, environment.scrollX, environment.scrollY);
      lens.style.transform = `translate3d(${position.left}px, ${position.top}px, 0)`;
      view.style.transform = `translate3d(${position.contentX}px, ${position.contentY}px, 0) scale(${position.zoom})`;
      for (const selector of labels) {
        const source = root.querySelector(selector);
        const copy = view.querySelector(selector);
        if (source && copy && copy.textContent !== source.textContent) copy.textContent = source.textContent;
      }
      overlay.setAttribute('data-active', '');
      dirty = false;
    }
    if (overCanvas && sourceCanvas.width && sourceCanvas.height && (lastCopy === null || timestamp - lastCopy >= 1000 / 30)) {
      if (mirror.width !== sourceCanvas.width) mirror.width = sourceCanvas.width;
      if (mirror.height !== sourceCanvas.height) mirror.height = sourceCanvas.height;
      context.clearRect(0, 0, mirror.width, mirror.height);
      context.drawImage(sourceCanvas, 0, 0);
      for (const selector of ['.explorer-node', '.explorer-connections line', '.explorer-memories line', '.explorer-memories circle']) {
        const sources = field.querySelectorAll(selector);
        const copies = view.querySelectorAll(selector);
        for (const [index, source] of [...sources].entries()) {
          const copy = copies[index];
          if (!copy) continue;
          copy.style.cssText = source.style.cssText;
          if (selector.endsWith('line')) {
            for (const name of ['x1', 'y1', 'x2', 'y2']) copy.setAttribute(name, source.getAttribute(name));
          } else if (selector.endsWith('circle')) {
            for (const name of ['cx', 'cy']) copy.setAttribute(name, source.getAttribute(name));
          }
        }
      }
      for (const selector of ['.explorer-connections', '.explorer-memories']) {
        const source = field.querySelector(selector);
        const copy = view.querySelector(selector);
        if (source && copy) copy.setAttribute('viewBox', source.getAttribute('viewBox'));
      }
      lastCopy = timestamp;
    }
    if (relaxLiquid() || (overCanvas && field.dataset.fieldState === 'running')) schedule();
  }

  function move(event) {
    if (event.pointerType !== 'mouse') { hide(); return; }
    liquid.targetX = inside ? Math.min(5, Math.max(-5, (event.clientX - pointer.x) * .45)) : 0;
    liquid.targetY = inside ? Math.min(5, Math.max(-5, (event.clientY - pointer.y) * .45)) : 0;
    inside = true;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    dirty = true;
    schedule();
  }

  function layout() {
    view.style.width = `${root.clientWidth}px`;
    view.style.minHeight = `${root.getBoundingClientRect().height}px`;
    dirty = true;
    schedule();
  }

  function scroll() { dirty = true; schedule(); }
  function preferences() {
    toggle.hidden = !fine.matches || forced.matches;
    if (!canFollow()) hide();
  }
  function fieldState() {
    lastCopy = null;
    if (explorerState !== field.dataset.explorerState) {
      explorerState = field.dataset.explorerState;
      contentDirty = true;
      dirty = true;
    }
    preferences();
    schedule();
  }
  function change() {
    enabled = !enabled;
    toggle.setAttribute('aria-pressed', String(enabled));
    label.textContent = enabled ? 'On' : 'Off';
    hide();
  }
  function hidePage() { activePage = false; hide(); }
  function showPage() { activePage = true; }
  const resize = new environment.ResizeObserver(layout);
  resize.observe(root);
  const state = new environment.MutationObserver(fieldState);
  state.observe(field, { attributes: true, attributeFilter: ['data-motion-playing', 'data-explorer-state', 'data-field-dragging', 'data-field-state', 'data-controls-open'] });
  toggle.addEventListener('click', change);
  fine.addEventListener('change', preferences);
  reduced.addEventListener('change', hide);
  forced.addEventListener('change', preferences);
  document.addEventListener('keydown', hide);
  document.addEventListener('visibilitychange', hide);
  document.documentElement.addEventListener('pointerleave', hide);
  environment.addEventListener('pointermove', move, { passive: true });
  environment.addEventListener('scroll', scroll, { passive: true });
  environment.addEventListener('blur', hide);
  environment.addEventListener('pagehide', hidePage);
  environment.addEventListener('pageshow', showPage);
  toggle.hidden = !fine.matches || forced.matches;
  layout();

  return {
    destroy() {
      destroyed = true;
      hide();
      resize.disconnect();
      state.disconnect();
      toggle.removeEventListener('click', change);
      image.removeEventListener('error', opticsError);
      fine.removeEventListener('change', preferences);
      reduced.removeEventListener('change', hide);
      forced.removeEventListener('change', preferences);
      document.removeEventListener('keydown', hide);
      document.removeEventListener('visibilitychange', hide);
      document.documentElement.removeEventListener('pointerleave', hide);
      environment.removeEventListener('pointermove', move);
      environment.removeEventListener('scroll', scroll);
      environment.removeEventListener('blur', hide);
      environment.removeEventListener('pagehide', hidePage);
      environment.removeEventListener('pageshow', showPage);
      toggle.hidden = true;
      overlay.remove();
    },
  };
}
