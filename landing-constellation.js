export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
export const angleDelta = (from, to) => wrapAngle(to - from);
const targetHeight = 104;
const verticalGap = targetHeight + 6;

export function projectPoint([x, y, z], rotation, tilt, size) {
  const yaw = rotation + tilt.x * .35;
  const pitch = .32 + tilt.y * .22;
  const turnedX = x * Math.cos(yaw) - z * Math.sin(yaw);
  const turnedZ = x * Math.sin(yaw) + z * Math.cos(yaw);
  const turnedY = y * Math.cos(pitch) - turnedZ * Math.sin(pitch);
  const depth = y * Math.sin(pitch) + turnedZ * Math.cos(pitch);
  const perspective = 3.8 / (3.8 - depth);
  return { x: turnedX * size * perspective, y: turnedY * size * perspective, depth };
}

export function constellationGeometry(experiences, skills) {
  const angles = [-.55, 1.02, 2.59, 4.16];
  const heights = [-.27, .24, -.04, -.12];
  const offsets = [
    [[.32, -.32, .08], [.68, -.1, -.06], [.78, .3, -.15], [.35, .57, .04]],
    [[.28, -.38, .05], [.67, -.27, -.08], [.85, .09, -.15], [.55, .4, .03], [.15, .55, -.05]],
    [[.35, -.32, .1], [.72, .2, -.05]],
    [],
  ];
  const groups = experiences.map((experience, index) => {
    const angle = angles[index];
    const origin = [Math.sin(angle) * .68, heights[index], Math.cos(angle) * .68];
    const projects = experience.projects.map((project, row) => {
      const [x, y, z] = offsets[index][row];
      return {
        id: project.id, kind: 'project', parent: experience.id,
        position: [origin[0] + Math.cos(angle) * x + Math.sin(angle) * z, origin[1] + y, origin[2] - Math.sin(angle) * x + Math.cos(angle) * z],
      };
    });
    return {
      id: experience.id, angle, anchor: { id: experience.id, kind: 'experience', position: origin },
      projects,
    };
  });
  const skillPositions = [[-1.22, .3, 0], [-.64, .04, 0], [-.06, -.02, 0], [.52, -.16, 0], [.52, .42, 0], [1.1, .42, 0], [1.1, -.16, 0], [1.1, -.92, 0]];
  return {
    groups,
    skills: skills.map((skill, index) => ({ id: skill.id, kind: 'skills', position: skillPositions[index] })),
    skillEdges: [],
  };
}

function packStars(stars, width, height) {
  const targetWidth = width < 420 ? 82 : 104;
  const left = targetWidth / 2 + 8;
  const right = Math.max(left, width - left);
  const top = 32;
  const bottom = Math.max(top, height - targetHeight - 44);
  const origins = stars.map((star) => ({ ...star, width: targetWidth, height: targetHeight, x: clamp(star.x, left, right), y: clamp(star.y, top, bottom) }));
  const placed = [];
  for (const origin of origins) {
    if (origin.opacity < .1) { placed.push(origin); continue; }
    const occupied = placed.filter((other) => other.opacity >= .1);
    const overlaps = (x, y) => occupied.some((other) => Math.abs(x - other.x) < targetWidth + 8 && Math.abs(y - other.y) < verticalGap);
    let best = null;
    const xs = [origin.x, left, right, ...occupied.flatMap(({ x }) => [x - targetWidth - 8, x + targetWidth + 8])];
    const ys = [origin.y, top, bottom, ...occupied.flatMap(({ y }) => [y - verticalGap, y + verticalGap])];
    for (const x of xs) for (const y of ys) {
      if (x < left || x > right || y < top || y > bottom || overlaps(x, y)) continue;
      const distance = (x - origin.x) ** 2 + (y - origin.y) ** 2;
      if (!best || distance < best.distance) best = { x, y, distance };
    }
    if (!best) {
      // Repack a crowded projection into nearest free slots instead of leaving overlapping buttons.
      const columns = Math.floor((right - left) / (targetWidth + 8)) + 1;
      const rows = Math.max(Math.ceil(origins.filter(({ opacity }) => opacity >= .1).length / columns), Math.floor((bottom - top) / verticalGap) + 1);
      const slots = Array.from({ length: columns * rows }, (_, index) => ({
        x: left + (right - left) * (index % columns) / Math.max(1, columns - 1),
        y: top + (bottom - top) * Math.floor(index / columns) / Math.max(1, rows - 1),
      }));
      return origins.map((star) => {
        if (star.opacity < .1) return star;
        const distance = ({ x, y }) => (x - star.x) ** 2 + (y - star.y) ** 2;
        const nearest = slots.reduce((bestIndex, slot, index) => distance(slot) < distance(slots[bestIndex]) ? index : bestIndex, 0);
        return { ...star, ...slots.splice(nearest, 1)[0] };
      });
    }
    placed.push({ ...origin, x: best.x, y: best.y });
  }
  return placed;
}

// Choose separation directions once from the resting layout, not again at every camera angle.
export function arrangeStars(stars, width, height, reference = stars) {
  const resting = packStars(reference, width, height);
  const targetWidth = width < 420 ? 82 : 104;
  const left = targetWidth / 2 + 8;
  const right = Math.max(left, width - left);
  const top = 32;
  const bottom = Math.max(top, height - targetHeight - 44);
  const points = stars.map((star) => ({ ...star, width: targetWidth, height: targetHeight, x: clamp(star.x, left, right), y: clamp(star.y, top, bottom) }));
  const constraints = [];
  for (let from = 0; from < resting.length; from++) {
    for (let to = from + 1; to < resting.length; to++) {
      const dx = resting[to].x - resting[from].x;
      const dy = resting[to].y - resting[from].y;
      const axis = Math.abs(dx) / (targetWidth + 8) >= Math.abs(dy) / verticalGap ? 'x' : 'y';
      constraints.push({ from, to, axis, sign: Math.sign(axis === 'x' ? dx : dy), gap: axis === 'x' ? targetWidth + 8 : verticalGap });
    }
  }
  for (let pass = 0; pass < 160; pass++) {
    let correction = 0;
    for (const { from, to, axis, sign, gap } of constraints) {
      const a = points[from];
      const b = points[to];
      const overlap = gap - (b[axis] - a[axis]) * sign;
      if (overlap <= .001) continue;
      correction = Math.max(correction, overlap);
      a[axis] -= sign * overlap / 2;
      b[axis] += sign * overlap / 2;
    }
    for (const point of points) {
      point.x = clamp(point.x, left, right);
      point.y = clamp(point.y, top, bottom);
    }
    if (correction < .01) break;
  }
  return points;
}

export function transitionScene(scene, origins, progress) {
  const time = clamp(progress, 0, 1);
  const amount = time * time * (3 - 2 * time);
  const stars = new Set([...scene.nodes, ...scene.traces.flatMap(({ nodes }) => nodes)]);
  for (const star of stars) {
    const previous = origins.get(star.id);
    const origin = previous || origins.get(star.parent);
    if (origin) {
      star.x = origin.x + (star.x - origin.x) * amount;
      star.y = origin.y + (star.y - origin.y) * amount;
    }
    star.opacity = previous ? previous.opacity + (star.opacity - previous.opacity) * amount : star.opacity * amount;
  }
  return scene;
}

function shortestChapterPath(anchor, projects) {
  let shortest = [];
  let shortestDistance = Infinity;
  function visit(path, remaining, distance) {
    if (distance >= shortestDistance) return;
    if (!remaining.length) {
      shortest = path;
      shortestDistance = distance;
      return;
    }
    const from = path.at(-1);
    for (const [index, to] of remaining.entries()) {
      visit([...path, to], remaining.filter((_, row) => row !== index), distance + Math.hypot(to.x - from.x, to.y - from.y));
    }
  }
  visit([anchor], projects, 0);
  return shortest.slice(1).map((star, index) => [shortest[index].id, star.id]);
}

export function constellationScene(model, { mode = 'experience', expanded = null, discovered = [], unfold = 1, camera = { yaw: 0, pitch: .12 }, width, height }) {
  const group = model.groups.find(({ id }) => id === expanded);
  const size = Math.min(width, height) * .44;
  const project = (star, view = camera) => {
    const projected = projectPoint(star.position, view.yaw, { x: 0, y: (view.pitch - .32) / .22 }, size);
    return {
      ...star, x: width / 2 + projected.x, y: height * .47 + projected.y,
      depth: projected.depth, opacity: star.reveal * (.55 + clamp((projected.depth + 1) / 2, 0, 1) * .45),
    };
  };
  const restingCamera = { yaw: group && mode === 'experience' ? group.angle + .35 : 0, pitch: .12 };
  const restingSources = mode === 'skills' ? model.skills : [...model.groups.map(({ anchor }) => anchor), ...(group?.projects || [])];
  const reference = restingSources.map((star) => project({ ...star, reveal: 1 }, restingCamera));
  function chapterEdges(chapter) {
    if (!chapter.projects.length) return [];
    // Route the resting layout so camera movement never rewires the constellation.
    const chapterReference = chapter === group ? reference : [...model.groups.map(({ anchor }) => anchor), ...chapter.projects]
      .map((star) => project({ ...star, reveal: 1 }, { yaw: chapter.angle + .35, pitch: .12 }));
    const resting = new Map(arrangeStars(chapterReference, width, height).map((star) => [star.id, star]));
    return shortestChapterPath(resting.get(chapter.id), chapter.projects.map(({ id }) => resting.get(id)));
  }
  const path = mode === 'skills' ? model.skillEdges : group ? chapterEdges(group) : [];
  const revealOrder = new Map(path.map(([, id], index) => [id, index]));
  const sources = mode === 'skills' ? model.skills.map((star) => ({ ...star, reveal: 1 })) : [
    ...model.groups.map(({ anchor }) => ({ ...anchor, reveal: 1 })),
    ...(group ? group.projects.map((star) => {
      const progress = clamp((unfold - revealOrder.get(star.id) * .09) / .64, 0, 1);
      return { ...star, reveal: clamp((progress - .18) / .5, 0, 1) };
    }) : []),
  ];
  const nodes = arrangeStars(sources.map((star) => project(star)), width, height, reference);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges = path.map(([from, to]) => ({
    from: byId.get(from), to: byId.get(to),
  }));
  const traces = mode === 'skills' ? [] : model.groups.filter(({ id }) => discovered.includes(id) && id !== expanded).map((chapter) => {
    const stars = [byId.get(chapter.id), ...chapter.projects.map((star) => project({ ...star, reveal: 1 }))];
    const points = new Map(stars.map((star) => [star.id, star]));
    return { id: chapter.id, nodes: stars, edges: chapterEdges(chapter).map(([from, to]) => ({ from: points.get(from), to: points.get(to) })) };
  });
  return { nodes, edges, traces, width, height };
}
