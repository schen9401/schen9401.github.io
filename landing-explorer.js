// Projects and the first seven skills: Misc frames 1:492 and 1:476.
// Company overviews and Toast/Microsoft dates follow the user's brief.
// Toast slice (opaque white outline): https://brandfolder.com/toast/media-kit/#!asset/7fvnspg4k88j2r2q8ffmff6
// Bevi white logo: https://brandfolder.com/bevi-1/partner-marketing-hub/#!asset/jcmc9ps8q725vkf7gcnskbh
// Bevi's original white wordmark is presented on its official blue (#246eff).
// GoTo logo: original white/yellow footer SVG from https://www.goto.com/
export const experiences = [
  {
    id: 'toast', label: 'Toast', role: 'Senior product designer', year: '2021–2024',
    description: 'I led Toast’s all-in-one POS system to streamline restaurant operations, reimagining payments and closeout for servers and the admin home and global navigation for managers to accelerate efficiency and growth.',
    highlights: ['all-in-one POS system', 'payments', 'closeout', 'admin home', 'global navigation'],
    image: 'assets/work/toast-logo.svg', imageKind: 'logo', alt: 'Toast logo.',
    href: 'work/toast-closeout.html', x: 18, y: 23,
    projects: [
      { id: 'closeout', label: 'Closeout', title: 'Check-centered closeout', description: 'A clearer path through tip entry and check closure on Toast POS.', image: 'presentation/assets/check-closeout.png', alt: 'Toast closeout with checks and a payment-specific tip-entry panel.', href: 'work/toast-closeout.html', kind: 'Case study' },
      { id: 'cash', label: 'Cash Drawer', title: 'Cash Drawer 2.0', description: 'Clearer drawer states, prioritized actions and a shared view of restaurant cash activity.', image: 'assets/work/cash-drawer-overview.png', alt: 'Toast cash-drawer overview and restaurant activity summary.', href: 'work/toast-cash-drawer.html', kind: 'Case study' },
      { id: 'web', label: 'Toast Web', title: 'Toast Web', description: 'Navigation, product pages and alerts for the restaurant-manager administration platform.', image: 'assets/work/toast-web-preview.png', alt: 'Source Toast Web navigation and administration interface.', href: 'work/#toast-web', kind: 'Brief snapshot' },
      { id: 'pos', label: 'POS dashboard', title: 'POS dashboard', description: 'Digestible sales and labor information for managers during service.', href: 'work/#pos-dashboard', kind: 'Brief snapshot' },
    ],
  },
  {
    id: 'goto', label: 'GoTo', role: 'Product designer', year: '2019–2021',
    description: 'I revamped GoTo’s call-center dashboards and intelligence tools, and crafted a multi-device telephony platform to boost engagement, strengthen retention, and fuel business growth.',
    image: 'assets/work/goto-logo.svg', imageKind: 'logo', alt: 'GoTo logo.',
    href: 'work/goto-wallboard.html', x: 18, y: 50,
    projects: [
      { id: 'wallboard', label: 'Wallboard', title: 'Configurable wallboard', description: 'Choosing metrics, managing boards and sharing a real-time team view.', image: 'assets/work/wallboard-cast.jpg', alt: 'GoTo wallboard with configurable contact-center metrics.', href: 'work/goto-wallboard.html', kind: 'Case study' },
      { id: 'conversation', label: 'Conversation AI', title: 'Conversation intelligence', description: 'A sales concept demo connecting call recordings, transcripts and keyword search; not a production launch.', image: 'assets/work/conversation-transcripts.jpg', alt: 'Conversation intelligence concept demo with a transcript and call player.', href: 'work/goto-conversation-intelligence.html', kind: 'Concept demo' },
      { id: 'grasshopper', label: 'Grasshopper', title: 'Business calls, anywhere', description: 'A multi-platform virtual phone system separating business and personal calls.', href: 'work/#grasshopper', kind: 'Brief snapshot' },
      { id: 'supervisor', label: 'Supervisor', title: 'Supervisor dashboard', description: 'Real-time analytics and actionable views for contact-center supervisors.', href: 'work/#supervisor-dashboard', kind: 'Brief snapshot' },
      { id: 'dialer', label: 'Outbound dialer', title: 'Outbound dialer', description: 'Moving missed calls into an outbound campaign and dialing for available agents.', href: 'work/#outbound-dialer', kind: 'Brief snapshot' },
    ],
  },
  {
    id: 'bevi', label: 'Bevi', role: 'Solo UX/UI designer', year: '2017–2019',
    description: 'I reimagine hydration through IoT, turning the smart water cooler into a personal, connected experience.',
    image: 'assets/work/bevi-logo.svg', imageKind: 'logo', alt: 'Bevi logo.',
    href: 'work/#bevi', x: 18, y: 77,
    projects: [
      { id: 'dispensing', label: 'Dispensing & service', title: 'A more personal pour', description: 'Personalized dispensing, technician installation and service tools for stocking, activity and issue alerts.', image: 'assets/work/bevi-device.png', alt: 'Source Bevi standing and countertop beverage-machine designs.', href: 'work/#bevi', kind: 'Brief snapshot' },
      { id: 'next-machine', label: 'Next-gen machine', title: 'Next-generation machine', description: 'Machine innovation named in the source experience slide. The linked Bevi snapshot provides the broader project context, not a separate full case study.', href: 'work/#bevi', kind: 'Source overview' },
    ],
  },
  {
    id: 'microsoft', label: 'Microsoft', title: 'Microsoft', role: 'Senior product designer', year: '2024–now',
    description: 'I reimagine Copilot sales agents across web and native mobile in M365, Outlook, and Dynamics 365, modernize Legacy D365 with the cross-platform canvas agentic framework and Arc design language, and lead and own the studio’s Sales vibecoding toolkit.',
    highlights: ['sales agents', 'web', 'native mobile', 'canvas agentic framework', 'vibecoding toolkit'],
    image: 'assets/work/microsoft-logo.svg', imageKind: 'logo', alt: 'Microsoft logo.',
    href: 'resume/', link: 'View résumé',
    projects: [],
  },
];

export const skills = [
  { id: 'iot', label: 'IoT design', title: 'IoT design experience', description: 'Connected hardware, dispensing and servicing experiences at Bevi.', image: 'assets/work/bevi-device.png', alt: 'Bevi connected beverage machines.', href: 'work/#bevi', link: 'Explore Bevi', x: 22, y: 16 },
  { id: 'responsive', label: 'Responsive web', title: 'Responsive web', description: 'Web navigation and administration experiences, including Toast Web.', image: 'assets/work/toast-web-preview.png', alt: 'Toast Web administration interface.', href: 'work/#toast-web', link: 'Explore Toast Web', x: 65, y: 13 },
  { id: 'multi-device', label: 'Multi-device', title: 'Multi-device design', description: 'Experiences across software and hardware, from restaurant POS to connected devices.', image: 'presentation/assets/check-closeout.png', alt: 'Toast POS closeout interface.', href: 'work/toast-closeout.html', link: 'Explore Toast POS', x: 81, y: 43 },
  { id: 'game', label: 'Game design', title: 'Game design experience', description: 'Cattia: gameplay structure, player flows and a visual system for a world of cats and buildings.', image: 'assets/work/cattia-world.png', alt: 'Cattia isometric island with cat-themed buildings.', href: 'work/cattia.html', link: 'Explore Cattia', x: 62, y: 76 },
  { id: 'illustration', label: 'Animation & illustration', title: 'Animation & illustration', href: 'https://www.figma.com/design/LlMnARhmKoI1oPOmYEXp77/Misc?node-id=1-476', link: 'View source slide in Figma', x: 20, y: 80 },
  { id: 'research', label: 'Research', title: 'Research', href: 'resume/', link: 'View résumé', x: 16, y: 48 },
  { id: 'mentoring', label: 'Mentoring', title: 'Mentoring', description: 'Community mentoring.', href: 'resume/', link: 'View résumé', x: 47, y: 44 },
  { id: 'vibe-coding', label: 'Vibe-coding', title: 'Vibe-coding', description: 'AI-assisted coding to turn design ideas into working prototypes.', href: 'work/', link: 'Explore my work', northStar: true },
];

export function mountExplorer(root, onChange = () => {}) {
  const graph = root.querySelector('[data-explorer-nodes]');
  if (!graph) return null;
  const document = root.ownerDocument;
  const detail = root.querySelector('[data-explorer-detail]');
  const empty = root.querySelector('[data-explorer-empty]');
  const reset = document.querySelector('[data-explorer-reset]');
  const announcement = root.querySelector('[data-explorer-status]');
  const state = { mode: 'experience', experience: null, expanded: false, item: null, pinned: false };
  const discovered = new Set();
  let version = 0;
  let primary;
  let projects;
  let connections;
  let memories;
  let memoryKey = null;
  let memoryLines = [];
  let memoryStars = [];
  let nodeElements = new Map();
  let edgeElements = [];

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function nodeButton(item, kind, index) {
    const button = element('button', `explorer-node explorer-node--${kind}`);
    button.type = 'button';
    button.dataset.node = item.id;
    button.dataset.kind = kind;
    if (kind === 'skills' && item.northStar) button.classList.add('explorer-node--north-star');
    button.style.setProperty('--star-delay', `${index * -1.35}s`);
    const hasProjects = kind === 'experience' && item.projects.length > 0;
    button.setAttribute('aria-controls', hasProjects ? 'explorer-projects explorer-detail' : 'explorer-detail');
    button.setAttribute(hasProjects ? 'aria-expanded' : 'aria-pressed', 'false');
    const dot = element('span', 'explorer-dot');
    dot.setAttribute('aria-hidden', 'true');
    const label = element('span', 'explorer-node-label', item.label);
    if (item.label.includes('/')) {
      label.textContent = '';
      item.label.split('/').forEach((part, index, parts) => {
        label.append(element('span', '', part + (index < parts.length - 1 ? '/' : '')));
        if (index < parts.length - 1) label.append(element('wbr', ''));
      });
    }
    button.append(dot, label);
    if (kind === 'experience') {
      button.append(element('span', 'explorer-node-date', ` ${item.year}`));
      button.append(element('span', 'visually-hidden explorer-chapter-state'));
    }
    nodeElements.set(item.id, button);
    return button;
  }

  function buildGraph() {
    graph.replaceChildren();
    nodeElements = new Map();
    connections = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    connections.setAttribute('viewBox', '0 0 100 100');
    connections.setAttribute('preserveAspectRatio', 'none');
    connections.setAttribute('aria-hidden', 'true');
    connections.classList.add('explorer-connections');
    memories = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    memories.setAttribute('aria-hidden', 'true');
    memories.classList.add('explorer-memories');
    memoryKey = null;
    memoryLines = [];
    memoryStars = [];
    primary = element('div', 'explorer-primary');
    primary.setAttribute('role', 'group');
    primary.setAttribute('aria-label', state.mode === 'experience' ? 'Career chapters' : 'Design and UX skills');
    projects = element('div', 'explorer-projects');
    projects.id = 'explorer-projects';
    projects.setAttribute('role', 'group');
    projects.setAttribute('aria-label', 'Projects');
    projects.hidden = true;
    for (const [index, item] of (state.mode === 'experience' ? experiences : skills).entries()) {
      primary.append(nodeButton(item, state.mode, index));
    }
    graph.append(memories, connections, primary, projects);
  }

  function connect(from, to) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.classList.toggle('is-selected', state.item === from || state.item === to);
    connections.append(line);
    edgeElements.push(line);
  }

  function renderConnections() {
    connections.replaceChildren();
    edgeElements = [];
    if (state.mode === 'experience') {
      const experience = experiences.find(({ id }) => id === state.experience);
      if (experience && state.expanded) {
        for (const [index, project] of experience.projects.entries()) {
          connect(index ? experience.projects[index - 1].id : experience.id, project.id);
        }
      }
    }
  }

  function renderDetail() {
    const experience = experiences.find(({ id }) => id === state.experience);
    const item = state.mode === 'skills' ? skills.find(({ id }) => id === state.item) : experience?.projects.find(({ id }) => id === state.item);
    const content = item || experience;
    empty.hidden = Boolean(content);
    detail.classList.toggle('has-image', Boolean(content?.image));
    if (!content) {
      detail.replaceChildren();
      return;
    }
    const parts = [];
    if (content?.image) {
      const visual = element('div', 'explorer-visual');
      const image = element('img', 'explorer-image');
      const isLogo = content.imageKind === 'logo';
      image.classList.toggle('explorer-image--logo', isLogo);
      image.src = content.image;
      image.alt = content.alt;
      image.width = isLogo ? 102 : 124;
      image.height = 102;
      visual.append(image);
      parts.push(visual);
    }
    const copy = element('div', 'explorer-detail-copy');
    const heading = element('div', 'explorer-heading');
    heading.append(element('h2', 'explorer-title', state.mode === 'skills' ? content.label : item ? content.title : experience.label));
    if (state.mode === 'experience') {
      if (!item) {
        heading.classList.add('explorer-heading--experience');
        const separator = element('span', 'explorer-heading-separator', ' · ');
        separator.setAttribute('aria-hidden', 'true');
        heading.append(separator);
      }
      heading.append(element('p', 'explorer-kicker', item ? `${experience.label} · ${item.kind}` : `${experience.role} · ${experience.year}`));
    }
    copy.append(heading);
    if (content.description) {
      const description = element('p', 'explorer-description');
      let start = 0;
      for (const highlight of content.highlights || []) {
        const index = content.description.indexOf(highlight, start);
        if (index === -1) throw new Error(`Explorer description is missing highlight: ${highlight}`);
        description.append(document.createTextNode(content.description.slice(start, index)), element('strong', '', highlight));
        start = index + highlight.length;
      }
      description.append(document.createTextNode(content.description.slice(start)));
      copy.append(description);
    }
    const link = element('a', 'explorer-link', content.link || (item ? item.kind === 'Case study' || item.kind === 'Concept demo' ? 'Read the case study' : 'View project overview' : `Explore ${experience.label} work`));
    link.href = content.href;
    if (content.href.startsWith('https:')) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.append(element('span', 'visually-hidden', ' (opens in a new tab; Figma access may be required)'));
    }
    const arrow = element('span', '', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    link.append(arrow);
    copy.append(link);
    parts.push(copy);
    detail.replaceChildren(...parts);
  }

  function render(source = 'preview', animate = false) {
    for (const button of primary.querySelectorAll('button')) {
      if (button.dataset.kind !== state.mode) continue;
      const selected = state.mode === 'experience' ? state.experience === button.dataset.node : state.item === button.dataset.node;
      button.classList.toggle('is-selected', selected);
      button.classList.toggle('is-expanded', selected && state.expanded);
      button.classList.toggle('is-muted', state.mode === 'experience' && state.expanded && !selected);
      button.classList.toggle('is-pinned', selected && state.pinned);
      button.classList.toggle('is-discovered', state.mode === 'experience' && discovered.has(button.dataset.node));
      const chapterState = button.querySelector('.explorer-chapter-state');
      if (chapterState) chapterState.textContent = discovered.has(button.dataset.node) ? ' (explored chapter)' : '';
      if (button.getAttribute('aria-expanded') !== null) button.setAttribute('aria-expanded', String(selected && state.expanded));
      else button.setAttribute('aria-pressed', String(selected && state.pinned));
    }
    for (const button of projects.querySelectorAll('button')) {
      button.classList.toggle('is-selected', state.item === button.dataset.node);
      button.classList.toggle('is-pinned', state.item === button.dataset.node && state.pinned);
      button.setAttribute('aria-pressed', String(state.item === button.dataset.node && state.pinned));
    }
    renderConnections();
    renderDetail();
    root.dataset.explorerState = String(++version);
    onChange({ ...state, discovered: [...discovered], source, animate });
  }

  function select(button, { pin = false, focus = false, animate = false, browse = false } = {}) {
    const kind = button.dataset.kind;
    const id = button.dataset.node;
    if (!pin && state.pinned) return;
    if (focus && (kind === 'experience' ? state.experience === id && !state.item : state.item === id)) return;
    if (kind === 'experience') {
      const same = state.experience === id;
      const expanded = browse || (pin ? !(same && state.expanded) : same && state.expanded);
      if (same && state.expanded === expanded && !state.item) return;
      const experience = experiences.find((item) => item.id === id);
      if (projects.contains(document.activeElement)) button.focus({ preventScroll: true });
      state.experience = id;
      state.expanded = expanded;
      if (expanded) discovered.add(id);
      for (const project of experiences.flatMap((item) => item.projects)) nodeElements.delete(project.id);
      projects.replaceChildren(...(expanded ? experience.projects.map((project, index) => nodeButton(project, 'project', index)) : []));
      projects.hidden = !expanded || !experience.projects.length;
      projects.setAttribute('aria-label', `${experience.label} projects`);
      button.after(projects);
    }
    const item = kind === 'experience' ? null : id;
    if (kind !== 'experience' && state.item === item && state.pinned === pin) return;
    state.item = item;
    state.pinned = pin && (kind !== 'experience' || state.expanded);
    render(pin ? 'activate' : focus ? 'focus' : 'preview', animate);
    if (pin) {
      const hasProjects = kind === 'experience' && experiences.find((item) => item.id === id).projects.length > 0;
      const message = hasProjects ? state.expanded ? 'Constellation expanded. Projects available.' : 'Press Enter to unfold projects.' : kind === 'experience' && !state.pinned ? 'Press Enter to select this experience.' : 'Details available below the constellation.';
      announcement.textContent = `${button.textContent}. ${message}`;
    }
  }

  function eventNode(event) {
    const button = event.target.closest('[data-node]');
    return button && graph.contains(button) ? button : null;
  }
  function hover(event) {
    if (event.pointerType !== 'mouse' || root.dataset.fieldDragging === 'true') return;
    const button = eventNode(event);
    if (button && !detail.contains(document.activeElement) && !projects.contains(document.activeElement)) select(button);
  }
  function focus(event) {
    const button = eventNode(event);
    if (button) select(button, { focus: true });
  }
  function click(event) {
    const button = eventNode(event);
    if (button) select(button, { pin: true, animate: event.detail > 0 });
  }
  function clear(source = 'reset') {
    if (projects.contains(document.activeElement) || detail.contains(document.activeElement)) {
      const id = state.mode === 'skills' ? state.item : state.experience;
      primary.querySelector(`[data-node="${id}"]`)?.focus({ preventScroll: true });
    }
    state.experience = state.item = null;
    state.expanded = false;
    state.pinned = false;
    if (source === 'reset') discovered.clear();
    projects.replaceChildren();
    projects.hidden = true;
    for (const project of experiences.flatMap((item) => item.projects)) nodeElements.delete(project.id);
    render(source);
    announcement.textContent = source === 'reset' ? 'Constellation exploration restarted.' : discovered.size ? 'Selection cleared. Explored chapters remain in the constellation.' : 'Selection cleared.';
  }
  function restart() { clear(); }
  function keydown(event) {
    if (event.key === 'Escape' && (state.experience || state.item)) {
      event.preventDefault();
      clear('clear');
    }
  }
  graph.addEventListener('pointerover', hover);
  graph.addEventListener('focusin', focus);
  graph.addEventListener('click', click);
  reset.addEventListener('click', restart);
  root.addEventListener('keydown', keydown);
  buildGraph();
  render();
  return {
    selectAdjacent(direction) {
      const buttons = graph.querySelectorAll('button');
      const current = [...buttons].findIndex((button) => button.dataset.node === (state.item || state.experience));
      const index = current < 0 ? direction > 0 ? 0 : buttons.length - 1 : (current + direction + buttons.length) % buttons.length;
      select(buttons[index], { pin: true, browse: true });
      if (graph.contains(document.activeElement)) buttons[index].focus({ preventScroll: true });
    },
    updateScene(scene) {
      connections.setAttribute('viewBox', `0 0 ${scene.width} ${scene.height}`);
      memories.setAttribute('viewBox', `0 0 ${scene.width} ${scene.height}`);
      const traces = scene.traces;
      const key = traces.map(({ id }) => id).join(':');
      const lines = traces.flatMap(({ edges }) => edges);
      const stars = traces.flatMap(({ nodes }) => nodes.filter(({ kind }) => kind === 'project'));
      if (memoryKey !== key) {
        memoryKey = key;
        memoryLines = lines.map(() => document.createElementNS('http://www.w3.org/2000/svg', 'line'));
        memoryStars = stars.map((_, index) => {
          const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circle.setAttribute('r', '1.8');
          circle.style.setProperty('--star-delay', `${index * -.8}s`);
          return circle;
        });
        memories.replaceChildren(...memoryLines, ...memoryStars);
      }
      for (const [index, { from, to }] of lines.entries()) {
        const line = memoryLines[index];
        for (const [name, value] of Object.entries({ x1: from.x, y1: from.y, x2: to.x, y2: to.y })) line.setAttribute(name, String(value));
        line.style.opacity = String(Math.min(from.opacity, to.opacity));
      }
      for (const [index, star] of stars.entries()) {
        memoryStars[index].setAttribute('cx', String(star.x));
        memoryStars[index].setAttribute('cy', String(star.y));
        memoryStars[index].style.opacity = String(star.opacity * .6);
      }
      for (const star of scene.nodes) {
        const button = nodeElements.get(star.id);
        if (!button) continue;
        button.style.left = `${star.x}px`;
        button.style.top = `${star.y}px`;
        button.style.width = `${star.width}px`;
        button.style.height = `${star.height}px`;
        button.style.setProperty('--star-alpha', String(star.opacity));
        button.style.visibility = star.opacity < .1 ? 'hidden' : 'visible';
        button.style.zIndex = String(Math.round((star.depth + 2) * 10));
        button.tabIndex = star.opacity < .1 ? -1 : 0;
      }
      for (const [index, edge] of scene.edges.entries()) {
        const line = edgeElements[index];
        if (!line) continue;
        line.classList.toggle('is-selected', state.item === edge.from.id || state.item === edge.to.id);
        for (const [name, value] of Object.entries({ x1: edge.from.x, y1: edge.from.y, x2: edge.to.x, y2: edge.to.y })) line.setAttribute(name, String(value));
        line.style.opacity = String(Math.min(edge.from.opacity, edge.to.opacity));
      }
    },
    setMode(mode) {
      if (state.mode === mode) return;
      if (graph.contains(document.activeElement) || detail.contains(document.activeElement)) root.querySelector('[data-field-model-summary]').focus({ preventScroll: true });
      state.mode = mode;
      state.experience = state.item = null;
      state.expanded = false;
      state.pinned = false;
      buildGraph();
      render('mode');
      announcement.textContent = mode === 'skills' ? `${skills.length} design and UX skills. Select a star to explore.` : `${experiences.length} selected experiences. Select a star to explore.`;
    },
    destroy() {
      graph.removeEventListener('pointerover', hover);
      graph.removeEventListener('focusin', focus);
      graph.removeEventListener('click', click);
      reset.removeEventListener('click', restart);
      root.removeEventListener('keydown', keydown);
    },
  };
}
