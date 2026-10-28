import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import { createPreviewServer } from '../server.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cases = ['work/toast-closeout.html', 'work/toast-cash-drawer.html', 'work/goto-wallboard.html', 'work/goto-conversation-intelligence.html', 'work/cattia.html'];
const pages = ['index.html', ...cases, 'presentations/index.html', 'presentation/index.html'];
const server = createPreviewServer(root);
let base;

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

test('all eleven original walkthroughs have posters, native controls, and preserved GIFs', async () => {
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
  assert.equal(sources.size, 11);
});

test('website presents five cases separately from the Toast-only presentation', async () => {
  const home = await readFile(resolve(root, 'index.html'), 'utf8');
  for (const page of cases) assert.ok(home.includes(`href="${page}"`));
  assert.match(home, /05 cases/);
  assert.equal([...home.matchAll(/<details class="snapshot">/g)].length, 6);
  assert.ok(home.includes('href="presentations/"'));
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
});

test('resume is readable in the website with source-qualified history and navigation', async () => {
  const home = await readFile(resolve(root, 'index.html'), 'utf8');
  const resume = home.match(/<section id="resume"[\s\S]*?<\/section>\s*\n\s*<section class="contact-section/)[0];
  assert.match(resume, /aria-labelledby="resume-title"/);
  assert.match(resume, /September 24, 2025/);
  assert.match(resume, /Roles marked “Present” reflect that version/);
  for (const employer of ['Microsoft', 'Peppr', 'Toast', 'GoTo', 'Bevi', 'LYUN game studio']) assert.ok(resume.includes(employer));
  for (const school of ['Cornell University', 'UMass Amherst']) assert.ok(resume.includes(school));
  assert.match(resume, /id="skills-title"/);
  assert.match(resume, /node-id=27-3/);
  assert.doesNotMatch(resume, /Principal product designer|\b(?:20|40|80)%/i);
  assert.equal([...resume.matchAll(/<li><p class="resume-dates">/g)].length, 5);
  for (const page of ['index.html', ...cases, 'presentations/index.html']) {
    const html = await readFile(resolve(root, page), 'utf8');
    const nav = html.match(/<nav aria-label="Main navigation">[\s\S]*?<\/nav>/)[0];
    assert.match(nav, /href="(?:\.\.\/index\.html)?#resume"/, `${page}: missing resume navigation`);
  }
});

test('website text colors meet AA contrast on the primary reading surfaces', async () => {
  const css = await readFile(resolve(root, 'styles.css'), 'utf8');
  const tokens = css.match(/:root\s*\{([^}]+)\}/)[1];
  const colors = new Map([...tokens.matchAll(/--([\w-]+):\s*(#[\da-f]{6})/gi)].map((match) => [match[1], match[2]]));
  const about = css.match(/\.about-section\s*\{\s*background:\s*(#[\da-f]{6})/i)[1];
  const luminance = (hex) => hex.slice(1).match(/../g).reduce((sum, channel, index) => {
    const value = Number.parseInt(channel, 16) / 255;
    const linear = value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
  for (const foreground of ['ink', 'muted', 'accent']) {
    for (const background of [colors.get('paper'), colors.get('field'), colors.get('sage'), about]) {
      const values = [luminance(colors.get(foreground)), luminance(background)];
      const contrast = (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
      assert.ok(contrast >= 4.5, `${foreground} on ${background}: ${contrast.toFixed(2)}:1`);
    }
  }
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

test('CSS image and active font references exist', async () => {
  const unusedRuntimeFonts = new Set([
    './fonts/CommunityPro-Bold.ttf',
    './fonts/CommunityPro-Medium.ttf',
    './fonts/SegoePro-Regular.ttf',
  ]);
  for (const cssPath of ['styles.css', 'presentation/deck.css', 'presentation/presentation.css']) {
    const css = await readFile(resolve(root, cssPath), 'utf8');
    for (const match of css.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) {
      if (/^(https?:|data:)/.test(match[1])) continue;
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
