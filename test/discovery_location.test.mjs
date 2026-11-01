import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coarseCell } from '../src/ui/discovery.js';

test('location is reduced to a validated, broad area including poles and antimeridian',()=>{
  assert.deepEqual(coarseCell(41.8781,-87.6298),coarseCell(41.87,-87.62));
  for (const [lat,lon] of [[-90,-180],[90,180],[0,0],[89.999,179.999],[-89.999,-179.999]]) {
    const cell=coarseCell(lat,lon);
    const columns=Math.max(1,Math.floor(360*Math.cos((cell.lat-89.5)*Math.PI/180)));
    assert.ok(Number.isInteger(cell.lat) && cell.lat>=0 && cell.lat<=179);
    assert.ok(Number.isInteger(cell.lon) && cell.lon>=0 && cell.lon<columns);
  }
  for (const [lat,lon] of [[NaN,0],[91,0],[-91,0],[0,181],[0,-181],[null,0]]) assert.throws(()=>coarseCell(lat,lon));
});
