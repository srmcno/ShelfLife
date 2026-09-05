// Art-space hinges. Split a limb across the plane perpendicular to its upper
// bone, then mount the lower artwork at the hinge. The unposed silhouette is
// unchanged; CSS can bend a knee/elbow without rotating the entire limb.
export const LIMB_JOINTS = {
  leg: {
    stubby: [0, 3, 3.8, 'body'], spindly: [-.9, 6, 1.6, 'accent'],
    bird: [-.25, 5, 1.45, 'accent'], hoof: [0, 4, 4.4, 'body'],
    many: [.8, 4, 1.25, 'accent'], tentacles: [.4, 4, 1.7, 'accent'],
    boots: [0, 2.8, 3.4, 'body'], bony: [-.6, 5.6, 1.6, 'bone']
  },
  arm: {
    stubby: [-5, 1, 3.4, 'bodyDark'], noodle: [-8, 5, 1.35, 'accent'],
    claw: [-7, 1, 1.25, 'accent'], paddle: [-5, 4, 3.4, 'bodyDark'],
    bones: [-6.6, 7.4, 1.7, 'bone'], mitts: [-6, 1.7, 1.3, 'accent']
  }
};

export function jointPlanes(x, y) {
  const length = Math.hypot(x, y);
  if (!length) throw new Error('A limb hinge must be away from its root');
  const nx = x / length, ny = y / length, reach = 100;
  const a = [x - ny * reach, y + nx * reach];
  const b = [x + ny * reach, y - nx * reach];
  return [-1, 1].map(side => [a, b,
    [b[0] + side * nx * reach, b[1] + side * ny * reach],
    [a[0] + side * nx * reach, a[1] + side * ny * reach]]);
}

export function articulateLimb(markup, kind, variant, colors) {
  const joint = LIMB_JOINTS[kind]?.[variant];
  if (!joint) return markup;
  const [x, y, radius, color] = joint;
  // IDs describe geometry, not a render counter: saves and postcard renders
  // remain deterministic. Every occurrence of an ID has identical clip data.
  const id = `sl-hinge-${kind}-${variant}`;
  const planes = jointPlanes(x, y).map(points => points.map(p => p.map(n => Number(n.toFixed(3))).join(',')).join(' '));
  return `<defs><clipPath id="${id}-upper" clipPathUnits="userSpaceOnUse"><polygon points="${planes[0]}"/></clipPath><clipPath id="${id}-lower" clipPathUnits="userSpaceOnUse"><polygon points="${planes[1]}"/></clipPath></defs>`
    + `<g clip-path="url(#${id}-upper)">${markup}</g>`
    + `<g transform="translate(${x} ${y})"><g class="cr-joint" data-joint="${kind === 'leg' ? 'knee' : 'elbow'}"><g transform="translate(${-x} ${-y})"><g clip-path="url(#${id}-lower)">${markup}</g></g></g></g>`
    + `<circle cx="${x}" cy="${y}" r="${radius}" fill="${colors[color]}"/>`;
}
