const GAP = 8;
const RADIUS = 56;
const LIFETIME = 1100;
const MAX_CELLS = 2400;

export function mountTrail(root, environment = window) {
  const document = root.ownerDocument;
  const field = root.querySelector('[data-signal-field]');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    const notice = field.querySelector('[data-field-error]');
    notice.hidden = false;
    notice.textContent = 'The pixel trail is unavailable in this browser. The rest of the page remains fully usable.';
    console.error('Landing trail: Canvas 2D is unavailable.');
    return null;
  }
  canvas.className = 'cursor-trail';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('inert', '');
  canvas.hidden = true;
  root.append(canvas);
  const fine = environment.matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = environment.matchMedia('(prefers-reduced-motion: reduce)');
  const forced = environment.matchMedia('(forced-colors: active)');
  const cells = new Map();
  let width = 1;
  let height = 1;
  let frame = null;
  let lastDraw = null;
  let pending = null;
  let previous = null;
  let activePage = true;
  let destroyed = false;

  const canPaint = () => !destroyed && activePage && !document.hidden && fine.matches && !forced.matches && field.dataset.motionPlaying === 'true';

  function clear() {
    if (frame !== null) environment.cancelAnimationFrame(frame);
    frame = null;
    lastDraw = null;
    pending = previous = null;
    cells.clear();
    context.clearRect(0, 0, width, height);
    canvas.hidden = true;
  }

  function schedule() {
    if (canPaint() && frame === null) frame = environment.requestAnimationFrame(render);
  }

  function stamp(x, y, timestamp) {
    const left = Math.max(0, Math.floor((x - RADIUS) / GAP));
    const right = Math.min(Math.floor((width - 1) / GAP), Math.ceil((x + RADIUS) / GAP));
    const top = Math.max(0, Math.floor((y - RADIUS) / GAP));
    const bottom = Math.min(Math.floor((height - 1) / GAP), Math.ceil((y + RADIUS) / GAP));
    for (let row = top; row <= bottom; row++) {
      for (let column = left; column <= right; column++) {
        const distance = Math.hypot(column * GAP - x, row * GAP - y);
        const grain = (((column * 73856093) ^ (row * 19349663)) >>> 0) % 101 / 100;
        if (distance >= RADIUS || grain < .25) continue;
        const key = `${column},${row}`;
        const existing = cells.get(key);
        const faded = existing ? existing.alpha * Math.max(0, 1 - (timestamp - existing.born) / LIFETIME) ** 2 : 0;
        // Refresh insertion order so the hard cap drops the oldest trail first.
        cells.delete(key);
        cells.set(key, {
          x: column * GAP, y: row * GAP, born: timestamp,
          alpha: Math.max(faded, (.1 + grain * .08) * (1 - distance / RADIUS)),
          size: grain > .7 ? 3 : 2,
        });
      }
    }
    while (cells.size > MAX_CELLS) cells.delete(cells.keys().next().value);
  }

  function render(timestamp) {
    frame = null;
    if (!canPaint()) { clear(); return; }
    if (lastDraw !== null && timestamp - lastDraw < 1000 / 30) { schedule(); return; }
    lastDraw = timestamp;
    if (pending) {
      const start = previous ?? pending;
      const steps = Math.min(32, Math.max(1, Math.ceil(Math.hypot(pending.x - start.x, pending.y - start.y) / GAP)));
      for (let step = 1; step <= steps; step++) {
        stamp(start.x + (pending.x - start.x) * step / steps, start.y + (pending.y - start.y) * step / steps, timestamp);
      }
      previous = pending;
      pending = null;
    }
    context.clearRect(0, 0, width, height);
    for (const [key, cell] of cells) {
      const age = timestamp - cell.born;
      if (age >= LIFETIME) { cells.delete(key); continue; }
      const alpha = cell.alpha * (1 - age / LIFETIME) ** 2;
      context.fillStyle = `rgba(255,255,255,${alpha})`;
      context.fillRect(cell.x, cell.y, cell.size, cell.size);
    }
    canvas.hidden = cells.size === 0;
    if (cells.size) schedule();
    else { previous = null; lastDraw = null; }
  }

  function move(event) {
    if (!canPaint() || event.pointerType !== 'mouse') { clear(); return; }
    if (event.clientX < 0 || event.clientX > width || event.clientY < 0 || event.clientY > height) { clear(); return; }
    pending = { x: event.clientX, y: event.clientY };
    schedule();
  }

  function resize() {
    clear();
    width = Math.max(1, document.documentElement.clientWidth);
    height = Math.max(1, environment.innerHeight);
    const ratio = Math.min(environment.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  function preferences() { if (!canPaint()) clear(); }
  function hidePage() { activePage = false; clear(); }
  function showPage() { activePage = true; }
  const state = new environment.MutationObserver(preferences);
  state.observe(field, { attributes: true, attributeFilter: ['data-motion-playing'] });
  fine.addEventListener('change', preferences);
  reduced.addEventListener('change', clear);
  forced.addEventListener('change', preferences);
  document.addEventListener('keydown', clear);
  document.addEventListener('visibilitychange', clear);
  document.documentElement.addEventListener('pointerleave', clear);
  environment.addEventListener('pointermove', move, { passive: true });
  environment.addEventListener('resize', resize);
  environment.addEventListener('scroll', clear, { passive: true });
  environment.addEventListener('blur', clear);
  environment.addEventListener('pagehide', hidePage);
  environment.addEventListener('pageshow', showPage);
  resize();

  return {
    destroy() {
      destroyed = true;
      clear();
      state.disconnect();
      fine.removeEventListener('change', preferences);
      reduced.removeEventListener('change', clear);
      forced.removeEventListener('change', preferences);
      document.removeEventListener('keydown', clear);
      document.removeEventListener('visibilitychange', clear);
      document.documentElement.removeEventListener('pointerleave', clear);
      environment.removeEventListener('pointermove', move);
      environment.removeEventListener('resize', resize);
      environment.removeEventListener('scroll', clear);
      environment.removeEventListener('blur', clear);
      environment.removeEventListener('pagehide', hidePage);
      environment.removeEventListener('pageshow', showPage);
      canvas.remove();
    },
  };
}
