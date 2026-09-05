import { resolveMotion } from '../art/anatomy.js';
export function artPersonality(pet) {
  const motion = resolveMotion(pet), parts = pet.art?.creature?.parts || {};
  const stamps = new Set((pet.art?.stamps || []).map(s => s.kind));
  const horns = stamps.has('horns') || stamps.has('antlers') || ['curled', 'spiky', 'antlers', 'stub', 'nubs'].includes(parts.top);
  const halo = stamps.has('halo') || parts.top === 'halo';
  const features = [];
  if (motion.canFlap) features.push({ name: 'Aerial opinions', text: 'Wings let it cross empty spaces by air. It considers floor-level disputes beneath it.' });
  if (horns) features.push({ name: 'Personal space', text: 'Horns intimidate gentle neighbours. They prefer a little distance (−1.5 neighbour appeal).' });
  if (halo) features.push({ name: 'Centre of attention', text: 'Its halo draws company. Neighbours lose attention 10% more slowly.' });
  if (motion.gait === 'ooze' || motion.legs >= 6) features.push({ name: 'Too many points of view', text: 'Tentacles make it scuttle or pour along the wood. It counts each limb as a witness.' });
  if (!features.length) features.push({ name: motion.canWalk ? 'Small steps, large opinions' : 'Unstoppable blob', text: motion.canWalk ? 'Its legs let it sneak between nearby spaces. Every step is a decision.' : 'It hops where legs would be useful. This has never stopped it having plans.' });
  return { horns, halo, motion, features };
}
