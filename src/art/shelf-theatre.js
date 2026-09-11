import { createPuppet, reserveShelfAnimation } from './animator.js';

export const SHELF_SCENE_MS = 11200;
const ACTIONS = new Set(['bath', 'lamp', 'dance', 'tug', 'mirror', 'meal', 'phone', 'comfort', 'argument', 'makeup']);
const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const smooth = n => { const t = clamp(n); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

// Authored eyes can sit low on a blob or high above long legs. Seat the body
// inside the bath using its actual face height, keeping a little body below
// water and the face above it instead of assuming every sprite fills its box.
export function bathWaterPlacement(size, bathSize, eyesAboveFeet = size * .5) {
  const waterDepth = bathSize * 22 / 60;
  const lift = clamp(waterDepth + size * .12 - eyesAboveFeet * .82, 0, Math.max(0, waterDepth - size * .08));
  return { lift, clip: waterDepth - lift };
}

export function furnitureSceneX(center, side, actorSize, propWidth, cabinetWidth) {
  // Leave the furniture's complete art box between the residents. The old
  // partner-only spacing put both bodies over the lamp shade and phone dial.
  const reach = (actorSize + propWidth) / 2 + 6;
  return clamp(center + (side < 0 ? -reach : reach), actorSize / 2, cabinetWidth - actorSize / 2);
}

// Normalized choreography is independent of DOM size and wall-clock timers.
// Translation is on a carrier, leaving the resident's authored body rig intact.
export function shelfSceneFrame(action, elapsed, reduced = false) {
  const t = clamp(elapsed, 0, SHELF_SCENE_MS);
  const arriving = t < 2200, leaving = t >= 8600;
  const progress = arriving ? smooth(t / 2200) : leaving ? 1 - smooth((t - 8600) / 2200) : 1;
  const active = !arriving && !leaving;
  const beat = Math.max(0, t - 2200) / 1000;
  const actors = [0, 1].map(i => ({
    travel: reduced ? 1 : progress, lift: 0, offset: 0, angle: 0, scale: 1,
    pose: '', moving: !reduced && (arriving || (leaving && t < 10800)), airborne: false
  }));
  if (action === 'bath') {
    const a = actors[0];
    a.scale = mix(1, .82, a.travel);
    if (!reduced && (arriving || (leaving && t < 10800))) {
      const p = arriving ? clamp(t / 2200) : clamp((t - 8600) / 2200);
      a.lift = Math.sin(p * Math.PI) * .65;
      a.airborne = true;
    }
    if (active || reduced) {
      a.pose = 'wash'; a.angle = reduced ? 0 : Math.sin(beat * 7) * 3;
      actors[1].pose = 'receive'; actors[1].angle = reduced ? -6 : Math.sin(beat * 3) * 5;
    }
  } else if (active || reduced) {
    actors.forEach((a, i) => {
      const sign = i ? -1 : 1;
      if (action === 'dance') { a.pose = 'dance'; a.angle = reduced ? sign * 6 : Math.sin(beat * 4.7 + i * Math.PI) * 9; a.lift = reduced ? 0 : Math.max(0, Math.sin(beat * 4.7)) * .08; }
      if (action === 'tug') { a.pose = 'pull'; a.angle = sign * -9; a.offset = reduced ? sign * -.05 : Math.sin(beat * 4) * .055 - sign * .035; }
      if (action === 'mirror') { a.pose = 'mirror'; a.angle = reduced ? -8 : Math.sin((beat - i * .23) * 2.8) * 12; }
      if (action === 'comfort' || action === 'makeup') { a.pose = i ? 'receive' : 'comfort'; a.angle = sign * 6; }
      if (action === 'argument') { a.pose = 'argue'; a.angle = reduced ? sign * -7 : sign * (-4 + Math.sin(beat * 3 + i * Math.PI) * 5); }
      if (action === 'meal') a.pose = 'eat';
      if (action === 'phone') { a.pose = 'phone'; a.angle = i ? 0 : -7; }
      if (action === 'lamp') { a.pose = 'switch'; a.angle = sign * (reduced ? 5 : Math.max(0, Math.sin(beat * 3)) * 8); }
    });
  }
  return {
    actors, active: active || reduced, bathInside: action === 'bath' && (active || reduced),
    splash: action === 'bath' && active && !reduced,
    lampBeat: t < 3000 ? 0 : t < 5300 ? 1 : t < 7500 ? 2 : 3,
    caption: t < 3700 ? 0 : t < 7100 ? 1 : 2,
    done: t >= SHELF_SCENE_MS
  };
}

function element(tag, cls, parent) {
  const el = document.createElement(tag);
  el.className = cls;
  if (parent) parent.appendChild(el);
  return el;
}

function cleanClone(original) {
  const clone = original.cloneNode(true);
  // Art is local markup, but cloned SVG ids must remain unique in the document.
  const prefix = 'theatre-' + (++cloneSerial) + '-';
  const ids = new Map();
  clone.querySelectorAll('[id]').forEach(el => { ids.set(el.id, prefix + el.id); el.id = prefix + el.id; });
  clone.querySelectorAll('*').forEach(el => {
    for (const attr of [...el.attributes]) {
      let value = attr.value;
      for (const [oldId, newId] of ids) {
        value = value.split('url(#' + oldId + ')').join('url(#' + newId + ')');
        if ((attr.name === 'href' || attr.name === 'xlink:href') && value === '#' + oldId) value = '#' + newId;
      }
      if (value !== attr.value) el.setAttribute(attr.name, value);
    }
  });
  clone.removeAttribute('id');
  clone.querySelectorAll('.sl-bubble,.sl-zzz,.care-motes').forEach(el => el.remove());
  delete clone.dataset.slReserved;
  return clone;
}
let cloneSerial = 0;

function bathArt(root, side) {
  const el = element('div', 'shelf-theatre-tub shelf-theatre-tub-' + side, root);
  // The water/back and opaque front are distinct planes. The actor sits between
  // them; this is a bath entered by a body, rather than a bath icon being poked.
  el.innerHTML = side === 'back'
    ? '<svg viewBox="0 0 60 60"><rect x="8" y="25" width="44" height="22" rx="10" fill="#788F99"/><ellipse cx="30" cy="29" rx="20" ry="6" fill="#B9EEE0"/><ellipse cx="30" cy="29" rx="16" ry="3" fill="#83CBBF"/></svg>'
    : '<svg viewBox="0 0 60 60"><path d="M8 30Q30 38 52 30V37Q52 48 42 48H18Q8 48 8 37Z" fill="#B9C6CC"/><path d="M9 30Q30 37 51 30" fill="none" stroke="#E1EBED" stroke-width="3"/><path d="M15 48V52M45 48V52" stroke="#8A979D" stroke-width="5" stroke-linecap="round"/><path d="M16 38Q27 43 40 39" fill="none" stroke="#D6E2E5" stroke-width="2"/></svg>';
  return el;
}

/**
 * Plays an already-committed engine event. Never awards care or mutates saves.
 * onDone(event, {cancelled, reason}) also fires on cancellation, so UI cannot
 * remain busy after a resize, drag, visibility change or a replaced resident.
 */
export function initShelfTheatre({ getState = () => null, onCaption = () => {}, onDone = () => {} } = {}) {
  let scene = null;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  function stop(reason = 'stopped') {
    const current = scene;
    if (!current) return;
    scene = null;
    cancelAnimationFrame(current.raf);
    current.abort.abort();
    current.observer?.disconnect();
    current.resize?.disconnect();
    current.actors.forEach(a => { a.puppet.release(); a.original.classList.remove('sl-theatre-source'); });
    current.prop?.classList.remove('sl-theatre-prop-source');
    current.prop?.removeAttribute('data-theatre-lit');
    current.release();
    current.root.remove();
    onDone(current.event, { cancelled: reason !== 'complete', reason });
  }

  function play(event) {
    if (!event || !ACTIONS.has(event.action) || !Array.isArray(event.actorIds) || event.actorIds.length < 1 || event.actorIds.length > 2) return false;
    const cabinet = document.getElementById('cabinet');
    const host = document.getElementById('cabinetWrap');
    if (!cabinet || !host || document.hidden || !cabinet.getClientRects().length || cabinet.closest('[hidden]') || document.querySelector('.veil.open,.piece.dragging')) return false;
    const ids = [...new Set(event.actorIds)];
    if (ids.length !== event.actorIds.length) return false;
    const pieces = [...cabinet.querySelectorAll('.pet[data-id]')];
    const originals = ids.map(id => pieces.find(el => el.dataset.id === id));
    if (originals.some(el => !el?.querySelector('.sprite.sl2'))) return false;
    const prop = event.propId ? [...cabinet.querySelectorAll('.prop[data-id]')].find(el => el.dataset.id === event.propId) : null;
    if (event.propId && !prop) return false;
    if (['bath', 'lamp', 'meal', 'phone'].includes(event.action) && !prop) return false;
    const positions = originals.concat(prop ? [prop] : []).map(el => Number(el.dataset.slot));
    if (positions.some(n => !Number.isFinite(n)) || Math.floor(Math.min(...positions) / 6) !== Math.floor(Math.max(...positions) / 6) || Math.max(...positions) - Math.min(...positions) > 2) return false;
    const initialBox = host.getBoundingClientRect();
    if (initialBox.width < 1 || initialBox.height < 1) return false;
    stop('replaced');
    const release = reserveShelfAnimation(cabinet);
    const root = element('div', 'shelf-theatre', host);
    root.dataset.action = event.action;
    root.dataset.slTheatre = '1';
    root.setAttribute('aria-hidden', 'true');
    const isReduced = reduced.matches;
    if (isReduced) root.classList.add('shelf-theatre-still');
    const base = host.getBoundingClientRect();
    const abort = new AbortController();
    const actors = originals.map(piece => {
      const original = piece.querySelector('.sprite.sl2');
      const rect = piece.getBoundingClientRect();
      const size = original.offsetWidth || original.getBoundingClientRect().width;
      const eyes = [...original.querySelectorAll('[data-part="eye"],.sprite-stamp[data-kind="eyes"]')]
        .map(el => el.getBoundingClientRect()).filter(r => r.height > 0);
      const eyesAboveFeet = eyes.length ? clamp(rect.bottom - Math.max(...eyes.map(r => r.bottom)), size * .08, size) : size * .5;
      const carrier = element('div', 'shelf-theatre-actor', root);
      carrier.style.width = size + 'px'; carrier.style.height = size + 'px';
      const pose = element('div', 'shelf-theatre-pose', carrier);
      const clone = cleanClone(original);
      pose.appendChild(clone);
      const puppet = createPuppet(clone);
      original.classList.add('sl-theatre-source');
      return { id: piece.dataset.id, piece, original, carrier, pose, clone, puppet, size, eyesAboveFeet,
        homeX: rect.left + rect.width / 2 - base.left, floor: rect.bottom - base.top,
        slot: piece.dataset.slot, lastPose: '', lastMove: '' };
    });
    const floor = actors[0].floor;
    const propRect = prop?.querySelector('svg')?.getBoundingClientRect();
    const midpoint = propRect ? propRect.left + propRect.width / 2 - base.left : actors.reduce((n, a) => n + a.homeX, 0) / actors.length;
    const pitch = originals[0].getBoundingClientRect().width;
    const maxSize = Math.max(...actors.map(a => a.size));
    const bathSize = Math.min(maxSize * 1.38, pitch * 2.05);
    const bathSeat = bathWaterPlacement(actors[0].size, bathSize, actors[0].eyesAboveFeet);
    const center = clamp(midpoint, maxSize * .55, base.width - maxSize * .55);
    const spacing = Math.min(pitch * .48, maxSize * .38);
    const furnitureSize = propRect ? event.action === 'lamp' ? propRect.width : Math.max(propRect.width, Math.min(pitch, maxSize * .75)) : 0;
    actors.forEach((a, i) => {
      if (event.action === 'bath') a.targetX = i ? center + (a.homeX < center ? -1 : 1) * spacing * 1.5 : center;
      else if (prop && event.action !== 'tug') {
        const side = actors.length === 1 ? (a.homeX < center ? -1 : 1) : (a.homeX <= actors[1 - i].homeX ? -1 : 1);
        a.targetX = furnitureSceneX(center, side, a.size, furnitureSize, base.width);
      }
      else if (prop && actors.length === 1) a.targetX = center + (a.homeX < center ? -1 : 1) * spacing;
      else a.targetX = center + (actors.length === 1 || a.homeX <= actors[1 - i].homeX ? -1 : 1) * spacing;
      a.targetX = clamp(a.targetX, a.size * .45, base.width - a.size * .45);
    });
    let bathBack, bathFront, splash, rope, effect, propClone;
    if (event.action === 'bath') {
      prop.classList.add('sl-theatre-prop-source');
      bathBack = bathArt(root, 'back'); bathFront = bathArt(root, 'front');
      for (const tub of [bathBack, bathFront]) {
        tub.style.width = bathSize + 'px'; tub.style.height = bathSize + 'px';
        tub.style.left = (center - bathSize / 2) + 'px'; tub.style.top = (floor - bathSize * 52 / 60) + 'px';
      }
      splash = element('div', 'shelf-theatre-splash', root);
      splash.style.left = center + 'px'; splash.style.top = (floor - bathSize * 22 / 60) + 'px';
      for (let i = 0; i < 7; i++) {
        const drop = element('i', '', splash);
        drop.style.setProperty('--drop-x', ((i - 3) * bathSize * .09) + 'px');
        drop.style.setProperty('--drop-rise', (-14 - i % 3 * 9) + 'px');
        drop.style.setProperty('--drop-delay', (i * -.16) + 's');
      }
    }
    if (prop && propRect && event.action !== 'bath' && event.action !== 'lamp') {
      prop.classList.add('sl-theatre-prop-source');
      propClone = element('div', 'shelf-theatre-furniture', root);
      const size = furnitureSize;
      propClone.style.width = size + 'px'; propClone.style.height = size + 'px';
      propClone.style.left = (center - size / 2) + 'px'; propClone.style.top = (floor - size) + 'px';
      propClone.appendChild(cleanClone(prop.querySelector('svg')));
    }
    if (event.action === 'tug' && actors.length === 2) rope = element('div', 'shelf-theatre-rope', root);
    if (['dance', 'comfort', 'makeup', 'argument', 'phone', 'meal'].includes(event.action)) {
      effect = element('div', 'shelf-theatre-symbol', root);
      effect.textContent = ({ dance: '♫', comfort: '♡', makeup: '♡', argument: '! ?', phone: '…', meal: '· · ·' })[event.action];
      effect.style.left = center + 'px'; effect.style.top = Math.max(3, floor - maxSize * .86) + 'px';
    }
    const current = scene = { event, root, actors, prop, release, abort, raf: 0, observer: null, resize: null, caption: -1 };
    const slotSignature = JSON.stringify(getState()?.slots || positions);
    const stillValid = () => !document.hidden && cabinet.getClientRects().length > 0 && !cabinet.closest('[hidden]') && !document.querySelector('.veil.open,.piece.dragging') &&
      actors.every(a => a.original.isConnected && a.piece.dataset.slot === a.slot && a.piece.querySelector('.sprite.sl2') === a.original) &&
      (!prop || prop.isConnected) && JSON.stringify(getState()?.slots || positions) === slotSignature;
    const cancel = () => stop('interrupted');
    cabinet.addEventListener('pointerdown', cancel, { capture: true, passive: true, signal: abort.signal });
    window.addEventListener('resize', cancel, { passive: true, signal: abort.signal });
    document.addEventListener('visibilitychange', cancel, { signal: abort.signal });
    reduced.addEventListener('change', cancel, { signal: abort.signal });
    // Watch dialog state and DOM replacement, not every animated style update.
    current.observer = new MutationObserver(() => { if (scene === current && !stillValid()) cancel(); });
    current.observer.observe(cabinet, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-slot', 'hidden'] });
    document.querySelectorAll('.veil').forEach(el => current.observer.observe(el, { attributes: true, attributeFilter: ['class'] }));
    current.observer.observe(document.body, { attributes: true, attributeFilter: ['data-active-dialog', 'data-tab'] });
    if (typeof ResizeObserver !== 'undefined') {
      current.resize = new ResizeObserver(() => {
        const rect = host.getBoundingClientRect();
        if (scene === current && (Math.abs(rect.width - base.width) > 1 || Math.abs(rect.height - base.height) > 1)) cancel();
      });
      current.resize.observe(host);
    }
    const lines = Array.isArray(event.lines) ? event.lines.filter(line => typeof line?.text === 'string').slice(0, 3) : [];
    if (!lines.length) lines.push({ text: event.summary || event.title || 'Life on the shelf.', actorId: '' });
    const speech = element('div', 'shelf-theatre-speech', root);
    const speaker = element('b', 'shelf-theatre-speaker', speech);
    const spoken = element('span', 'shelf-theatre-spoken', speech);
    const castLeft = Math.min(...actors.map(a => Math.min(a.homeX, a.targetX) - a.size / 2), prop ? center - (event.action === 'bath' ? bathSize : propRect?.width || 0) / 2 : Infinity);
    const castRight = Math.max(...actors.map(a => Math.max(a.homeX, a.targetX) + a.size / 2), prop ? center + (event.action === 'bath' ? bathSize : propRect?.width || 0) / 2 : -Infinity);
    function placeSpeech() {
      let width = Math.min(240, Math.max(1, base.width - 16));
      speech.style.width = width + 'px';
      let height = speech.offsetHeight;
      let left = clamp(center - width / 2, 8, base.width - width - 8);
      let top = floor - maxSize - height - 12;
      if (top < 8) {
        // On a short first shelf there is no headroom. Use empty horizontal
        // shelf space instead of pinning the bubble over the bathing resident.
        const freeLeft = castLeft - 20, freeRight = base.width - castRight - 20;
        const right = freeRight >= freeLeft, room = Math.max(freeLeft, freeRight);
        if (room >= 132) {
          width = Math.min(240, room); speech.style.width = width + 'px';
          height = speech.offsetHeight;
          left = right ? base.width - width - 8 : 8;
          top = clamp(floor - maxSize * .9, 8, Math.max(8, base.height - height - 8));
        } else {
          // A crowded row uses a shallow caption in the space below the feet.
          // This keeps the bodies readable without changing cabinet geometry.
          width = Math.max(1, base.width - 16); speech.style.width = width + 'px';
          height = speech.offsetHeight; left = 8;
          top = floor + 36;
          if (top + height > base.height - 8) {
            // Last-row fallback: the larger side still gives the character its
            // stage. Narrow copy wraps naturally; it never obscures the cast.
            width = Math.max(60, room); speech.style.width = width + 'px';
            height = speech.offsetHeight; left = right ? base.width - width - 8 : 8;
            top = clamp(floor - maxSize, 8, Math.max(8, base.height - height - 8));
          }
        }
      }
      speech.style.left = left + 'px'; speech.style.top = Math.max(8, top) + 'px';
    }
    let started = null, validateAt = 0;
    function draw(time) {
      if (scene !== current) return;
      if (time >= validateAt) {
        validateAt = time + 250;
        if (!stillValid()) { cancel(); return; }
      }
      if (started === null) started = time;
      const frame = shelfSceneFrame(event.action, time - started, isReduced);
      const captionIndex = Math.min(lines.length - 1, frame.caption);
      if (captionIndex !== current.caption) {
        current.caption = captionIndex;
        const actor = actors.find(a => a.id === lines[captionIndex].actorId);
        speaker.textContent = actor?.piece.querySelector('.nameplate')?.textContent || 'On the shelf';
        spoken.textContent = lines[captionIndex].text;
        placeSpeech();
        onCaption(lines[captionIndex].text, lines[captionIndex].actorId || '');
        // A callback may open a dialog or stop the controller.
        if (scene !== current) return;
      }
      const drawn = [];
      actors.forEach((a, i) => {
        const motion = frame.actors[i];
        const x = mix(a.homeX, a.targetX, motion.travel) + motion.offset * a.size;
        const seatLift = event.action === 'bath' && i === 0 ? bathSeat.lift * motion.travel : 0;
        const lift = motion.lift * a.size + seatLift;
        const travellingTo = motion.travel < 1 && time - started >= 8600 ? a.homeX - a.targetX : a.targetX - a.homeX;
        const face = motion.moving && Math.abs(travellingTo) > 2 ? Math.sign(travellingTo) : (x < center ? 1 : -1);
        const canFly = a.clone.classList.contains('sl-can-flap');
        const moveKey = [motion.moving, face, motion.airborne || canFly && motion.moving].join('/');
        if (moveKey !== a.lastMove) { a.puppet.move(motion.moving, face, motion.airborne || canFly && motion.moving); a.lastMove = moveKey; }
        a.carrier.style.transform = 'translate(' + (x - a.size / 2).toFixed(2) + 'px,' + (a.floor - a.size - lift).toFixed(2) + 'px)';
        a.pose.style.transform = 'rotate(' + motion.angle.toFixed(2) + 'deg) scale(' + motion.scale + ')';
        if (motion.pose !== a.lastPose) {
          a.pose.dataset.pose = motion.pose; a.lastPose = motion.pose;
          // The idle rig intentionally stills planted legs. A dance is an
          // explicit stepping action, so it must opt out of that idle rule.
          a.clone.classList.toggle('sl-stepping', motion.pose === 'dance');
        }
        // Clip the submerged body at the waterline; the rim/front then covers
        // the cut, including drawings and unusually long authored legs.
        a.carrier.style.clipPath = i === 0 && frame.bathInside ? 'inset(-100% -50% ' + bathSeat.clip.toFixed(2) + 'px -50%)' : '';
        drawn.push({ x, y: a.floor - a.size * .37 });
      });
      if (splash) splash.hidden = !frame.splash;
      if (rope) {
        const left = Math.min(drawn[0].x, drawn[1].x), right = Math.max(drawn[0].x, drawn[1].x);
        rope.hidden = !frame.active; rope.style.left = left + 'px'; rope.style.width = (right - left) + 'px'; rope.style.top = Math.min(drawn[0].y, drawn[1].y) + 'px';
      }
      if (effect) effect.hidden = !frame.active;
      if (propClone) propClone.dataset.active = String(frame.active);
      if (event.action === 'lamp') {
        const before = event.before?.lit !== false, after = event.after?.lit !== false;
        const lit = isReduced ? after : frame.lampBeat === 0 ? before : frame.lampBeat === 1 && actors.length === 2 ? !after : after;
        prop.dataset.theatreLit = String(lit);
      }
      if (frame.done) { stop('complete'); return; }
      current.raf = requestAnimationFrame(draw);
    }
    current.raf = requestAnimationFrame(draw);
    return true;
  }
  return { play, stop, isPlaying: () => !!scene };
}
