import assert from 'node:assert/strict';
import { test } from 'node:test';
import { angleDelta, constellationGeometry, constellationScene, transitionScene, wrapAngle } from '../landing-constellation.js';
import { experiences, skills } from '../landing-explorer.js';

const model = constellationGeometry(experiences, skills);

test('four distinct 3D anchor stars preserve eleven source projects without inventing Microsoft projects', () => {
  assert.equal(model.groups.length, 4);
  assert.equal(model.groups.flatMap(({ projects }) => projects).length, 11);
  assert.deepEqual(model.groups.find(({ id }) => id === 'microsoft').projects, []);
  assert.deepEqual(model, constellationGeometry(experiences, skills));
  const ids = new Set();
  for (const [index, group] of model.groups.entries()) {
    assert.equal(group.anchor.kind, 'experience');
    assert.equal(group.id, experiences[index].id);
    assert.deepEqual(group.projects.map(({ id }) => id), experiences[index].projects.map(({ id }) => id));
    const reached = new Set([group.id]);
    for (const [from, to] of group.edges) {
      assert.ok(reached.has(from));
      reached.add(to);
    }
    assert.equal(reached.size, group.projects.length + 1);
    for (const star of [group.anchor, ...group.projects]) {
      assert.ok(star.position.every(Number.isFinite));
      assert.ok(!ids.has(star.id));
      ids.add(star.id);
    }
  }
  assert.equal(new Set(model.groups.map(({ angle }) => angle)).size, 4);
});

test('unfolding lights a real project path from its own anchor, not a disconnected starburst', () => {
  for (const group of model.groups) {
    const settings = { expanded: group.id, camera: { yaw: group.angle + .35, pitch: .12 }, width: 640, height: 520 };
    const closed = constellationScene(model, { ...settings, unfold: 0 });
    const open = constellationScene(model, { ...settings, unfold: 1 });
    assert.equal(open.nodes.filter(({ kind }) => kind === 'experience').length, 4);
    assert.equal(open.nodes.filter(({ kind }) => kind === 'project').length, group.projects.length);
    assert.ok(closed.nodes.filter(({ kind }) => kind === 'project').every(({ opacity }) => opacity === 0));
    assert.ok(open.nodes.filter(({ kind }) => kind === 'project').every(({ opacity }) => opacity > .5));
    assert.equal(open.edges.length, group.projects.length);
    if (group.projects.length) assert.equal(open.edges[0].from.id, group.id);
    assert.ok(open.edges.slice(1).every(({ from }) => from.kind === 'project'));
    for (const { from, to } of open.edges) {
      assert.ok(open.nodes.includes(from) && open.nodes.includes(to), 'The connecting line uses the actual projected endpoints');
    }
  }
});

test('all rotated constellations keep 44px-plus native targets on screen and apart at mobile and desktop sizes', () => {
  for (const width of [280, 335, 420, 640, 960]) {
    for (const height of [440, 520, 650]) {
      for (const yaw of [-Math.PI, -2, -1, 0, 1, 2, Math.PI]) {
        for (const pitch of [-.38, .12, .48]) {
          for (const expanded of [null, ...model.groups.map(({ id }) => id), 'skills']) {
            const scene = constellationScene(model, { width, height, camera: { yaw, pitch }, expanded, mode: expanded === 'skills' ? 'skills' : 'experience' });
            for (const [index, star] of scene.nodes.entries()) {
              assert.ok(star.width >= 44 && star.height === 104 && [star.x, star.y, star.depth].every(Number.isFinite));
              assert.ok(star.x - star.width / 2 >= 0 && star.x + star.width / 2 <= width);
              assert.ok(star.y - 22 >= 0 && star.y + star.height - 22 <= height - 60, 'Orbit controls remain unobscured');
              for (const other of scene.nodes.slice(index + 1)) {
                const overlap = Math.abs(star.x - other.x) < (star.width + other.width) / 2 && Math.abs(star.y - other.y) < (star.height + other.height) / 2;
                assert.equal(overlap, false, `${width}x${height}, ${yaw}/${pitch}, ${expanded}: ${star.id}/${other.id}`);
              }
            }
          }
        }
      }
    }
  }
});

test('rotation changes meaningful star positions and depth; nearest-turn angles stay bounded', () => {
  const settings = { width: 640, height: 520, expanded: 'toast' };
  const first = constellationScene(model, { ...settings, camera: { yaw: 0, pitch: .12 } });
  const rotated = constellationScene(model, { ...settings, camera: { yaw: 1, pitch: .12 } });
  assert.notDeepEqual(first.nodes.map(({ x, y, depth }) => [x, y, depth]), rotated.nodes.map(({ x, y, depth }) => [x, y, depth]));
  assert.ok(Math.abs(angleDelta(Math.PI - .05, -Math.PI + .05) - .1) < 1e-10);
  for (const angle of [-100000, -100, 0, 100, 100000]) assert.ok(Math.abs(wrapAngle(angle)) <= Math.PI);
});

test('discovered chapters keep their stars and paths without adding stale interactive targets', () => {
  const settings = { width: 640, height: 520, discovered: experiences.map(({ id }) => id) };
  const overview = constellationScene(model, settings);
  assert.equal(overview.nodes.length, 4, 'Only the four anchor buttons are interactive in the overview');
  assert.equal(overview.traces.length, 4);
  assert.equal(overview.traces.flatMap(({ nodes }) => nodes.filter(({ kind }) => kind === 'project')).length, 11);
  const open = constellationScene(model, { ...settings, expanded: 'goto' });
  assert.deepEqual(open.traces.map(({ id }) => id), ['toast', 'bevi', 'microsoft'], 'The selected path is not drawn a second time');
  for (const trace of open.traces) {
    assert.equal(trace.nodes[0], open.nodes.find(({ id }) => id === trace.id), 'Retained chapters remain attached to the resolved native anchor');
    if (trace.edges.length) assert.equal(trace.edges[0].from, trace.nodes[0]);
    assert.ok(trace.nodes.every(({ x, y, depth, opacity }) => [x, y, depth, opacity].every(Number.isFinite)));
    assert.ok(trace.edges.every(({ from, to }) => trace.nodes.includes(from) && trace.nodes.includes(to)));
  }
  const rotated = constellationScene(model, { ...settings, camera: { yaw: 1, pitch: .12 } });
  assert.notDeepEqual(overview.traces[0].nodes.map(({ x, y }) => [x, y]), rotated.traces[0].nodes.map(({ x, y }) => [x, y]));
  assert.deepEqual(constellationScene(model, { ...settings, mode: 'skills' }).traces, []);
  assert.deepEqual(constellationScene(model, { width: 640, height: 520 }).traces, []);
});

test('seven Dipper skills guide toward the eighth North Star without connecting lines', () => {
  for (const [width, height] of [[600, 440], [600, 450], [605.40625, 469], [640, 520], [773, 580]]) {
    const scene = constellationScene(model, { mode: 'skills', width, height });
    assert.deepEqual(scene.nodes.map(({ id }) => id), skills.map(({ id }) => id));
    assert.deepEqual(scene.edges, []);
    assert.equal(skills.length, 8);
    assert.deepEqual(skills.filter(({ northStar }) => northStar).map(({ id }) => id), ['vibe-coding']);
    const byId = new Map(scene.nodes.map((star) => [star.id, star]));
    const handle = ['iot', 'responsive', 'multi-device', 'game'].map((id) => byId.get(id));
    assert.ok(handle.slice(1).every((star, index) => star.x > handle[index].x), 'Three handle stars lead into the bowl');
    const leftTop = byId.get('game'), leftBottom = byId.get('illustration');
    const rightBottom = byId.get('research'), rightTop = byId.get('mentoring');
    assert.ok(leftTop.x < rightTop.x && leftBottom.x < rightBottom.x);
    assert.ok(leftTop.y < leftBottom.y && rightTop.y < rightBottom.y, 'Four stars form an open bowl silhouette');
    const north = byId.get('vibe-coding');
    assert.ok(north.y + north.height < rightTop.y, 'The North Star is clearly separated above the pointer stars');
    assert.ok(Math.abs(north.x - rightTop.x) < 15 && Math.abs(rightTop.x - rightBottom.x) < 15);
  }
});

test('full rotations and gradual unfolding have bounded continuous star trajectories without repacking jumps', () => {
  for (const [width, height] of [[280, 440], [640, 520], [960, 650]]) {
    for (const expanded of [null, ...experiences.map(({ id }) => id), 'skills']) {
      let previous;
      for (let step = 0; step <= 1200; step++) {
        const scene = constellationScene(model, {
          width, height, expanded, mode: expanded === 'skills' ? 'skills' : 'experience',
          camera: { yaw: -Math.PI + step * Math.PI / 600, pitch: .12 },
        });
        if (previous) {
          for (const [index, star] of scene.nodes.entries()) {
            const distance = Math.hypot(star.x - previous.nodes[index].x, star.y - previous.nodes[index].y);
            assert.ok(distance < 3, `${width}/${expanded}: ${star.id} jumped ${distance}px for a 0.3-degree turn`);
          }
        }
        previous = scene;
      }
    }
    for (const group of model.groups) {
      let previous;
      for (let step = 0; step <= 200; step++) {
        const scene = constellationScene(model, { width, height, expanded: group.id, unfold: step / 200, camera: { yaw: group.angle + .35, pitch: .12 } });
        if (previous) for (const [index, star] of scene.nodes.entries()) {
          const distance = Math.hypot(star.x - previous.nodes[index].x, star.y - previous.nodes[index].y);
          assert.equal(distance, 0, `${width}/${group.id}: revealing a star must not reflow the constellation`);
        }
        previous = scene;
      }
    }
  }
});

test('chapter layout changes begin at the currently drawn stars and keep lines attached throughout the transition', () => {
  const options = { width: 640, height: 520, discovered: ['toast', 'goto'], camera: { yaw: .2, pitch: .12 } };
  const previous = constellationScene(model, { ...options, expanded: 'toast' });
  const origins = new Map(previous.nodes.map((star) => [star.id, { ...star }]));
  const fresh = () => constellationScene(model, { ...options, expanded: 'goto', unfold: 0 });
  const start = transitionScene(fresh(), origins, 0);
  for (const star of start.nodes.filter(({ kind }) => kind === 'experience')) {
    assert.equal(star.x, origins.get(star.id).x);
    assert.equal(star.y, origins.get(star.id).y);
  }
  assert.ok(start.nodes.filter(({ kind }) => kind === 'project').every(({ opacity }) => opacity === 0));
  for (const star of start.traces[0].nodes) {
    assert.equal(star.x, origins.get(star.id).x, 'Completed project stars do not jump when becoming retained starlight');
    assert.equal(star.y, origins.get(star.id).y);
  }
  const halfway = transitionScene(fresh(), origins, .5);
  for (const { from, to } of halfway.edges) assert.ok(halfway.nodes.includes(from) && halfway.nodes.includes(to));
  for (const trace of halfway.traces) for (const { from, to } of trace.edges) assert.ok(trace.nodes.includes(from) && trace.nodes.includes(to));
  const final = transitionScene(fresh(), origins, 1);
  assert.deepEqual(final, fresh());
});
