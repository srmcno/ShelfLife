import { FRENZY_ITEMS, FRENZY_WAVES, FRENZY_BOSS_LINES, WHACK_WAVES, STACK_HEIGHT_LINES } from '../content/arcade.js';
import { frenzyStep, frenzyMult, FRENZY, stackStep, stackDrop, seanceShown, seanceInput, seanceSchedule, seanceWanted, whackStep, whackHit, WHACK } from '../engine/arcade.js';
import { arcadeGlyph, bossMarkup } from '../art/arcade-art.js';

/* The four playfields. Each view builds its own DOM inside the shaken `world`
   element, steps its simulation (engine/arcade.js) once a frame, and turns the
   events that come back into particles, sounds, banners and a reaction from the
   resident.

   Positions are written as transforms and nothing here reads layout in the
   frame: the field is measured once (and again on resize) by the shell, which
   hands the size over as `A.size`. Moving things are recycled from small pools.

   `A` is the shell's api: { g, run, field, world, fx, size, sfx, haptic, say,
   react, mkPet, pet } (see ui/arcade.js). */

const f1 = n => n.toFixed(1);
const pick = list => list[Math.floor(Math.random() * list.length)];
const SEANCE_NAMES = ['Bone candle', 'Wax candle', 'Tallow candle', 'Black candle'];

/* ---------- Feeding Frenzy ---------- */
const BAD_WORDS = { holy: ['Holy water!', 'Blessed. Ow.', 'Damp and righteous'], soap: ['Soap!', 'Clean. Horribly.', 'Lathered'], trap: ['Snap!', 'The trap won', 'Ow. Cheese?'] };
const HIT_PARTICLES = { holy: 'water', soap: 'spark', trap: 'bone' };
const GOOD_PARTICLES = { crumb: 'crumb', raisin: 'crumb', tooth: 'tooth', heart: 'blood' };

export function frenzyView() {
  const nodes = new Map(), pool = new Map();
  let itemsEl, catcherEl, bossEl, gapEl, moving = '', frenzied = false, lastNear = 0, bossOn = false, lastCombo = 0;
  const grab = kind => {
    const list = pool.get(kind);
    let n = list?.pop();
    if (!n) {
      const def = FRENZY_ITEMS[kind];
      n = document.createElement('span');
      n.className = 'ar-item ' + (def.good ? 'good' : 'bad') + ' k-' + kind;
      n.innerHTML = arcadeGlyph(def.glyph);
      n.dataset.kind = kind;
    }
    n.hidden = false;
    return n;
  };
  const drop = n => { n.hidden = true; const k = n.dataset.kind; if (!pool.has(k)) pool.set(k, []); pool.get(k).push(n); };
  return {
    controls: () => '<div class="ar-pads"><button class="btn ar-pad" type="button" data-ar-dir="-1" aria-label="Move left">←</button><button class="btn ar-pad" type="button" data-ar-dir="1" aria-label="Move right">→</button></div>',
    build(A) {
      A.world.innerHTML = '<div class="ar-frenzy-glow"></div><div class="ar-gapmark" hidden></div><div class="ar-boss" hidden>' + bossMarkup() + '</div><div class="ar-items"></div><div class="ar-catcher"></div><div class="ar-floor"></div>';
      itemsEl = A.world.querySelector('.ar-items'); catcherEl = A.world.querySelector('.ar-catcher');
      bossEl = A.world.querySelector('.ar-boss'); gapEl = A.world.querySelector('.ar-gapmark');
      A.mkPet(catcherEl);
      this.draw(A);
    },
    draw(A) {
      const g = A.g, { w, h } = A.size;
      catcherEl.style.transform = 'translate3d(' + f1(g.x * w) + 'px,0,0) translateX(-50%)';
      const seen = new Set();
      for (const it of g.items) {
        seen.add(it.id);
        let n = nodes.get(it.id);
        if (!n) { n = grab(it.kind); itemsEl.appendChild(n); nodes.set(it.id, n); }
        n.style.transform = 'translate3d(' + f1(it.x * w) + 'px,' + f1(it.y * h) + 'px,0) translate(-50%,-50%) rotate(' + Math.round(it.spin) + 'deg)';
      }
      for (const [id, n] of nodes) if (!seen.has(id)) { drop(n); nodes.delete(id); }
    },
    frame(A, dt) {
      const g = A.g, events = frenzyStep(g, dt), { w, h } = A.size;
      this.draw(A);
      const now = g.t < g.frenzyUntil;
      if (now !== frenzied) { frenzied = now; A.field.classList.toggle('frenzied', now); }
      // The catcher walks when it is going somewhere.
      const dir = g.dir || (g.target != null && Math.abs(g.target - g.x) > 0.012 ? Math.sign(g.target - g.x) * (g.mod?.mirror ? -1 : 1) : 0);
      const key = dir ? String(Math.sign(dir)) : '';
      if (key !== moving) { moving = key; A.puppet?.move(!!dir, dir || 1); }
      for (const e of events) {
        if (e.type === 'catch') {
          const y = FRENZY.catchY[0] + 0.03;
          A.fx.pop('+' + e.points + (e.mult > 1 ? ' ×' + e.mult : ''), e.x, y - 0.1, e.mult > 2 ? 'gold' : 'good');
          A.fx.burst(GOOD_PARTICLES[e.kind] || 'crumb', e.x, y, e.kind === 'heart' ? 1.5 : 1);
          A.sfx('combo', Math.min(14, e.combo), e.kind === 'heart' ? { priority: 'high' } : null);
          A.haptic(e.mult > 2 ? 'combo' : 'catch');
          A.react('catch');
        } else if (e.type === 'frenzy') {
          A.fx.banner('Heart!', 'Everything counts double for six seconds', 'gold', 1300);
          A.sfx('gold', 0, { priority: 'high' }); A.react('wiggle'); A.haptic('gold');
        } else if (e.type === 'hit') {
          A.fx.pop(pick(BAD_WORDS[e.kind] || ['Ow']), e.x, 0.7, 'bad');
          A.fx.burst(HIT_PARTICLES[e.kind] || 'spark', e.x, FRENZY.catchY[0] + 0.05, 1.3);
          A.fx.shake(1); A.fx.hitStop(60); A.fx.flash('hurt');
          A.sfx('hurt', 0, { priority: 'high' }); A.haptic(g.lives > 0 ? 'bad' : 'fatal'); A.react('bump');
        } else if (e.type === 'near' && performance.now() - lastNear > 900) {
          lastNear = performance.now();
          A.sfx('near'); A.haptic('tick'); A.react('shield');
          if (Math.random() < 0.5) A.fx.pop('Close', e.x, 0.66, 'soft');
        } else if (e.type === 'miss') {
          if (lastCombo >= 3) A.fx.pop('Dropped it', 0.5, 0.45, 'soft');
        } else if (e.type === 'row') {
          const lane = 1 / (e.boss ? FRENZY.bossLanes : FRENZY.lanes);
          gapEl.style.left = f1((e.x - lane * e.width * 0.5 - 0.02) * w) + 'px'; gapEl.style.width = f1((lane * e.width + 0.04) * w) + 'px';
          gapEl.hidden = false;
          gapEl.getAnimations?.().forEach(a => a.cancel());
          gapEl.animate?.([{ opacity: 0 }, { opacity: 0.55, offset: 0.2 }, { opacity: 0 }], { duration: 1500, easing: 'ease-out' });
          if (e.boss) { bossEl.classList.remove('throw'); void bossEl.offsetWidth; bossEl.classList.add('throw'); }
        } else if (e.type === 'wave') {
          const info = FRENZY_WAVES[e.kind];
          if (info) { A.fx.banner(info.name, info.line, e.boss ? 'bad' : 'good', e.boss ? 2200 : 1700); A.sfx(e.boss ? 'boss' : 'wave', 0, { priority: 'high' }); }
          bossOn = !!e.boss; bossEl.hidden = !bossOn; A.field.classList.toggle('boss', bossOn);
          if (e.boss) A.haptic('combo');
        } else if (e.type === 'boss-end') {
          bossOn = false; bossEl.hidden = true; A.field.classList.remove('boss');
          const line = pick(e.flawless ? FRENZY_BOSS_LINES.clean : FRENZY_BOSS_LINES.scuffed);
          A.fx.banner(e.flawless ? 'Flawless +' + e.bonus : 'Survived', line, e.flawless ? 'gold' : 'good', 2200);
          if (e.flawless) { A.sfx('gold', 0, { priority: 'high' }); A.react('win'); A.fx.burst('gold', 0.5, 0.45, 1.4); A.haptic('best'); }
        }
      }
      lastCombo = g.combo;
      const step = g.mod?.comboStep ?? FRENZY.comboStep, mult = frenzyMult(g) * (now ? 2 : 1);
      A.fx.combo({ label: now ? 'Frenzy' : 'Combo', count: g.combo, mult, progress: frenzyMult(g) >= FRENZY.comboCap ? 1 : (g.combo % step) / step, hot: now });
      A.fx.low(g.lives === 1 && g.maxLives > 1);
    },
    die(A) { bossEl.hidden = true; A.react('bump'); A.fx.burst('water', Math.max(0.1, Math.min(0.9, A.g.x)), 0.85, 1.6); },
    destroy() { nodes.clear(); pool.clear(); }
  };
}

/* ---------- Coffin Stack ---------- */
export const STACK_ROW = 0.075;
export function stackView() {
  let tower, mover, rider, sky, ground, placedEls = [], riderPuppet = null, lastStage = -1, shownHeights = new Set(), lastRiskyAt = 0;
  const VISIBLE_ROWS = 7;
  const coffinEl = (block, row, cls = '') => {
    const el = document.createElement('span');
    el.className = 'ar-coffin placed ' + cls;
    el.style.left = (block.x * 100) + '%'; el.style.width = (block.w * 100) + '%'; el.style.bottom = (row * STACK_ROW * 100) + '%';
    return el;
  };
  const lift = A => Math.max(0, A.g.stack.length - VISIBLE_ROWS);
  return {
    controls: () => '<div class="ar-pads"><button class="btn btn-primary ar-pad wide" type="button" data-ar="drop">Drop the coffin</button></div>',
    build(A) {
      A.world.innerHTML = '<div class="ar-tower"></div><div class="ar-mover"><span class="ar-coffin"></span></div><div class="ar-rider"></div>';
      tower = A.world.querySelector('.ar-tower'); mover = A.world.querySelector('.ar-mover'); rider = A.world.querySelector('.ar-rider');
      sky = A.field.querySelector('.ar-sky'); ground = A.field.querySelector('.ar-ground');
      A.mkPet(rider);
      placedEls = [];
      A.run.drawn = 0;
      this.draw(A, false);
    },
    draw(A, animate = true) {
      const g = A.g, { w, h } = A.size, up = lift(A);
      while (A.run.drawn < g.stack.length) {
        const i = A.run.drawn, el = coffinEl(g.stack[i], i, i === 0 ? 'base' : animate ? 'settle' : '');
        tower.appendChild(el); placedEls.push(el); A.run.drawn++;
      }
      // Rows far below the bottom edge can never be seen again.
      while (placedEls.length > VISIBLE_ROWS + 6 && A.run.drawn - placedEls.length < up - 2) { placedEls.shift().remove(); }
      const shift = 'translate3d(0,' + f1(up * STACK_ROW * h) + 'px,0)';
      tower.style.transform = shift;
      if (ground) ground.style.transform = shift;
      if (sky) sky.style.setProperty('--lift', String(Math.min(40, up)));
      const m = g.mover, topRow = g.stack.length - up;
      mover.style.width = (m.w * 100) + '%';
      mover.style.bottom = ((topRow + 1.6) * STACK_ROW * 100) + '%';
      mover.style.transform = 'translate3d(' + f1(m.x * w) + 'px,0,0)';
      mover.hidden = g.over;
      const top = g.stack[g.stack.length - 1];
      rider.style.transform = 'translate3d(' + f1((top.x + top.w / 2) * w) + 'px,' + f1(-(topRow * STACK_ROW * h)) + 'px,0) translateX(-50%)';
      const height = g.stack.length - 1, stage = height < 8 ? 0 : height < 16 ? 1 : height < 28 ? 2 : 3;
      if (sky && stage !== lastStage) { lastStage = stage; sky.dataset.stage = String(stage); }
    },
    frame(A, dt) {
      const g = A.g, events = stackStep(g, dt);
      const { w, h } = A.size;
      // Between drops only the mover moves.
      const m = g.mover;
      mover.style.transform = 'translate3d(' + f1(m.x * w) + 'px,0,0)';
      for (const e of events) if (e.type === 'autodrop') this.landed(A, e.result);
    },
    // A drop, by the player or by the undertaker's fuse.
    drop(A) {
      const g = A.g, before = { x: g.mover.x, w: g.mover.w, row: g.stack.length };
      const r = stackDrop(g);
      r.before = before;
      this.landed(A, r);
      return r;
    },
    landed(A, r) {
      const g = A.g, { w, h } = A.size;
      // A drop by the player records where it started; one by the undertaker's fuse is read back from the result.
      const before = r.before || { x: (r.fell || r.placed || g.mover).x, w: (r.fell || r.placed || g.mover).w, row: r.placed ? g.stack.length - 1 : g.stack.length };
      const up = Math.max(0, before.row - VISIBLE_ROWS);
      if (r.fell) {
        // The whole coffin misses and falls past the tower.
        const piece = document.createElement('span');
        piece.className = 'ar-coffin falling ' + (before.x + before.w / 2 < 0.5 ? 'left' : 'right') + ' whole';
        piece.style.left = (r.fell.x * 100) + '%'; piece.style.width = (r.fell.w * 100) + '%'; piece.style.bottom = ((before.row - up + 1.6) * STACK_ROW * 100) + '%';
        A.world.appendChild(piece); setTimeout(() => piece.remove(), 1100);
        placedEls.slice(-3).forEach((el, i) => { el.style.setProperty('--dx', ((i - 1) * 34 + (Math.random() - 0.5) * 18) + 'px'); el.style.setProperty('--rot', ((i - 1) * 26) + 'deg'); el.classList.add('tumble'); });
        mover.hidden = true;
        rider.classList.add('tumble');
        A.fx.burst('dust', r.fell.x + r.fell.w / 2, 0.8, 1.8); A.fx.burst('bone', r.fell.x + r.fell.w / 2, 0.7, 1.2);
        A.fx.shake(1.4); A.fx.hitStop(80); A.fx.flash('hurt');
        A.sfx('fell', 0, { priority: 'high' }); A.haptic('fatal'); A.react('bump');
        return;
      }
      if (r.over) return;
      this.draw(A);
      const topRow = g.stack.length - 1 - lift(A), cx = r.placed.x + r.placed.w / 2, y = 1 - (topRow + 1) * STACK_ROW;
      if (r.cut) {
        const piece = document.createElement('span');
        piece.className = 'ar-coffin falling ' + (r.cut.side < 0 ? 'left' : 'right');
        piece.style.left = (r.cut.x * 100) + '%'; piece.style.width = (r.cut.w * 100) + '%'; piece.style.bottom = ((topRow) * STACK_ROW * 100) + '%';
        A.world.appendChild(piece); setTimeout(() => piece.remove(), 950);
        A.fx.burst('dust', r.cut.x + r.cut.w / 2, y + 0.04, 0.7);
      }
      A.sfx('thunk');
      if (r.perfect) {
        placedEls.at(-1)?.classList.add('perfect');
        A.fx.pop(r.grew ? 'Perfect! It grew.' : 'Perfect +' + r.points, cx, Math.max(0.12, y - 0.12), 'gold');
        A.fx.burst('spark', cx, y, 1.2);
        A.sfx('perfect', r.streak); A.haptic(r.streak >= 3 ? 'combo' : 'perfect'); A.react(r.streak >= 3 ? 'win' : 'jump');
      } else {
        A.haptic('tap'); A.react('land');
        if (r.points === 0) A.fx.pop('Sloppy', cx, Math.max(0.12, y - 0.1), 'bad');
        if (r.risky && performance.now() - lastRiskyAt > 1200) {
          lastRiskyAt = performance.now();
          A.sfx('creak'); A.fx.pop('Creak…', cx, Math.max(0.12, y - 0.1), 'soft');
          tower.classList.remove('wobble'); void tower.offsetWidth; tower.classList.add('wobble');
        }
      }
      A.fx.combo({ label: 'Streak', count: g.streak, mult: Math.min(1 + g.streak, 5), progress: Math.min(1, g.streak / 4), hot: g.streak >= 3, min: 2 });
      const line = STACK_HEIGHT_LINES[r.height];
      if (line && !shownHeights.has(r.height)) { shownHeights.add(r.height); A.fx.banner(r.height + ' coffins', line, 'good', 1800); }
    },
    die(A) { A.fx.low(false); },
    destroy() { placedEls = []; }
  };
}

/* ---------- The Séance ---------- */
export function seanceView() {
  let circle, candles, sched = null, lit = -2, showAt = 0, mediumEl, wasShowing = false;
  const lightCandle = (pad, on) => { candles.forEach((el, i) => el.classList.toggle('lit', on && i === pad)); };
  return {
    controls: () => '',
    build(A) {
      A.world.innerHTML = '<div class="ar-circle">' + [0, 1, 2, 3].map(i => '<button class="ar-candle c' + i + '" type="button" data-pad="' + i + '" aria-label="' + SEANCE_NAMES[i] + ', key ' + (i + 1) + '"><span class="ar-flame"></span><span class="ar-wax"></span><small>' + (i + 1) + '</small></button>').join('') + '<div class="ar-medium"></div></div>';
      circle = A.world.querySelector('.ar-circle'); candles = [...A.world.querySelectorAll('.ar-candle')]; mediumEl = A.world.querySelector('.ar-medium');
      A.mkPet(mediumEl);
      A.run.showAt = 0; sched = null; lit = -2; wasShowing = false;
    },
    frame(A, dt) {
      const g = A.g;
      if (g.phase !== 'show') { wasShowing = false; return; }
      if (!wasShowing) {
        wasShowing = true; showAt = 0; sched = seanceSchedule(g); lit = -2;
        A.field.classList.add('listening');
        A.say(g.mod?.reverse ? 'The spirits are speaking… backwards.' : 'The spirits are speaking…');
        lightCandle(-1, false);
      }
      showAt += dt;
      if (showAt >= sched.end) {
        lightCandle(-1, false); seanceShown(g); wasShowing = false; lit = -2;
        A.field.classList.remove('listening');
        A.say(g.mod?.reverse ? 'Your turn. From the last candle, ' + g.seq.length + '.' : 'Your turn. ' + g.seq.length + (g.seq.length === 1 ? ' candle.' : ' candles.'));
        A.run.tapT = null;
        return;
      }
      let step = -1;
      for (let i = 0; i < sched.starts.length; i++) if (showAt >= sched.starts[i] && showAt < sched.starts[i] + sched.beat) { step = i; break; }
      if (step !== lit) {
        lit = step;
        if (step >= 0) { lightCandle(g.seq[step], true); A.sfx('candle', g.seq[step], { hold: sched.beat * 0.9 }); A.react('think'); A.fx.burst('soul', 0.5 + (g.seq[step] === 1 ? 0.33 : g.seq[step] === 3 ? -0.33 : 0), g.seq[step] === 0 ? 0.2 : g.seq[step] === 2 ? 0.75 : 0.45, 0.6); }
        else lightCandle(-1, false);
      }
    },
    press(A, pad) {
      const g = A.g, at = performance.now() / 1000;
      const r = seanceInput(g, pad, at);
      if (r.ignored) return null;
      const el = candles[pad];
      el.classList.add('lit'); setTimeout(() => el.classList.remove('lit'), 200);
      const xs = [0.5, 0.83, 0.5, 0.17], ys = [0.16, 0.49, 0.82, 0.49];
      if (r.ok) {
        A.sfx('candle', pad, { hold: 0.28 }); A.haptic('tap');
        if (r.off) { el.classList.add('off'); setTimeout(() => el.classList.remove('off'), 260); }
        if (r.round) {
          A.fx.pop(r.rhythm ? 'In time +' + r.bonus : 'The dead approve', 0.5, 0.12, r.rhythm ? 'gold' : 'good');
          if (r.rhythm) { A.sfx('chime', g.streak, { priority: 'high' }); A.fx.burst('gold', 0.5, 0.5, 0.8); A.haptic('perfect'); }
          else A.sfx('combo', Math.min(14, g.rounds));
          if (r.healed) { A.fx.pop('A mistake mended', 0.5, 0.24, 'gold'); A.sfx('gold', 0, { priority: 'high' }); }
          A.react('boop');
          A.say('Round ' + (g.rounds + 1) + '. Listen…');
          A.fx.combo({ label: 'In time', count: g.streak, mult: Math.min(g.streak, 3), progress: (g.streak % 3) / 3, hot: g.streak >= 3, min: 2 });
        }
      } else if (r.forgiven) {
        A.sfx('wrong', 0, { priority: 'high' }); A.fx.shake(0.8); A.fx.flash('hurt'); A.haptic('bad'); A.react('deny');
        A.fx.pop('Forgiven. Once.', 0.5, 0.12, 'bad');
        A.say(g.maxLives > 2 ? 'Wrong candle. ' + g.lives + ' mistakes left. Listen again.' : 'Wrong candle. The spirits forgive you once. Listen again.');
        A.fx.combo({ count: 0, min: 2 });
        A.fx.burst('soul', xs[pad], ys[pad], 0.8);
      } else {
        A.sfx('wrong', 0, { priority: 'high' }); A.fx.burst('soul', xs[pad], ys[pad], 1);
      }
      A.fx.low(g.lives === 1 && g.maxLives > 1);
      return r;
    },
    die(A) { A.react('deny'); lightCandle(-1, false); A.field.classList.remove('listening'); },
    destroy() {}
  };
}

/* ---------- Grave Whack ---------- */
const RISER = { hand: 'hand', mourner: 'veil', landlord: 'skull', gold: 'goldtooth', glove: 'glove' };
const LABEL = { hand: ': a hand', mourner: ': a mourner, leave her', landlord: ': the landlord, five points', gold: ': a gold tooth, eight points', glove: ': a stuffed glove, leave it' };
export function whackView() {
  let graves = [], lastRise = 0, lastCombo = 0;
  return {
    controls: () => '',
    build(A) {
      const blocked = A.g.mod?.blocked || [];
      A.world.innerHTML = '<div class="ar-overseer"><div class="ar-overseer-pet"></div><i class="ar-lantern"></i></div><div class="ar-yard">' + Array.from({ length: 9 }, (_, i) =>
        '<button class="ar-grave' + (blocked.includes(i) ? ' flooded' : '') + '" type="button" data-hole="' + i + '"' + (blocked.includes(i) ? ' aria-disabled="true" tabindex="-1"' : '') + ' aria-label="Grave ' + (i + 1) + (blocked.includes(i) ? ', flooded' : '') + '"><span class="ar-stone">' + arcadeGlyph('grave') + '</span><span class="ar-riser"></span><span class="ar-mound"></span></button>').join('') + '</div>';
      graves = [...A.world.querySelectorAll('.ar-grave')];
      A.mkPet(A.world.querySelector('.ar-overseer-pet'));
    },
    frame(A, dt) {
      const g = A.g, events = whackStep(g, dt);
      this.draw(A);
      for (const e of events) {
        if (e.type === 'rise') {
          if (performance.now() - lastRise > 260) { lastRise = performance.now(); A.sfx('creak'); }
        } else if (e.type === 'escape') {
          const [x, y] = this.at(e.hole);
          A.fx.pop('Escaped!', x, y, 'bad'); A.fx.burst('dust', x, y + 0.1, 1);
          A.fx.shake(1); A.fx.hitStop(60); A.fx.flash('hurt'); A.sfx('hurt', 0, { priority: 'high' }); A.haptic(g.lives > 0 ? 'bad' : 'fatal'); A.react('bump');
        } else if (e.type === 'wave') {
          const info = WHACK_WAVES[e.kind];
          if (info) { A.fx.banner(info.name, info.line, e.kind === 'funeral' ? 'bad' : e.kind === 'gold' ? 'gold' : 'good', 1800); A.sfx('wave', 0, { priority: 'high' }); }
        } else if (e.type === 'hop') {
          A.fx.burst('dust', ...this.at(e.to), 0.5);
        }
      }
      A.fx.low(g.lives === 1 && g.maxLives > 1);
    },
    at(i) { return [((i % 3) + 0.5) / 3, (Math.floor(i / 3) + 0.45) / 3.3]; },
    draw(A) {
      const g = A.g;
      graves.forEach((el, i) => {
        const hole = g.holes[i], kind = hole ? hole.kind : '';
        if (el.dataset.kind !== kind) {
          el.dataset.kind = kind;
          el.querySelector('.ar-riser').innerHTML = kind ? arcadeGlyph(RISER[kind]) : '';
          el.setAttribute('aria-label', 'Grave ' + (i + 1) + (kind ? LABEL[kind] : g.mod?.blocked?.includes(i) ? ', flooded' : ''));
          el.classList.remove('urgent');
        }
        el.classList.toggle('up', !!hole);
        // A hand about to get away starts to shake, so no escape is a surprise.
        const urgent = !!hole && (hole.kind === 'hand' || hole.kind === 'landlord') && hole.age > hole.life * 0.65;
        if (urgent !== el.classList.contains('urgent')) el.classList.toggle('urgent', urgent);
      });
    },
    hit(A, i) {
      const g = A.g, hole = g.holes[i], kindBefore = hole?.kind;
      const r = whackHit(g, i);
      if (r.ignored) return null;
      const el = graves[i], [x, y] = this.at(i);
      if (r.empty) { A.sfx('tick', 0); A.fx.combo({ count: 0 }); return r; }
      el.classList.add('bonk'); setTimeout(() => el.classList.remove('bonk'), 160);
      this.draw(A);
      if (r.widow) {
        A.fx.pop('That was the widow.', x, y, 'bad'); A.fx.burst('soul', x, y + 0.05, 1.2);
        A.fx.shake(1.2); A.fx.hitStop(70); A.fx.flash('hurt'); A.sfx('widow', 0, { priority: 'high' }); A.sfx('hurt', 0, { priority: 'high' }); A.haptic(g.over ? 'fatal' : 'bad'); A.react('bump');
      } else if (r.glove) {
        A.fx.pop('Just a glove.', x, y, 'soft'); A.fx.burst('dust', x, y + 0.05, 0.7); A.sfx('wrong', 0, null); A.haptic('tap'); A.react('shield');
      } else {
        A.fx.pop(r.kind === 'gold' ? 'Gold! +' + r.points : '+' + r.points + (r.mult > 1 ? ' ×' + r.mult : ''), x, y, r.kind === 'gold' || r.kind === 'landlord' ? 'gold' : 'good');
        A.fx.burst(r.kind === 'gold' ? 'gold' : r.kind === 'landlord' ? 'bone' : 'dust', x, y + 0.05, r.kind === 'gold' ? 1.4 : 0.9);
        if (r.kind === 'gold') { A.sfx('gold', 0, { priority: 'high' }); A.haptic('gold'); A.react('win'); if (r.healed) A.fx.pop('A skull back', x, Math.max(0.1, y - 0.12), 'gold'); }
        else { A.sfx('pop', Math.min(14, r.combo)); A.haptic(r.mult > 2 ? 'combo' : 'tap'); A.react('knock'); }
      }
      const step = g.mod?.comboStep ?? WHACK.comboStep;
      A.fx.combo({ label: 'Combo', count: g.combo, mult: g.combo ? Math.min(WHACK.comboCap, 1 + Math.floor(g.combo / step)) : 1, progress: g.combo >= step * (WHACK.comboCap - 1) ? 1 : (g.combo % step) / step, hot: g.combo >= step * 2 });
      lastCombo = g.combo;
      return r;
    },
    die(A) { A.fx.low(false); },
    destroy() { graves = []; }
  };
}

export const VIEWS = { frenzy: frenzyView, stack: stackView, seance: seanceView, whack: whackView };
