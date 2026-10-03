/* Small messages at the foot of the screen. They queue: two things that happen
   at once (a care line and a chore reward, a rank-up and a coffin) are both
   read, in order, instead of the second wiping the first. A message that is
   already showing or waiting is not repeated, and a lone message lasts as long
   as it always did. */

const MAX_QUEUE = 4;
const queue = [];
let showing = null, timer = null, shownAt = 0;
const el = () => (typeof document === 'undefined' ? null : document.getElementById('toast'));

// How long a message needs to be read, and how long it may stay on its own.
export const readTime = msg => Math.max(1800, Math.min(4200, String(msg).length * 38));
export const restTime = msg => Math.max(3200, Math.min(6500, String(msg).length * 48));

function clear() {
  const node = el();
  clearTimeout(timer);
  timer = null; showing = null;
  if (node) { node.classList.remove('show'); node.textContent = ''; }
}

function next() {
  clearTimeout(timer);
  const node = el();
  const msg = queue.shift();
  if (msg === undefined) { clear(); return; }
  showing = msg; shownAt = Date.now();
  if (node) { node.textContent = msg; node.classList.add('show'); }
  // With others waiting, a message gets only the time it needs to be read.
  timer = setTimeout(next, queue.length ? readTime(msg) : restTime(msg));
}

export function dismissToast() {
  queue.length = 0;
  clear();
}

export function toast(msg) {
  const text = String(msg ?? '');
  if (!text) return;
  if (showing === text) {
    // The same line again: keep it on screen a little longer instead of stacking it.
    clearTimeout(timer);
    timer = setTimeout(next, queue.length ? readTime(text) : restTime(text));
    return;
  }
  if (queue.includes(text)) return;
  if (showing === null) { queue.push(text); next(); return; }
  if (queue.length >= MAX_QUEUE) queue.shift();
  queue.push(text);
  // Something is waiting now. If the current message has been up long enough
  // to read, move on rather than holding the queue for its full rest time.
  const elapsed = Date.now() - shownAt, need = readTime(showing);
  clearTimeout(timer);
  timer = setTimeout(next, Math.max(0, need - elapsed));
}

// A tap on the message sends it away early.
if (typeof document !== 'undefined') document.getElementById('toast')?.addEventListener('click', () => { if (showing !== null) next(); });

/* ---- small chips that float up from the thing that earned them ---------------
   "+4 souls" over the card, "+1 trust" over the resident. They are decoration for
   a result the player can already read in the text, so they are skipped when
   motion is reduced and never trap focus. */
export function floatChip(host, text, tone = 'souls') {
  if (!host || !text || typeof document === 'undefined') return null;
  const chip = document.createElement('span');
  chip.className = 'earn-chip earn-' + tone;
  chip.textContent = text;
  chip.setAttribute('aria-hidden', 'true');
  host.appendChild(chip);
  setTimeout(() => chip.remove(), 1700);
  return chip;
}
