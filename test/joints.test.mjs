import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jointPlanes, LIMB_JOINTS } from '../src/art/joints.js';
import { generateCreature, renderCreatureSVG, LEGS, ARMS, BASELINE } from '../src/art/creatures.js';
import { STAMP_SVG } from '../src/art/stamps.js';

test('every articulated style splits at a shared hinge with opposite clipping half planes', () => {
  for (const kind of ['leg','arm']) {
    const library = kind === 'leg' ? LEGS : ARMS;
    for (const variant of Object.keys(library).filter(v => v !== 'none')) {
      const [x,y] = LIMB_JOINTS[kind][variant];
      const [near,far] = jointPlanes(x,y);
      assert.deepEqual(near.slice(0,2), far.slice(0,2));
      const project = ([px,py]) => (px-x)*x+(py-y)*y;
      assert.ok(near.slice(2).every(p => project(p)<0));
      assert.ok(far.slice(2).every(p => project(p)>0));
      assert.ok(near.slice(0,2).every(p => Math.abs(project(p))<1e-9));
    }
  }
});
test('generated knees and elbows follow actual anatomy and feet share the shelf baseline', () => {
  for(let i=0;i<100;i++) {
    const c=generateCreature({seed:'joints-'+i});
    const svg=renderCreatureSVG(c);
    assert.equal((svg.match(/data-joint="knee"/g)||[]).length,c.anatomy.legCount);
    assert.equal((svg.match(/data-joint="elbow"/g)||[]).length,c.anatomy.armCount);
    for(const leg of c.rig.legs) assert.equal(leg.y+LEGS[c.parts.legs].length,BASELINE);
    assert.equal(svg,renderCreatureSVG(JSON.parse(JSON.stringify(c))));
  }
});
test('drawn arm and leg stamps also have independent lower limbs', () => {
  assert.equal((STAMP_SVG.arms.match(/data-joint="elbow"/g)||[]).length,2);
  assert.equal((STAMP_SVG.legs.match(/data-joint="knee"/g)||[]).length,2);
  assert.equal((STAMP_SVG.arms.match(/data-part="arm"/g)||[]).length,2);
  assert.equal((STAMP_SVG.legs.match(/data-part="leg"/g)||[]).length,2);
});
