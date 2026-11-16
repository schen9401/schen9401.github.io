import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import { createPreviewServer } from '../server.mjs';
import { experiences, skills } from '../landing-explorer.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cases = ['work/toast-closeout.html', 'work/toast-cash-drawer.html', 'work/goto-wallboard.html', 'work/goto-conversation-intelligence.html', 'work/cattia.html'];
const pages = ['index.html', 'work/index.html', 'resume/index.html', 'about/index.html', ...cases, 'presentations/index.html', 'presentation/index.html'];
const server = createPreviewServer(root);
let base;

test('authored typography has a 12px floor, including deck text-size reduction and mobile overrides', async () => {
  for (const path of ['styles.css', 'presentation/presentation.css']) {
    const css = await readFile(resolve(root, path), 'utf8');
    for (const declaration of css.matchAll(/\b(font(?:-size)?):\s*([^;}]+)/g)) {
      for (const size of declaration[2].matchAll(/([\d.]+)px\b/g)) {
        assert.ok(Number(size[1]) >= 12, `${path}: ${declaration[0]}`);
      }
      if (path.startsWith('presentation/') && declaration[1] === 'font-size') {
        assert.match(declaration[2], /^max\(12px,/, 'Deck rem/em sizes must not shrink below 12px when the runtime reduces root text size');
      }
    }
    if (path.startsWith('presentation/')) {
      assert.match(css, /font: 500 max\(12px, clamp/);
      assert.match(css, /\.sidebar-head, \.thumb-cap, \.brand-badge \{ font-size: max\(12px,/);
    }
  }
});

test('skip links have focusable main destinations and the deck retains a persistent primary heading', async () => {
  for (const path of pages) {
    const html = await readFile(resolve(root, path), 'utf8');
    assert.equal([...html.matchAll(/<h1\b/g)].length, 1, path);
    if (path === 'presentation/index.html') {
      assert.match(html, /<h1 class="deck-title">Rethinking restaurant closeout<\/h1>/);
      assert.match(html, /<h2 class="hero-title/);
    } else {
      assert.match(html, /<main\b[^>]*id="main"[^>]*tabindex="-1"/, path);
    }
  }
});

test('every website header matches the homepage content and preserves section context', async () => {
  const header = (html) => html.match(/<header class="site-header wrap">[\s\S]*?<\/header>/)?.[0];
  const normalize = (html) => html.replaceAll('href="../', 'href="').replace(/ aria-current="[^"]+"/g, '');
  const home = header(await readFile(resolve(root, 'index.html'), 'utf8'));
  assert.ok(home);
  for (const page of pages.filter((page) => page !== 'presentation/index.html')) {
    const markup = header(await readFile(resolve(root, page), 'utf8'));
    assert.ok(markup, `${page}: missing site header`);
    assert.equal(normalize(markup), home, `${page}: header content or structure differs from home`);
    const current = [...markup.matchAll(/<a href="([^"]+)" aria-current="([^"]+)">/g)];
    if (page === 'index.html') assert.equal(current.length, 0);
    else {
      assert.equal(current.length, 1, `${page}: mark exactly one current section`);
      const section = cases.includes(page) ? 'work' : page.split('/')[0];
      assert.equal(current[0][1], `../${section}/`, page);
      assert.equal(current[0][2], cases.includes(page) ? 'location' : 'page', page);
    }
  }
});

test('deck reflow reserves the fixed controls and stacks real diagram grids on phones', async () => {
  const css = await readFile(resolve(root, 'presentation/presentation.css'), 'utf8');
  const html = await readFile(resolve(root, 'presentation/index.html'), 'utf8');
  assert.match(css, /\.slide::after \{ content: ""; flex: 0 0 var\(--stage-safe-bottom\);/);
  assert.match(css, /\.controls-center \{ grid-column: 1 \/ -1; grid-row: 2;/);
  assert.match(css, /--stage-safe-bottom: max\(136px, 8\.5rem\)/);
  const stacked = /\.payment-nodes, \.annotation-list, \.metric-grid, \.comparison-grid \{ grid-template-columns: minmax\(0, 1fr\);/;
  assert.match(css, stacked);
  for (const name of ['payment-nodes', 'annotation-list', 'metric-grid', 'comparison-grid']) {
    assert.match(html, new RegExp(`class="[^"]*\\b${name}\\b`), `${name} must be a real slide layout, not an unused override`);
  }
});

before(async () => {
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((done) => server.close(done)));

test('all pages and their local resources resolve', async () => {
  for (const page of pages) {
    const response = await fetch(`${base}/${page}`);
    assert.equal(response.status, 200, page);
    const html = await response.text();
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${page}: duplicate IDs`);
    const resources = [...html.matchAll(/\b(?:href|src|poster)="([^"]+)"/g)].map((match) => match[1]);
    for (const resource of resources) {
      if (/^(https?:|mailto:|data:)/.test(resource)) continue;
      const url = new URL(resource, `${base}/${page}`);
      const target = await fetch(url);
      assert.equal(target.status, 200, `${page}: ${resource}`);
      if (url.hash) {
        const targetHtml = await target.text();
        assert.ok(targetHtml.includes(`id="${url.hash.slice(1)}"`), `${page}: missing ${resource}`);
      }
    }
    for (const image of html.matchAll(/<img\b[^>]*>/g)) {
      assert.match(image[0], /\balt="[^"]*"/, `${page}: image needs an alt attribute`);
      if (/\balt=""/.test(image[0])) {
        assert.match(image[0], /\baria-hidden="true"/, `${page}: an empty alternative must be decorative`);
      }
    }
  }
});

test('all twelve original walkthroughs have posters, native controls, and preserved GIFs', async () => {
  const sources = new Set();
  for (const page of cases) {
    const html = await readFile(resolve(root, page), 'utf8');
    for (const [video] of html.matchAll(/<video\b[\s\S]*?<\/video>/g)) {
      assert.match(video, /\bcontrols\b/);
      assert.match(video, /\bplaysinline\b/);
      assert.match(video, /\bpreload="none"/);
      assert.match(video, /\bposter="[^"]+\.jpg"/);
      assert.match(video, /\baria-label="[^"]+"/);
      assert.match(video, /\bdata-motion-preview\b/);
      assert.match(video, /\bmuted\b/);
      assert.match(video, /\bloop\b/);
      assert.doesNotMatch(video, /\bautoplay\b/);
      const description = video.match(/aria-describedby="([^"]+)"/)[1];
      assert.ok(html.includes(`id="${description}"`), `${page}: missing walkthrough description`);
      const source = video.match(/<source src="([^"]+\.mp4)"/)[1];
      const path = resolve(root, dirname(page), source);
      sources.add(path);
      const gif = await readFile(path.replace(/\.mp4$/, '.gif'));
      assert.match(gif.subarray(0, 6).toString(), /^GIF8[79]a$/);
      assert.equal(gif.at(-1), 0x3b, `${source}: incomplete GIF`);
      const mp4 = await readFile(path);
      assert.equal(mp4.subarray(4, 8).toString(), 'ftyp');
      assert.ok(mp4.indexOf('moov') > 0 && mp4.indexOf('moov') < mp4.indexOf('mdat'), `${source}: video needs fast-start metadata`);
      const track = mp4.indexOf('tkhd');
      assert.ok(track > 4, `${source}: missing video track header`);
      const trackEnd = track - 4 + mp4.readUInt32BE(track - 4);
      const originalWidth = gif.readUInt16LE(6);
      const originalHeight = gif.readUInt16LE(8);
      assert.equal(mp4.readUInt32BE(trackEnd - 8) / 65536, originalWidth + originalWidth % 2, `${source}: preserve source width`);
      assert.equal(mp4.readUInt32BE(trackEnd - 4) / 65536, originalHeight + originalHeight % 2, `${source}: preserve source height`);
      assert.ok(html.includes(`href="${source.replace(/\.mp4$/, '.gif')}" download`));
    }
  }
  assert.equal(sources.size, 12);
});

test('the legacy closeout workflow plays its original recording instead of a flattened still', async () => {
  const caseHtml = await readFile(resolve(root, 'work/toast-closeout.html'), 'utf8');
  const deckHtml = await readFile(resolve(root, 'presentation/index.html'), 'utf8');
  const context = caseHtml.match(/<section id="context"[\s\S]*?<\/section>/)?.[0];
  const slides = [...deckHtml.matchAll(/<section class="slide\b[\s\S]*?<\/section>/g)].map(([slide]) => slide);
  for (const section of [context, slides[1], slides[12]]) {
    assert.ok(section, 'The legacy workflow has an identified case/deck destination');
    assert.match(section, /<video\b[^>]*data-motion-preview[^>]*\bcontrols\b[^>]*aria-describedby="[^"]+"><source src="(?:\.\.\/presentation\/)?assets\/motion\/closeout-legacy\.mp4"/);
    assert.doesNotMatch(section, /<img[^>]*src="[^"]*legacy-closeout\.png"/);
  }
});

test('website presents five cases separately from the Toast-only presentation', async () => {
  const home = await readFile(resolve(root, 'index.html'), 'utf8');
  const work = await readFile(resolve(root, 'work/index.html'), 'utf8');
  for (const page of cases) assert.ok(work.includes(`href="../${page}"`));
  assert.match(work, /05 cases/);
  assert.equal([...work.matchAll(/<details class="snapshot" id="[^"]+">/g)].length, 6);
  assert.ok(home.includes('href="presentations/"'));
  for (const route of ['work/', 'presentations/', 'resume/', 'about/']) {
    assert.ok(home.includes(`href="${route}"`), `Landing navigation: ${route}`);
  }
  assert.doesNotMatch(home, /class="(?:project|snapshot|resume-section|presentation-list)|<video\b|id="(?:work|resume|about)"/);
  assert.match(home, /data-field-canvas aria-hidden="true"/);
  assert.doesNotMatch(home, /data-field-pause|data-field-form|data-explorer-pin|field-cross|header-contact|landing-index/);
  assert.match(home, /<details class="field-model-switcher" data-field-model name="constellation-tools">/);
  assert.match(home, /<summary class="field-model-summary" data-field-model-summary>/);
  assert.match(home, /<span data-field-model-label>Career<\/span><span class="visually-hidden"> constellation model<\/span>/);
  assert.match(home, /class="field-model-menu" role="group" aria-label="Constellation model"/);
  assert.match(home, /data-field-mode="experience" aria-pressed="true"/);
  assert.match(home, /data-field-mode="skills" aria-pressed="false"/);
  assert.doesNotMatch(home, /<select/);
  assert.match(home, /data-field-status/);
  assert.match(home, /Current model: Career\./);
  assert.match(home, /<details class="field-options" data-field-options hidden name="constellation-tools">/);
  assert.match(home, /<summary class="field-options-summary">Accessibility /);
  assert.match(home, /data-explorer-reset><span>Reset<\/span>/);
  assert.match(home, /role="group" aria-labelledby="field-accessibility-title" aria-describedby="field-accessibility-description"/);
  assert.match(home, /<h2 id="field-accessibility-title">Accessibility<\/h2>/);
  assert.match(home, /<p id="field-accessibility-description">Constellation controls<\/p>/);
  assert.match(home, /Reset clears all explored chapters\./);
  assert.doesNotMatch(home, /Restart exploration|Text sparkle|data-caption-animation|field-animation-toggle/);
  assert.match(home, /<p class="landing-eyebrow">Senior designer<\/p>\s*<h1/);
  assert.match(home, /<p class="landing-description">[^<]+<\/p>\s*<a class="landing-work-link"/);
  assert.match(home, /<div class="field-topline field-controlbar"[^>]*>\s*<div class="explorer-empty" data-explorer-empty>\s*<p class="field-caption">Select a star to explore my chapters\.<\/p>\s*<\/div>\s*<details class="field-model-switcher"/);
  assert.doesNotMatch(home, /class="field-hint"/);
  assert.doesNotMatch(home, /landing-caption|A decade of design|Each chapter lights the way|returns to the newest star/);
  assert.equal([...home.matchAll(/Select a star to explore my chapters\./g)].length, 1);
  assert.doesNotMatch(home, /chapters that light my constellation/);
  assert.doesNotMatch(home, /<\/div>\s*<p class="field-(?:hint|caption)">/);
  assert.doesNotMatch(home, /field-intro/);
  assert.ok(home.indexOf('data-field-stage') < home.indexOf('field-topline field-controlbar'));
  assert.ok(home.indexOf('field-topline field-controlbar') < home.indexOf('class="explorer-inspector"'));
  assert.ok(home.indexOf('field-topline field-controlbar') < home.indexOf('id="explorer-detail"'));
  assert.doesNotMatch(home, /mailto:|gmail\.com|Start a conversation/);
  const footer = home.match(/<footer class="site-footer landing-footer wrap">([\s\S]*?)<\/footer>/)?.[1];
  assert.ok(footer, 'Homepage reuses the general site footer');
  assert.match(footer, /<div class="landing-footer-contact">\s*<a href="index.html">Siyi Chen<\/a>\s*<span class="landing-footer-divider" aria-hidden="true"><\/span>\s*<a href="https:\/\/www\.linkedin\.com\/in\/siyichen"/);
  assert.doesNotMatch(footer, /Product design|<svg class="contact-linkedin-icon"/);
  assert.match(footer, /href="https:\/\/www\.linkedin\.com\/in\/siyichen" target="_blank" rel="noopener noreferrer"><img class="contact-linkedin-icon" src="assets\/linkedin-in-white\.png" width="840" height="779" alt="" aria-hidden="true">Contact me/);
  const linkedinIcon = await readFile(resolve(root, 'assets/linkedin-in-white.png'));
  assert.deepEqual(linkedinIcon.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert.deepEqual([linkedinIcon.readUInt32BE(16), linkedinIcon.readUInt32BE(20)], [840, 779]);
  const linkedinResponse = await fetch(`${base}/assets/linkedin-in-white.png`);
  assert.equal(linkedinResponse.status, 200);
  assert.equal(linkedinResponse.headers.get('content-type'), 'image/png');
  assert.ok(footer.indexOf('Contact me') < footer.indexOf('data-field-options'));
  assert.match(footer, /data-field-options[\s\S]*data-field-left[\s\S]*data-field-right[\s\S]*data-lens-toggle[\s\S]*data-explorer-reset/);
  assert.equal([...home.matchAll(/data-field-options/g)].length, 1);
  assert.match(home, /AI-powered\.<br><span class="outline-word">Human-led\.<\/span>/);
  assert.match(home, /Bringing clarity to complexity and light to ambiguity—crafting trusted agentic experiences that help us think deeper, see further, and move faster\./);
  assert.match(home, /data-field-left aria-label="Select previous star"/);
  assert.match(home, /data-field-right aria-label="Select next star"/);
  assert.match(home, /data-explorer-nodes/);
  assert.match(home, /data-explorer-detail/);
  const fallback = home.match(/<svg class="field-fallback"[\s\S]*?<\/svg>/)[0];
  assert.match(fallback, /<path /);
  assert.match(fallback, /<circle /);
  assert.doesNotMatch(fallback, /<ellipse/);
  assert.match(home, /data-lens-toggle aria-pressed="true" hidden/);
  assert.match(home, /data-lens-label aria-hidden="true"/);
  assert.match(home, /src="landing-field\.js" type="module"/);
  const field = await readFile(resolve(root, 'landing-field.js'), 'utf8');
  assert.match(field, /import \{ mountTrail \} from '\.\/landing-trail\.js'/);
  assert.match(field, /mountTrail\(document\.body\)/);
  const trail = await fetch(`${base}/landing-trail.js`);
  assert.equal(trail.status, 200);
  assert.match(trail.headers.get('content-type'), /javascript/);
  const css = await readFile(resolve(root, 'styles.css'), 'utf8');
  assert.match(css, /\.glass-lens \{[^}]*width: 48px; height: 48px;/);
  assert.match(css, /\.field-stage \{[^}]*-webkit-user-select: none; user-select: none;/);
  assert.match(css, /\.field-stage \* \{[^}]*-webkit-user-drag: none;/);
  assert.doesNotMatch(css, /animation: (?:star-breathe|memory-shimmer)/);
  assert.match(css, /\.field-model-switcher \{[^}]*margin-left: auto;/);
  assert.match(css, /\.field-options\[hidden\] \{ display: none; \}/);
  assert.match(css, /\.field-options:not\(\[open\]\) \.field-toolbar \{ display: none; \}/);
  assert.match(css, /\.explorer-empty\[hidden\] \{ display: block; visibility: hidden; \}/);
  assert.match(css, /\.explorer-empty\[hidden\] \.field-caption[^}]*animation: none;/);
  assert.match(css, /\.landing-footer \.field-toolbar \{ top: auto; bottom: calc\(100% \+ 8px\);/);
  assert.match(css, /\.landing-footer \{ display: flex; flex-wrap: wrap;/);
  assert.match(css, /\.landing-footer-contact \{ display: flex; align-items: center; gap: 14px; \}/);
  assert.match(css, /\.landing-footer-divider \{ flex: 0 0 1px; height: 16px; border-left: 1px solid var\(--muted\); \}/);
  assert.match(css, /\.contact-linkedin-icon \{ width: auto; height: 16px; flex: 0 0 auto; \}/);
  assert.match(css, /\.landing-footer \.field-options \{ margin-left: auto; flex: 0 0 auto; \}/);
  assert.match(home, /<summary class="field-options-summary">Accessibility <svg [^>]*aria-hidden="true"[^>]*><path /);
  assert.match(css, /\.field-options-summary \{[^}]*align-items: center;[^}]*line-height: 1;/);
  assert.match(css, /\.field-options-summary svg \{ display: block; flex: 0 0 12px;/);
  assert.match(css, /\.field-options\[open\] \.field-options-summary svg \{ transform: rotate\(180deg\);/);
  assert.match(css, /\.explorer-node--skills \.explorer-dot::before[^}]*width: 38px/);
  assert.match(css, /\.explorer-node--north-star \.explorer-dot \{[^}]*width: 12px/);
  for (const selector of ['landing-eyebrow', 'field-model-summary', 'field-options-summary']) {
    assert.match(css, new RegExp(`\\.${selector} \\{[^}]*text-transform: uppercase;`));
  }
  assert.match(css, /\.landing-eyebrow \{[^}]*font-size: 16px/);
  assert.match(css, /\.field-caption \{[^}]*font-size: 16px; line-height: 1\.6;/);
  assert.match(css, /\.field-topline \{[^}]*display: grid; grid-template-columns: minmax\(0, 1fr\) 128px; align-items: center;/);
  assert.match(css, /\.explorer-empty \{[^}]*display: flex;[^}]*align-items: center; justify-content: center; text-align: center;/);
  assert.match(css, /\.explorer-empty \{[^}]*grid-column: 1 \/ -1; grid-row: 1;/);
  assert.match(css, /\.field-caption \{[^}]*text-wrap: balance;/);
  assert.match(css, /\.field-model-switcher \{[^}]*grid-column: 2; grid-row: 2;/);
  assert.match(css, /@container \(min-width: 560px\) \{\s*\.explorer-empty \{ padding-inline: 144px; \}\s*\.field-model-switcher \{ grid-row: 1; \}/);
  const invitationMotion = css.match(/@media \(prefers-reduced-motion: no-preference\) and \(forced-colors: none\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(invitationMotion, 'Decorative invitation motion is opt-in to normal-motion, normal-color preferences');
  assert.match(invitationMotion, /\.field-caption \{ animation: invitation-glow [^;]* infinite both;/);
  assert.match(invitationMotion, /\.field-caption::before, \.field-caption::after \{[^}]*content: "";[^}]*pointer-events: none;[^}]*animation: invitation-sparkle [^;]* infinite both;/);
  assert.doesNotMatch(invitationMotion, /steps\(/);
  assert.doesNotMatch(css, /data-caption-animation|field-animation-toggle/);
  assert.doesNotMatch(css, /--landing-rule/);
  assert.doesNotMatch(css, /\.landing-work-link \{[^}]*border/);
  assert.doesNotMatch(css, /\.explorer-inspector \{[^}]*border/);
  assert.match(css, /\.landing-hero \{[^}]*align-items: center;/);
  assert.match(css, /@media \(min-width: 761px\) \{\s*\.landing-hero \{[^}]*grid-template-rows: auto auto auto auto; gap: 0 32px;[^}]*padding-block: 64px 24px;/);
  assert.match(css, /\.landing-copy \{[^}]*grid-column: 1; grid-row: 1 \/ span 2; align-self: end; \}/);
  assert.match(css, /\.signal-field \{[^}]*grid-column: 2; grid-row: 1 \/ span 4; grid-template-rows: subgrid;/);
  assert.match(css, /\.field-stage \{ grid-row: 1; align-self: end; \}/);
  assert.match(css, /\.field-controlbar \{ min-height: 44px; container-type: inline-size; \}/);
  assert.match(css, /\.field-controlbar \{ grid-row: 2; \}/);
  assert.match(css, /\.explorer-inspector \{ grid-row: 3; \}/);
  assert.doesNotMatch(css, /\.field-modes\b|\.field-mode\.is-active/);
  assert.match(css, /\.field-model-summary \{[^}]*min-width: 128px;[^}]*min-height: 44px;[^}]*border-radius: 999px;/);
  assert.match(css, /\.field-model-summary:focus-visible \{ border-radius: 999px; outline-offset: 4px; \}/);
  assert.match(css, /\.field-model-switcher:not\(\[open\]\) \.field-model-menu \{ display: none; \}/);
  assert.match(css, /\.field-mode \{[^}]*min-height: 66px;/);
  assert.match(css, /\.field-mode\[aria-pressed="true"\] \.field-mode-check \{ visibility: visible; \}/);
  assert.match(css, /\.field-model-summary, \.field-model-menu \{[^}]*background: Canvas; border-color: ButtonText;/);
  const chapterEmphasis = css.match(/@media \(forced-colors: none\) \{([\s\S]*?)\n\}/)?.[1];
  const backgroundOpacity = chapterEmphasis?.match(/\.explorer-node--experience\.is-muted:not\(:hover\):not\(:focus-visible\) \{ opacity: ([.\d]+); \}/)?.[1];
  assert.ok(Number(backgroundOpacity) > 0 && Number(backgroundOpacity) <= .3, 'Inactive chapter buttons, including labels, fade together except on hover or keyboard focus');
  assert.match(chapterEmphasis, /\.explorer-nodes:has\(\.explorer-node--experience\.is-expanded\) \.explorer-memories \{ opacity: \.15; \}/);
  assert.match(css, /\.landing-eyebrow, \.field-model-summary, \.field-options-summary \{ font-family: var\(--mono\); letter-spacing: \.06em/);
  assert.match(css, /\.explorer-detail\.has-image \{[^}]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 4fr\); align-items: stretch; gap: 24px/);
  assert.doesNotMatch(css, /\.explorer-visual \{[^}]*(?:border|background)/);
  assert.match(css, /\.explorer-description strong \{ color: var\(--ink\); font-weight: 500; \}/);
  assert.match(css, /@media \(max-width: 360px\) \{\s*\.explorer-inspector \{ min-height: 540px; \}/);
  const site = await readFile(resolve(root, 'site.js'), 'utf8');
  for (const hash of ['#work', '#more-work', '#resume', '#about']) assert.ok(site.includes(`'${hash}'`));
  const hub = await readFile(resolve(root, 'presentations/index.html'), 'utf8');
  assert.match(hub, /href="\.\.\/presentation\/"/);
  assert.match(hub, /20 main slides \+ 3 backups/);
  assert.match(hub, /href="\.\.\/work\/cattia\.html"/);
  const deck = await readFile(resolve(root, 'presentation/index.html'), 'utf8');
  assert.doesNotMatch(deck, /Cattia|cattia\.html/);
  const conversation = await readFile(resolve(root, 'work/goto-conversation-intelligence.html'), 'utf8');
  assert.match(conversation, /Sales concept demo/);
  assert.match(conversation, /accuracy and security/);
  assert.match(conversation, /not a production launch/);
  assert.match(conversation, /href="cattia\.html"/);
});

test('all explorer destinations and genuine source previews resolve, including precise snapshot fragments', async () => {
  assert.deepEqual(experiences.map(({ label, year }) => [label, year]), [
    ['Toast', '2021–2024'], ['GoTo', '2019–2021'], ['Bevi', '2017–2019'], ['Microsoft', '2024–now'],
  ]);
  assert.equal(skills.length, 8);
  assert.equal(skills.at(-1).label, 'Vibe-coding');
  const content = [...experiences, ...experiences.flatMap(({ projects }) => projects), ...skills];
  for (const item of content) {
    if (item.image) {
      assert.ok(item.alt);
      assert.equal((await fetch(new URL(item.image, `${base}/`))).status, 200, item.image);
    }
    if (item.href.startsWith('https:')) continue;
    const url = new URL(item.href, `${base}/`);
    const response = await fetch(url);
    assert.equal(response.status, 200, item.href);
    if (url.hash) assert.match(await response.text(), new RegExp(`<details class="snapshot" id="${url.hash.slice(1)}">`));
  }
  const demo = experiences[1].projects.find(({ id }) => id === 'conversation');
  assert.match(demo.description, /not a production launch/);
  assert.match(experiences[0].role, /Senior/);
  assert.doesNotMatch(JSON.stringify(content), /8 YoE|proficiency|Present/);
});

test('Cattia preserves ten detailed source images and qualifies its alpha evidence', async () => {
  const html = await readFile(resolve(root, 'work/cattia.html'), 'utf8');
  const images = {
    world: [2436, 1125],
    workshop: [2436, 1125],
    mainline: [2436, 1125],
    building: [2436, 1125],
    'character-offer': [2436, 1125],
    stamps: [2436, 1125],
    gacha: [2436, 1125],
    'gameplay-architecture': [4096, 2716],
    'player-flow': [2917, 4096],
    'design-system': [4096, 2347],
  };
  for (const [name, dimensions] of Object.entries(images)) {
    const source = `../assets/work/cattia-${name}.png`;
    const bytes = await readFile(resolve(root, 'assets/work', `cattia-${name}.png`));
    assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], dimensions, name);
    const image = [...html.matchAll(/<img\b[^>]*>/g)].find(([tag]) => tag.includes(`src="${source}"`))?.[0];
    assert.ok(image, `${name}: missing reading-page image`);
    assert.ok(image.includes(`width="${dimensions[0]}" height="${dimensions[1]}"`), `${name}: incorrect image ratio`);
    assert.ok(html.includes(`href="${source}" data-lightbox`), `${name}: missing expand link`);
  }
  assert.equal([...html.matchAll(/data-lightbox/g)].length, 10);
  for (const board of ['gameplay-architecture', 'player-flow', 'design-system']) {
    assert.ok(html.includes(`href="../assets/work/cattia-${board}.png" target="_blank"`), `${board}: missing full-resolution link`);
  }
  for (const section of ['context', 'structure', 'experience', 'system', 'learning']) {
    assert.ok(html.includes(`href="#${section}"`));
    assert.ok(html.includes(`id="${section}"`));
  }
  assert.match(html, /alpha test with 15 participants/);
  assert.match(html, /8<span>\/10<\/span>/);
  assert.match(html, /7<span>\/10<\/span>/);
  assert.match(html, /Small-sample alpha feedback, not validated launch impact/);
  assert.match(html, /current status is not verified/);
  assert.match(html, /static source screenshots and diagrams/);
  assert.doesNotMatch(html, /<video\b|<iframe\b|api\/mcp\/asset|node-id=49-2/);
});

test('new game UI resources stay source-linked and separate from the earlier written case', {
  skip: !existsSync(resolve(root, 'resources/cattia-2025-2026')) &&
    'Staged Figma resources are local-only and excluded from the public repository.',
}, async () => {
  const resourceRoot = 'resources/cattia-2025-2026';
  const manifestText = await readFile(resolve(root, resourceRoot, 'manifest.json'), 'utf8');
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.status, 'prepared-resources-only');
  assert.equal(manifest.source.fileKey, 'BYX0zxImY0uNoo34SuEbWH');
  assert.equal(manifest.source.nodeId, '5454:22640');
  assert.equal(manifest.source.pageId, '4780:58085');
  assert.equal(manifest.capture.sourceModified, false);
  assert.equal(manifest.capture.linkedIntoWebsite, false);
  assert.equal(manifest.capture.scale, 3);
  assert.match(manifest.designIntent.goals.join(' '), /immersive.*milk-box.*unnecessary UI noise/);
  assert.match(manifest.designIntent.outcomeBoundary, /Earlier alpha ratings must not be attributed/);
  assert.equal(manifest.screens.length, 16);
  assert.equal(manifest.milkBoxReferences.length, 4);
  assert.equal(manifest.boards.length, 4);
  assert.equal(manifest.vectorReferences.length, 1);
  assert.equal(new Set(manifest.screens.map((screen) => screen.nodeId)).size, 16);
  const pngDimensions = async (file) => {
    const bytes = await readFile(resolve(root, resourceRoot, file));
    assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  };
  const dimensions = new Map();
  for (const board of manifest.boards) {
    assert.deepEqual(await pngDimensions(board.file), board.pixels, board.file);
    dimensions.set(board.file, board.pixels);
    assert.equal(manifest.screens.filter((screen) => screen.board === board.file).length, board.screenCount);
  }
  for (const image of [...manifest.screens, ...manifest.milkBoxReferences]) {
    assert.match(image.nodeId, /^\d+:\d+$/);
    const source = image.board ?? image.source;
    const bounds = dimensions.get(source);
    assert.ok(bounds, `${image.file}: missing source image`);
    const [left, top, width, height] = image.cropPx;
    assert.ok(image.cropPx.every(Number.isInteger), image.file);
    assert.ok(left >= 0 && top >= 0 && left + width <= bounds[0] && top + height <= bounds[1], image.file);
    assert.deepEqual(await pngDimensions(image.file), [width, height], image.file);
    dimensions.set(image.file, [width, height]);
  }
  for (const vector of manifest.vectorReferences) {
    const svg = await readFile(resolve(root, resourceRoot, vector.file), 'utf8');
    const element = svg.match(/<svg\b[^>]*>/)[0];
    assert.match(element, /\bwidth="163"/);
    assert.match(element, /\bheight="197"/);
    assert.doesNotMatch(svg, /api\/mcp\/asset/);
  }
  assert.deepEqual(await pngDimensions(manifest.overview), [1804, 1400]);
  assert.doesNotMatch(manifestText, /api\/mcp\/asset/);
  for (const page of pages) {
    const html = await readFile(resolve(root, page), 'utf8');
    assert.ok(!html.includes(resourceRoot), `${page}: staged resources must not replace the earlier case`);
  }
});

test('public deployment excludes preparation files and uses system-font fallbacks', async () => {
  const ignore = (await readFile(resolve(root, '.gitignore'), 'utf8')).split(/\r?\n/);
  for (const path of ['/resources/', '/presentation/fonts/', '/presentation/PRESENTATION.md', '/presentation/slides.md', '/presentation/context.md']) {
    assert.ok(ignore.includes(path), `${path}: must stay out of the public repository`);
  }
  assert.equal((await readFile(resolve(root, '.nojekyll'), 'utf8')).trim(), '');
  const css = await readFile(resolve(root, 'styles.css'), 'utf8');
  assert.doesNotMatch(css, /@font-face|presentation\/fonts\//);
  for (const token of ['body', 'heading']) {
    assert.ok(css.includes(`--${token}: Arial, sans-serif;`));
  }
  const presentation = await readFile(resolve(root, 'presentation/presentation.css'), 'utf8');
  assert.match(presentation, /:root, body\[data-mode\]\s*\{/);
  for (const token of ['body', 'display', 'display-2']) {
    assert.ok(presentation.includes(`--${token}: Arial, sans-serif;`));
  }
  for (const page of pages) {
    assert.doesNotMatch(await readFile(resolve(root, page), 'utf8'), /Local portfolio draft|Not published|reviewable local draft/, page);
  }
});

test('resume is readable in the website with source-qualified history and navigation', async () => {
  const resume = await readFile(resolve(root, 'resume/index.html'), 'utf8');
  assert.match(resume, /aria-labelledby="resume-title"/);
  assert.match(resume, /September 24, 2025/);
  assert.match(resume, /Roles marked “Present” reflect that version/);
  for (const employer of ['Microsoft', 'Peppr', 'Toast', 'GoTo', 'Bevi', 'LYUN game studio']) assert.ok(resume.includes(employer));
  for (const school of ['Cornell University', 'UMass Amherst']) assert.ok(resume.includes(school));
  assert.match(resume, /id="skills-title"/);
  assert.match(resume, /node-id=27-3/);
  assert.doesNotMatch(resume, /Principal product designer|\b(?:20|40|80)%/i);
  assert.equal([...resume.matchAll(/<li><p class="resume-dates">/g)].length, 5);
  for (const page of pages.filter((page) => page !== 'presentation/index.html')) {
    const html = await readFile(resolve(root, page), 'utf8');
    const nav = html.match(/<nav aria-label="Main navigation">[\s\S]*?<\/nav>/)[0];
    assert.match(nav, /href="(?:\.\.\/)?resume\/"/, `${page}: missing resume navigation`);
    assert.match(nav, /href="(?:\.\.\/)?work\/"/, `${page}: missing work navigation`);
    assert.match(nav, /href="(?:\.\.\/)?about\/"/, `${page}: missing about navigation`);
  }
});

test('website text colors meet AA contrast on the primary reading surfaces', async () => {
  const css = await readFile(resolve(root, 'styles.css'), 'utf8');
  const tokens = css.match(/:root\s*\{([^}]+)\}/)[1];
  const colors = new Map([...tokens.matchAll(/--([\w-]+):\s*(#[\da-f]{6})/gi)].map((match) => [match[1], match[2]]));
  const luminance = (hex) => hex.slice(1).match(/../g).reduce((sum, channel, index) => {
    const value = Number.parseInt(channel, 16) / 255;
    const linear = value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
  for (const foreground of ['ink', 'muted', 'accent']) {
    for (const background of [colors.get('paper'), colors.get('field'), colors.get('sage')]) {
      const values = [luminance(colors.get(foreground)), luminance(background)];
      const contrast = (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
      assert.ok(contrast >= 4.5, `${foreground} on ${background}: ${contrast.toFixed(2)}:1`);
    }
  }
});

test('website and presentation theme layers are monochrome without altering original media', async () => {
  for (const path of ['styles.css', 'presentation/presentation.css', 'favicon.svg']) {
    const text = await readFile(resolve(root, path), 'utf8');
    for (const [hex] of text.matchAll(/#[\da-f]{6}(?:[\da-f]{2})?\b/gi)) {
      assert.equal(hex.slice(1, 3).toLowerCase(), hex.slice(3, 5).toLowerCase(), `${path}: ${hex}`);
      assert.equal(hex.slice(3, 5).toLowerCase(), hex.slice(5, 7).toLowerCase(), `${path}: ${hex}`);
    }
  }
  const deck = await readFile(resolve(root, 'presentation/index.html'), 'utf8');
  assert.match(deck, /data-mode="dark"/);
  assert.match(deck, /class="deck-home-link" href="\.\.\/presentations\/"/);
  const css = await readFile(resolve(root, 'presentation/presentation.css'), 'utf8');
  assert.match(css, /body\[data-brand="neutral"\]\[data-mode\]/);
  assert.match(css, /--accent-from: #ffffff/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /forced-colors/);
});

test('preview serves original images and supports native-video byte-range requests', async () => {
  const path = 'assets/motion/cash-drawer-close.mp4';
  const bytes = await readFile(resolve(root, path));
  for (const [range, start, end] of [
    ['bytes=0-1', 0, 1],
    ['bytes=10-', 10, bytes.length - 1],
    ['bytes=-10', bytes.length - 10, bytes.length - 1],
    [`bytes=10-${bytes.length + 100}`, 10, bytes.length - 1],
  ]) {
    const response = await fetch(`${base}/${path}`, { headers: { Range: range } });
    assert.equal(response.status, 206, range);
    assert.equal(response.headers.get('content-type'), 'video/mp4');
    assert.equal(response.headers.get('accept-ranges'), 'bytes');
    assert.equal(response.headers.get('content-range'), `bytes ${start}-${end}/${bytes.length}`);
    assert.equal(Number(response.headers.get('content-length')), end - start + 1);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes.subarray(start, end + 1));
  }
  for (const range of ['bytes=-0', 'bytes=9-3', `bytes=${bytes.length}-`, 'bytes=0-1,4-5', 'bytes=9007199254740992-', 'invalid']) {
    const response = await fetch(`${base}/${path}`, { headers: { Range: range } });
    assert.equal(response.status, 416, range);
    assert.equal(response.headers.get('content-range'), `bytes */${bytes.length}`);
  }
  const head = await fetch(`${base}/${path}`, { method: 'HEAD', headers: { Range: 'bytes=0-1' } });
  assert.equal(head.status, 206);
  assert.equal(head.headers.get('content-length'), '2');
  assert.equal((await head.arrayBuffer()).byteLength, 0);
  assert.equal((await fetch(`${base}/assets/motion/cash-drawer-close.gif`)).headers.get('content-type'), 'image/gif');
  assert.equal((await fetch(`${base}/assets/work/wallboard-cast.jpg`)).headers.get('content-type'), 'image/jpeg');
});

test('deck has 20 core slides and 3 backups with complete contracts', async () => {
  const html = await readFile(resolve(root, 'presentation/index.html'), 'utf8');
  const slides = [...html.matchAll(/<section class="slide [^>]+>/g)].map((match) => match[0]);
  assert.equal(slides.length, 23);
  assert.equal(slides.filter((slide) => slide.includes('slide--appendix')).length, 3);
  for (const slide of slides) {
    assert.match(slide, /data-section="[^"]+"/);
    assert.match(slide, /data-motion="[^"]+"/);
    assert.match(slide, /aria-labelledby="[^"]+"/);
  }
  for (const id of ['stage', 'deck', 'prev', 'next', 'counter', 'menuBtn', 'fontDown', 'fontUp', 'fontPct', 'presentBtn', 'sidebar', 'sbOverlay', 'sbList']) {
    assert.ok(html.includes(`id="${id}"`), `Missing runtime ID ${id}`);
  }
  assert.match(html, /data-edit="false"/);
  assert.doesNotMatch(html, /GoTo|conversation intelligence|Principal product designer/i);
});

test('case-study outcomes stay qualified and historical role stays intact', async () => {
  for (const page of ['work/toast-closeout.html', 'presentation/index.html']) {
    const html = await readFile(resolve(root, page), 'utf8');
    assert.match(html, /Senior product designer/);
    assert.match(html, /directional/i);
    assert.match(html, /Approximate trial estimate/);
    assert.doesNotMatch(html, /N\s*=\s*10[,\s]?000/);
    assert.match(html, /incomplete/i);
    assert.match(html, /(?:save|retain)/i);
  }
});

test('CSS image, inline optics, and active font references exist', async () => {
  const unusedRuntimeFonts = new Set([
    './fonts/CommunityPro-Bold.ttf',
    './fonts/CommunityPro-Medium.ttf',
    './fonts/SegoePro-Regular.ttf',
  ]);
  for (const cssPath of ['styles.css', 'presentation/deck.css', 'presentation/presentation.css']) {
    const css = await readFile(resolve(root, cssPath), 'utf8');
    for (const match of css.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) {
      if (/^(https?:|data:)/.test(match[1])) continue;
      if (match[1].startsWith('#')) {
        assert.equal(match[1], '#landing-liquid-refraction');
        const lens = await readFile(resolve(root, 'landing-lens.js'), 'utf8');
        assert.match(lens, /id: 'landing-liquid-refraction'/);
        continue;
      }
      // The preserved runtime declares restricted fonts; the public theme never uses them.
      if (cssPath === 'presentation/deck.css' && unusedRuntimeFonts.has(match[1])) continue;
      const path = resolve(root, dirname(cssPath), match[1]);
      assert.ok((await stat(path)).isFile(), `${cssPath}: ${match[1]}`);
    }
  }
});

test('preview handles HEAD, missing resources, invalid requests, and traversal safely', async () => {
  assert.equal((await fetch(base, { method: 'HEAD' })).status, 200);
  const redirect = await fetch(`${base}/presentation?preview=1`, { redirect: 'manual' });
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('location'), '/presentation/?preview=1');
  assert.equal((await fetch(`${base}/missing.html`)).status, 404);
  assert.equal((await fetch(base, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${base}/%zz`)).status, 400);
  assert.equal((await fetch(`${base}/.private`)).status, 403);
  assert.equal((await fetch(`${base}/..%2f..%2fetc%2fpasswd`)).status, 403);
  assert.equal((await fetch(`${base}/server.mjs`)).status, 403);
});

test('published assets contain no temporary Figma download addresses', async () => {
  async function visit(directory) {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, item.name);
      if (item.isDirectory()) await visit(path);
      else if (/\.(html|css|js|json|md)$/.test(item.name)) {
        assert.doesNotMatch(await readFile(path, 'utf8'), /figma\.com\/api\/mcp\/asset\//, path);
      }
    }
  }
  await visit(root);
});
