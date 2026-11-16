import { mountLens } from './landing-lens.js';
import { mountTrail } from './landing-trail.js';
import { experiences, skills, mountExplorer } from './landing-explorer.js';
import { angleDelta, clamp, constellationGeometry, constellationScene, projectPoint, transitionScene, wrapAngle } from './landing-constellation.js';

export { projectPoint } from './landing-constellation.js';

const TAU = Math.PI * 2;
const mix = (a, b, amount) => a + (b - a) * amount;

export function networkGeometry() {
  const nodes = Array.from({ length: 60 }, (_, index) => {
    const latitude = 1 - 2 * (index + .5) / 60;
    const angle = index * Math.PI * (3 - Math.sqrt(5));
    const radius = .35 + .7 * ((index * 37 % 61) / 60) ** .35;
    const ring = Math.sqrt(1 - latitude * latitude);
    return {
      phase: index * .83,
      mesh: [Math.cos(angle) * ring * radius, latitude * radius, Math.sin(angle) * ring * radius],
      layers: [(Math.floor(index / 12) - 2) * .48, (index % 12 / 11 - .5) * 1.55, (index % 3 - 1) * .12],
    };
  });
  const links = new Map();
  function connect(a, b, mode) {
    const from = Math.min(a, b);
    const to = Math.max(a, b);
    const key = `${from}:${to}`;
    if (!links.has(key)) links.set(key, { from, to, mesh: false, layers: false });
    links.get(key)[mode] = true;
  }
  for (const [index, node] of nodes.entries()) {
    const nearest = nodes.map((other, target) => ({
      target,
      distance: Math.hypot(...node.mesh.map((value, axis) => value - other.mesh[axis])),
    })).filter(({ target }) => target !== index).sort((a, b) => a.distance - b.distance);
    for (const { target } of nearest.slice(0, 3)) connect(index, target, 'mesh');
    // A nearest-predecessor backbone keeps the entire mesh connected.
    if (index) connect(index, nearest.find(({ target }) => target < index).target, 'mesh');
    if (index < 48) {
      for (const offset of [-1, 0, 1]) {
        const row = index % 12 + offset;
        if (row >= 0 && row < 12) connect(index, (Math.floor(index / 12) + 1) * 12 + row, 'layers');
      }
    }
  }
  return { nodes, links: [...links.values()] };
}

export function networkPoint(node, morph, time) {
  return node.mesh.map((value, axis) => mix(value, node.layers[axis], morph) + Math.sin(time + node.phase + axis) * .015);
}

export function mountField(root, environment = window) {
  const canvas = root.querySelector('[data-field-canvas]');
  const context = canvas.getContext('2d');
  if (!context) {
    const notice = root.querySelector('[data-field-error]');
    notice.hidden = false;
    notice.textContent = 'Animated graphics are unavailable in this browser. A static network is shown; experience and skill selections still work.';
    console.error('Landing field: Canvas 2D is unavailable.');
  }
  const document = root.ownerDocument;
  const stage = root.querySelector('[data-field-stage]');
  const forms = [...root.querySelectorAll('[data-field-mode]')];
  const modelOptions = root.querySelector('[data-field-model]');
  const modelSummary = modelOptions.querySelector('summary');
  const modelLabel = root.querySelector('[data-field-model-label]');
  const options = document.querySelector('[data-field-options]');
  const summary = options.querySelector('summary');
  const reset = options.querySelector('[data-explorer-reset]');
  const status = root.querySelector('[data-field-status]');
  const reduced = environment.matchMedia('(prefers-reduced-motion: reduce)');
  const forced = environment.matchMedia('(forced-colors: active)');
  const fine = environment.matchMedia('(hover: hover) and (pointer: fine)');
  const model = networkGeometry();
  const constellations = constellationGeometry(experiences, skills);
  const left = options.querySelector('[data-field-left]');
  const right = options.querySelector('[data-field-right]');
  let visible = true;
  let pageActive = true;
  let destroyed = false;
  let frame = null;
  let pointerFocusFrame = null;
  let lastTime = null;
  let width = 1;
  let height = 1;
  let mode = 'experience';
  let drag = null;
  let suppressClick = false;
  let expanded = null;
  let discovered = [];
  let unfold = 1;
  let transition = 1;
  let transitionFrom = new Map();
  let lastScene = null;
  const camera = { yaw: 0, pitch: .12 };
  const targetCamera = { ...camera };
  let explorer = null;
  const pointer = { x: 0, y: 0, active: false };
  const tilt = { x: 0, y: 0 };

  const motionAllowed = () => Boolean(context) && !reduced.matches && !forced.matches;
  const canAnimate = () => motionAllowed() && visible && pageActive && !document.hidden && !destroyed;
  const needsMotion = () => Math.abs(angleDelta(camera.yaw, targetCamera.yaw)) > .0001 ||
    Math.abs(camera.pitch - targetCamera.pitch) > .0001 || transition < 1 || unfold < 1 ||
    Math.abs(tilt.x - pointer.x) > .001 || Math.abs(tilt.y - pointer.y) > .001;

  function schedule() {
    if (canAnimate() && needsMotion() && frame === null) {
      root.dataset.fieldState = 'running';
      frame = environment.requestAnimationFrame(tick);
    }
  }

  function draw() {
    let scene = constellationScene(constellations, {
      mode, expanded, discovered, unfold, camera, width, height,
    });
    if (transition < 1) scene = transitionScene(scene, transitionFrom, transition);
    lastScene = scene;
    explorer?.updateScene(scene);
    root.dataset.fieldYaw = camera.yaw.toFixed(4);
    if (!context) return;
    context.clearRect(0, 0, width, height);
    const size = Math.min(width, height) * .39;
    const time = 0;
    const rotation = camera.yaw;
    const points = model.nodes.map((node) => {
      const point = projectPoint(networkPoint(node, 0, time), rotation, { x: tilt.x * .2, y: (camera.pitch - .32) / .22 + tilt.y * .2 }, size);
      point.x += width / 2;
      point.y += height / 2;
      point.energy = 0;
      if (pointer.active && canAnimate()) {
        const dx = point.x - (pointer.x + 1) * width / 2;
        const dy = point.y - (pointer.y + 1) * height / 2;
        point.energy = Math.max(0, 1 - Math.hypot(dx, dy) / (size * .65));
        point.x += dx * point.energy * .1;
        point.y += dy * point.energy * .1;
      }
      return point;
    });
    for (const [index, link] of model.links.entries()) {
      if (!link.mesh) continue;
      const from = points[link.from];
      const to = points[link.to];
      const depth = clamp(((from.depth + to.depth) / 2 + 1.2) / 2.4, 0, 1);
      const energy = Math.max(from.energy, to.energy);
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.strokeStyle = `rgba(255,255,255,${.018 + depth * .035 + energy * .08})`;
      context.lineWidth = .55 + energy * .6;
      context.stroke();
      if (index % 9 === 0) {
        const progress = (time * .75 + index * .137) % 1;
        context.beginPath();
        context.arc(mix(from.x, to.x, progress), mix(from.y, to.y, progress), 1 + depth * .6, 0, TAU);
        context.fillStyle = 'rgba(255,255,255,.3)';
        context.fill();
      }
    }
    for (const { point, index } of points.map((point, index) => ({ point, index })).sort((a, b) => a.point.depth - b.point.depth)) {
      const depth = clamp((point.depth + 1.2) / 2.4, 0, 1);
      const radius = .8 + depth * .65 + point.energy * .3;
      if (point.energy > .2) {
        context.beginPath();
        context.arc(point.x, point.y, radius + 7, 0, TAU);
        context.fillStyle = `rgba(255,255,255,${.025 + point.energy * .045})`;
        context.fill();
        context.beginPath();
        context.arc(point.x, point.y, radius + 3, 0, TAU);
        context.strokeStyle = `rgba(255,255,255,${.12 + point.energy * .25})`;
        context.lineWidth = .65;
        context.stroke();
      }
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, TAU);
      context.fillStyle = `rgba(255,255,255,${.12 + depth * .22 + point.energy * .1})`;
      context.fill();
    }
  }

  function tick(timestamp) {
    frame = null;
    if (!canAnimate()) return;
    if (lastTime === null || timestamp - lastTime >= 1000 / 30) {
      const delta = lastTime === null ? 1000 / 30 : Math.min(timestamp - lastTime, 80);
      lastTime = timestamp;
      const turn = clamp(angleDelta(camera.yaw, targetCamera.yaw) * .11, -delta * .0012, delta * .0012);
      camera.yaw = wrapAngle(camera.yaw + turn);
      camera.pitch = mix(camera.pitch, targetCamera.pitch, .11);
      transition = Math.min(1, transition + delta / 700);
      if (transition === 1) unfold = Math.min(1, unfold + delta / 950);
      tilt.x = mix(tilt.x, pointer.x, .09);
      tilt.y = mix(tilt.y, pointer.y, .09);
      draw();
    }
    if (needsMotion()) schedule();
    else {
      lastTime = null;
      root.dataset.fieldState = 'idle';
    }
  }

  function sync() {
    if (frame !== null) environment.cancelAnimationFrame(frame);
    frame = null;
    lastTime = null;
    root.dataset.fieldState = canAnimate() ? 'idle' : motionAllowed() ? 'suspended' : 'static';
    root.dataset.motionPlaying = String(motionAllowed());
    if (canAnimate()) schedule();
    else {
      Object.assign(camera, targetCamera);
      Object.assign(tilt, { x: pointer.x, y: pointer.y });
      unfold = 1;
      transition = 1;
      draw();
    }
  }

  function resize() {
    const bounds = stage.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    const ratio = Math.min(environment.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }

  function move(event) {
    if (!canAnimate() || !fine.matches || event.pointerType !== 'mouse') return;
    const bounds = stage.getBoundingClientRect();
    pointer.x = clamp((event.clientX - bounds.left) / width * 2 - 1, -1.2, 1.2);
    pointer.y = clamp((event.clientY - bounds.top) / height * 2 - 1, -1.2, 1.2);
    pointer.active = true;
    schedule();
  }

  function leave() { pointer.x = 0; pointer.y = 0; pointer.active = false; schedule(); }
  function explorerChanged(next) {
    discovered = next.discovered;
    const nextExpanded = next.expanded ? next.experience : null;
    const changed = expanded !== nextExpanded;
    const resetView = next.source === 'reset' || next.source === 'mode';
    const animate = canAnimate() && (next.animate || resetView);
    if (lastScene && animate && (changed || resetView)) {
      transitionFrom = new Map([...lastScene.nodes, ...lastScene.traces.flatMap(({ nodes }) => nodes)].map((star) => [star.id, { ...star }]));
      transition = 0;
    }
    expanded = nextExpanded;
    if (changed && expanded) {
      targetCamera.yaw = wrapAngle(constellations.groups.find(({ id }) => id === expanded).angle + .35);
      targetCamera.pitch = .12;
      unfold = next.animate && canAnimate() ? 0 : 1;
    }
    if (resetView) {
      targetCamera.yaw = 0;
      targetCamera.pitch = .12;
    }
    if (!canAnimate() || !next.animate) {
      Object.assign(camera, targetCamera);
      unfold = 1;
      transition = 1;
    }
    draw();
    schedule();
  }
  function rotate(amount, immediate = false) {
    targetCamera.yaw = wrapAngle(targetCamera.yaw + amount);
    if (immediate || !canAnimate()) Object.assign(camera, targetCamera);
    draw();
    schedule();
  }
  function selectLeft() { explorer?.selectAdjacent(-1); }
  function selectRight() { explorer?.selectAdjacent(1); }
  function startDrag(event) {
    if (drag || event.isPrimary === false || event.button !== 0) return;
    suppressClick = false;
    drag = { id: event.pointerId, type: event.pointerType, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, active: false };
  }
  function dragMove(event) {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.active) {
      if (Math.hypot(dx, dy) < 6 || (drag.type === 'touch' && Math.abs(dx) <= Math.abs(dy))) return;
      drag.active = true;
      stage.setPointerCapture(event.pointerId);
      root.dataset.fieldDragging = 'true';
    }
    event.preventDefault();
    camera.yaw = wrapAngle(camera.yaw - (event.clientX - drag.lastX) * .007);
    if (drag.type !== 'touch') camera.pitch = clamp(camera.pitch + (event.clientY - drag.lastY) * .003, -.38, .48);
    Object.assign(targetCamera, camera);
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    draw();
  }
  function endDrag(event) {
    if (!drag || (event?.pointerId !== undefined && event.pointerId !== drag.id)) return;
    const ended = drag;
    drag = null;
    suppressClick = ended.active;
    root.dataset.fieldDragging = 'false';
    if (stage.hasPointerCapture(ended.id)) stage.releasePointerCapture(ended.id);
  }
  function preventDragClick(event) {
    if (!suppressClick) return;
    suppressClick = false;
    if (event.detail === 0) return;
    event.preventDefault();
    event.stopPropagation();
  }
  function preventNativeDrag(event) { event.preventDefault(); }
  function orbitKey(event) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const direction = event.key === 'ArrowLeft' ? -1 : 1;
      if (event.shiftKey) rotate(direction * .3);
      else explorer?.selectAdjacent(direction);
    } else if (event.key === 'Tab') {
      Object.assign(camera, targetCamera);
      unfold = 1;
      transition = 1;
      draw();
    }
  }
  function changeForm(event) {
    const next = event.currentTarget.dataset.fieldMode;
    closeModel(true);
    if (mode === next) return;
    mode = next;
    const isSkills = mode === 'skills';
    const name = isSkills ? 'Skills' : 'Career';
    root.dataset.fieldForm = isSkills ? 'skills' : 'network';
    status.textContent = `Current model: ${name}.`;
    stage.setAttribute('aria-label', `My ${name.toLowerCase()} constellation`);
    modelLabel.textContent = name;
    for (const button of forms) button.setAttribute('aria-pressed', String(button.dataset.fieldMode === mode));
    explorer?.setMode(mode);
    if (!canAnimate()) draw();
  }
  function preferences() {
    leave();
    sync();
  }
  function closeOptions(restoreFocus = false) {
    options.open = false;
    if (restoreFocus) summary.focus({ preventScroll: true });
  }
  function closeModel(restoreFocus = false) {
    modelOptions.open = false;
    if (restoreFocus) modelSummary.focus({ preventScroll: true });
  }
  function optionsKey(event) {
    if (event.key === 'Escape' && (options.open || modelOptions.open)) {
      event.preventDefault();
      event.stopPropagation();
      if (modelOptions.open) closeModel(true);
      else closeOptions(true);
    }
  }
  function outsideOptions(event) {
    if (pointerFocusFrame !== null) environment.cancelAnimationFrame(pointerFocusFrame);
    pointerFocusFrame = null;
    let restore;
    for (const [pane, trigger] of [[options, summary], [modelOptions, modelSummary]]) {
      if (!pane.open || pane.contains(event.target)) continue;
      if (pane.contains(document.activeElement)) restore = trigger;
      pane.open = false;
    }
    if (restore) {
      restore.focus({ preventScroll: true });
      pointerFocusFrame = environment.requestAnimationFrame(() => {
        pointerFocusFrame = null;
        // Native pointer focus can undo restoration when the outside target is not focusable.
        if (!destroyed && document.activeElement === document.body) restore.focus({ preventScroll: true });
      });
    }
  }
  function optionsChanged(event) {
    if (event.currentTarget.open) {
      if (event.currentTarget === modelOptions) closeOptions();
      else closeModel();
    }
    root.dataset.controlsOpen = String(options.open || modelOptions.open);
  }
  function restarted() { closeOptions(true); }
  function loseFocus() { endDrag(); leave(); }
  function visibility() { if (document.hidden) loseFocus(); sync(); }
  function hidePage() { endDrag(); pageActive = false; sync(); }
  function showPage() { pageActive = true; sync(); }

  const resizeObserver = new environment.ResizeObserver(resize);
  resizeObserver.observe(stage);
  const intersection = new environment.IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
  intersection.observe(root);
  for (const button of forms) button.addEventListener('click', changeForm);
  document.addEventListener('keydown', optionsKey, true);
  document.addEventListener('pointerdown', outsideOptions);
  options.addEventListener('toggle', optionsChanged);
  modelOptions.addEventListener('toggle', optionsChanged);
  reset.addEventListener('click', restarted);
  reduced.addEventListener('change', preferences);
  forced.addEventListener('change', preferences);
  document.addEventListener('visibilitychange', visibility);
  environment.addEventListener('pointermove', move, { passive: true });
  environment.addEventListener('blur', loseFocus);
  environment.addEventListener('pagehide', hidePage);
  environment.addEventListener('pageshow', showPage);
  stage.addEventListener('pointerleave', leave);
  stage.addEventListener('pointerdown', startDrag);
  stage.addEventListener('dragstart', preventNativeDrag);
  stage.addEventListener('pointermove', dragMove);
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('lostpointercapture', endDrag);
  stage.addEventListener('click', preventDragClick, true);
  stage.addEventListener('keydown', orbitKey);
  left?.addEventListener('click', selectLeft);
  right?.addEventListener('click', selectRight);
  explorer = mountExplorer(root, explorerChanged);
  root.querySelector('[data-field-controls]').hidden = false;
  options.hidden = false;
  if (context) root.dataset.fieldReady = '';
  root.dataset.fieldForm = 'network';
  resize();
  sync();

  return {
    destroy() {
      destroyed = true;
      if (pointerFocusFrame !== null) environment.cancelAnimationFrame(pointerFocusFrame);
      endDrag();
      sync();
      resizeObserver.disconnect();
      intersection.disconnect();
      explorer?.destroy();
      for (const button of forms) button.removeEventListener('click', changeForm);
      document.removeEventListener('keydown', optionsKey, true);
      document.removeEventListener('pointerdown', outsideOptions);
      options.removeEventListener('toggle', optionsChanged);
      modelOptions.removeEventListener('toggle', optionsChanged);
      reset.removeEventListener('click', restarted);
      reduced.removeEventListener('change', preferences);
      forced.removeEventListener('change', preferences);
      document.removeEventListener('visibilitychange', visibility);
      environment.removeEventListener('pointermove', move);
      environment.removeEventListener('blur', loseFocus);
      environment.removeEventListener('pagehide', hidePage);
      environment.removeEventListener('pageshow', showPage);
      stage.removeEventListener('pointerleave', leave);
      stage.removeEventListener('pointerdown', startDrag);
      stage.removeEventListener('dragstart', preventNativeDrag);
      stage.removeEventListener('pointermove', dragMove);
      stage.removeEventListener('pointerup', endDrag);
      stage.removeEventListener('pointercancel', endDrag);
      stage.removeEventListener('lostpointercapture', endDrag);
      stage.removeEventListener('click', preventDragClick, true);
      stage.removeEventListener('keydown', orbitKey);
      left?.removeEventListener('click', selectLeft);
      right?.removeEventListener('click', selectRight);
    },
  };
}

if (typeof document !== 'undefined') {
  const root = document.querySelector('[data-signal-field]');
  if (root) {
    mountField(root);
    if (root.hasAttribute('data-field-ready')) {
      mountLens(document.body);
      mountTrail(document.body);
    }
  }
}
